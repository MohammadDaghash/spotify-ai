import { createContext, useContext, useEffect, useMemo, useState } from "react";
import spotifyApi from "../services/spotifyApi";

/**
 * SpotifyContext
 * - Fetches Spotify "session-wide" data once (profile, top tracks, playlists)
 * - Exposes helper functions (searchArtist, getArtist, getArtistAlbums, getFollowedArtists)
 * - Prevents repeated API calls from multiple components mounting
 */

const SpotifyContext = createContext(null);

export function SpotifyProvider({ children }) {
  const [initials, setInitials] = useState("");
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- Base fetchers ----

  const getUserProfile = async () => {
    const res = await spotifyApi.get("/me");
    setInitials(
      (res.data.display_name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0].toUpperCase())
        .join(""),
    );
  };

  const getTopTracks = async () => {
    const res = await spotifyApi.get("/me/top/tracks?limit=10");
    setTracks(res.data.items || []);
  };

  const getUserPlaylists = async () => {
    const res = await spotifyApi.get("/me/playlists?limit=20");
    setPlaylists(res.data.items || []);
  };

  // ---- Helpers for pages/components ----

  const searchArtist = async (artistName) => {
    const q = (artistName || "").trim();
    if (!q) return null;

    const res = await spotifyApi.get(
      `/search?q=${encodeURIComponent(q)}&type=artist&limit=1`,
    );
    return res.data?.artists?.items?.[0] ?? null;
  };

  const searchTrack = async (trackName, artistName) => {
    const track = (trackName || "").trim();
    const artist = (artistName || "").trim();
    if (!track) return null;

    const query = artist ? `track:${track} artist:${artist}` : track;
    const res = await spotifyApi.get(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    );

    return res.data?.tracks?.items?.[0] || null;
  };

  const getArtist = async (id) => {
    if (!id) return null;
    const res = await spotifyApi.get(`/artists/${id}`);
    return res.data;
  };

  const getArtistAlbums = async (id) => {
    if (!id) return [];
    const res = await spotifyApi.get(
      `/artists/${id}/albums?include_groups=album,single&limit=20`,
    );
    return res.data.items || [];
  };

  const getFollowedArtists = async () => {
    const res = await spotifyApi.get("/me/following?type=artist&limit=20");
    return res.data?.artists?.items || [];
  };

  const getLiveListeningSignals = async () => {
    const [recentlyPlayed, savedTracks, shortTermTop, mediumTermTop, longTermTop] =
      await Promise.allSettled([
        spotifyApi.get("/me/player/recently-played?limit=50"),
        spotifyApi.get("/me/tracks?limit=50"),
        spotifyApi.get("/me/top/tracks?time_range=short_term&limit=50"),
        spotifyApi.get("/me/top/tracks?time_range=medium_term&limit=50"),
        spotifyApi.get("/me/top/tracks?time_range=long_term&limit=50"),
      ]);

    const getResultData = (result) =>
      result.status === "fulfilled" ? result.value.data : null;

    const recentlyPlayedTracks =
      getResultData(recentlyPlayed)?.items?.map((item) => item.track) || [];

    const savedTrackItems = getResultData(savedTracks)?.items || [];
    const savedTrackList = savedTrackItems.map((item) => item.track);

    const topTrackLists = [shortTermTop, mediumTermTop, longTermTop].flatMap(
      (result) => getResultData(result)?.items || [],
    );

    return {
      recentlyPlayedTracks,
      savedTracks: savedTrackList,
      topTracks: topTrackLists,
    };
  };

  const createPrivatePlaylistFromTracks = async ({
    name,
    description,
    tracks: playlistTracks,
  }) => {
    const profile = await spotifyApi.get("/me");
    const userId = profile.data?.id;

    if (!userId) {
      throw new Error("Could not find Spotify user profile.");
    }

    const playlist = await spotifyApi.post(`/users/${userId}/playlists`, {
      name,
      description,
      public: false,
    });

    const trackUris = [];

    for (const track of playlistTracks) {
      const spotifyTrack = await searchTrack(track.track_name, track.artist_name);

      if (spotifyTrack?.uri) {
        trackUris.push(spotifyTrack.uri);
      }
    }

    if (trackUris.length > 0) {
      await spotifyApi.post(`/playlists/${playlist.data.id}/tracks`, {
        uris: trackUris,
      });
    }

    return playlist.data?.external_urls?.spotify;
  };

  // ---- Initial fetch once per app session ----
  useEffect(() => {
    let cancelled = false;

    const token =
      localStorage.getItem("spotify_access_token") ||
      localStorage.getItem("access_token");

    // ⛔ No token → do not call Spotify
    if (!token) {
      setLoading(false);
      setInitials("");
      setTracks([]);
      setPlaylists([]);
      return;
    }

    async function bootstrap() {
      try {
        setLoading(true);
        await Promise.all([
          getUserProfile(),
          getTopTracks(),
          getUserPlaylists(),
        ]);
      } catch (err) {
        console.error("Spotify bootstrap failed:", err);
        if (!cancelled) {
          setInitials("");
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
  }, []);

  const value = useMemo(
    () => ({
      // data
      initials,
      tracks,
      playlists,
      loading,

      // refreshers
      refreshProfile: getUserProfile,
      refreshTopTracks: getTopTracks,
      refreshPlaylists: getUserPlaylists,

      // helpers
      searchArtist,
      getArtist,
      getArtistAlbums,
      getFollowedArtists,
      getLiveListeningSignals,
      createPrivatePlaylistFromTracks,
    }),
    [initials, tracks, playlists, loading],
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
