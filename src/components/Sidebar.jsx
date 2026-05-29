// src/components/Sidebar.jsx
import { useEffect, useRef, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";

function Sidebar({ playlists }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const { getFollowedArtists } = useSpotifyContext();

  const [showInput, setShowInput] = useState(false);
  const [resultArtist, setResultArtist] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState("");

  // ✅ Support both playlist shapes:
  // - playlists is an array (recommended)
  // - playlists is { items: [...] } (legacy)
  const items = Array.isArray(playlists) ? playlists : playlists?.items || [];

  const hasToken =
    Boolean(localStorage.getItem("spotify_access_token")) ||
    Boolean(localStorage.getItem("access_token"));

  const handleSearchClick = () => {
    setShowInput((prev) => !prev);
    setShowDropdown(false);
    setResultArtist(null);
    setSearchError("");
  };

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") {
      setShowDropdown(false);
      setResultArtist(null);
      setSearchError("");
    }
  };

  const handleSearch = async () => {
    const q = searchValue.trim();
    if (!q) return;

    // ✅ No token → no Spotify calls
    if (!hasToken || typeof getFollowedArtists !== "function") {
      setSearchError("Search requires Spotify authentication (mock mode).");
      setShowDropdown(false);
      setResultArtist(null);
      return;
    }

    try {
      setSearchError("");

      // In our context we normalized it to return items array.
      // If your context returns full response, we handle both.
      const res = await getFollowedArtists();
      const artistsArray = Array.isArray(res)
        ? res
        : res?.artists?.items || res?.data?.artists?.items || [];

      if (!artistsArray.length) {
        setSearchError("No followed artists found.");
        setShowDropdown(false);
        setResultArtist(null);
        return;
      }

      // Simple name match (contains), case-insensitive
      const found = artistsArray.find((a) =>
        (a.name || "").toLowerCase().includes(q.toLowerCase()),
      );

      if (found) {
        setResultArtist(found);
        setShowDropdown(true);
      } else {
        setSearchError("No matching artist found.");
        setShowDropdown(false);
        setResultArtist(null);
      }
    } catch (err) {
      console.error("Sidebar artist search failed:", err);
      setSearchError("Search failed. Please try again.");
      setShowDropdown(false);
      setResultArtist(null);
    }
  };

  const handleOnChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    if (!value.trim()) {
      setShowDropdown(false);
      setResultArtist(null);
      setSearchError("");
    }
  };

  return (
    <div className="w-[26%] h-full p-2 text-white">
      <div className="bg-[#121212] w-full rounded-lg p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Your Library</h2>
          <button
            type="button"
            className="bg-[#1f1f1f] hover:bg-[#2a2a2a] text-sm px-3 py-1 rounded-full"
          >
            + Create
          </button>
        </div>

        {/* Search */}
        <div className="relative flex gap-2 items-center">
          <button type="button" onClick={handleSearchClick} aria-label="Search">
            <IoSearch size={18} className="text-gray-400 hover:text-white" />
          </button>

          {showInput && (
            <input
              ref={inputRef}
              value={searchValue}
              onKeyDown={handleKeyDown}
              onChange={handleOnChange}
              type="text"
              placeholder="Search followed artists"
              className="w-40 text-white bg-transparent focus:border-white border-b placeholder-violet-100 outline-none"
            />
          )}

          {showInput && (
            <button
              type="button"
              onClick={handleSearch}
              className="text-xs bg-[#1f1f1f] px-2 py-1 rounded hover:bg-[#2a2a2a]"
            >
              Search
            </button>
          )}

          {/* Error */}
          {searchError && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-[#181818] rounded-md shadow-lg p-2 z-50 text-xs text-red-300">
              {searchError}
            </div>
          )}

          {/* Dropdown */}
          {showDropdown && resultArtist && !searchError && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-[#181818] rounded-md shadow-lg p-2 z-50">
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

        {/* Empty-state cards */}
        {items.length === 0 ? (
          <>
            <div className="bg-[#242424] rounded-lg p-4 flex flex-col gap-2">
              <h3 className="font-semibold text-sm">
                Create your first playlist
              </h3>
              <p className="text-xs text-gray-400">It’s easy, we’ll help you</p>
              <button
                type="button"
                className="mt-2 bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full w-fit hover:scale-105 transition"
              >
                Create playlist
              </button>
            </div>

            <div className="bg-[#242424] rounded-lg p-4 flex flex-col gap-2">
              <h3 className="font-semibold text-sm">
                Let’s find some podcasts to follow
              </h3>
              <p className="text-xs text-gray-400">
                We’ll keep you updated on new episodes
              </p>
              <button
                type="button"
                className="mt-2 bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full w-fit hover:scale-105 transition"
              >
                Browse podcasts
              </button>
            </div>
          </>
        ) : (
          /* Playlist list */
          items.map((pl) => (
            <button
              key={pl.id}
              type="button"
              className="group relative w-full flex items-center gap-2 p-2 rounded hover:bg-[#242424] text-left"
            >
              {pl.images?.[0]?.url ? (
                <img
                  src={pl.images[0].url}
                  alt={pl.name || "Playlist"}
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-[#333] rounded flex items-center justify-center">
                  🎵
                </div>
              )}

              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">
                  {pl.name || "Untitled playlist"}
                </span>
                <span className="text-xs text-gray-400">
                  Playlist • {pl.owner?.display_name || "Unknown"}
                </span>
              </div>

              <div className="absolute right-2 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                ▶
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default Sidebar;
