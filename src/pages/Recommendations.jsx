// src/pages/Recommendations.jsx
import { useEffect, useMemo, useState } from "react";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";

import { useSpotifyContext } from "../context/SpotifyContext.jsx";

import { candidateTracks } from "../data/demoMusicData.js";
import {
  getArtistRecommendations,
  getTrackRecommendations,
  getTripPlaylists,
} from "../services/mlApi.js";
import { buildDynamicUserProfile } from "../utils/featureEngineering.js";

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
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
  const [liveKnownTrackSignals, setLiveKnownTrackSignals] = useState(new Map());
  const [liveTasteArtistWeights, setLiveTasteArtistWeights] = useState({});
  const [creatingPlaylistKey, setCreatingPlaylistKey] = useState("");
  const [mlError, setMlError] = useState("");
  const [mlLoading, setMlLoading] = useState(false);

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
          window.location.href = spotifyUrl;
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

        const [
          artistRecommendationsData,
          trackRecommendationsData,
          tripPlaylistsData,
        ] =
          await Promise.all([
            getArtistRecommendations({
              topN: 20,
              likedArtists,
              ignoredArtists,
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
            }),
          ]);

        let followed = [];

        if (typeof getFollowedArtists === "function") {
          followed = await getFollowedArtists();
        }

        let liveKnownTracks = new Map();

        if (typeof getLiveListeningSignals === "function") {
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
    const followedArtistNames = new Set(
      followedArtists.map((artist) => artist.name?.toLowerCase()),
    );

    return artistRecommendations.filter(
      (rec) =>
        !followedArtistNames.has(rec.artist?.toLowerCase()) &&
        !ignoredArtists.includes(rec.artist) &&
        !likedArtists.includes(rec.artist),
    );
  }, [artistRecommendations, followedArtists, ignoredArtists, likedArtists]);

  const visibleArtistRecommendations = filteredArtistRecommendations.slice(
    0,
    visibleRecommendationCount,
  );

  const visibleArtistRecommendationsWithDisplayScores = useMemo(() => {
    return addRelativeMatchScores(visibleArtistRecommendations);
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
        historyPlayCount: track.streams || 0,
        liveKnownReason:
          liveKnownTrackSignals.get(
            getTrackHistoryKey(trackName, artistName),
          ) || "",
      };
    });
  }, [trackRecommendations, liveKnownTrackSignals]);

  const eligibleSongRecommendations = useMemo(() => {
    return recommendationsWithPlayCounts.filter(
      (track) =>
        track.historyPlayCount < maxRecommendedTrackPlays &&
        !track.liveKnownReason,
    );
  }, [recommendationsWithPlayCounts, maxRecommendedTrackPlays]);

  const rankedRecommendations = useMemo(() => {
    return eligibleSongRecommendations
      .filter((track) => !ignoredSongs.includes(track.trackName))
      .filter((track) => !likedSongs.includes(track.trackName));
  }, [
    eligibleSongRecommendations,
    ignoredSongs,
    likedSongs,
  ]);

  const visibleSongRecommendations = rankedRecommendations.slice(
    0,
    visibleRecommendationCount,
  );

  const visibleSongRecommendationsWithDisplayScores = useMemo(() => {
    return addRelativeMatchScores(visibleSongRecommendations);
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

  return (
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <h1 className="text-3xl font-bold mb-2">Recommendations</h1>

            <p className="text-sm text-gray-400 mb-6">
              Hybrid recommendation engine using vector similarity, artist
              affinity, popularity, recency, and user feedback.
            </p>

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
                visibleArtistRecommendations.length === 0 && (
                  <p className="text-sm text-gray-400">
                    No new artist recommendations found.
                  </p>
                )}

              <div className="space-y-3">
                {visibleArtistRecommendationsWithDisplayScores.map((artist, index) => (
                  <div
                    key={artist.artist}
                    className="flex items-center justify-between border-b border-white/10 pb-3"
                  >
                    <div>
                      <p className="font-semibold">
                        #{index + 1} {artist.artist}
                      </p>

                      <p className="text-sm text-gray-400">
                        Relative match: {artist.relativeMatch}%
                      </p>
                      <p className="text-xs text-gray-500">
                        Raw similarity: {artist.score}
                      </p>
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
                            setLikedArtists((prev) => [
                              ...new Set([...prev, artist.artist]),
                            ])
                          }
                          className="bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          Liked
                        </button>

                        <button
                          onClick={() =>
                            setIgnoredArtists((prev) => [
                              ...new Set([...prev, artist.artist]),
                            ])
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

            {tripPlaylists && (
              <section className="bg-[#181818] rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Trip playlists</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Three playlist strategies for group listening.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(tripPlaylists).map(([playlistKey, playlist]) => (
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
                              {track.artist_name} • {track.streams} plays
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => createTripPlaylist(playlistKey, playlist)}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleSongRecommendationsWithDisplayScores.map((rec) => (
                <div
                  key={`${rec.trackName}-${rec.artistName}`}
                  className="bg-[#181818] rounded-lg p-4 hover:bg-[#252525] transition"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-bold">{rec.trackName}</h3>
                      <p className="text-sm text-gray-400">{rec.artistName}</p>
                    </div>

                    <span className="text-sm font-bold">
                      {rec.relativeMatch}%
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mt-3">{rec.reason}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Played {rec.historyPlayCount} times in your exported history
                    {" "}• Raw similarity: {rec.score}
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
                      onClick={() => applyTrackFeedback(rec, "like")}
                      className="bg-white text-black text-sm font-semibold px-3 py-1.5 rounded-full"
                    >
                      Liked
                    </button>

                    <button
                      onClick={() => applyTrackFeedback(rec, "ignore")}
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
