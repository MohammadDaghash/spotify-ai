// src/services/integratingAiAPI.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
});

// Simple in-memory cache to avoid repeated AI calls for the same artist
const cache = new Map();

/**
 * Fetch a "Top 10 songs" list (raw text) from your backend AI endpoint.
 * Returns a string (possibly empty) so the UI can safely parse it.
 */
const fetchTopSongsBySinger = async (singer) => {
  const name = (singer || "").trim();
  if (!name) return "";

  if (cache.has(name)) return cache.get(name);

  try {
    const res = await api.post("/api/songs", { singer: name });
    const songs = typeof res.data?.songs === "string" ? res.data.songs : "";
    cache.set(name, songs);
    return songs;
  } catch (error) {
    console.error("AI fetch failed:", error);
    return "";
  }
};

// Optional: allow manual cache reset (useful during development)
const clearAiSongsCache = () => cache.clear();

export { fetchTopSongsBySinger, clearAiSongsCache };
