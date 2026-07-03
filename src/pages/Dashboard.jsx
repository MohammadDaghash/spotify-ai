// src/pages/Dashboard.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/layout/Header.jsx";
import AdminGateModal from "../components/AdminGateModal.jsx";
import StatCard from "../components/common/StatCard.jsx";
import PrivateDataModeNotice from "../components/dashboard/PrivateDataModeNotice.jsx";
import RankingTable from "../components/dashboard/RankingTable.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSpotifyContext } from "../context/useSpotifyContext.js";
import { allSpotifyHistory } from "../data/loadSpotifyHistory.js";
import { parseSpotifyHistory } from "../utils/spotifyDataParser.js";
import {
  PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
  readLocalSpotifyHistory,
  returnToPublicDemoMode,
} from "../utils/localSpotifyHistory.js";
import { dedupeHistoryEntries } from "../utils/publicListeningHistory.js";
import {
  addRankMovementToRows,
  getPreviousHistoryWindow,
} from "../utils/rankMovement.js";
import { hasSpotifyAccessToken } from "../utils/spotifySession.js";
import { getAdminUser, isAdmin } from "../utils/adminAuth.js";
import ListeningTrendChart from "../components/charts/ListeningTrendChart.jsx";
import { getListeningTrend } from "../utils/spotifyDataParser.js";
import { getMlDashboardAnalytics } from "../services/mlApi";
import {
  getPublicListeningStatus,
  getPublicSyncedHistory,
  syncPublicListeningNow,
} from "../services/publicListeningApi.js";
import { loginAdminServerSession } from "../services/adminApi.js";
import { redirectToSpotifyLogin } from "../services/spotifyAuth.js";
import { useDashboardRankingImages } from "../hooks/useDashboardRankingImages.js";
import {
  getRankingImageKey,
  sortRowsForImageLoading,
} from "../utils/dashboardImageUtils.js";
import { rowMatchesDashboardSearch } from "../utils/dashboardSearch.js";

function formatSyncTime(value) {
  if (!value) return "Not synced yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return date.toLocaleString();
}

function formatEnvList(values = []) {
  return values.length > 0 ? values.join(", ") : "";
}

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [publicSyncStatus, setPublicSyncStatus] = useState(null);
  const [publicSyncError, setPublicSyncError] = useState("");
  const [publicSyncedHistory, setPublicSyncedHistory] = useState([]);
  const [manualSyncState, setManualSyncState] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const [coverLoginError, setCoverLoginError] = useState("");
  const [adminGate, setAdminGate] = useState({
    isOpen: false,
    actionLabel: "",
  });
  const syncedPlayCount = listeningSyncStatus?.total_plays || 0;
  const liveSyncVersion = listeningSyncStatus?.last_checked_at || "";
  const canLoadSpotifyArtwork = hasSpotifyAccessToken();
  const dashboardSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const dashboardSearchQuery =
    dashboardSearchParams.get("search")?.trim() || "";
  const dashboardSearchType = dashboardSearchParams.get("type") || "";
  const activeDashboardSearchType = ["song", "artist", "album"].includes(
    dashboardSearchType,
  )
    ? dashboardSearchType
    : "";
  const isDashboardSearchActive = Boolean(dashboardSearchQuery);
  const publicSpotifyHistory = useMemo(
    () => dedupeHistoryEntries([...allSpotifyHistory, ...publicSyncedHistory]),
    [publicSyncedHistory],
  );
  const displayedSpotifyHistory =
    localSpotifyHistory.length > 0 ? localSpotifyHistory : publicSpotifyHistory;
  const isPrivateSpotifyHistory = localSpotifyHistory.length > 0;
  const historySourceLabel =
    isPrivateSpotifyHistory
      ? "Your private Spotify data stored in this browser"
      : publicSyncedHistory.length > 0
        ? "Public demo Spotify history + synced recent Spotify plays"
        : "Public demo Spotify history";

  const loadPublicListeningData = useCallback(async () => {
    const [statusData, recentData] = await Promise.all([
      getPublicListeningStatus(),
      getPublicSyncedHistory(500),
    ]);

    return {
      sync: recentData.sync || statusData.sync || null,
      history: recentData.history || [],
    };
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;

    async function refreshPublicListeningData() {
      try {
        setPublicSyncError("");
        const data = await loadPublicListeningData();

        if (isCurrentRequest) {
          setPublicSyncStatus(data.sync);
          setPublicSyncedHistory(data.history);
        }
      } catch (error) {
        if (isCurrentRequest) {
          setPublicSyncError(
            error.message || "Could not load public listening sync status.",
          );
        }
      }
    }

    refreshPublicListeningData();

    return () => {
      isCurrentRequest = false;
    };
  }, [loadPublicListeningData]);

  useEffect(() => {
    const refreshLocalHistory = () => {
      setLocalSpotifyHistory(readLocalSpotifyHistory());
    };

    window.addEventListener("focus", refreshLocalHistory);
    window.addEventListener("storage", refreshLocalHistory);
    window.addEventListener(
      PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
      refreshLocalHistory,
    );

    return () => {
      window.removeEventListener("focus", refreshLocalHistory);
      window.removeEventListener("storage", refreshLocalHistory);
      window.removeEventListener(
        PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
        refreshLocalHistory,
      );
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
  const dashboardData = isPrivateSpotifyHistory
    ? fallbackDashboardData
    : mlDashboardData || fallbackDashboardData;
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

  const visibleDashboardTopTracks = useMemo(() => {
    if (!isDashboardSearchActive) return dashboardTopTracks;
    if (activeDashboardSearchType && activeDashboardSearchType !== "song") {
      return [];
    }

    return dashboardTopTracks.filter((track) =>
      rowMatchesDashboardSearch(track, dashboardSearchQuery),
    );
  }, [
    activeDashboardSearchType,
    dashboardSearchQuery,
    dashboardTopTracks,
    isDashboardSearchActive,
  ]);

  const visibleDashboardTopArtists = useMemo(() => {
    if (!isDashboardSearchActive) return dashboardTopArtists;
    if (activeDashboardSearchType && activeDashboardSearchType !== "artist") {
      return [];
    }

    return dashboardTopArtists.filter((artist) =>
      rowMatchesDashboardSearch(artist, dashboardSearchQuery),
    );
  }, [
    activeDashboardSearchType,
    dashboardSearchQuery,
    dashboardTopArtists,
    isDashboardSearchActive,
  ]);

  const visibleDashboardTopAlbums = useMemo(() => {
    if (!isDashboardSearchActive) return dashboardTopAlbums;
    if (activeDashboardSearchType && activeDashboardSearchType !== "album") {
      return [];
    }

    return dashboardTopAlbums.filter((album) =>
      rowMatchesDashboardSearch(album, dashboardSearchQuery),
    );
  }, [
    activeDashboardSearchType,
    dashboardSearchQuery,
    dashboardTopAlbums,
    isDashboardSearchActive,
  ]);

  const rankingImageRows = useMemo(
    () =>
      sortRowsForImageLoading([
        ...visibleDashboardTopTracks,
        ...visibleDashboardTopArtists,
        ...visibleDashboardTopAlbums,
      ]),
    [
      visibleDashboardTopTracks,
      visibleDashboardTopArtists,
      visibleDashboardTopAlbums,
    ],
  );

  const {
    addImagesToRows,
    cachedRankingImageCount,
    rankingImageStatus,
    removeBrokenRankingImage,
    retryRankingImages,
  } = useDashboardRankingImages({
    canLoadSpotifyArtwork,
    rankingImageRows,
    searchAlbum,
    searchArtist,
    searchTrack,
  });

  const coverImageStatusText = useMemo(() => {
    if (!canLoadSpotifyArtwork) {
      return "Sign in with Spotify to load official album covers and artist images. Placeholder initials are shown until you connect Spotify.";
    }

    const statusParts = [
      `Album covers / artist images loaded: ${cachedRankingImageCount}/${rankingImageRows.length}`,
    ];

    if (rankingImageStatus.requested > 0) {
      statusParts.push(
        `Current pass: ${rankingImageStatus.loaded} loaded, ${rankingImageStatus.failed} unmatched`,
      );
    }

    if (rankingImageStatus.rateLimited) {
      statusParts.push(
        "Spotify is limiting cover/image requests. Wait a moment, then retry.",
      );
    } else if (rankingImageStatus.authError) {
      statusParts.push("Spotify login needs refresh before images can load.");
    } else if (rankingImageStatus.done && rankingImageStatus.failed > 0) {
      statusParts.push(
        "Some album covers or artist images were not matched. Retry can check again.",
      );
    }

    return statusParts.join(" • ");
  }, [
    cachedRankingImageCount,
    canLoadSpotifyArtwork,
    rankingImageRows.length,
    rankingImageStatus.authError,
    rankingImageStatus.done,
    rankingImageStatus.failed,
    rankingImageStatus.loaded,
    rankingImageStatus.rateLimited,
    rankingImageStatus.requested,
  ]);

  const runManualSync = async () => {
    try {
      setManualSyncState({
        loading: true,
        message: "",
        error: "",
      });

      const adminUser = getAdminUser();

      if (adminUser?.email) {
        await loginAdminServerSession(adminUser.email);
      }

      const syncResult = await syncPublicListeningNow();
      const refreshedData = await loadPublicListeningData();

      setPublicSyncStatus(refreshedData.sync || syncResult.sync || null);
      setPublicSyncedHistory(refreshedData.history || []);
      setManualSyncState({
        loading: false,
        message: syncResult.ok
          ? `Sync finished. ${syncResult.inserted || 0} new plays added.`
          : "Sync request finished without adding plays.",
        error: "",
      });
    } catch (error) {
      setManualSyncState({
        loading: false,
        message: "",
        error: error.message || "Manual sync failed.",
      });
    }
  };

  const requestManualSync = () => {
    if (isAdmin()) {
      runManualSync();
      return;
    }

    setAdminGate({
      isOpen: true,
      actionLabel: "Sync Spotify listening data",
    });
  };

  const closeAdminGate = () => {
    setAdminGate({
      isOpen: false,
      actionLabel: "",
    });
  };

  const connectSpotifyForCovers = async () => {
    try {
      setCoverLoginError("");
      await redirectToSpotifyLogin({
        authMode: "connect",
        returnPath: `${location.pathname}${location.search}`,
      });
    } catch (error) {
      setCoverLoginError(
        error.message || "Spotify login is not configured correctly.",
      );
    }
  };

  const returnDashboardToPublicDemo = () => {
    returnToPublicDemoMode();
    setLocalSpotifyHistory([]);
    navigate("/dashboard", { replace: true });
  };

  const dashboardTopTracksWithImages = useMemo(
    () => addImagesToRows(visibleDashboardTopTracks),
    [addImagesToRows, visibleDashboardTopTracks],
  );

  const dashboardTopArtistsWithImages = useMemo(
    () => addImagesToRows(visibleDashboardTopArtists),
    [addImagesToRows, visibleDashboardTopArtists],
  );

  const dashboardTopAlbumsWithImages = useMemo(
    () => addImagesToRows(visibleDashboardTopAlbums),
    [addImagesToRows, visibleDashboardTopAlbums],
  );

  const clearDashboardSearch = () => {
    navigate("/dashboard");
  };

  return (
    <div className="app-shell h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="fade-in p-6 text-white overflow-y-auto h-full">
            <Header />

            <div className="mb-4 bg-[#181818] rounded-lg p-4 border border-white/10">
              <p className="text-sm text-gray-400">Python ML Backend</p>

              {mlDashboardData && !isPrivateSpotifyHistory ? (
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
                    {isPrivateSpotifyHistory ? "Private mode" : "Public demo mode"}{" "}
                    — {formatNumber(historySummary.totalStreams)}{" "}
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

            <div className="mb-4 flex flex-col gap-4 bg-[#181818] rounded-lg p-4 border border-white/10 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-gray-400">Public Spotify Sync</p>
                <p className="text-green-400 font-semibold">
                  Last synced: {formatSyncTime(publicSyncStatus?.last_synced_at)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {publicSyncStatus?.configured
                    ? `${(publicSyncStatus.total_plays || 0).toLocaleString()} recent API plays stored server-side`
                    : `Server-side Spotify sync is not configured yet${
                        formatEnvList(publicSyncStatus?.missing_required_env)
                          ? `; missing: ${formatEnvList(publicSyncStatus.missing_required_env)}`
                          : ""
                      }. Imported public history is still available.`}
                  {publicSyncStatus?.latest_played_at
                    ? ` • Latest play: ${formatSyncTime(publicSyncStatus.latest_played_at)}`
                    : ""}
                  {publicSyncStatus?.currently_playing?.track_name
                    ? ` • Now playing: ${publicSyncStatus.currently_playing.track_name} by ${publicSyncStatus.currently_playing.artist_name}`
                    : ""}
                  {publicSyncStatus?.configured &&
                  publicSyncStatus?.missing_recommended_env?.length
                    ? ` • Add ${formatEnvList(publicSyncStatus.missing_recommended_env)} for persistent Vercel storage`
                    : ""}
                </p>
                {publicSyncError && (
                  <p className="text-xs text-amber-300 mt-1">
                    Public sync status unavailable: {publicSyncError}
                  </p>
                )}
                {manualSyncState.message && (
                  <p className="text-xs text-green-300 mt-1">
                    {manualSyncState.message}
                  </p>
                )}
                {manualSyncState.error && (
                  <p className="text-xs text-red-300 mt-1">
                    {manualSyncState.error}
                  </p>
                )}
              </div>

              <button
                onClick={requestManualSync}
                disabled={manualSyncState.loading}
                className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {manualSyncState.loading ? "Syncing..." : "Sync now"}
              </button>
            </div>

            <div className="mb-6 text-sm opacity-70">
              {loading
                ? "Loading Spotify data…"
                : `${historySourceLabel} analytics — ${timeRangeLabel}`}
            </div>

            {isPrivateSpotifyHistory && (
              <PrivateDataModeNotice
                onBackToDemo={returnDashboardToPublicDemo}
                onImportHistory={() => navigate("/login")}
              />
            )}

            {isDashboardSearchActive && (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-sky-400/20 bg-sky-400/10 p-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-sky-100">
                  Showing dashboard results for{" "}
                  <span className="font-semibold">“{dashboardSearchQuery}”</span>
                  {activeDashboardSearchType
                    ? ` in ${activeDashboardSearchType}s`
                    : ""}
                  .
                </p>

                <button
                  className="self-start rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition hover:scale-[1.02] md:self-auto"
                  onClick={clearDashboardSearch}
                  type="button"
                >
                  Clear search
                </button>
              </div>
            )}

            <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Streams analyzed"
                value={dashboardTotalStreams}
                subtitle={
                  isPrivateSpotifyHistory
                    ? "From private browser data"
                    : mlDashboardData
                      ? "From Python/pandas"
                      : "From public history"
                }
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
                {coverImageStatusText}
              </p>

              {canLoadSpotifyArtwork ? (
                <button
                  onClick={retryRankingImages}
                  className="bg-[#2a2a2a] hover:bg-[#333] text-white text-sm font-semibold px-4 py-2 rounded-full"
                  title="Retry loading Spotify album covers and artist images"
                  type="button"
                >
                  Retry covers
                </button>
              ) : (
                <button
                  onClick={connectSpotifyForCovers}
                  className="bg-[#1db954] hover:bg-[#1ed760] text-black text-sm font-bold px-4 py-2 rounded-full transition hover:scale-[1.02]"
                  title="Open the Spotify sign-in and data import flow"
                  type="button"
                >
                  Sign in to load covers
                </button>
              )}

              {coverLoginError && (
                <p className="basis-full text-xs text-red-300">
                  {coverLoginError}
                </p>
              )}
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

      <AdminGateModal
        actionLabel={adminGate.actionLabel}
        isOpen={adminGate.isOpen}
        message="Admin login required to manually sync public Spotify data."
        onApproved={() => {
          closeAdminGate();
          runManualSync();
        }}
        onClose={closeAdminGate}
        title="Admin login required"
      />
    </div>
  );
}

export default Dashboard;
