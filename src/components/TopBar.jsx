// src/components/TopBar.jsx
import { FaSpotify, FaHome } from "react-icons/fa";
import { IoSearch } from "react-icons/io5";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import AdminGateModal from "./AdminGateModal.jsx";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";
import {
  demoArtistRecommendations,
  demoGroupPlaylists,
  demoTrackRecommendations,
} from "../data/demoRecommendations.js";
import { allSpotifyHistory } from "../data/loadSpotifyHistory.js";
import { getPublicSyncedHistory } from "../services/publicListeningApi.js";
import {
  ADMIN_SESSION_CHANGED_EVENT,
  getAdminUser,
  logoutAdmin,
} from "../utils/adminAuth.js";
import { logoutAdminServerSession } from "../services/adminApi.js";
import {
  PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
  readLocalSpotifyHistory,
} from "../utils/localSpotifyHistory.js";
import { dedupeHistoryEntries } from "../utils/publicListeningHistory.js";
import {
  buildTopbarSearchEntries,
  groupTopbarSearchResults,
  searchTopbarCatalog,
} from "../utils/topbarSearch.js";

function TopBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [adminUser, setAdminUser] = useState(() => getAdminUser());
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [localSpotifyHistory, setLocalSpotifyHistory] = useState(() =>
    readLocalSpotifyHistory(),
  );
  const [publicSyncedHistory, setPublicSyncedHistory] = useState([]);
  const [searchPanelStyle, setSearchPanelStyle] = useState(null);
  const searchShellRef = useRef(null);
  const searchPanelRef = useRef(null);

  const ctx = useSpotifyContext();
  const badgeText = (ctx?.isName || ctx?.initials || "").trim();
  const isAdminMode = Boolean(adminUser);
  const searchHistoryRows = useMemo(() => {
    if (localSpotifyHistory.length > 0) {
      return localSpotifyHistory;
    }

    return dedupeHistoryEntries([...allSpotifyHistory, ...publicSyncedHistory]);
  }, [localSpotifyHistory, publicSyncedHistory]);
  const searchEntries = useMemo(
    () =>
      buildTopbarSearchEntries({
        historyRows: searchHistoryRows,
        artistRecommendations: demoArtistRecommendations,
        trackRecommendations: demoTrackRecommendations,
        groupPlaylists: demoGroupPlaylists,
      }),
    [searchHistoryRows],
  );
  const groupedSearchResults = useMemo(
    () => groupTopbarSearchResults(searchResults),
    [searchResults],
  );

  const closeSearch = useCallback(() => {
    setSearchResults([]);
    setShowDropdown(false);
    setHasSearched(false);
  }, []);

  const updateSearchPanelPosition = useCallback(() => {
    const searchShell = searchShellRef.current;

    if (!searchShell || typeof window === "undefined") return;

    const rect = searchShell.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const sidePadding = isMobile ? 12 : 0;
    const top = Math.round(rect.bottom + 8);
    const availableHeight = Math.max(220, window.innerHeight - top - 16);

    setSearchPanelStyle({
      left: Math.round(isMobile ? sidePadding : rect.left),
      maxHeight: Math.min(isMobile ? 560 : 620, availableHeight),
      top,
      width: Math.round(
        isMobile ? window.innerWidth - sidePadding * 2 : rect.width,
      ),
    });
  }, []);

  useEffect(() => {
    const syncAdminUser = () => {
      setAdminUser(getAdminUser());
    };

    window.addEventListener("storage", syncAdminUser);
    window.addEventListener(ADMIN_SESSION_CHANGED_EVENT, syncAdminUser);
    window.addEventListener("focus", syncAdminUser);

    return () => {
      window.removeEventListener("storage", syncAdminUser);
      window.removeEventListener(ADMIN_SESSION_CHANGED_EVENT, syncAdminUser);
      window.removeEventListener("focus", syncAdminUser);
    };
  }, []);

  useEffect(() => {
    if (!showDropdown) return undefined;

    updateSearchPanelPosition();

    window.addEventListener("resize", updateSearchPanelPosition);
    window.addEventListener("scroll", updateSearchPanelPosition, true);

    return () => {
      window.removeEventListener("resize", updateSearchPanelPosition);
      window.removeEventListener("scroll", updateSearchPanelPosition, true);
    };
  }, [showDropdown, updateSearchPanelPosition]);

  useEffect(() => {
    if (!showDropdown) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        searchShellRef.current?.contains(target) ||
        searchPanelRef.current?.contains(target)
      ) {
        return;
      }

      closeSearch();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeSearch, showDropdown]);

  useEffect(() => {
    const syncPrivateHistory = () => {
      setLocalSpotifyHistory(readLocalSpotifyHistory());
    };

    window.addEventListener("storage", syncPrivateHistory);
    window.addEventListener("focus", syncPrivateHistory);
    window.addEventListener(
      PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
      syncPrivateHistory,
    );

    return () => {
      window.removeEventListener("storage", syncPrivateHistory);
      window.removeEventListener("focus", syncPrivateHistory);
      window.removeEventListener(
        PRIVATE_SPOTIFY_DATA_CHANGED_EVENT,
        syncPrivateHistory,
      );
    };
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadPublicHistory() {
      try {
        const data = await getPublicSyncedHistory(500);

        if (isCurrentRequest) {
          setPublicSyncedHistory(data.history || []);
        }
      } catch {
        if (isCurrentRequest) {
          setPublicSyncedHistory([]);
        }
      }
    }

    loadPublicHistory();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const handleAdminLogout = async () => {
    logoutAdmin();
    try {
      await logoutAdminServerSession();
    } catch (error) {
      console.warn("Admin server logout failed:", error);
    }
    setAdminUser(null);
  };

  const goToDashboard = () => {
    setShowDropdown(false);
    setQuery("");
    setHasSearched(false);
    navigate("/dashboard");
  };

  const runSearch = (nextQuery, { submit = false } = {}) => {
    const q = nextQuery.trim();

    if (!q) {
      closeSearch();
      return;
    }

    const nextResults = searchTopbarCatalog(q, searchEntries);

    setSearchResults(nextResults);
    setHasSearched(true);
    setShowDropdown(true);

    if (submit && nextResults[0]) {
      openSearchResult(nextResults[0]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch(query, { submit: true });
    }

    if (e.key === "Escape") {
      setQuery("");
      closeSearch();
    }
  };

  const handleOnChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length < 2) {
      closeSearch();
      return;
    }

    runSearch(value);
  };

  const openSearchResult = (result) => {
    if (!result?.href) return;

    setShowDropdown(false);
    setQuery("");
    closeSearch();
    navigate(result.href);
  };

  const searchPanel =
    showDropdown && searchPanelStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[1000] overflow-y-auto rounded-2xl border border-white/10 bg-[#101010]/95 p-2 text-white shadow-[0_28px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl"
            data-testid="topbar-search-panel"
            ref={searchPanelRef}
            style={{
              left: `${searchPanelStyle.left}px`,
              maxHeight: `${searchPanelStyle.maxHeight}px`,
              top: `${searchPanelStyle.top}px`,
              width: `${searchPanelStyle.width}px`,
            }}
          >
            {searchResults.length > 0 ? (
              groupedSearchResults.map((group) => (
                <div key={group.label} className="py-1">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                    {group.label}
                  </p>

                  {group.items.map((result) => (
                    <button
                      key={`${result.type}-${result.title}-${result.subtitle}`}
                      className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10"
                      onClick={() => openSearchResult(result)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {result.title}
                        </span>
                        <span className="block truncate text-xs text-gray-400">
                          {result.subtitle}
                        </span>
                      </span>

                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-gray-300">
                        {result.source}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              hasSearched && (
                <div className="px-4 py-5 text-sm text-gray-400">
                  No results found
                </div>
              )
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <AdminGateModal
        isOpen={isAdminLoginOpen}
        message="Admin mode allows editing recommendation feedback. Public viewers can still browse analytics and recommendations."
        onApproved={(user) => {
          setAdminUser(user || getAdminUser());
          setIsAdminLoginOpen(false);
        }}
        onClose={() => setIsAdminLoginOpen(false)}
        title="Admin Login"
      />

      <div className="premium-topbar relative z-[900] min-h-16 bg-black flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="flex items-center gap-4">
          <button
            aria-label="Go to public dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1db954] text-black shadow-lg transition hover:scale-105 active:scale-95"
            onClick={goToDashboard}
            type="button"
          >
            <FaSpotify size={24} />
          </button>
        </div>

        <div className="order-3 flex w-full items-center gap-3 lg:order-none lg:w-[42%]">
          <button
            aria-label="Go to dashboard"
            className="bg-[#1f1f1f] p-2 rounded-full hover:bg-[#2a2a2a] transition active:scale-95"
            onClick={goToDashboard}
            type="button"
          >
            <FaHome size={20} />
          </button>

          <div
            className="relative flex w-full items-center gap-2 rounded-full bg-[#1f1f1f] px-4 py-2 hover:bg-[#2a2a2a]"
            ref={searchShellRef}
          >
            <button
              onClick={() => runSearch(query)}
              type="button"
              aria-label="Search"
            >
              <IoSearch size={18} className="text-gray-400 hover:text-white" />
            </button>

            <input
              value={query}
              onChange={handleOnChange}
              onKeyDown={handleKeyDown}
              type="text"
              placeholder="Search"
              aria-label="Search songs, artists, albums, and recommendations"
              className="bg-transparent outline-none text-sm w-full placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-gray-400">
          {badgeText ? (
            <button
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#1f1f1f] px-2 text-white transition hover:bg-[#2a2a2a]"
              onClick={() => navigate("/login")}
              title="View your Spotify data options"
              type="button"
            >
              {badgeText}
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="rounded-full bg-[#1f1f1f] px-4 py-2 text-white hover:bg-[#2a2a2a]"
              type="button"
            >
              Use your data
            </button>
          )}

          <button
            onClick={
              isAdminMode ? handleAdminLogout : () => setIsAdminLoginOpen(true)
            }
            className={`hidden rounded-full border px-3 py-1 text-xs font-semibold transition md:inline-flex ${
              isAdminMode
                ? "border-[#1db954]/40 bg-[#1db954]/10 text-[#1db954] hover:bg-[#1db954]/15"
                : "border-white/10 bg-[#1f1f1f] text-gray-300 hover:bg-[#2a2a2a]"
            }`}
            title={
              isAdminMode
                ? "Admin mode is active. Click to log out."
                : "Viewer mode is active. Click to log in as admin."
            }
            type="button"
          >
            {isAdminMode ? "Admin Mode" : "Viewer Mode"}
          </button>

          {isAdminMode && (
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1db954] text-xs font-bold text-black transition hover:scale-105 active:scale-95"
              onClick={() => navigate("/login")}
              title={adminUser.email}
              type="button"
            >
              MD
            </button>
          )}

          <button
            onClick={
              isAdminMode ? handleAdminLogout : () => setIsAdminLoginOpen(true)
            }
            className="rounded-full bg-[#1f1f1f] px-4 py-2 text-white hover:bg-[#2a2a2a]"
            type="button"
          >
            {isAdminMode ? "Admin Logout" : "Admin Login"}
          </button>

          <button
            className="hidden rounded-full px-2 py-1 text-gray-400 transition hover:text-white xl:inline"
            onClick={goToDashboard}
            type="button"
          >
            Music Intelligence
          </button>
        </div>
      </div>

      {searchPanel}
    </>
  );
}

export default TopBar;
