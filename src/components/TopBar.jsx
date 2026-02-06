// src/components/TopBar.jsx (update - replace useSpotify with context)
import { FaSpotify, FaHome } from "react-icons/fa";
import { IoSearch } from "react-icons/io5";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";

function TopBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { searchArtist, isName, loading } = useSpotifyContext();
  const [resultArtist, setResultArtist] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    const artist = await searchArtist(query);
    if (artist) {
      setResultArtist(artist);
      setShowDropdown(true);
    } else {
      setResultArtist(null);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleOnChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (!value.trim()) {
      setShowDropdown(false);
      setResultArtist(null);
    }
  };

  return (
    <div className="h-14 bg-black flex items-center justify-between px-4 text-white">
      <div className="flex items-center gap-4">
        <FaSpotify size={24} />
      </div>

      <div className="flex items-center gap-3 w-[40%]">
        <button className="bg-[#1f1f1f] p-2 rounded-full hover:bg-[#2a2a2a]">
          <FaHome size={20} />
        </button>

        {/* Fix: relative (was realative) */}
        <div className="relative flex items-center gap-2 bg-[#1f1f1f] px-4 py-2 rounded-full w-full hover:bg-[#2a2a2a]">
          <button onClick={handleSearch}>
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

          {showDropdown && resultArtist && (
            <div className="absolute left-0 right-0 top-12 bg-[#181818] rounded-md shadow-lg p-2 z-50">
              <div
                className="flex items-center gap-3 p-2 hover:bg-[#2a2a2a] rounded cursor-pointer"
                onClick={() => {
                  navigate(`/artist/${resultArtist.id}`);
                  setShowDropdown(false);
                }}
              >
                <img
                  src={resultArtist.images?.[0]?.url}
                  alt={resultArtist.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold">{resultArtist.name}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="text-sm font-semibold bg-white text-black px-4 py-1.5 rounded-full hover:scale-105 transition">
          Explore Premium
        </button>

        <button className="text-sm text-gray-300 hover:text-white">
          Install App
        </button>

        <div className="w-8 h-8 bg-[#1f1f1f] rounded-full flex items-center justify-center">
          <span className="text-sm font-bold">{loading ? "..." : isName}</span>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
