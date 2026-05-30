// src/pages/Recommendations.jsx
import { useMemo, useState } from "react";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";

import { candidateTracks, demoUserProfile } from "../data/demoMusicData.js";
import { getRankedRecommendations } from "../utils/recommendationEngine.js";
import { evaluateRecommendations } from "../utils/evaluationMetrics.js";

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
  const [ignoredSongs, setIgnoredSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [userTasteProfile, setUserTasteProfile] = useState(demoUserProfile);

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
        <Sidebar />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <h1 className="text-3xl font-bold mb-2">Recommendations</h1>

            <p className="text-sm text-gray-400 mb-6">
              Hybrid recommendation engine using vector similarity, artist
              affinity, popularity, recency, and user feedback.
            </p>

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

                        setUserTasteProfile((prevProfile) => ({
                          ...prevProfile,
                          favoriteGenres: [
                            ...new Set([
                              ...prevProfile.favoriteGenres,
                              ...rec.genres,
                            ]),
                          ],
                          favoriteMoods: [
                            ...new Set([
                              ...prevProfile.favoriteMoods,
                              ...rec.moods,
                            ]),
                          ],
                          favoriteArtists: [
                            ...new Set([
                              ...prevProfile.favoriteArtists,
                              rec.artistName,
                            ]),
                          ],
                        }));
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
