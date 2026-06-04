// src/pages/Recommendations.jsx
import { useEffect, useMemo, useState } from "react";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";

import { useSpotifyContext } from "../context/SpotifyContext.jsx";

import { candidateTracks } from "../data/demoMusicData.js";
import { getRankedRecommendations } from "../utils/recommendationEngine.js";
import { evaluateRecommendations } from "../utils/evaluationMetrics.js";
import { getArtistRecommendations } from "../services/mlApi.js";
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

function Recommendations() {
  const { playlists = [], getFollowedArtists } = useSpotifyContext();

  const [ignoredSongs, setIgnoredSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [userTasteProfile, setUserTasteProfile] = useState(
    buildDynamicUserProfile(candidateTracks),
  );

  const [artistRecommendations, setArtistRecommendations] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [mlError, setMlError] = useState("");
  const [mlLoading, setMlLoading] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadArtistRecommendations() {
      try {
        setMlLoading(true);
        setMlError("");

        const recommendationsData = await getArtistRecommendations();

        let followed = [];

        if (typeof getFollowedArtists === "function") {
          followed = await getFollowedArtists();
        }

        if (isCurrentRequest) {
          setArtistRecommendations(recommendationsData.recommendations || []);
          setFollowedArtists(followed || []);
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

    loadArtistRecommendations();

    return () => {
      isCurrentRequest = false;
    };
  }, [getFollowedArtists]);

  const filteredArtistRecommendations = useMemo(() => {
    const followedArtistNames = new Set(
      followedArtists.map((artist) => artist.name?.toLowerCase()),
    );

    return artistRecommendations.filter(
      (rec) => !followedArtistNames.has(rec.artist?.toLowerCase()),
    );
  }, [artistRecommendations, followedArtists]);

  const originalRecommendations = useMemo(() => {
    return getRankedRecommendations(candidateTracks, userTasteProfile);
  }, [userTasteProfile]);

  const rankedRecommendations = useMemo(() => {
    return originalRecommendations
      .filter((track) => !ignoredSongs.includes(track.trackName))
      .filter((track) => !likedSongs.includes(track.trackName));
  }, [originalRecommendations, ignoredSongs, likedSongs]);

  const evaluationMetrics = evaluateRecommendations({
    recommendations: originalRecommendations,
    relevantTrackNames: likedSongs,
    allCandidateTracks: candidateTracks,
    k: 3,
  });

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
                filteredArtistRecommendations.length === 0 && (
                  <p className="text-sm text-gray-400">
                    No new artist recommendations found.
                  </p>
                )}

              <div className="space-y-3">
                {filteredArtistRecommendations.map((artist, index) => (
                  <div
                    key={artist.artist}
                    className="flex items-center justify-between border-b border-white/10 pb-3"
                  >
                    <div>
                      <p className="font-semibold">
                        #{index + 1} {artist.artist}
                      </p>

                      <p className="text-sm text-gray-400">
                        Similarity Score: {artist.score}
                      </p>
                      <p className="text-sm text-gray-500">{artist.reason}</p>
                    </div>

                    <div className="text-right text-sm text-gray-400">
                      <p>{artist.streams.toLocaleString()} streams</p>
                      <p>{artist.minutes.toLocaleString()} min</p>
                      <p>{Math.round(artist.skip_rate * 100)}% skip rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Precision@3"
                value={evaluationMetrics.precisionAtK}
                subtitle="Relevant songs in top 3"
              />
              <StatCard
                title="Hit@3"
                value={evaluationMetrics.hitAtK}
                subtitle="At least one good recommendation"
              />
              <StatCard
                title="Catalog coverage"
                value={evaluationMetrics.catalogCoverage}
                subtitle="Recommended catalog share"
              />
              <StatCard
                title="Artist diversity"
                value={evaluationMetrics.artistDiversity}
                subtitle="Unique artists in results"
              />
            </section>

            <h2 className="text-xl font-bold mb-4">Recommended songs</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rankedRecommendations.map((rec) => (
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
                      {(rec.score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mt-3">{rec.reason}</p>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        setLikedSongs((prev) => [...prev, rec.trackName]);

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

                          for (const genre of rec.genres || []) {
                            nextGenreWeights[genre] =
                              (nextGenreWeights[genre] || 0) + 0.1;
                          }

                          for (const mood of rec.moods || []) {
                            nextMoodWeights[mood] =
                              (nextMoodWeights[mood] || 0) + 0.1;
                          }

                          nextArtistWeights[rec.artistName] =
                            (nextArtistWeights[rec.artistName] || 0) + 0.1;

                          return {
                            ...prevProfile,
                            genreWeights: nextGenreWeights,
                            moodWeights: nextMoodWeights,
                            artistWeights: nextArtistWeights,
                          };
                        });
                      }}
                      className="bg-white text-black text-sm font-semibold px-3 py-1.5 rounded-full"
                    >
                      Add to Library
                    </button>

                    <button
                      onClick={() =>
                        setIgnoredSongs((prev) => [...prev, rec.trackName])
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
