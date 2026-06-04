// src/pages/Dashboard.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/layout/Header.jsx";
import Section from "../components/layout/Section.jsx";
import TrackCard from "../components/cards/TrackCard.jsx";
import { useEffect, useMemo, useState } from "react";
import { getMlDashboardAnalytics } from "../services/mlApi.js";
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

      <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
        {rows.map((row, index) => (
          <div
            key={`${title}-${index}-${row.name || ""}-${row.artistName || ""}-${row.albumName || ""}`}
            className="grid grid-cols-[40px_1fr_auto] gap-3 items-center border-b border-white/5 pb-3"
          >
            <span className="text-gray-400">#{index + 1}</span>

            <div>
              <p className="font-semibold">
                {row.name || row.trackName || row.albumName || row.artistName}
              </p>

              <p className="text-xs text-gray-400">
                {columns
                  .map((col) => row[col])
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold text-white">
                {row.streams?.toLocaleString()} streams
              </p>

              <p className="text-xs text-gray-400">
                {Math.round(row.minutes || 0).toLocaleString()} min
              </p>
            </div>
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

  const [mlDashboardData, setMlDashboardData] = useState(null);
  const [mlError, setMlError] = useState("");
  const [mlLoading, setMlLoading] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadMlDashboardData() {
      try {
        setMlError("");

        const data = await getMlDashboardAnalytics(
          sortBy,
          timeRange,
          selectedYear,
        );

        if (isCurrentRequest) {
          setMlDashboardData(data);
          console.log("ML backend dashboard data:", data);
        }
      } catch (error) {
        if (isCurrentRequest) {
          setMlError(error.message);
          console.error(error);
        }
      }
    }

    loadMlDashboardData();

    return () => {
      isCurrentRequest = false;
    };
  }, [sortBy, timeRange, selectedYear]);

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

  const mlSummary = mlDashboardData?.summary;

  const formatNumber = (value) => {
    if (value === undefined || value === null) return "—";
    return Number(value).toLocaleString();
  };

  const dashboardTotalStreams = mlSummary
    ? formatNumber(mlSummary.total_streams)
    : formatNumber(totalStreams);

  const dashboardTotalMinutes = mlSummary
    ? formatNumber(Math.round(mlSummary.total_minutes))
    : formatNumber(Math.round(totalMinutes));

  const dashboardTotalArtists = mlSummary
    ? formatNumber(mlSummary.unique_artists)
    : formatNumber(libraryArtists.length);

  const dashboardTopTracks = (mlDashboardData?.top_tracks ?? []).map(
    (track) => ({
      name: track.track_name,
      artistName: track.artist_name,
      albumName: track.album_name,
      streams: track.streams,
      minutes: track.minutes,
    }),
  );

  const dashboardTopArtists = (mlDashboardData?.top_artists ?? []).map(
    (artist) => ({
      name: artist.artist_name,
      streams: artist.streams,
      minutes: artist.minutes,
    }),
  );

  const dashboardTopAlbums = (mlDashboardData?.top_albums ?? []).map(
    (album) => ({
      name: album.album_name,
      artistName: album.artist_name,
      streams: album.streams,
      minutes: album.minutes,
    }),
  );

  return (
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <Header />

            <div className="mb-4 bg-[#181818] rounded-lg p-4 border border-white/10">
              <p className="text-sm text-gray-400">Python ML Backend</p>

              {mlDashboardData ? (
                <p className="text-green-400 font-semibold">
                  Connected — {mlDashboardData.summary.total_streams} streams
                  analyzed by pandas
                </p>
              ) : mlError ? (
                <p className="text-red-400 font-semibold">
                  Backend error: {mlError}
                </p>
              ) : (
                <p className="text-gray-300">Loading ML backend data...</p>
              )}
            </div>

            <div className="mb-6 text-sm opacity-70">
              {loading
                ? "Loading Spotify data…"
                : "Real Spotify history analytics —" + timeRangeLabel}
            </div>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Streams analyzed"
                value={dashboardTotalStreams}
                subtitle="From Python/pandas"
              />
              <StatCard
                title="Minutes played"
                value={dashboardTotalMinutes}
                subtitle="Listening-time signal"
              />
              <StatCard
                title="Artists in library"
                value={dashboardTotalArtists}
                subtitle="Used for artist affinity"
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
              {mlLoading ? (
                <>
                  <div className="bg-[#181818] rounded-lg p-4 h-[700px] animate-pulse" />
                  <div className="bg-[#181818] rounded-lg p-4 h-[700px] animate-pulse" />
                  <div className="bg-[#181818] rounded-lg p-4 h-[700px] animate-pulse" />
                </>
              ) : (
                <>
                  <RankingTable
                    title="Top Songs"
                    rows={dashboardTopTracks}
                    columns={["artistName", "albumName"]}
                  />

                  <RankingTable
                    title="Top Artists"
                    rows={dashboardTopArtists}
                    columns={[]}
                  />

                  <RankingTable
                    title="Top Albums"
                    rows={dashboardTopAlbums}
                    columns={["artistName"]}
                  />
                </>
              )}
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
