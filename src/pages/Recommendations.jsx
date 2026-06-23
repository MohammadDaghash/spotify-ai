// src/pages/Recommendations.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import AdminGateModal from "../components/AdminGateModal.jsx";
import RankMovementBadge from "../components/RankMovementBadge.jsx";

import { useSpotifyContext } from "../context/SpotifyContext.jsx";

import { candidateTracks } from "../data/demoMusicData.js";
import {
  getArtistRecommendations,
  getTrackRecommendations,
  getTripPlaylists,
} from "../services/mlApi.js";
import { isAdmin } from "../utils/adminAuth.js";
import { buildDynamicUserProfile } from "../utils/featureEngineering.js";
import { hasSpotifyAccessToken } from "../utils/spotifySession.js";
import { addRankMovementToRows } from "../utils/rankMovement.js";
import {
  getVisibleArtistRecommendations,
  getVisibleSongRecommendations,
} from "../utils/recommendationLists.js";
import { normalizeTopbarSearchText } from "../utils/topbarSearch.js";

const ARTIST_RECOMMENDATION_RANKING_KEY =
  "spotify_ai_previous_artist_recommendation_ranking";
const SONG_RECOMMENDATION_RANKING_KEY =
  "spotify_ai_previous_song_recommendation_ranking";

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#181818] rounded-lg p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
        {title}
      </p>
      <h3 className="mt-3 text-3xl font-bold">{value}</h3>
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function getNumericScore(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatScore(value) {
  const numericValue = getNumericScore(value);

  if (numericValue === null) return "—";

  return `${Math.round(numericValue * 100)}%`;
}

function ScoreBar({ label, value, tone = "green" }) {
  const numericValue = getNumericScore(value);
  const width = numericValue === null ? 0 : Math.min(100, Math.max(0, numericValue * 100));
  const toneClass =
    tone === "red"
      ? "bg-red-400"
      : tone === "blue"
        ? "bg-sky-400"
        : tone === "amber"
          ? "bg-amber-300"
          : "bg-[#1db954]";

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-xs mb-1">
        <span className="text-gray-400 truncate">{label}</span>
        <span className="text-gray-300 shrink-0">{formatScore(value)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`${toneClass} h-full rounded-full`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ModelBreakdown({ signals }) {
  const visibleSignals = signals.filter(
    (signal) => getNumericScore(signal.value) !== null,
  );

  if (visibleSignals.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
      {visibleSignals.map((signal) => (
        <ScoreBar
          key={signal.label}
          label={signal.label}
          value={signal.value}
          tone={signal.tone}
        />
      ))}
    </div>
  );
}

function getSpotifySearchUrl(query) {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

function getTrackHistoryKey(trackName, artistName) {
  return `${trackName || ""}::${artistName || ""}`.toLowerCase();
}

function getSpotifyTrackKey(track) {
  return getTrackHistoryKey(track?.name, track?.artists?.[0]?.name);
}

function getStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function storeRankingRows(key, rows) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        rows.map((row, index) => ({
          ...row,
          rank: Number(row.rank || index + 1),
        })),
      ),
    );
  } catch {
    // Local ranking history is optional. Ignore storage failures.
  }
}

function getStoredGroupMembers() {
  try {
    return JSON.parse(
      localStorage.getItem("spotify_ai_group_members") ||
        localStorage.getItem("spotify_ai_trip_members") ||
        "[]",
    );
  } catch {
    return [];
  }
}

function applyWeightDelta(weights, key, delta) {
  if (!key) return;
  weights[key] = Math.max(0, (weights[key] || 0) + delta);
}

function getTopWeights(weights, limit = 3) {
  return Object.entries(weights || {})
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([name, weight]) => ({
      name,
      weight: Number(weight.toFixed(2)),
    }));
}

function recommendationMatchesSearch(item, query) {
  const normalizedQuery = normalizeTopbarSearchText(query);

  if (!normalizedQuery) return true;

  const itemText = normalizeTopbarSearchText(
    [
      item.artist,
      item.artist_name,
      item.artistName,
      item.track_name,
      item.trackName,
      item.name,
      item.reason,
      item.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => itemText.includes(token));
}

function filterTripPlaylistsForSearch(playlists, query) {
  if (!playlists || !query) return playlists;

  return Object.fromEntries(
    Object.entries(playlists)
      .map(([playlistKey, playlist]) => {
        const playlistMatches = recommendationMatchesSearch(
          {
            name: playlist.name,
            description: playlist.description,
          },
          query,
        );
        const tracks = playlistMatches
          ? playlist.tracks
          : playlist.tracks.filter((track) =>
              recommendationMatchesSearch(track, query),
            );

        return [
          playlistKey,
          {
            ...playlist,
            tracks,
          },
        ];
      })
      .filter(([, playlist]) => playlist.tracks.length > 0),
  );
}

function addRelativeMatchScores(recommendations) {
  if (recommendations.length === 0) return [];

  const scores = recommendations.map((rec) => rec.score || 0);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  return recommendations.map((rec, index) => {
    let relativeMatch = 100;

    if (maxScore !== minScore) {
      relativeMatch =
        60 + ((rec.score - minScore) / (maxScore - minScore)) * 40;
    } else if (index > 0) {
      relativeMatch = 90;
    }

    return {
      ...rec,
      relativeMatch: Math.round(relativeMatch),
    };
  });
}

function calculateDiscoveryMetrics({
  recommendations,
  visibleRecommendations,
  eligibleRecommendations,
  k = 3,
}) {
  const topK = visibleRecommendations.slice(0, k);
  const relevantTopK = topK.filter(
    (track) => track.historyPlayCount < 10 && !track.liveKnownReason,
  );
  const uniqueVisibleArtists = new Set(
    visibleRecommendations.map((track) => track.artistName),
  );

  return {
    precisionAtK:
      topK.length === 0
        ? 0
        : Number((relevantTopK.length / topK.length).toFixed(2)),
    hitAtK: relevantTopK.length > 0 ? 1 : 0,
    catalogCoverage:
      recommendations.length === 0
        ? 0
        : Number(
            (eligibleRecommendations.length / recommendations.length).toFixed(
              2,
            ),
          ),
    artistDiversity:
      visibleRecommendations.length === 0
        ? 0
        : Number(
            (
              uniqueVisibleArtists.size / visibleRecommendations.length
            ).toFixed(2),
          ),
  };
}

function Recommendations() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    playlists = [],
    getFollowedArtists,
    getLiveListeningSignals,
    createPrivatePlaylistFromTracks,
  } = useSpotifyContext();

  const visibleRecommendationCount = 5;
  const maxRecommendedTrackPlays = 10;
  const [ignoredSongs, setIgnoredSongs] = useState(() =>
    getStoredList("spotify_ai_ignored_songs"),
  );
  const [likedSongs, setLikedSongs] = useState(() =>
    getStoredList("spotify_ai_liked_songs"),
  );
  const [savedSongs, setSavedSongs] = useState(() =>
    getStoredList("spotify_ai_saved_song_recommendations"),
  );
  const [userTasteProfile, setUserTasteProfile] = useState(
    buildDynamicUserProfile(candidateTracks),
  );

  const [artistRecommendations, setArtistRecommendations] = useState([]);
  const [trackRecommendations, setTrackRecommendations] = useState([]);
  const [tripPlaylists, setTripPlaylists] = useState(null);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [ignoredArtists, setIgnoredArtists] = useState(() =>
    getStoredList("spotify_ai_ignored_artists"),
  );
  const [likedArtists, setLikedArtists] = useState(() =>
    getStoredList("spotify_ai_liked_artists"),
  );
  const [savedArtists, setSavedArtists] = useState(() =>
    getStoredList("spotify_ai_saved_artist_recommendations"),
  );
  const [liveKnownTrackSignals, setLiveKnownTrackSignals] = useState(new Map());
  const [liveTasteArtistWeights, setLiveTasteArtistWeights] = useState({});
  const [creatingPlaylistKey, setCreatingPlaylistKey] = useState("");
  const [mlError, setMlError] = useState("");
  const [mlLoading, setMlLoading] = useState(false);
  const [adminGate, setAdminGate] = useState({
    isOpen: false,
    actionLabel: "",
    action: null,
  });
  const recommendationSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const recommendationSearchQuery =
    recommendationSearchParams.get("search")?.trim() || "";
  const recommendationSearchType = recommendationSearchParams.get("type") || "";
  const activeRecommendationSearchType = ["song", "artist"].includes(
    recommendationSearchType,
  )
    ? recommendationSearchType
    : "";
  const isRecommendationSearchActive = Boolean(recommendationSearchQuery);

  const runAdminAction = (actionLabel, action) => {
    if (isAdmin()) {
      action();
      return;
    }

    setAdminGate({
      isOpen: true,
      actionLabel,
      action,
    });
  };

  const closeAdminGate = () => {
    setAdminGate({
      isOpen: false,
      actionLabel: "",
      action: null,
    });
  };

  const approveAdminGate = () => {
    adminGate.action?.();
    closeAdminGate();
  };

  const applyTrackFeedback = (track, sentiment) => {
    const isLike = sentiment === "like";
    const delta = isLike ? 0.2 : -0.15;

    if (isLike) {
      setLikedSongs((prev) => [...new Set([...prev, track.trackName])]);
    } else {
      setIgnoredSongs((prev) => [...new Set([...prev, track.trackName])]);
    }

    setUserTasteProfile((prevProfile) => {
      const nextGenreWeights = {
        ...prevProfile.genreWeights,
      };
      const nextMoodWeights = {
        ...prevProfile.moodWeights,
      };
      const nextArtistWeights = {
        ...prevProfile.artistWeights,
      };

      for (const genre of track.genres || []) {
        applyWeightDelta(nextGenreWeights, genre, delta);
      }

      for (const mood of track.moods || []) {
        applyWeightDelta(nextMoodWeights, mood, delta);
      }

      applyWeightDelta(nextArtistWeights, track.artistName, delta);

      return {
        ...prevProfile,
        genreWeights: nextGenreWeights,
        moodWeights: nextMoodWeights,
        artistWeights: nextArtistWeights,
      };
    });
  };

  const createTripPlaylist = async (playlistKey, playlist) => {
    const spotifyWindow = window.open("", "_blank", "noreferrer");

    if (spotifyWindow) {
      spotifyWindow.document.write(
        "<p style='font-family: system-ui; padding: 24px;'>Creating Spotify playlist...</p>",
      );
    }

    try {
      setCreatingPlaylistKey(playlistKey);
      setMlError("");

      const spotifyUrl = await createPrivatePlaylistFromTracks?.({
        name: playlist.name,
        description: playlist.description,
        tracks: playlist.tracks,
      });

      if (spotifyUrl) {
        if (spotifyWindow) {
          spotifyWindow.location.href = spotifyUrl;
        } else {
          window.location.assign(spotifyUrl);
        }
      } else {
        if (spotifyWindow) {
          spotifyWindow.close();
        }

        setMlError("Spotify created the playlist but did not return a URL.");
      }
    } catch (error) {
      console.error(error);
      if (spotifyWindow) {
        spotifyWindow.close();
      }
      setMlError("Could not create Spotify playlist. Try logging in again.");
    } finally {
      setCreatingPlaylistKey("");
    }
  };

  useEffect(() => {
    localStorage.setItem("spotify_ai_liked_songs", JSON.stringify(likedSongs));
  }, [likedSongs]);

  useEffect(() => {
    localStorage.setItem(
      "spotify_ai_saved_song_recommendations",
      JSON.stringify(savedSongs),
    );
  }, [savedSongs]);

  useEffect(() => {
    localStorage.setItem(
      "spotify_ai_ignored_songs",
      JSON.stringify(ignoredSongs),
    );
  }, [ignoredSongs]);

  useEffect(() => {
    localStorage.setItem(
      "spotify_ai_liked_artists",
      JSON.stringify(likedArtists),
    );
  }, [likedArtists]);

  useEffect(() => {
    localStorage.setItem(
      "spotify_ai_saved_artist_recommendations",
      JSON.stringify(savedArtists),
    );
  }, [savedArtists]);

  useEffect(() => {
    localStorage.setItem(
      "spotify_ai_ignored_artists",
      JSON.stringify(ignoredArtists),
    );
  }, [ignoredArtists]);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadRecommendations() {
      try {
        setMlLoading(true);
        setMlError("");

        const groupMembers = getStoredGroupMembers();
        const surveyLikedArtists = [
          ...new Set(groupMembers.flatMap((member) => member.likedArtists || [])),
        ];
        const surveyIgnoredArtists = [
          ...new Set(
            groupMembers.flatMap((member) => member.ignoredArtists || []),
          ),
        ];

        const [
          artistRecommendationsData,
          trackRecommendationsData,
          tripPlaylistsData,
        ] =
          await Promise.all([
            getArtistRecommendations({
              topN: 50,
            }),
            getTrackRecommendations({
              topN: 30,
              maxPlayCount: maxRecommendedTrackPlays,
              likedTracks: likedSongs,
              ignoredTracks: ignoredSongs,
            }),
            getTripPlaylists({
              limit: 25,
              newSongMaxPlays: 5,
              surveyLikedArtists,
              surveyIgnoredArtists,
            }),
          ]);

        const canUseSpotifyApi = hasSpotifyAccessToken();
        let followed = [];

        if (canUseSpotifyApi && typeof getFollowedArtists === "function") {
          followed = await getFollowedArtists();
        }

        let liveKnownTracks = new Map();

        if (canUseSpotifyApi && typeof getLiveListeningSignals === "function") {
          const liveSignals = await getLiveListeningSignals();
          const nextLiveTasteArtistWeights = {};

          const addLiveSignal = (track, reason) => {
            const key = getSpotifyTrackKey(track);
            if (!key || key === "::") return;
            liveKnownTracks.set(key, reason);
          };

          const boostLiveArtist = (track, amount) => {
            const artistName = track?.artists?.[0]?.name;
            if (!artistName) return;
            nextLiveTasteArtistWeights[artistName] =
              (nextLiveTasteArtistWeights[artistName] || 0) + amount;
          };

          for (const track of liveSignals.savedTracks || []) {
            addLiveSignal(track, "saved in Spotify");
          }

          for (const track of liveSignals.recentlyPlayedTracks || []) {
            addLiveSignal(track, "recently played on Spotify");
            boostLiveArtist(track, 0.08);
          }

          for (const track of liveSignals.topTracks || []) {
            addLiveSignal(track, "current Spotify top track");
            boostLiveArtist(track, 0.04);
          }

          if (isCurrentRequest) {
            setLiveTasteArtistWeights(nextLiveTasteArtistWeights);
          }
        }

        if (isCurrentRequest) {
          setArtistRecommendations(
            artistRecommendationsData.recommendations || [],
          );
          setTrackRecommendations(
            trackRecommendationsData.recommendations || [],
          );
          setTripPlaylists(tripPlaylistsData.playlists || null);
          setFollowedArtists(followed || []);
          setLiveKnownTrackSignals(liveKnownTracks);
        }
      } catch (error) {
        if (isCurrentRequest) {
          console.error(error);
          setMlError(error.message);
        }
      } finally {
        if (isCurrentRequest) {
          setMlLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      isCurrentRequest = false;
    };
  }, [
    getFollowedArtists,
    getLiveListeningSignals,
    likedArtists,
    ignoredArtists,
    likedSongs,
    ignoredSongs,
    maxRecommendedTrackPlays,
  ]);

  const filteredArtistRecommendations = useMemo(() => {
    return getVisibleArtistRecommendations({
      recommendations: artistRecommendations,
      likedArtists,
      ignoredArtists,
      followedArtists,
      limit: visibleRecommendationCount,
    });
  }, [artistRecommendations, followedArtists, ignoredArtists, likedArtists]);

  const visibleArtistRecommendations = filteredArtistRecommendations;

  const visibleArtistRecommendationsWithDisplayScores = useMemo(() => {
    const currentRows = addRelativeMatchScores(visibleArtistRecommendations).map(
      (artist, index) => ({
        ...artist,
        rank: index + 1,
      }),
    );

    return addRankMovementToRows(
      currentRows,
      getStoredList(ARTIST_RECOMMENDATION_RANKING_KEY),
      ["artist"],
    );
  }, [visibleArtistRecommendations]);

  const displayedArtistRecommendationsWithDisplayScores = useMemo(() => {
    if (!isRecommendationSearchActive) {
      return visibleArtistRecommendationsWithDisplayScores;
    }

    if (
      activeRecommendationSearchType &&
      activeRecommendationSearchType !== "artist"
    ) {
      return [];
    }

    return visibleArtistRecommendationsWithDisplayScores.filter((artist) =>
      recommendationMatchesSearch(artist, recommendationSearchQuery),
    );
  }, [
    activeRecommendationSearchType,
    isRecommendationSearchActive,
    recommendationSearchQuery,
    visibleArtistRecommendationsWithDisplayScores,
  ]);

  useEffect(() => {
    storeRankingRows(
      ARTIST_RECOMMENDATION_RANKING_KEY,
      visibleArtistRecommendations.map((artist, index) => ({
        artist: artist.artist,
        rank: index + 1,
      })),
    );
  }, [visibleArtistRecommendations]);

  const effectiveUserTasteProfile = useMemo(() => {
    return {
      ...userTasteProfile,
      artistWeights: {
        ...userTasteProfile.artistWeights,
        ...Object.fromEntries(
          Object.entries(liveTasteArtistWeights).map(([artist, weight]) => [
            artist,
            (userTasteProfile.artistWeights?.[artist] || 0) + weight,
          ]),
        ),
      },
    };
  }, [userTasteProfile, liveTasteArtistWeights]);

  const recommendationsWithPlayCounts = useMemo(() => {
    return trackRecommendations.map((track) => {
      const trackName = track.track_name;
      const artistName = track.artist_name;

      return {
        ...track,
        trackName,
        artistName,
        similarityScore: track.similarity_score,
        rawSimilarityScore: track.raw_similarity_score,
        qualityScore: track.quality_score,
        confidence: track.confidence,
        recencyScore: track.recency_score,
        diversityPenalty: track.diversity_penalty,
        knownTrackPenalty: track.known_track_penalty,
        recentListenStrength: track.recent_listen_strength,
        historyPlayCount: track.streams || 0,
        liveKnownReason:
          liveKnownTrackSignals.get(
            getTrackHistoryKey(trackName, artistName),
          ) || "",
      };
    });
  }, [trackRecommendations, liveKnownTrackSignals]);

  const eligibleSongRecommendations = useMemo(() => {
    return getVisibleSongRecommendations({
      recommendations: recommendationsWithPlayCounts,
      maxPlayCount: maxRecommendedTrackPlays,
      limit: recommendationsWithPlayCounts.length,
    });
  }, [recommendationsWithPlayCounts, maxRecommendedTrackPlays]);

  const rankedRecommendations = useMemo(() => {
    return getVisibleSongRecommendations({
      recommendations: eligibleSongRecommendations,
      likedSongs,
      ignoredSongs,
      maxPlayCount: maxRecommendedTrackPlays,
      limit: visibleRecommendationCount,
    });
  }, [
    eligibleSongRecommendations,
    ignoredSongs,
    likedSongs,
    maxRecommendedTrackPlays,
  ]);

  const visibleSongRecommendations = rankedRecommendations;

  const visibleSongRecommendationsWithDisplayScores = useMemo(() => {
    const currentRows = addRelativeMatchScores(visibleSongRecommendations).map(
      (track, index) => ({
        ...track,
        rank: index + 1,
      }),
    );

    return addRankMovementToRows(
      currentRows,
      getStoredList(SONG_RECOMMENDATION_RANKING_KEY),
      ["trackName", "artistName"],
    );
  }, [visibleSongRecommendations]);

  const displayedSongRecommendationsWithDisplayScores = useMemo(() => {
    if (!isRecommendationSearchActive) {
      return visibleSongRecommendationsWithDisplayScores;
    }

    if (
      activeRecommendationSearchType &&
      activeRecommendationSearchType !== "song"
    ) {
      return [];
    }

    return visibleSongRecommendationsWithDisplayScores.filter((track) =>
      recommendationMatchesSearch(track, recommendationSearchQuery),
    );
  }, [
    activeRecommendationSearchType,
    isRecommendationSearchActive,
    recommendationSearchQuery,
    visibleSongRecommendationsWithDisplayScores,
  ]);

  useEffect(() => {
    storeRankingRows(
      SONG_RECOMMENDATION_RANKING_KEY,
      visibleSongRecommendations.map((track, index) => ({
        trackName: track.trackName,
        artistName: track.artistName,
        rank: index + 1,
      })),
    );
  }, [visibleSongRecommendations]);

  const evaluationMetrics = calculateDiscoveryMetrics({
    recommendations: recommendationsWithPlayCounts,
    visibleRecommendations: visibleSongRecommendationsWithDisplayScores,
    eligibleRecommendations: eligibleSongRecommendations,
    k: 3,
  });

  const feedbackAnalytics = useMemo(() => {
    const liveSignalCount = liveKnownTrackSignals.size;
    const topBoostedArtists = getTopWeights(
      effectiveUserTasteProfile.artistWeights,
      4,
    );
    const topGenres = getTopWeights(effectiveUserTasteProfile.genreWeights, 4);
    const topMoods = getTopWeights(effectiveUserTasteProfile.moodWeights, 4);
    const totalFeedback =
      likedSongs.length +
      ignoredSongs.length +
      likedArtists.length +
      ignoredArtists.length;
    const positiveFeedback = likedSongs.length + likedArtists.length;

    return {
      liveSignalCount,
      topBoostedArtists,
      topGenres,
      topMoods,
      totalFeedback,
      acceptanceRate:
        totalFeedback === 0
          ? "0%"
          : `${Math.round((positiveFeedback / totalFeedback) * 100)}%`,
    };
  }, [
    likedSongs,
    ignoredSongs,
    likedArtists,
    ignoredArtists,
    liveKnownTrackSignals,
    effectiveUserTasteProfile,
  ]);

  const displayedTripPlaylists = useMemo(
    () =>
      isRecommendationSearchActive
        ? filterTripPlaylistsForSearch(tripPlaylists, recommendationSearchQuery)
        : tripPlaylists,
    [isRecommendationSearchActive, recommendationSearchQuery, tripPlaylists],
  );

  const hasDisplayedTripPlaylistTracks = Object.values(
    displayedTripPlaylists || {},
  ).some((playlist) => playlist.tracks.length > 0);
  const hasRecommendationSearchResults =
    displayedArtistRecommendationsWithDisplayScores.length > 0 ||
    displayedSongRecommendationsWithDisplayScores.length > 0 ||
    hasDisplayedTripPlaylistTracks;

  const clearRecommendationSearch = () => {
    navigate("/recommendations");
  };

  return (
    <div className="app-shell h-screen bg-black flex flex-col">
      <AdminGateModal
        actionLabel={adminGate.actionLabel}
        isOpen={adminGate.isOpen}
        message="Admin login required for editing recommendations."
        onApproved={approveAdminGate}
        onClose={closeAdminGate}
      />

      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="fade-in p-6 text-white overflow-y-auto h-full">
            <div className="premium-hero mb-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#1db954]">
                Discovery engine
              </p>
              <h1 className="page-title text-4xl font-bold md:text-5xl">
                Recommendations
              </h1>

              <p className="page-subtitle mt-3 max-w-4xl text-sm leading-relaxed md:text-base">
                Hybrid recommendation engine using vector similarity, artist
                affinity, popularity, recency, and user feedback.
              </p>
            </div>

            {isRecommendationSearchActive && (
              <div className="mb-6 flex flex-col gap-3 rounded-lg border border-sky-400/20 bg-sky-400/10 p-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-sky-100">
                  Showing recommendation results for{" "}
                  <span className="font-semibold">
                    “{recommendationSearchQuery}”
                  </span>
                  {activeRecommendationSearchType
                    ? ` in ${activeRecommendationSearchType}s`
                    : ""}
                  .
                </p>

                <button
                  className="self-start rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition hover:scale-[1.02] md:self-auto"
                  onClick={clearRecommendationSearch}
                  type="button"
                >
                  Clear search
                </button>
              </div>
            )}

            {isRecommendationSearchActive && !hasRecommendationSearchResults && (
              <div className="mb-6 rounded-lg border border-white/10 bg-[#181818] p-6 text-sm text-gray-400">
                No results found
              </div>
            )}

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Recommended Artists</h2>

              {mlLoading && (
                <p className="text-sm text-gray-400">
                  Loading ML artist recommendations...
                </p>
              )}

              {mlError && (
                <p className="text-sm text-red-400">Backend error: {mlError}</p>
              )}

              {!mlLoading &&
                !mlError &&
                displayedArtistRecommendationsWithDisplayScores.length === 0 && (
                  <p className="text-sm text-gray-400">
                    {isRecommendationSearchActive
                      ? "No results found"
                      : "No new artist recommendations found."}
                  </p>
                )}

              <div className="space-y-3">
                {displayedArtistRecommendationsWithDisplayScores.map((artist, index) => (
                  <div
                    key={artist.artist}
                    className="music-table-row flex items-center justify-between gap-4 border-b border-white/10 p-3"
                  >
                    <div>
                      <p className="font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span>#{index + 1}</span>
                          <RankMovementBadge row={artist} />
                          <span>{artist.artist}</span>
                        </span>
                      </p>

                      <p className="text-sm text-gray-400">
                        Relative match: {artist.relativeMatch}%
                      </p>

                      <ModelBreakdown
                        signals={[
                          {
                            label: "Model score",
                            value: artist.score,
                          },
                          {
                            label: "Similarity",
                            value: artist.similarity_score,
                            tone: "blue",
                          },
                          {
                            label: "Quality",
                            value: artist.quality_score,
                          },
                          {
                            label: "Confidence",
                            value: artist.confidence,
                            tone: "amber",
                          },
                          {
                            label: "Recency",
                            value: artist.recency_score,
                            tone: "blue",
                          },
                          {
                            label: "Known penalty",
                            value: artist.known_artist_penalty,
                            tone: "red",
                          },
                        ]}
                      />

                      {artist.raw_similarity_score !== undefined && (
                        <p className="text-xs text-gray-600 mt-2">
                          Raw cosine: {artist.raw_similarity_score}
                        </p>
                      )}

                      <p className="text-sm text-gray-500">{artist.reason}</p>
                    </div>

                    <div className="text-right text-sm text-gray-400">
                      <p>{artist.streams.toLocaleString()} streams</p>
                      <p>{artist.minutes.toLocaleString()} min</p>
                      <p>{Math.round(artist.skip_rate * 100)}% skip rate</p>

                      <div className="flex flex-wrap justify-end gap-2 mt-3">
                        <a
                          href={getSpotifySearchUrl(artist.artist)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#1db954] text-black text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          Open Spotify
                        </a>

                        <button
                          onClick={() =>
                            runAdminAction(`save ${artist.artist}`, () =>
                              setSavedArtists((prev) => [
                                ...new Set([...prev, artist.artist]),
                              ]),
                            )
                          }
                          disabled={savedArtists.includes(artist.artist)}
                          className="bg-[#3b82f6] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          {savedArtists.includes(artist.artist)
                            ? "Saved"
                            : "Save"}
                        </button>

                        <button
                          onClick={() =>
                            runAdminAction(`mark ${artist.artist} as liked`, () =>
                              setLikedArtists((prev) => [
                                ...new Set([...prev, artist.artist]),
                              ]),
                            )
                          }
                          className="bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          Liked
                        </button>

                        <button
                          onClick={() =>
                            runAdminAction(`ignore ${artist.artist}`, () =>
                              setIgnoredArtists((prev) => [
                                ...new Set([...prev, artist.artist]),
                              ]),
                            )
                          }
                          className="bg-[#2a2a2a] text-white text-xs px-3 py-1.5 rounded-full"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Precision@3"
                value={evaluationMetrics.precisionAtK}
                subtitle="Top 3 under 10 plays"
              />
              <StatCard
                title="Hit@3"
                value={evaluationMetrics.hitAtK}
                subtitle="At least one discovery in top 3"
              />
              <StatCard
                title="Catalog coverage"
                value={evaluationMetrics.catalogCoverage}
                subtitle="Candidate songs eligible"
              />
              <StatCard
                title="Artist diversity"
                value={evaluationMetrics.artistDiversity}
                subtitle="Unique artists in visible songs"
              />
            </section>

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold">Feedback analytics</h2>
                <p className="text-sm text-gray-400">
                  Acceptance rate: {feedbackAnalytics.acceptanceRate}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
                <StatCard
                  title="Liked songs"
                  value={likedSongs.length}
                  subtitle="Boost artist, genre, and mood"
                />
                <StatCard
                  title="Ignored songs"
                  value={ignoredSongs.length}
                  subtitle="Penalize artist, genre, and mood"
                />
                <StatCard
                  title="Liked artists"
                  value={likedArtists.length}
                  subtitle="Sent to Python user vector"
                />
                <StatCard
                  title="Ignored artists"
                  value={ignoredArtists.length}
                  subtitle="Excluded from Python results"
                />
                <StatCard
                  title="Live signals"
                  value={feedbackAnalytics.liveSignalCount}
                  subtitle="Saved, recent, and top Spotify tracks"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-semibold mb-2">
                    Top boosted artists
                  </p>
                  <div className="space-y-1 text-sm text-gray-400">
                    {feedbackAnalytics.topBoostedArtists.map((item) => (
                      <p key={item.name}>
                        {item.name}: {item.weight}
                      </p>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">
                    Top genre weights
                  </p>
                  <div className="space-y-1 text-sm text-gray-400">
                    {feedbackAnalytics.topGenres.map((item) => (
                      <p key={item.name}>
                        {item.name}: {item.weight}
                      </p>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">
                    Top mood weights
                  </p>
                  <div className="space-y-1 text-sm text-gray-400">
                    {feedbackAnalytics.topMoods.map((item) => (
                      <p key={item.name}>
                        {item.name}: {item.weight}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {displayedTripPlaylists && hasDisplayedTripPlaylistTracks && (
              <section className="bg-[#181818] rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Group playlists</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Three playlist strategies for group listening.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(displayedTripPlaylists).map(([playlistKey, playlist]) => (
                    <div
                      key={playlistKey}
                      className="bg-[#121212] rounded-lg p-4 border border-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{playlist.name}</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {playlist.description}
                          </p>
                        </div>

                        <span className="text-sm text-gray-400">
                          {playlist.tracks.length}
                        </span>
                      </div>

                      <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                        {playlist.tracks.slice(0, 8).map((track, index) => (
                          <div
                            key={`${playlistKey}-${track.track_name}-${track.artist_name}`}
                            className="text-sm"
                          >
                            <p className="font-semibold">
                              #{index + 1} {track.track_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {track.artist_name} • {track.streams} plays •{" "}
                              {track.recent_7d_streams || 0} this week
                            </p>
                            <p className="text-xs text-gray-500">
                              Group score: {track.group_score}
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() =>
                          runAdminAction(`create ${playlist.name} in Spotify`, () =>
                            createTripPlaylist(playlistKey, playlist),
                          )
                        }
                        disabled={
                          creatingPlaylistKey === playlistKey ||
                          playlist.tracks.length === 0
                        }
                        className="bg-[#1db954] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-black text-sm font-semibold px-3 py-2 rounded-full w-full mt-4"
                      >
                        {creatingPlaylistKey === playlistKey
                          ? "Creating..."
                          : "Create in Spotify"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <h2 className="text-xl font-bold mb-4">Recommended songs</h2>

            {displayedSongRecommendationsWithDisplayScores.length === 0 && (
              <p className="mb-4 text-sm text-gray-400">
                {isRecommendationSearchActive
                  ? "No results found"
                  : "No new song recommendations found."}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedSongRecommendationsWithDisplayScores.map((rec) => (
                <div
                  key={`${rec.trackName}-${rec.artistName}`}
                  className="bg-[#181818] rounded-lg p-5 hover:bg-[#252525] transition"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        <span>#{rec.rank}</span>
                        <RankMovementBadge row={rec} />
                        <span>{rec.trackName}</span>
                      </h3>
                      <p className="text-sm text-gray-400">{rec.artistName}</p>
                    </div>

                    <span className="text-sm font-bold">
                      {rec.relativeMatch}%
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mt-3">{rec.reason}</p>

                  <ModelBreakdown
                    signals={[
                      {
                        label: "Model score",
                        value: rec.score,
                      },
                      {
                        label: "Similarity",
                        value: rec.similarityScore,
                        tone: "blue",
                      },
                      {
                        label: "Quality",
                        value: rec.qualityScore,
                      },
                      {
                        label: "Confidence",
                        value: rec.confidence,
                        tone: "amber",
                      },
                      {
                        label: "Recency",
                        value: rec.recencyScore,
                        tone: "blue",
                      },
                      {
                        label: "Known penalty",
                        value: rec.knownTrackPenalty,
                        tone: "red",
                      },
                      {
                        label: "Diversity penalty",
                        value: rec.diversityPenalty,
                        tone: "red",
                      },
                    ]}
                  />

                  <p className="text-xs text-gray-500 mt-3">
                    Played {rec.historyPlayCount} times in your exported history
                    {rec.recentListenStrength !== undefined
                      ? ` • Recent strength: ${rec.recentListenStrength}`
                      : ""}
                    {rec.rawSimilarityScore !== undefined
                      ? ` • Raw cosine: ${rec.rawSimilarityScore}`
                      : ""}
                  </p>

                  <div className="flex gap-2 mt-4">
                    <a
                      href={getSpotifySearchUrl(
                        `${rec.trackName} ${rec.artistName}`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#1db954] text-black text-sm font-semibold px-3 py-1.5 rounded-full"
                    >
                      Open Spotify
                    </a>

                    <button
                      onClick={() =>
                        runAdminAction(`save ${rec.trackName}`, () =>
                          setSavedSongs((prev) => [
                            ...new Set([
                              ...prev,
                              getTrackHistoryKey(rec.trackName, rec.artistName),
                            ]),
                          ]),
                        )
                      }
                      disabled={savedSongs.includes(
                        getTrackHistoryKey(rec.trackName, rec.artistName),
                      )}
                      className="bg-[#3b82f6] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full"
                    >
                      {savedSongs.includes(
                        getTrackHistoryKey(rec.trackName, rec.artistName),
                      )
                        ? "Saved"
                        : "Save"}
                    </button>

                    <button
                      onClick={() =>
                        runAdminAction(`mark ${rec.trackName} as liked`, () =>
                          applyTrackFeedback(rec, "like"),
                        )
                      }
                      className="bg-white text-black text-sm font-semibold px-3 py-1.5 rounded-full"
                    >
                      Liked
                    </button>

                    <button
                      onClick={() =>
                        runAdminAction(`ignore ${rec.trackName}`, () =>
                          applyTrackFeedback(rec, "ignore"),
                        )
                      }
                      className="bg-[#2a2a2a] text-white text-sm px-3 py-1.5 rounded-full"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Recommendations;
