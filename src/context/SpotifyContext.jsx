import { createContext, useContext, useEffect, useMemo, useState } from "react";
import spotifyApi from "../services/spotifyApi";
import { getListeningSyncStatus, syncRecentlyPlayed } from "../services/mlApi";

/**
 * SpotifyContext
 * - Fetches Spotify "session-wide" data once (profile, top tracks, playlists)
 * - Exposes helper functions (searchArtist, getArtist, getArtistAlbums, getFollowedArtists)
 * - Prevents repeated API calls from multiple components mounting
 */

const SpotifyContext = createContext(null);

function mapSpotifyTrackToSyncPlay(track, playedAt, source) {
  if (!track?.name || !track?.artists?.length || !playedAt) {
    return null;
  }

  return {
    track_id: track.id || "",
    track_name: track.name,
    artist_name: track.artists.map((artist) => artist.name).join(", "),
    album_name: track.album?.name || "",
    played_at: playedAt,
    duration_ms: track.duration_ms || 0,
    spotify_url: track.external_urls?.spotify || "",
    uri: track.uri || "",
    source,
  };
}

function mapCurrentlyPlaying(data) {
  const track = data?.item;

  if (!track?.name || track.type !== "track") {
    return null;
  }

  return {
    track_id: track.id || "",
    track_name: track.name,
    artist_name: track.artists?.map((artist) => artist.name).join(", ") || "",
    album_name: track.album?.name || "",
    progress_ms: data.progress_ms || 0,
    duration_ms: track.duration_ms || 0,
    is_playing: Boolean(data.is_playing),
    spotify_url: track.external_urls?.spotify || "",
  };
}

export function SpotifyProvider({ children }) {
  const [initials, setInitials] = useState("");
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listeningSyncStatus, setListeningSyncStatus] = useState(null);

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

  const getCurrentlyPlaying = async () => {
    const res = await spotifyApi.get("/me/player/currently-playing");
    return res.data || null;
  };

  const syncListeningHistory = async () => {
    const [recentlyPlayedResult, currentlyPlayingResult] = await Promise.allSettled([
      spotifyApi.get("/me/player/recently-played?limit=50"),
      getCurrentlyPlaying(),
    ]);

    const recentItems =
      recentlyPlayedResult.status === "fulfilled"
        ? recentlyPlayedResult.value.data?.items || []
        : [];

    const plays = recentItems
      .map((item) =>
        mapSpotifyTrackToSyncPlay(
          item.track,
          item.played_at,
          "spotify_recently_played",
        ),
      )
      .filter(Boolean);

    const syncResponse =
      plays.length > 0
        ? await syncRecentlyPlayed(plays)
        : await getListeningSyncStatus();

    const currentlyPlaying =
      currentlyPlayingResult.status === "fulfilled"
        ? mapCurrentlyPlaying(currentlyPlayingResult.value)
        : null;

    const nextStatus = {
      ...(syncResponse.sync || {}),
      currently_playing: currentlyPlaying,
      last_checked_at: new Date().toISOString(),
    };

    setListeningSyncStatus(nextStatus);

    return nextStatus;
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
    let syncIntervalId;

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

    async function runListeningSync() {
      try {
        await syncListeningHistory();
      } catch (err) {
        console.error("Listening sync failed:", err);

        if (!cancelled) {
          setListeningSyncStatus((prev) => ({
            ...(prev || {}),
            error: err.message,
            last_checked_at: new Date().toISOString(),
          }));
        }
      }
    }

    runListeningSync();
    syncIntervalId = window.setInterval(runListeningSync, 90_000);

    return () => {
      cancelled = true;
      window.clearInterval(syncIntervalId);
    };
  }, []);

  const value = useMemo(
    () => ({
      // data
      initials,
      tracks,
      playlists,
      loading,
      listeningSyncStatus,

      // refreshers
      refreshProfile: getUserProfile,
      refreshTopTracks: getTopTracks,
      refreshPlaylists: getUserPlaylists,
      syncListeningHistory,

      // helpers
      searchArtist,
      getArtist,
      getArtistAlbums,
      getFollowedArtists,
      getCurrentlyPlaying,
      getLiveListeningSignals,
      createPrivatePlaylistFromTracks,
    }),
    [initials, tracks, playlists, loading, listeningSyncStatus],
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
