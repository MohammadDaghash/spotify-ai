// src/pages/Dashboard.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/layout/Header.jsx";
import RankMovementBadge from "../components/RankMovementBadge.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";
import { allSpotifyHistory } from "../data/loadSpotifyHistory.js";
import { parseSpotifyHistory } from "../utils/spotifyDataParser.js";
import { readLocalSpotifyHistory } from "../utils/localSpotifyHistory.js";
import {
  addRankMovementToRows,
  getPreviousHistoryWindow,
} from "../utils/rankMovement.js";
import { hasSpotifyAccessToken } from "../utils/spotifySession.js";
import ListeningTrendChart from "../components/charts/ListeningTrendChart.jsx";
import { getListeningTrend } from "../utils/spotifyDataParser.js";
import { getMlDashboardAnalytics } from "../services/mlApi";

const RANKING_IMAGE_CACHE_KEY = "spotify_ai_dashboard_ranking_images_v4";
const MAX_CACHED_RANKING_IMAGES = 500;
const IMAGE_LOOKUP_DELAY_MS = 250;
const RANKING_IMAGE_TYPE_PRIORITY = {
  track: 0,
  artist: 1,
  album: 2,
};

function getStoredRankingImages() {
  if (typeof localStorage === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(RANKING_IMAGE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeRankingImages(images) {
  if (typeof localStorage === "undefined") return;

  const entries = Object.entries(images).slice(-MAX_CACHED_RANKING_IMAGES);
  localStorage.setItem(
    RANKING_IMAGE_CACHE_KEY,
    JSON.stringify(Object.fromEntries(entries)),
  );
}

function getBestSpotifyImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return "";

  const mediumImage = images.find(
    (image) => image.width >= 120 && image.width <= 320,
  );

  return mediumImage?.url || images[images.length - 1]?.url || images[0]?.url || "";
}

function getRankingImageKey(type, ...parts) {
  return [type, ...parts].map((part) => part || "").join("::").toLowerCase();
}

function getFallbackInitial(row) {
  return (row.name || row.artistName || row.albumName || "?").trim().slice(0, 1);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getRetryAfterMs(error) {
  const status = error?.response?.status;
  const retryAfter = Number(error?.response?.headers?.["retry-after"]);

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  if (status === 429) {
    return 5_000;
  }

  return 0;
}

function sortRowsForImageLoading(rows) {
  return [...rows].sort((left, right) => {
    const rankDiff = (left.rank || 999) - (right.rank || 999);

    if (rankDiff !== 0) return rankDiff;

    return (
      (RANKING_IMAGE_TYPE_PRIORITY[left.imageType] ?? 99) -
      (RANKING_IMAGE_TYPE_PRIORITY[right.imageType] ?? 99)
    );
  });
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function RankingImage({ row, onImageError }) {
  const isArtist = row.imageType === "artist";
  const shapeClass = isArtist ? "rounded-full" : "rounded";

  if (row.imageUrl) {
    return (
      <img
        src={row.imageUrl}
        alt={row.name || row.artistName || row.albumName || "Ranking artwork"}
        className={`h-11 w-11 object-cover bg-[#2a2a2a] ${shapeClass}`}
        loading="lazy"
        onError={() => onImageError?.(row.imageKey)}
      />
    );
  }

  return (
    <div
      className={`h-11 w-11 bg-[#2a2a2a] text-gray-300 flex items-center justify-center text-sm font-bold ${shapeClass}`}
    >
      {getFallbackInitial(row)}
    </div>
  );
}

function RankingTable({ title, rows, columns, onImageError }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <h2 className="text-lg font-bold mb-4">{title}</h2>

      <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
        {rows.map((row, index) => (
          <div
            key={`${title}-${index}-${row.name || ""}-${row.artistName || ""}-${row.albumName || ""}`}
            className="grid grid-cols-[40px_44px_1fr_auto] gap-3 items-center border-b border-white/5 pb-3"
          >
            <div>
              <span className="block text-gray-400">#{row.rank || index + 1}</span>
              <RankMovementBadge row={row} />
            </div>

            <RankingImage row={row} onImageError={onImageError} />

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
  const {
    playlists = [],
    loading = false,
    listeningSyncStatus,
    searchArtist,
    searchTrack,
    searchAlbum,
  } = useSpotifyContext();

  const [timeRange, setTimeRange] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [sortBy, setSortBy] = useState("minutes");
  const [localSpotifyHistory, setLocalSpotifyHistory] = useState(
    readLocalSpotifyHistory,
  );

  const [mlDashboardData, setMlDashboardData] = useState(null);
  const [mlError, setMlError] = useState("");
  const [mlLoading, setMlLoading] = useState(false);
  const [rankingImages, setRankingImages] = useState(getStoredRankingImages);
  const [rankingImageStatus, setRankingImageStatus] = useState({
    requested: 0,
    loaded: 0,
    failed: 0,
    done: false,
    rateLimited: false,
    authError: false,
  });
  const [imageLoadVersion, setImageLoadVersion] = useState(0);
  const rankingImagesRef = useRef(rankingImages);
  const syncedPlayCount = listeningSyncStatus?.total_plays || 0;
  const liveSyncVersion = listeningSyncStatus?.last_checked_at || "";
  const canLoadSpotifyArtwork = hasSpotifyAccessToken();
  const displayedSpotifyHistory =
    localSpotifyHistory.length > 0 ? localSpotifyHistory : allSpotifyHistory;
  const historySourceLabel =
    localSpotifyHistory.length > 0
      ? "Your uploaded Spotify history"
      : "Public demo Spotify history";

  useEffect(() => {
    rankingImagesRef.current = rankingImages;
  }, [rankingImages]);

  useEffect(() => {
    const refreshLocalHistory = () => {
      setLocalSpotifyHistory(readLocalSpotifyHistory());
    };

    window.addEventListener("focus", refreshLocalHistory);

    return () => {
      window.removeEventListener("focus", refreshLocalHistory);
    };
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadMlDashboardData() {
      try {
        setMlLoading(true);
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
          const message = error.message || "Failed to fetch ML dashboard data";

          if (message.includes("not configured")) {
            setMlError("");
          } else {
            setMlError(message);
            console.error(error);
          }
        }
      } finally {
        if (isCurrentRequest) {
          setMlLoading(false);
        }
      }
    }

    loadMlDashboardData();

    return () => {
      isCurrentRequest = false;
    };
  }, [sortBy, timeRange, selectedYear, syncedPlayCount, liveSyncVersion]);

  const timeRangeLabel =
    timeRange === "30d"
      ? "Last 30 Days"
      : timeRange === "6m"
        ? "Last 6 Months"
        : "All Time";

  const filteredHistory = useMemo(() => {
    let filtered = displayedSpotifyHistory;

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
  }, [displayedSpotifyHistory, timeRange, selectedYear]);

  const parsedSpotifyData = useMemo(() => {
    return parseSpotifyHistory(filteredHistory, sortBy);
  }, [filteredHistory, sortBy]);

  const previousHistory = useMemo(
    () =>
      getPreviousHistoryWindow(displayedSpotifyHistory, {
        timeRange,
        selectedYear,
      }),
    [displayedSpotifyHistory, selectedYear, timeRange],
  );

  const previousParsedSpotifyData = useMemo(() => {
    return parseSpotifyHistory(previousHistory, sortBy);
  }, [previousHistory, sortBy]);

  const historySummary = useMemo(() => {
    const artistNames = new Set();

    return filteredHistory.reduce(
      (summary, entry) => {
        const streams = Number(entry.streams || entry.play_count || 1);
        const safeStreams = Number.isFinite(streams) && streams > 0 ? streams : 1;
        const totalMsPlayed = Number(entry.total_ms_played);
        const msPlayed = Number(entry.ms_played || entry.msPlayed || 0);
        const safeMsPlayed =
          Number.isFinite(totalMsPlayed) && totalMsPlayed > 0
            ? totalMsPlayed
            : msPlayed * safeStreams;
        const artistName =
          entry.master_metadata_album_artist_name ||
          entry.artist_name ||
          entry.artistName;

        if (artistName) {
          artistNames.add(artistName);
        }

        return {
          totalStreams: summary.totalStreams + safeStreams,
          totalMinutes: summary.totalMinutes + safeMsPlayed / 60000,
          uniqueArtists: artistNames.size,
        };
      },
      {
        totalStreams: 0,
        totalMinutes: 0,
        uniqueArtists: 0,
      },
    );
  }, [filteredHistory]);

  const listeningTrend = useMemo(() => {
    return getListeningTrend(filteredHistory, timeRange);
  }, [filteredHistory, timeRange]);

  const availableYears = useMemo(() => {
    const years = displayedSpotifyHistory
      .map((item) => new Date(item.ts).getFullYear())
      .filter(Boolean);

    return [...new Set(years)].sort((a, b) => b - a);
  }, [displayedSpotifyHistory]);

  const fallbackDashboardData = useMemo(
    () => ({
      summary: {
        total_streams: historySummary.totalStreams,
        total_minutes: historySummary.totalMinutes,
        unique_artists: historySummary.uniqueArtists,
      },
      top_tracks: addRankMovementToRows(
        parsedSpotifyData.topTracks,
        previousParsedSpotifyData.topTracks,
        ["trackName", "artistName", "albumName"],
      ).map((track) => ({
        track_name: track.trackName,
        artist_name: track.artistName,
        album_name: track.albumName,
        streams: track.streams,
        minutes: track.minutesPlayed,
        rank: track.rank,
        previous_rank: track.previous_rank,
        rank_change: track.rank_change,
        rank_direction: track.rank_direction,
      })),
      top_artists: addRankMovementToRows(
        parsedSpotifyData.topArtists,
        previousParsedSpotifyData.topArtists,
        ["artistName"],
      ).map((artist) => ({
        artist_name: artist.artistName,
        streams: artist.streams,
        minutes: artist.minutesPlayed,
        rank: artist.rank,
        previous_rank: artist.previous_rank,
        rank_change: artist.rank_change,
        rank_direction: artist.rank_direction,
      })),
      top_albums: addRankMovementToRows(
        parsedSpotifyData.topAlbums,
        previousParsedSpotifyData.topAlbums,
        ["albumName", "artistName"],
      ).map((album) => ({
        album_name: album.albumName,
        artist_name: album.artistName,
        streams: album.streams,
        minutes: album.minutesPlayed,
        rank: album.rank,
        previous_rank: album.previous_rank,
        rank_change: album.rank_change,
        rank_direction: album.rank_direction,
      })),
    }),
    [historySummary, parsedSpotifyData, previousParsedSpotifyData],
  );
  const dashboardData = mlDashboardData || fallbackDashboardData;
  const mlSummary = dashboardData?.summary;

  const formatNumber = (value) => {
    if (value === undefined || value === null) return "—";
    return Number(value).toLocaleString();
  };

  const dashboardTotalStreams = mlSummary
    ? formatNumber(mlSummary.total_streams)
    : formatNumber(historySummary.totalStreams);

  const dashboardTotalMinutes = mlSummary
    ? formatNumber(Math.round(mlSummary.total_minutes))
    : formatNumber(Math.round(historySummary.totalMinutes));

  const dashboardTotalArtists = mlSummary
    ? formatNumber(mlSummary.unique_artists)
    : formatNumber(historySummary.uniqueArtists);

  const dashboardTopTracks = useMemo(
    () => (dashboardData?.top_tracks ?? []).map((track) => ({
      imageKey: getRankingImageKey(
        "track",
        track.track_name,
        track.artist_name,
        track.album_name,
      ),
      imageType: "track",
      name: track.track_name,
      artistName: track.artist_name,
      albumName: track.album_name,
      streams: track.streams,
      minutes: track.minutes,
      rank: track.rank,
      previousRank: track.previous_rank,
      rankChange: track.rank_change,
      rankDirection: track.rank_direction,
    })),
    [dashboardData],
  );

  const dashboardTopArtists = useMemo(
    () => (dashboardData?.top_artists ?? []).map((artist) => ({
      imageKey: getRankingImageKey("artist", artist.artist_name),
      imageType: "artist",
      name: artist.artist_name,
      streams: artist.streams,
      minutes: artist.minutes,
      rank: artist.rank,
      previousRank: artist.previous_rank,
      rankChange: artist.rank_change,
      rankDirection: artist.rank_direction,
    })),
    [dashboardData],
  );

  const dashboardTopAlbums = useMemo(
    () => (dashboardData?.top_albums ?? []).map((album) => ({
      imageKey: getRankingImageKey("album", album.album_name, album.artist_name),
      imageType: "album",
      name: album.album_name,
      artistName: album.artist_name,
      streams: album.streams,
      minutes: album.minutes,
      rank: album.rank,
      previousRank: album.previous_rank,
      rankChange: album.rank_change,
      rankDirection: album.rank_direction,
    })),
    [dashboardData],
  );

  const rankingImageRows = useMemo(
    () =>
      sortRowsForImageLoading([
        ...dashboardTopTracks,
        ...dashboardTopArtists,
        ...dashboardTopAlbums,
      ]),
    [dashboardTopTracks, dashboardTopArtists, dashboardTopAlbums],
  );

  const rankingImageRequestKey = useMemo(() => {
    return rankingImageRows
      .map((row) => row.imageKey)
      .join("|");
  }, [rankingImageRows]);

  const cachedRankingImageCount = useMemo(() => {
    return rankingImageRows.filter((row) => rankingImages[row.imageKey]).length;
  }, [rankingImageRows, rankingImages]);

  const retryRankingImages = () => {
    setRankingImages({});
    rankingImagesRef.current = {};
    storeRankingImages({});
    setRankingImageStatus({
      requested: 0,
      loaded: 0,
      failed: 0,
      done: false,
      rateLimited: false,
      authError: false,
    });
    setImageLoadVersion((version) => version + 1);
  };

  useEffect(() => {
    if (!rankingImageRequestKey) return;

    if (!canLoadSpotifyArtwork) {
      setRankingImageStatus({
        requested: 0,
        loaded: 0,
        failed: 0,
        done: true,
        rateLimited: false,
        authError: false,
      });
      return;
    }

    let isCancelled = false;
    const rows = rankingImageRows;

    async function fetchRowImage(row) {
      if (row.imageType === "artist") {
        const artist = await searchArtist(row.name);
        return getBestSpotifyImage(artist?.images);
      }

      if (row.imageType === "album") {
        const album = await searchAlbum(row.name, row.artistName);
        return getBestSpotifyImage(album?.images);
      }

      const track = await searchTrack(row.name, row.artistName);
      const trackImage = getBestSpotifyImage(track?.album?.images);

      if (trackImage || !row.albumName) {
        return trackImage;
      }

      const album = await searchAlbum(row.albumName, row.artistName);
      return getBestSpotifyImage(album?.images);
    }

    async function loadRankingImages() {
      const missingRows = rows.filter(
        (row) => !rankingImagesRef.current[row.imageKey],
      );

      setRankingImageStatus({
        requested: missingRows.length,
        loaded: 0,
        failed: 0,
        done: missingRows.length === 0,
        rateLimited: false,
        authError: false,
      });

      for (const row of missingRows) {
        if (isCancelled) return;

        try {
          let imageUrl = "";

          try {
            imageUrl = await fetchRowImage(row);
          } catch (error) {
            const retryAfterMs = getRetryAfterMs(error);

            if (retryAfterMs > 0) {
              setRankingImageStatus((status) => ({
                ...status,
                rateLimited: true,
              }));
              await delay(retryAfterMs);
              if (isCancelled) return;
              imageUrl = await fetchRowImage(row);
            } else {
              throw error;
            }
          }

          if (imageUrl) {
            setRankingImages((prev) => {
              if (prev[row.imageKey]) {
                return prev;
              }

              const mergedImages = {
                ...prev,
                [row.imageKey]: imageUrl,
              };
              storeRankingImages(mergedImages);
              return mergedImages;
            });
            setRankingImageStatus((status) => ({
              ...status,
              loaded: status.loaded + 1,
            }));
          } else {
            setRankingImageStatus((status) => ({
              ...status,
              failed: status.failed + 1,
            }));
          }

          await delay(IMAGE_LOOKUP_DELAY_MS);
        } catch (error) {
          setRankingImageStatus((status) => ({
            ...status,
            failed: status.failed + 1,
            authError:
              status.authError ||
              error?.response?.status === 401 ||
              error?.response?.status === 403,
            rateLimited: status.rateLimited || error?.response?.status === 429,
          }));
          console.warn("Could not load ranking image", row.name, error);
        }
      }

      if (!isCancelled) {
        setRankingImageStatus((status) => ({
          ...status,
          done: true,
        }));
      }
    }

    loadRankingImages();

    return () => {
      isCancelled = true;
    };
  }, [
    imageLoadVersion,
    rankingImageRequestKey,
    rankingImageRows,
    searchAlbum,
    searchArtist,
    searchTrack,
    canLoadSpotifyArtwork,
  ]);

  const dashboardTopTracksWithImages = useMemo(
    () =>
      dashboardTopTracks.map((track) => ({
        ...track,
        imageUrl: rankingImages[track.imageKey],
      })),
    [dashboardTopTracks, rankingImages],
  );

  const dashboardTopArtistsWithImages = useMemo(
    () =>
      dashboardTopArtists.map((artist) => ({
        ...artist,
        imageUrl: rankingImages[artist.imageKey],
      })),
    [dashboardTopArtists, rankingImages],
  );

  const dashboardTopAlbumsWithImages = useMemo(
    () =>
      dashboardTopAlbums.map((album) => ({
        ...album,
        imageUrl: rankingImages[album.imageKey],
      })),
    [dashboardTopAlbums, rankingImages],
  );

  const removeBrokenRankingImage = (imageKey) => {
    if (!imageKey) return;

    setRankingImages((prev) => {
      if (!prev[imageKey]) return prev;

      const nextImages = { ...prev };
      delete nextImages[imageKey];
      storeRankingImages(nextImages);
      return nextImages;
    });
  };

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
                <>
                  <p className="text-green-400 font-semibold">
                    Connected — {mlDashboardData.summary.total_streams} streams
                    analyzed by pandas
                  </p>

                  {listeningSyncStatus && (
                    <p className="text-xs text-gray-400 mt-1">
                      Live sync stored {syncedPlayCount.toLocaleString()} recent
                      plays
                      {listeningSyncStatus.currently_playing?.track_name
                        ? ` • Now playing: ${listeningSyncStatus.currently_playing.track_name} by ${listeningSyncStatus.currently_playing.artist_name}`
                        : ""}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-green-400 font-semibold">
                    Public demo mode — {formatNumber(historySummary.totalStreams)}{" "}
                    streams analyzed in the browser
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {historySourceLabel}. The Python ML backend is not connected
                    on this deployment yet.
                  </p>
                  {mlLoading && (
                    <p className="text-xs text-gray-500 mt-1">
                      Checking ML backend connection...
                    </p>
                  )}
                  {mlError && (
                    <p className="text-xs text-amber-300 mt-1">
                      Backend unavailable, using demo data: {mlError}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mb-6 text-sm opacity-70">
              {loading
                ? "Loading Spotify data…"
                : `${historySourceLabel} analytics — ${timeRangeLabel}`}
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

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-[#181818] rounded-lg p-4 border border-white/10">
              <p className="text-sm text-gray-300">
                {canLoadSpotifyArtwork
                  ? `Artwork loaded: ${cachedRankingImageCount}/${rankingImageRows.length}`
                  : "Sign in with Spotify to load official artwork"}
                {canLoadSpotifyArtwork && rankingImageStatus.requested > 0
                  ? ` • Current pass: ${rankingImageStatus.loaded} loaded, ${rankingImageStatus.failed} unmatched`
                  : ""}
                {canLoadSpotifyArtwork && rankingImageStatus.rateLimited
                  ? " • Spotify is slowing requests, continuing carefully"
                  : ""}
                {canLoadSpotifyArtwork && rankingImageStatus.authError
                  ? " • Spotify login needs refresh"
                  : ""}
              </p>

              <button
                onClick={retryRankingImages}
                className="bg-[#2a2a2a] hover:bg-[#333] text-white text-sm font-semibold px-4 py-2 rounded-full"
              >
                Retry artwork
              </button>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
              {mlLoading && !dashboardData ? (
                <>
                  <div className="bg-[#181818] rounded-lg p-4 h-[700px] animate-pulse" />
                  <div className="bg-[#181818] rounded-lg p-4 h-[700px] animate-pulse" />
                  <div className="bg-[#181818] rounded-lg p-4 h-[700px] animate-pulse" />
                </>
              ) : (
                <>
                  <RankingTable
                    title="Top Songs"
                    rows={dashboardTopTracksWithImages}
                    columns={["artistName", "albumName"]}
                    onImageError={removeBrokenRankingImage}
                  />

                  <RankingTable
                    title="Top Artists"
                    rows={dashboardTopArtistsWithImages}
                    columns={[]}
                    onImageError={removeBrokenRankingImage}
                  />

                  <RankingTable
                    title="Top Albums"
                    rows={dashboardTopAlbumsWithImages}
                    columns={["artistName"]}
                    onImageError={removeBrokenRankingImage}
                  />
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
