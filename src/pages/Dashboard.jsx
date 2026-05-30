// src/pages/Dashboard.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/layout/Header.jsx";
import Section from "../components/layout/Section.jsx";
import TrackCard from "../components/cards/TrackCard.jsx";
import { useMemo, useState } from "react";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";
import { getRankedRecommendations } from "../utils/recommendationEngine.js";
import { evaluateRecommendations } from "../utils/evaluationMetrics.js";
import { allSpotifyHistory } from "../data/loadSpotifyHistory.js";
import { parseSpotifyHistory } from "../utils/spotifyDataParser.js";
import ListeningTrendChart from "../components/charts/ListeningTrendChart.jsx";
import { getListeningTrend } from "../utils/spotifyDataParser.js";

import {
  monthlyTopAlbums,
  libraryArtists,
  demoUserProfile,
  candidateTracks,
} from "../data/demoMusicData.js";

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function RankingTable({ title, rows, columns }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <h2 className="text-lg font-bold mb-4">{title}</h2>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={`${title}-${row.rank}-${row.trackName || row.artistName || row.albumName}`}
            className="grid grid-cols-[40px_1fr_auto] gap-3 items-center border-b border-white/5 pb-3"
          >
            <span className="text-gray-400">#{row.rank}</span>

            <div>
              <p className="font-semibold">
                {row.trackName || row.albumName || row.artistName}
              </p>
              <p className="text-xs text-gray-400">
                {columns
                  .map((col) => row[col])
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>

            <span className="text-sm font-bold text-right">
              {row.streams} streams
              <br />
              <span className="text-xs text-gray-400">
                {row.minutesPlayed} min
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const { tracks = [], playlists = [], loading = false } = useSpotifyContext();

  const [timeRange, setTimeRange] = useState("all");
  const [ignoredSongs, setIgnoredSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);

  const [userTasteProfile, setUserTasteProfile] = useState(demoUserProfile);
  const [selectedYear, setSelectedYear] = useState("all");
  const [sortBy, setSortBy] = useState("minutes");

  const timeRangeLabel =
    timeRange === "30d"
      ? "Last 30 Days"
      : timeRange === "6m"
        ? "Last 6 Months"
        : "All Time";

  const filteredHistory = useMemo(() => {
    let filtered = allSpotifyHistory;

    // Time range filter
    if (timeRange === "30d") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      filtered = filtered.filter((item) => new Date(item.ts) >= cutoff);
    }

    if (timeRange === "6m") {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);

      filtered = filtered.filter((item) => new Date(item.ts) >= cutoff);
    }

    // Year filter
    if (selectedYear !== "all") {
      filtered = filtered.filter((item) => {
        const year = new Date(item.ts).getFullYear();
        return year.toString() === selectedYear;
      });
    }

    return filtered;
  }, [timeRange, selectedYear]);

  const parsedSpotifyData = useMemo(() => {
    return parseSpotifyHistory(filteredHistory, sortBy);
  }, [filteredHistory, sortBy]);

  const totalStreams = parsedSpotifyData.topTracks.reduce(
    (sum, song) => sum + song.streams,
    0,
  );

  const totalMinutes = parsedSpotifyData.topTracks.reduce(
    (sum, song) => sum + song.minutesPlayed,
    0,
  );

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

  const listeningTrend = useMemo(() => {
    return getListeningTrend(filteredHistory, timeRange);
  }, [filteredHistory, timeRange]);

  const availableYears = useMemo(() => {
    const years = allSpotifyHistory
      .map((item) => new Date(item.ts).getFullYear())
      .filter(Boolean);

    return [...new Set(years)].sort((a, b) => b - a);
  }, []);

  return (
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <Header />

            <div className="mb-6 text-sm opacity-70">
              {loading
                ? "Loading Spotify data…"
                : "Real Spotify history analytics —" + timeRangeLabel}
            </div>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Streams analyzed"
                value={totalStreams}
                subtitle={timeRangeLabel}
              />
              <StatCard
                title="Minutes played"
                value={totalMinutes}
                subtitle="Listening-time signal"
              />
              <StatCard
                title="Artists in library"
                value={libraryArtists.length}
                subtitle="Used for artist affinity"
              />
              <StatCard
                title="Recommendation model"
                value="V1"
                subtitle="Content-based direction"
              />
            </section>

            <ListeningTrendChart data={listeningTrend} timeRange={timeRange} />

            <div className="flex flex-wrap items-center gap-3 mt-6 mb-6">
              <button
                onClick={() => {
                  setTimeRange("30d");
                  setSelectedYear("all");
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  timeRange === "30d"
                    ? "bg-white text-black"
                    : "bg-[#2a2a2a] text-white"
                }`}
              >
                Last 30 Days
              </button>

              <button
                onClick={() => {
                  setTimeRange("6m");
                  setSelectedYear("all");
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  timeRange === "6m"
                    ? "bg-white text-black"
                    : "bg-[#2a2a2a] text-white"
                }`}
              >
                Last 6 Months
              </button>

              <button
                onClick={() => {
                  setTimeRange("all");
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  timeRange === "all"
                    ? "bg-white text-black"
                    : "bg-[#2a2a2a] text-white"
                }`}
              >
                All Time
              </button>

              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setTimeRange("all");
                }}
                className="bg-[#2a2a2a] text-white px-4 py-2 rounded-full outline-none"
              >
                <option value="all">All Years</option>

                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setSortBy("minutes")}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  sortBy === "minutes"
                    ? "bg-white text-black"
                    : "bg-[#2a2a2a] text-white"
                }`}
              >
                Sort by Minutes
              </button>

              <button
                onClick={() => setSortBy("streams")}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  sortBy === "streams"
                    ? "bg-white text-black"
                    : "bg-[#2a2a2a] text-white"
                }`}
              >
                Sort by Streams
              </button>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
              <RankingTable
                title="Top Songs"
                rows={parsedSpotifyData.topTracks}
                columns={["artistName", "albumName"]}
              />

              <RankingTable
                title="Top Artists"
                rows={parsedSpotifyData.topArtists}
                columns={["songsInLibrary"]}
              />

              <RankingTable
                title="Top Albums"
                rows={parsedSpotifyData.topAlbums}
                columns={["artistName"]}
              />
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

            <Section title="Recommended songs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rankedRecommendations.map((rec) => (
                  <div
                    key={`${rec.trackName}-${rec.artistName}`}
                    className="bg-[#181818] rounded-lg p-4 hover:bg-[#252525] transition"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="font-bold">{rec.trackName}</h3>
                        <p className="text-sm text-gray-400">
                          {rec.artistName}
                        </p>
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
                            const updatedGenres = [
                              ...new Set([
                                ...prevProfile.favoriteGenres,
                                ...rec.genres,
                              ]),
                            ];

                            const updatedMoods = [
                              ...new Set([
                                ...prevProfile.favoriteMoods,
                                ...rec.moods,
                              ]),
                            ];

                            const updatedArtists = [
                              ...new Set([
                                ...prevProfile.favoriteArtists,
                                rec.artistName,
                              ]),
                            ];

                            return {
                              ...prevProfile,
                              favoriteGenres: updatedGenres,
                              favoriteMoods: updatedMoods,
                              favoriteArtists: updatedArtists,
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
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
