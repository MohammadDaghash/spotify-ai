import React from "react";
import { useState } from "react";

function Header() {
  const filters = ["All", "Music", "Podcasts"];
  const [item, setItem] = useState("All");
  return (
    <div className="flex gap-2 mb-6">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={()=>setItem(filter)}
          className={`px-4 py-1.5 rounded-full
         text-sm ${
           item === filter
             ? "bg-white text-black"
             : "bg-[#1f1f1f] text-white hover:bg-[#2a2a2a]"
         }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

export default Header;
