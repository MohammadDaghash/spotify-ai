import React, { useState, useEffect, useRef } from "react";
import { IoSearch } from "react-icons/io5";
import useSpotify from "../hooks/useSpotify";
import { useNavigate } from "react-router-dom";
function Sidebar({ playlists }) {
  const navigate = useNavigate();
  const { getFollowedArtists } = useSpotify();
  const inputRef = useRef(null);
  const [showInput, setShowInput] = useState(false);
  const [resultArtist, setResultArtist] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const items = playlists?.items || [];
  const handleSearchClick = () => {
    setShowInput((prev) => !prev);
  };

  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const findName = (search, arr) => {
    search = search.toLowerCase();

    return arr.find((person) => {
      const [firstName, lastName] = person.name.toLowerCase().split(" ");
      if (firstName === search || lastName === search) return person;
    });
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    const artists = await getFollowedArtists();
    const arrayofArtists = artists.data.artists.items;
    const arrayOfNames = arrayofArtists.map((item) => ({
      name: item.name,
      id: item.id,
    }));
    const value = findName(searchValue, arrayOfNames);
    if (value) {
      setResultArtist(arrayofArtists.find(item=>item.id===value.id))
      setShowDropdown(true);
    }
  };

  const handleOnChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
  };
  return (
    <div className="w-[26%] h-full p-2 text-white">
      <div className="bg-[#121212] w-full rounded-lg p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Your Library</h2>
          <button className="bg-[#1f1f1f] hover:bg-[#2a2a2a] text-sm px-3 py-1 rounded-full">
            + Create
          </button>
        </div>
        <div className="relative flex gap-2">
          <button onClick={handleSearchClick}>
            <IoSearch size={18} className="text-gray-400 hover:text-white" />
          </button>
          {showInput ? (
            <input
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onChange={handleOnChange}
              type="text"
              placeholder="Search"
              className="w-30 text-white bg-transparent  focus:border-white border-b  placeholder-violet-100 "
            />
          ) : null}
          {showDropdown && resultArtist && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-[#181818] rounded-md shadow-lg p-2 z-50">
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
        

        {/* Card 1 */}
        {items.length === 0 ? (
          <div className="bg-[#242424] rounded-lg p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-sm">
              Create your first playlist
            </h3>
            <p className="text-xs text-gray-400">It’s easy, we’ll help you</p>
            <button className="mt-2 bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full w-fit hover:scale-105 transition">
              Create playlist
            </button>
          </div>
        ) : (
          /* Playlist List */
          items.map((pl) => (
            <button
              key={pl.id}
              type="button"
              className="
                group relative w-full
                flex items-center gap-2 p-2 rounded
                hover:bg-[#242424]
                text-left
              "
            >
              {/* Image / placeholder */}
              {pl.images ? (
                <img
                  src={pl.images[0].url}
                  alt={pl.name}
                  className="w-12 h-12 rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-[#333] rounded flex items-center justify-center">
                  🎵
                </div>
              )}

              {/* Text */}
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">
                  {pl.name}
                </span>
                <span className="text-xs text-gray-400">
                  Playlist • {pl.owner.display_name}
                </span>
              </div>

              {/* ▶ Play triangle (HIDDEN until hover) */}
              <div
                className="
        absolute right-0.49
        w-12 h-12 rounded-full
        bg-[#none]
        flex items-center justify-center
        opacity-0
        group-hover:opacity-100
        transition
      "
              >
                ▶
              </div>
            </button>
          ))
        )}

        {/* Card 2 */}
        {items.length === 0 ? (
          <div className="bg-[#242424] rounded-lg p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-sm">
              Let’s find some podcasts to follow
            </h3>
            <p className="text-xs text-gray-400">
              We’ll keep you updated on new episodes
            </p>
            <button className="mt-2 bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full w-fit hover:scale-105 transition">
              Browse podcasts
            </button>
          </div>
        ) : (
          <div></div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
