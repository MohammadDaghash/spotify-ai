// src/pages/Recommendations.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import AdminGateModal from "../components/AdminGateModal.jsx";
import FeedbackAnalyticsSection from "../components/recommendations/FeedbackAnalyticsSection.jsx";
import GroupPlaylistsSection from "../components/recommendations/GroupPlaylistsSection.jsx";
import RecommendedArtistsSection from "../components/recommendations/RecommendedArtistsSection.jsx";
import RecommendedSongsSection from "../components/recommendations/RecommendedSongsSection.jsx";

import { useSpotifyContext } from "../context/useSpotifyContext.js";

import { candidateTracks } from "../data/demoMusicData.js";
import {
  getArtistRecommendations,
  getTrackRecommendations,
  getTripPlaylists,
} from "../services/mlApi.js";
import { syncFeedbackEvent } from "../services/feedbackApi.js";
import { syncUserFeedbackEvent } from "../services/userFeedbackApi.js";
import { useActiveRecommendationFeedback } from "../hooks/useActiveRecommendationFeedback.js";
import { isAdmin } from "../utils/adminAuth.js";
import { buildDynamicUserProfile } from "../utils/featureEngineering.js";
import {
  FEEDBACK_EVENTS_CHANGED_EVENT,
  getFeedbackEvents,
  recordFeedbackEvent,
  summarizeFeedbackEvents,
} from "../utils/feedbackEvents.js";
import {
  PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
  readLocalSpotifyHistory,
} from "../utils/localSpotifyHistory.js";
import {
  applyFeedbackPreferenceReranking,
  getFeedbackArtistPreferenceLists,
} from "../utils/feedbackPreferenceSignals.js";
import { rankPrivateTrackRecommendations } from "../utils/privateRecommendations.js";
import { hasSpotifyAccessToken } from "../utils/spotifySession.js";
import { addRankMovementToRows } from "../utils/rankMovement.js";
import {
  getVisibleArtistRecommendations,
  getVisibleSongRecommendations,
} from "../utils/recommendationLists.js";
import {
  addRelativeMatchScores,
  applyWeightDelta,
  ARTIST_RECOMMENDATION_RANKING_KEY,
  calculateDiscoveryMetrics,
  filterTripPlaylistsForSearch,
  getSpotifyTrackKey,
  getStoredGroupMembers,
  getStoredList,
  getTopWeights,
  getTrackHistoryKey,
  recommendationMatchesSearch,
  SONG_RECOMMENDATION_RANKING_KEY,
  storeRankingRows,
} from "../utils/recommendationPageUtils.js";

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
  const [feedbackEvents, setFeedbackEvents] = useState(() =>
    getFeedbackEvents(),
  );
  const [sessionFeedbackEvents, setSessionFeedbackEvents] = useState([]);
  const [userTasteProfile, setUserTasteProfile] = useState(
    buildDynamicUserProfile(candidateTracks),
  );
  const [localSpotifyHistory, setLocalSpotifyHistory] = useState(
    readLocalSpotifyHistory,
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
  const {
    activeFeedbackEvents,
    feedbackIgnoredArtists,
    feedbackIgnoredSongs,
    feedbackLikedArtists,
    feedbackLikedSongs,
    feedbackPreferenceSignals,
    isPersonalFeedbackActive,
    privateFeedback,
  } = useActiveRecommendationFeedback({
    feedbackEvents,
    ignoredArtists,
    ignoredSongs,
    likedArtists,
    likedSongs,
    sessionFeedbackEvents,
  });
  const groupFeedbackArtistPreferences = useMemo(
    () => getFeedbackArtistPreferenceLists(feedbackPreferenceSignals),
    [feedbackPreferenceSignals],
  );
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
  const isPrivateRecommendationMode = localSpotifyHistory.length > 0;
  const getFeedbackMode = () => {
    if (isPrivateRecommendationMode) return "private-user";
    if (isAdmin()) return "admin-demo";

    return "public-demo";
  };

  const recordRecommendationFeedback = (action, itemType, item, context = {}) => {
    const event = recordFeedbackEvent({
      action,
      itemType,
      item,
      mode: getFeedbackMode(),
      source: "recommendations",
      context: {
        route: "/recommendations",
        searchQuery: recommendationSearchQuery,
        ...context,
      },
    });

    void syncFeedbackEvent(event).catch((error) => {
      console.warn("Feedback server sync failed", error);
    });
    void syncUserFeedbackEvent(event).catch((error) => {
      console.warn("User feedback sync failed", error);
    });
    setFeedbackEvents(getFeedbackEvents());
    setSessionFeedbackEvents((previousEvents) => [...previousEvents, event]);

    return event;
  };

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

    recordRecommendationFeedback(sentiment, "song", track, {
      maxPlayCount: maxRecommendedTrackPlays,
      recommendationSource: track.source || "ml-api",
    });

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

  const saveSongRecommendation = (track) => {
    recordRecommendationFeedback("save", "song", track, {
      maxPlayCount: maxRecommendedTrackPlays,
      recommendationSource: track.source || "ml-api",
    });
    setSavedSongs((prev) => [
      ...new Set([
        ...prev,
        getTrackHistoryKey(track.trackName, track.artistName),
      ]),
    ]);
  };

  const applyArtistFeedback = (artist, sentiment) => {
    recordRecommendationFeedback(sentiment, "artist", artist, {
      recommendationSource: artist.source || "ml-api",
    });

    if (sentiment === "like") {
      setLikedArtists((prev) => [...new Set([...prev, artist.artist])]);
    } else {
      setIgnoredArtists((prev) => [...new Set([...prev, artist.artist])]);
    }
  };

  const saveArtistRecommendation = (artist) => {
    recordRecommendationFeedback("save", "artist", artist, {
      recommendationSource: artist.source || "ml-api",
    });
    setSavedArtists((prev) => [...new Set([...prev, artist.artist])]);
  };

  const recordOpenSpotify = (itemType, item) => {
    recordRecommendationFeedback("open_spotify", itemType, item, {
      recommendationSource: item.source || "spotify-search",
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
        recordRecommendationFeedback("create_playlist", "group_playlist", playlist, {
          playlistKey,
          trackCount: playlist.tracks.length,
        });

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
    const refreshPrivateHistory = () => {
      setLocalSpotifyHistory(readLocalSpotifyHistory());
    };

    window.addEventListener(
      PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
      refreshPrivateHistory,
    );
    window.addEventListener("storage", refreshPrivateHistory);

    return () => {
      window.removeEventListener(
        PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
        refreshPrivateHistory,
      );
      window.removeEventListener("storage", refreshPrivateHistory);
    };
  }, []);

  useEffect(() => {
    const refreshFeedbackEvents = () => {
      setFeedbackEvents(getFeedbackEvents());
    };

    window.addEventListener(FEEDBACK_EVENTS_CHANGED_EVENT, refreshFeedbackEvents);
    window.addEventListener("storage", refreshFeedbackEvents);

    return () => {
      window.removeEventListener(
        FEEDBACK_EVENTS_CHANGED_EVENT,
        refreshFeedbackEvents,
      );
      window.removeEventListener("storage", refreshFeedbackEvents);
    };
  }, []);

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
        const groupLikedArtists = [
          ...new Set([
            ...surveyLikedArtists,
            ...groupFeedbackArtistPreferences.likedArtists,
          ]),
        ];
        const groupIgnoredArtists = [
          ...new Set([
            ...surveyIgnoredArtists,
            ...groupFeedbackArtistPreferences.ignoredArtists,
          ]),
        ];

        const privateTrackRecommendations = isPrivateRecommendationMode
          ? rankPrivateTrackRecommendations({
              history: localSpotifyHistory,
              candidateTracks,
              topN: 30,
            })
          : null;

        const [artistRecommendationsData, trackRecommendationsData, tripPlaylistsData] =
          await Promise.all([
            getArtistRecommendations({
              topN: 50,
            }),
            privateTrackRecommendations
              ? Promise.resolve({ recommendations: privateTrackRecommendations })
              : getTrackRecommendations({
                  topN: 30,
                  maxPlayCount: maxRecommendedTrackPlays,
                  likedTracks: likedSongs,
                  ignoredTracks: ignoredSongs,
                }),
            getTripPlaylists({
              limit: 25,
              newSongMaxPlays: 5,
              groupMembers,
              surveyLikedArtists: groupLikedArtists,
              surveyIgnoredArtists: groupIgnoredArtists,
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
    groupFeedbackArtistPreferences,
    isPrivateRecommendationMode,
    localSpotifyHistory,
    maxRecommendedTrackPlays,
  ]);

  const feedbackRankedArtistRecommendations = useMemo(
    () =>
      applyFeedbackPreferenceReranking(artistRecommendations, {
        signals: feedbackPreferenceSignals,
        itemType: "artist",
      }),
    [artistRecommendations, feedbackPreferenceSignals],
  );

  const filteredArtistRecommendations = useMemo(() => {
    return getVisibleArtistRecommendations({
      recommendations: feedbackRankedArtistRecommendations,
      likedArtists: feedbackLikedArtists,
      ignoredArtists: feedbackIgnoredArtists,
      followedArtists,
      limit: visibleRecommendationCount,
    });
  }, [
    feedbackIgnoredArtists,
    feedbackLikedArtists,
    feedbackRankedArtistRecommendations,
    followedArtists,
  ]);

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

  const feedbackRankedSongRecommendations = useMemo(
    () =>
      applyFeedbackPreferenceReranking(recommendationsWithPlayCounts, {
        signals: feedbackPreferenceSignals,
        itemType: "song",
      }),
    [feedbackPreferenceSignals, recommendationsWithPlayCounts],
  );

  const eligibleSongRecommendations = useMemo(() => {
    return getVisibleSongRecommendations({
      recommendations: feedbackRankedSongRecommendations,
      maxPlayCount: maxRecommendedTrackPlays,
      limit: feedbackRankedSongRecommendations.length,
    });
  }, [feedbackRankedSongRecommendations, maxRecommendedTrackPlays]);

  const rankedRecommendations = useMemo(() => {
    return getVisibleSongRecommendations({
      recommendations: eligibleSongRecommendations,
      likedSongs: feedbackLikedSongs,
      ignoredSongs: feedbackIgnoredSongs,
      maxPlayCount: maxRecommendedTrackPlays,
      limit: visibleRecommendationCount,
    });
  }, [
    eligibleSongRecommendations,
    feedbackIgnoredSongs,
    feedbackLikedSongs,
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
    recommendations: feedbackRankedSongRecommendations,
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
      feedbackLikedSongs.length +
      feedbackIgnoredSongs.length +
      feedbackLikedArtists.length +
      feedbackIgnoredArtists.length;
    const positiveFeedback =
      feedbackLikedSongs.length + feedbackLikedArtists.length;
    const feedbackEventStats = summarizeFeedbackEvents(activeFeedbackEvents);

    return {
      feedbackEventStats,
      liveSignalCount,
      topBoostedArtists,
      topGenres,
      topMoods,
      totalFeedback,
      acceptanceRate:
        totalFeedback === 0
          ? "0%"
          : `${Math.round((positiveFeedback / totalFeedback) * 100)}%`,
      eventAcceptanceRate: `${Math.round(
        feedbackEventStats.acceptanceRate * 100,
      )}%`,
      eventIgnoreRate: `${Math.round(feedbackEventStats.ignoreRate * 100)}%`,
    };
  }, [
    feedbackLikedSongs,
    feedbackIgnoredSongs,
    feedbackLikedArtists,
    feedbackIgnoredArtists,
    liveKnownTrackSignals,
    effectiveUserTasteProfile,
    activeFeedbackEvents,
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

            {isPrivateRecommendationMode && (
              <div className="mb-6 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                Recommendations are using your private Spotify history stored
                in this browser. Public demo data remains unchanged.
              </div>
            )}

            {isPersonalFeedbackActive && (
              <div className="mb-6 rounded-lg border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
                Personal feedback learning is active for{" "}
                <span className="font-semibold">{privateFeedback.user.email}</span>
                . Private likes and ignores are adjusting these rankings.
              </div>
            )}

            {privateFeedback.error && (
              <div className="mb-6 rounded-lg border border-yellow-300/30 bg-yellow-950/30 p-4 text-sm text-yellow-100">
                Private feedback could not be loaded: {privateFeedback.error}
              </div>
            )}

            <RecommendedArtistsSection
              applyArtistFeedback={applyArtistFeedback}
              artists={displayedArtistRecommendationsWithDisplayScores}
              isSearchActive={isRecommendationSearchActive}
              mlError={mlError}
              mlLoading={mlLoading}
              onOpenSpotify={(artist) => recordOpenSpotify("artist", artist)}
              runAdminAction={runAdminAction}
              saveArtistRecommendation={saveArtistRecommendation}
              savedArtists={savedArtists}
            />

            <FeedbackAnalyticsSection
              evaluationMetrics={evaluationMetrics}
              feedbackAnalytics={feedbackAnalytics}
              ignoredArtists={feedbackIgnoredArtists}
              ignoredSongs={feedbackIgnoredSongs}
              likedArtists={feedbackLikedArtists}
              likedSongs={feedbackLikedSongs}
            />

            <GroupPlaylistsSection
              createTripPlaylist={createTripPlaylist}
              creatingPlaylistKey={creatingPlaylistKey}
              displayedTripPlaylists={displayedTripPlaylists}
              hasDisplayedTripPlaylistTracks={hasDisplayedTripPlaylistTracks}
              runAdminAction={runAdminAction}
            />

            <RecommendedSongsSection
              applyTrackFeedback={applyTrackFeedback}
              isSearchActive={isRecommendationSearchActive}
              onOpenSpotify={(track) => recordOpenSpotify("song", track)}
              runAdminAction={runAdminAction}
              savedSongs={savedSongs}
              saveSongRecommendation={saveSongRecommendation}
              songs={displayedSongRecommendationsWithDisplayScores}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Recommendations;
