import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import spotifyApi from "../services/spotifyApi";
import { getListeningSyncStatus, syncRecentlyPlayed } from "../services/mlApi";

/**
 * SpotifyContext
 * - Fetches Spotify "session-wide" data once (profile, top tracks, playlists)
 * - Exposes helper functions (searchArtist, getArtist, getArtistAlbums, getFollowedArtists)
 * - Prevents repeated API calls from multiple components mounting
 */

const SpotifyContext = createContext(null);
const LISTENING_SYNC_INTERVAL_MS = 30_000;
const MIN_CURRENT_PLAY_PROGRESS_MS = 30_000;
const ALBUM_EDITION_PATTERN =
  /\s*(?:(?:\(|\[|\{)\s*(?:.*?\bdeluxe\b.*?|.*?\bexpanded\b.*?|.*?\bbonus\b.*?|.*?\banniversary\b.*?|.*?\bremaster(?:ed)?\b.*?|.*?\bspecial\b.*?\bedition\b.*?|.*?\bcomplete\b.*?)\s*(?:\)|\]|\})|(?:-|–|—|:)\s*(?:.*?\bdeluxe\b.*?|.*?\bexpanded\b.*?|.*?\bbonus\b.*?|.*?\banniversary\b.*?|.*?\bremaster(?:ed)?\b.*?|.*?\bspecial\b.*?\bedition\b.*?|.*?\bcomplete\b.*?)|\s+(?:\bdeluxe\b.*?|\bexpanded\b.*?|\bbonus\b.*?|\banniversary\b.*?|\bremaster(?:ed)?\b.*?|\bspecial\b.*?\bedition\b.*?|\bcomplete\b.*?))\s*$/i;

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function namesAreCompatible(candidateName, targetName) {
  const candidate = normalizeForMatch(candidateName);
  const target = normalizeForMatch(targetName);

  if (!candidate || !target) return false;
  if (candidate === target) return true;

  const shortestLength = Math.min(candidate.length, target.length);

  if (shortestLength < 6) return false;

  return (
    candidate.startsWith(`${target} `) ||
    target.startsWith(`${candidate} `)
  );
}

function canonicalAlbumName(albumName) {
  let cleanName = String(albumName || "").trim();
  let previousName = "";

  while (cleanName && previousName !== cleanName) {
    previousName = cleanName;
    cleanName = cleanName.replace(ALBUM_EDITION_PATTERN, "").trim();
  }

  return cleanName.replace(/\s+/g, " ").trim();
}

function splitArtistNames(artistName) {
  return String(artistName || "")
    .split(/\s*(?:,|&|\band\b|feat\.?|ft\.?)\s*/i)
    .map(normalizeForMatch)
    .filter(Boolean);
}

function getPrimaryArtistName(artistName) {
  return (
    String(artistName || "")
      .split(/\s*(?:,|&|\band\b|feat\.?|ft\.?)\s*/i)
      .map((artist) => artist.trim())
      .filter(Boolean)[0] || String(artistName || "").trim()
  );
}

function buildSearchPath(query, type, limit = 10) {
  const params = new URLSearchParams({
    q: query,
    type,
    limit: String(limit),
  });

  return `/search?${params.toString()}`;
}

function spotifyArtistMatches(candidateArtists = [], targetArtistName) {
  const targetArtists = splitArtistNames(targetArtistName);

  if (targetArtists.length === 0) {
    return true;
  }

  return candidateArtists.some((artist) => {
    const candidateName = normalizeForMatch(artist?.name);
    return targetArtists.some((targetName) =>
      namesAreCompatible(candidateName, targetName),
    );
  });
}

function pickMatchingArtist(items = [], artistName, allowFirstFallback = false) {
  const targetName = normalizeForMatch(artistName);

  return (
    items.find((artist) => normalizeForMatch(artist?.name) === targetName) ||
    items.find((artist) => namesAreCompatible(artist?.name, targetName)) ||
    (allowFirstFallback ? items[0] : null) ||
    null
  );
}

function pickMatchingTrack(
  items = [],
  trackName,
  artistName,
  allowFirstFallback = false,
) {
  const targetTrack = normalizeForMatch(trackName);

  return (
    items.find((track) => {
      return (
        normalizeForMatch(track?.name) === targetTrack &&
        spotifyArtistMatches(track?.artists, artistName)
      );
    }) ||
    items.find((track) => {
      return (
        namesAreCompatible(track?.name, targetTrack) &&
        spotifyArtistMatches(track?.artists, artistName)
      );
    }) ||
    (allowFirstFallback ? items[0] : null) ||
    null
  );
}

function pickMatchingAlbum(
  items = [],
  albumName,
  artistName,
  allowFirstFallback = false,
) {
  const targetAlbum = normalizeForMatch(canonicalAlbumName(albumName));
  const exactNameMatch = items.find((album) => {
    return (
      normalizeForMatch(album?.name) === targetAlbum &&
      spotifyArtistMatches(album?.artists, artistName)
    );
  });

  if (exactNameMatch) {
    return exactNameMatch;
  }

  return (
    items.find((album) => {
      return (
        namesAreCompatible(canonicalAlbumName(album?.name), targetAlbum) &&
        spotifyArtistMatches(album?.artists, artistName)
      );
    }) ||
    (allowFirstFallback ? items[0] : null) ||
    null
  );
}

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

function mapCurrentlyPlayingToSyncPlay(data) {
  const track = data?.item;
  const progressMs = data?.progress_ms || 0;

  if (
    !data?.is_playing ||
    !track?.name ||
    track.type !== "track" ||
    progressMs < MIN_CURRENT_PLAY_PROGRESS_MS
  ) {
    return null;
  }

  const estimatedStartedAt = new Date(Date.now() - progressMs);
  estimatedStartedAt.setSeconds(0, 0);
  const trackId = track.id || "";
  const playKey = `current:${trackId || track.name}:${estimatedStartedAt.toISOString()}`;

  return {
    play_key: playKey,
    track_id: trackId,
    track_name: track.name,
    artist_name: track.artists?.map((artist) => artist.name).join(", ") || "",
    album_name: track.album?.name || "",
    played_at: estimatedStartedAt.toISOString(),
    duration_ms: Math.min(progressMs, track.duration_ms || progressMs),
    spotify_url: track.external_urls?.spotify || "",
    uri: track.uri || "",
    source: "spotify_currently_playing",
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

  const searchArtist = useCallback(async (artistName) => {
    const q = (artistName || "").trim();
    if (!q) return null;

    const res = await spotifyApi.get(buildSearchPath(q, "artist", 10));
    return pickMatchingArtist(res.data?.artists?.items, q, true);
  }, []);

  const searchTrack = useCallback(async (trackName, artistName) => {
    const track = (trackName || "").trim();
    const artist = (artistName || "").trim();
    if (!track) return null;

    const primaryArtist = getPrimaryArtistName(artist);
    const queries = [
      primaryArtist ? `${track} ${primaryArtist}` : "",
      artist && artist !== primaryArtist ? `${track} ${artist}` : "",
      track,
    ].filter(Boolean);

    for (const query of [...new Set(queries)]) {
      const res = await spotifyApi.get(buildSearchPath(query, "track", 10));
      const match = pickMatchingTrack(
        res.data?.tracks?.items,
        track,
        artist || primaryArtist,
      );

      if (match) {
        return match;
      }
    }

    if (!artist) {
      const res = await spotifyApi.get(buildSearchPath(track, "track", 10));
      return (
        res.data?.tracks?.items?.find((item) =>
          namesAreCompatible(item?.name, track),
        ) || null
      );
    }

    return null;
  }, []);

  const searchAlbum = useCallback(async (albumName, artistName) => {
    const album = (albumName || "").trim();
    const artist = (artistName || "").trim();
    if (!album) return null;

    const primaryArtist = getPrimaryArtistName(artist);
    const canonicalAlbum = canonicalAlbumName(album);
    const queries = [
      primaryArtist ? `${canonicalAlbum} ${primaryArtist}` : "",
      artist && artist !== primaryArtist ? `${canonicalAlbum} ${artist}` : "",
      canonicalAlbum,
    ].filter(Boolean);

    for (const query of [...new Set(queries)]) {
      const res = await spotifyApi.get(buildSearchPath(query, "album", 10));
      const match = pickMatchingAlbum(
        res.data?.albums?.items,
        album,
        artist || primaryArtist,
      );

      if (match) {
        return match;
      }
    }

    if (!artist) {
      const targetAlbum = normalizeForMatch(canonicalAlbumName(album));
      const res = await spotifyApi.get(buildSearchPath(canonicalAlbum, "album", 10));
      return (
        res.data?.albums?.items?.find((item) =>
          namesAreCompatible(
            canonicalAlbumName(item?.name),
            targetAlbum,
          ),
        ) || null
      );
    }

    return null;
  }, []);

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

    const recentPlays = recentItems
      .map((item) =>
        mapSpotifyTrackToSyncPlay(
          item.track,
          item.played_at,
          "spotify_recently_played",
        ),
      )
      .filter(Boolean);

    const currentlyPlayingData =
      currentlyPlayingResult.status === "fulfilled"
        ? currentlyPlayingResult.value
        : null;
    const currentPlay = mapCurrentlyPlayingToSyncPlay(currentlyPlayingData);
    const plays = currentPlay ? [...recentPlays, currentPlay] : recentPlays;

    const syncResponse =
      plays.length > 0
        ? await syncRecentlyPlayed(plays)
        : await getListeningSyncStatus();

    const currentlyPlaying =
      currentlyPlayingData ? mapCurrentlyPlaying(currentlyPlayingData) : null;

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
    syncIntervalId = window.setInterval(
      runListeningSync,
      LISTENING_SYNC_INTERVAL_MS,
    );

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
      searchTrack,
      searchAlbum,
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
