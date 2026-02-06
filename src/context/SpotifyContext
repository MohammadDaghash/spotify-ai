// src/context/SpotifyContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import spotifyApi from "../services/spotifyApi";

/**
 * SpotifyContext
 * - Fetches Spotify "session-wide" data once (profile, top tracks, playlists)
 * - Exposes helper functions (searchArtist, getArtist, getArtistAlbums, getFollowedArtists)
 * - Prevents repeated API calls from multiple components mounting
 */

const SpotifyContext = createContext(null);

export function SpotifyProvider({ children }) {
  const [isName, setIsName] = useState("");
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  const getUserProfile = async () => {
    const res = await spotifyApi.get("/me");
    setIsName(
      (res.data.display_name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0].toUpperCase())
        .join("")
    );
  };

  const getTopTracks = async () => {
    const res = await spotifyApi.get("/me/top/tracks?limit=10");
    setTracks(res.data.items || []);
  };

  const getUserPlaylists = async () => {
    const res = await spotifyApi.get("/me/playlists?limit=20");
    // Fix: store array, not the whole response object
    setPlaylists(res.data.items || []);
  };

  // ---- Helpers for pages/components ----

  const searchArtist = async (artistName) => {
    const q = (artistName || "").trim();
    if (!q) return null;

    const res = await spotifyApi.get(
      `/search?q=${encodeURIComponent(q)}&type=artist&limit=1`
    );
    return res.data?.artists?.items?.[0] ?? null;
  };

  const getArtist = async (id) => {
    if (!id) throw new Error("getArtist: missing id");
    const res = await spotifyApi.get(`/artists/${id}`);
    return res.data;
  };

  const getArtistAlbums = async (id) => {
    if (!id) throw new Error("getArtistAlbums: missing id");
    const res = await spotifyApi.get(
      `/artists/${id}/albums?include_groups=album,single&limit=20`
    );
    return res.data.items || [];
  };

  const getFollowedArtists = async () => {
    const res = await spotifyApi.get("/me/following?type=artist&limit=20");
    return res.data;
  };

  // ---- Initial fetch once per app session ----
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        await Promise.all([
          getUserProfile(),
          getTopTracks(),
          getUserPlaylists(),
        ]);
      } catch (err) {
        // If token missing/expired, requests will fail; keep UI stable
        console.error("Spotify bootstrap failed:", err);
        if (!cancelled) {
          setIsName("");
          setTracks([]);
          setPlaylists([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      // data
      isName,
      tracks,
      playlists,
      loading,

      // refreshers (optional)
      refreshProfile: getUserProfile,
      refreshTopTracks: getTopTracks,
      refreshPlaylists: getUserPlaylists,

      // helpers
      searchArtist,
      getArtist,
      getArtistAlbums,
      getFollowedArtists,
    }),
    [isName, tracks, playlists, loading]
  );

  return (
    <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>
  );
}

export function useSpotifyContext() {
  const ctx = useContext(SpotifyContext);
  if (!ctx) {
    throw new Error("useSpotifyContext must be used inside SpotifyProvider");
  }
  return ctx;
}
