// src/components/AlbumCard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTopSongsBySinger } from "../services/integratingAiAPI.js";

export default function AlbumCard({ album, artistName }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const [aiSongs, setAiSongs] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFetched, setAiFetched] = useState(false);
  const [aiError, setAiError] = useState("");

  // Prevent duplicate fetches caused by quick hover+click
  const fetchLockRef = useRef(false);

  // Prevent setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const year = useMemo(() => album?.release_date?.slice?.(0, 4) ?? "", [album]);

  const parseAiSongs = (raw) => {
    return String(raw || "")
      .split("\n")
      .map((line) =>
        line
          .replace(/^\s*[-•]\s*/, "")
          .replace(/^\s*\d+[.)]\s*/, "")
          .trim()
      )
      .filter(Boolean)
      .slice(0, 10);
  };

  const ensureAiSongs = async () => {
    if (!artistName) return;
    if (aiFetched) return;
    if (fetchLockRef.current) return;

    fetchLockRef.current = true;
    setAiLoading(true);
    setAiError("");

    try {
      const raw = await fetchTopSongsBySinger(artistName);
      const parsed = parseAiSongs(raw);

      if (!mountedRef.current) return;

      setAiSongs(parsed);
      setAiFetched(true);

      // If backend returned empty, treat as an error-ish state for clarity
      if (!parsed.length) {
        setAiError("AI returned no songs.");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("AlbumCard AI fetch failed:", err);
      setAiError("AI is unavailable right now.");
      setAiSongs([]);
    } finally {
      if (mountedRef.current) setAiLoading(false);
      fetchLockRef.current = false;
    }
  };

  const onHoverEnter = () => {
    setHoverOpen(true);
    ensureAiSongs();
  };

  const onHoverLeave = () => setHoverOpen(false);

  const onClickFlip = async () => {
    await ensureAiSongs();
    setFlipped((p) => !p);
  };

  // Close popup when flipped to reduce clutter
  useEffect(() => {
    if (flipped) setHoverOpen(false);
  }, [flipped]);

  return (
    <div className="relative min-w-[180px] hover:bg-[#1a1a1a] p-3 rounded-lg">
      <div
        className="relative w-full h-44 cursor-pointer"
        style={{ perspective: "1000px" }}
        onMouseEnter={onHoverEnter}
        onMouseLeave={onHoverLeave}
        onClick={onClickFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClickFlip();
        }}
        aria-label={`Album ${album?.name ?? ""}`}
      >
        <div
          className="absolute inset-0 transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden" }}
          >
            <img
              src={album?.images?.[0]?.url}
              alt={album?.name}
              className="w-full h-full object-cover rounded-md"
              draggable={false}
            />
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 rounded-md flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-700 shadow-2xl overflow-hidden p-3"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="w-full text-xs">
              <p className="font-semibold mb-2">Top 10 songs</p>

              {aiLoading ? (
                <p className="text-gray-200">Loading…</p>
              ) : aiError ? (
                <p className="text-gray-200">{aiError}</p>
              ) : aiSongs.length ? (
                <ul className="space-y-1">
                  {aiSongs.map((s, i) => (
                    <li key={i} className="truncate">
                      • {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-200">No results</p>
              )}
            </div>
          </div>
        </div>

        {/* HOVER POPUP */}
        {hoverOpen && !flipped && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-[#181818] rounded-md shadow-lg p-3 z-50">
            <p className="text-xs font-semibold mb-2">More songs (AI)</p>

            {aiLoading ? (
              <p className="text-xs text-gray-300">Loading…</p>
            ) : aiError ? (
              <p className="text-xs text-gray-300">{aiError}</p>
            ) : aiSongs.length ? (
              <ul className="text-xs text-gray-200 space-y-1">
                {aiSongs.slice(0, 6).map((s, i) => (
                  <li key={i} className="truncate">
                    • {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-300">No results</p>
            )}

            <p className="mt-2 text-[11px] text-gray-400">
              Click album to flip.
            </p>
          </div>
        )}
      </div>

      {/* Album meta */}
      <p className="mt-2 text-sm font-semibold truncate text-white">
        {album?.name}
      </p>
      <p className="text-xs text-gray-400">{year}</p>
    </div>
  );
}
