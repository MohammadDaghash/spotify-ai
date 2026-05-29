// src/components/TopBar.jsx
import { FaSpotify, FaHome } from "react-icons/fa";
import { IoSearch } from "react-icons/io5";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";

function TopBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [resultArtist, setResultArtist] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ✅ Safe destructure with defaults (prevents crashes)
  const ctx = useSpotifyContext();
  const searchArtist = ctx?.searchArtist;
  const loading = Boolean(ctx?.loading);

  // Support both names: isName (old) and initials (new)
  const badgeText = (ctx?.isName || ctx?.initials || "").trim();

  const hasToken =
    Boolean(localStorage.getItem("spotify_access_token")) ||
    Boolean(localStorage.getItem("access_token"));

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    // ✅ If auth is unavailable, do not call Spotify
    if (!hasToken || typeof searchArtist !== "function") {
      setSearchError("Search requires Spotify authentication (mock mode).");
      setResultArtist(null);
      setShowDropdown(false);
      return;
    }

    try {
      setSearchError("");
      const artist = await searchArtist(q);

      if (artist) {
        setResultArtist(artist);
        setShowDropdown(true);
      } else {
        setResultArtist(null);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error("Artist search failed:", err);
      setSearchError("Search failed. Please try again.");
      setResultArtist(null);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") {
      setShowDropdown(false);
      setResultArtist(null);
      setSearchError("");
    }
  };

  const handleOnChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!value.trim()) {
      setShowDropdown(false);
      setResultArtist(null);
      setSearchError("");
    }
  };

  return (
    <div className="h-14 bg-black flex items-center justify-between px-4 text-white">
      <div className="flex items-center gap-4">
        <FaSpotify size={24} />
      </div>

      <div className="flex items-center gap-3 w-[40%]">
        <button
          className="bg-[#1f1f1f] p-2 rounded-full hover:bg-[#2a2a2a]"
          onClick={() => navigate("/")}
          type="button"
        >
          <FaHome size={20} />
        </button>

        <div className="relative flex items-center gap-2 bg-[#1f1f1f] px-4 py-2 rounded-full w-full hover:bg-[#2a2a2a]">
          <button onClick={handleSearch} type="button" aria-label="Search">
            <IoSearch size={18} className="text-gray-400 hover:text-white" />
          </button>

          <input
            value={query}
            onChange={handleOnChange}
            onKeyDown={handleKeyDown}
            type="text"
            placeholder="Search"
            className="bg-transparent outline-none text-sm w-full placeholder-gray-400"
          />

          {/* ✅ Small inline error (won’t crash UI) */}
          {searchError && (
            <div className="absolute left-0 right-0 top-12 bg-[#181818] rounded-md shadow-lg p-2 z-50 text-xs text-red-300">
              {searchError}
            </div>
          )}

          {/* Dropdown */}
          {showDropdown && resultArtist && !searchError && (
            <div className="absolute left-0 right-0 top-12 bg-[#181818] rounded-md shadow-lg p-2 z-50">
              <div
                className="flex items-center gap-3 p-2 hover:bg-[#2a2a2a] rounded cursor-pointer"
                onClick={() => {
                  navigate(`/artist/${resultArtist.id}`);
                  setShowDropdown(false);
                }}
              >
                {resultArtist.images?.[0]?.url ? (
                  <img
                    src={resultArtist.images[0].url}
                    alt={resultArtist.name || "Artist"}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#2a2a2a]" />
                )}

                <div>
                  <p className="text-sm font-semibold">
                    {resultArtist.name || "Unknown artist"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="text-sm font-semibold bg-white text-black px-4 py-1.5 rounded-full hover:scale-105 transition"
          type="button"
        >
          Explore Premium
        </button>

        <button
          className="text-sm text-gray-300 hover:text-white"
          type="button"
        >
          Install App
        </button>

        <div className="w-8 h-8 bg-[#1f1f1f] rounded-full flex items-center justify-center">
          <span className="text-sm font-bold">
            {loading ? "..." : badgeText || "?"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
