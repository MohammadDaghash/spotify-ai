import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_STORAGE_PATH = "spotify-ai/public-listening/recent-plays.json";
const LOCAL_STORAGE_PATH = path.join(
  tmpdir(),
  "spotify-ai-public-recent-plays.json",
);
const MAX_STORED_PLAYS = 5000;

function safeString(value) {
  return String(value || "").trim();
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function normalizeIsoDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

function normalizeEntityKey(value) {
  return safeString(value).toLowerCase().replace(/\s+/g, " ");
}

function getStoragePath() {
  return process.env.SPOTIFY_SYNC_STORAGE_PATH || DEFAULT_STORAGE_PATH;
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobTokenOption() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};

  return {
    token: process.env.BLOB_READ_WRITE_TOKEN,
  };
}

function getBlobUploadOptions(extra = {}) {
  const options = {
    access: "public",
    ...getBlobTokenOption(),
    ...extra,
  };

  return options;
}

export function getPublicSyncStorageMode() {
  return hasBlobToken() ? "vercel_blob" : "local_tmp";
}

export function hasServerSpotifySyncConfig() {
  return Boolean(
    process.env.SPOTIFY_REFRESH_TOKEN &&
      (process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID),
  );
}

export function buildPlayKey(play) {
  const playedAt = normalizeIsoDate(play?.played_at);
  const trackId = safeString(play?.track_id);
  const fallbackTrackIdentity = [
    normalizeEntityKey(play?.track_name),
    normalizeEntityKey(play?.artist_name),
    normalizeEntityKey(play?.album_name),
  ]
    .filter(Boolean)
    .join("|");

  const trackIdentity = trackId || fallbackTrackIdentity;

  if (!playedAt || !trackIdentity) return "";

  return `${trackIdentity}|${playedAt}`;
}

export function normalizeStoredPlay(play) {
  const playedAt = normalizeIsoDate(play?.played_at);
  const trackName = safeString(play?.track_name);
  const artistName = safeString(play?.artist_name);

  if (!playedAt || !trackName || !artistName) return null;

  const normalized = {
    play_key: "",
    track_id: safeString(play?.track_id),
    track_name: trackName,
    artist_name: artistName,
    album_name: safeString(play?.album_name),
    played_at: playedAt,
    duration_ms: safeInteger(play?.duration_ms || play?.ms_played),
    spotify_url: safeString(play?.spotify_url),
    uri: safeString(play?.uri),
    source: safeString(play?.source) || "spotify_recently_played",
  };

  normalized.play_key = safeString(play?.play_key) || buildPlayKey(normalized);

  return normalized.play_key ? normalized : null;
}

export function normalizeSpotifyRecentPlay(item) {
  const track = item?.track;

  if (!track) return null;

  return normalizeStoredPlay({
    track_id: track.id,
    track_name: track.name,
    artist_name: (track.artists || [])
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(", "),
    album_name: track.album?.name,
    played_at: item.played_at,
    duration_ms: track.duration_ms,
    spotify_url: track.external_urls?.spotify,
    uri: track.uri,
    source: "spotify_recently_played",
  });
}

export function normalizeCurrentlyPlaying(item) {
  const track = item?.item;

  if (!track || item?.currently_playing_type !== "track") return null;

  return {
    track_id: safeString(track.id),
    track_name: safeString(track.name),
    artist_name: (track.artists || [])
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(", "),
    album_name: safeString(track.album?.name),
    spotify_url: safeString(track.external_urls?.spotify),
    uri: safeString(track.uri),
    is_playing: Boolean(item.is_playing),
    checked_at: new Date().toISOString(),
  };
}

export function upsertPublicPlays(existingPayload = {}, incomingPlays = []) {
  const playMap = new Map();

  for (const play of existingPayload.plays || []) {
    const normalized = normalizeStoredPlay(play);

    if (normalized) {
      playMap.set(normalized.play_key, normalized);
    }
  }

  let valid = 0;
  let inserted = 0;

  for (const play of incomingPlays) {
    const normalized = normalizeStoredPlay(play);

    if (!normalized) continue;

    valid += 1;

    if (!playMap.has(normalized.play_key)) {
      inserted += 1;
    }

    playMap.set(normalized.play_key, normalized);
  }

  const plays = [...playMap.values()]
    .sort((left, right) => right.played_at.localeCompare(left.played_at))
    .slice(0, MAX_STORED_PLAYS);

  return {
    plays,
    valid,
    inserted,
    total_plays: plays.length,
    latest_played_at: plays[0]?.played_at || null,
  };
}

export function buildPublicStatus(payload = {}, options = {}) {
  const plays = Array.isArray(payload.plays) ? payload.plays : [];

  return {
    configured: options.configured ?? true,
    last_synced_at: payload.last_sync_finished_at || null,
    last_sync_status: payload.last_sync_status || "idle",
    latest_played_at:
      payload.latest_played_at || plays[0]?.played_at || null,
    total_plays: plays.length,
    currently_playing: payload.currently_playing || null,
  };
}

export function mapStoredPlayToHistoryEntry(play) {
  const normalized = normalizeStoredPlay(play);

  if (!normalized) return null;

  return {
    ts: normalized.played_at,
    ms_played: normalized.duration_ms,
    master_metadata_track_name: normalized.track_name,
    master_metadata_album_artist_name: normalized.artist_name,
    master_metadata_album_album_name: normalized.album_name,
    total_ms_played: normalized.duration_ms,
    streams: 1,
  };
}

function emptyPayload(overrides = {}) {
  return {
    version: 1,
    updated_at: null,
    last_sync_started_at: null,
    last_sync_finished_at: null,
    last_sync_status: "idle",
    last_sync_error: "",
    latest_played_at: null,
    currently_playing: null,
    plays: [],
    ...overrides,
  };
}

function normalizePayload(payload) {
  const base = emptyPayload(payload && typeof payload === "object" ? payload : {});
  const plays = (Array.isArray(base.plays) ? base.plays : [])
    .map(normalizeStoredPlay)
    .filter(Boolean)
    .sort((left, right) => right.played_at.localeCompare(left.played_at));

  return {
    ...base,
    plays,
    latest_played_at: base.latest_played_at || plays[0]?.played_at || null,
  };
}

async function readBlobPayload() {
  if (!hasBlobToken()) return null;

  const { list } = await import("@vercel/blob");
  const { blobs } = await list({
    ...getBlobTokenOption(),
    prefix: getStoragePath(),
    limit: 10,
  });
  const blob = blobs.find((item) => item.pathname === getStoragePath());

  if (!blob?.url) return emptyPayload();

  const separator = blob.url.includes("?") ? "&" : "?";
  const response = await fetch(`${blob.url}${separator}v=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return emptyPayload({
      last_sync_status: "read_error",
      last_sync_error: "Stored public sync data could not be read.",
    });
  }

  return normalizePayload(await response.json());
}

async function writeBlobPayload(payload) {
  const { put } = await import("@vercel/blob");

  await put(getStoragePath(), JSON.stringify(payload, null, 2), {
    ...getBlobUploadOptions({
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    }),
  });
}

function readLocalPayload() {
  if (!existsSync(LOCAL_STORAGE_PATH)) return emptyPayload();

  try {
    return normalizePayload(
      JSON.parse(readFileSync(LOCAL_STORAGE_PATH, "utf8")),
    );
  } catch {
    return emptyPayload({
      last_sync_status: "read_error",
      last_sync_error: "Local public sync data could not be read.",
    });
  }
}

function writeLocalPayload(payload) {
  writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function readPublicSyncPayload() {
  if (hasBlobToken()) {
    return normalizePayload(await readBlobPayload());
  }

  return readLocalPayload();
}

export async function writePublicSyncPayload(payload) {
  const normalizedPayload = normalizePayload({
    ...payload,
    updated_at: new Date().toISOString(),
  });

  if (hasBlobToken()) {
    await writeBlobPayload(normalizedPayload);
  } else {
    writeLocalPayload(normalizedPayload);
  }

  return normalizedPayload;
}

async function fetchSpotifyAccessToken() {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!refreshToken || !clientId) {
    const error = new Error("Spotify server-side sync is not configured.");
    error.code = "not_configured";
    throw error;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(
      `${clientId}:${clientSecret}`,
    ).toString("base64")}`;
  } else {
    params.set("client_id", clientId);
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body: params,
  });

  if (!response.ok) {
    const error = new Error("Spotify token refresh failed.");
    error.code = "token_refresh_failed";
    error.status = response.status;
    throw error;
  }

  const data = await response.json();

  if (!data.access_token) {
    const error = new Error("Spotify token refresh returned no access token.");
    error.code = "token_refresh_empty";
    throw error;
  }

  return data.access_token;
}

async function fetchSpotifyJson(url, accessToken, allowEmpty = false) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (allowEmpty && response.status === 204) return null;

  if (!response.ok) {
    const error = new Error("Spotify API request failed.");
    error.code = "spotify_api_failed";
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function runSpotifyListeningSync() {
  const startedAt = new Date().toISOString();
  const existingPayload = await readPublicSyncPayload();

  try {
    const accessToken = await fetchSpotifyAccessToken();
    const [recentlyPlayed, currentlyPlaying] = await Promise.all([
      fetchSpotifyJson(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50",
        accessToken,
      ),
      fetchSpotifyJson(
        "https://api.spotify.com/v1/me/player/currently-playing",
        accessToken,
        true,
      ).catch(() => null),
    ]);

    const incomingPlays = (recentlyPlayed?.items || [])
      .map(normalizeSpotifyRecentPlay)
      .filter(Boolean);
    const merged = upsertPublicPlays(existingPayload, incomingPlays);
    const finishedAt = new Date().toISOString();

    const nextPayload = await writePublicSyncPayload({
      ...existingPayload,
      plays: merged.plays,
      last_sync_started_at: startedAt,
      last_sync_finished_at: finishedAt,
      last_sync_status: "success",
      last_sync_error: "",
      latest_played_at: merged.latest_played_at,
      currently_playing: normalizeCurrentlyPlaying(currentlyPlaying),
    });

    return {
      ok: true,
      received: recentlyPlayed?.items?.length || 0,
      valid: merged.valid,
      inserted: merged.inserted,
      sync: buildPublicStatus(nextPayload, {
        configured: hasServerSpotifySyncConfig(),
      }),
      storage_mode: getPublicSyncStorageMode(),
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const nextPayload = await writePublicSyncPayload({
      ...existingPayload,
      last_sync_started_at: startedAt,
      last_sync_finished_at: finishedAt,
      last_sync_status: error.code || "error",
      last_sync_error: error.message || "Spotify listening sync failed.",
    });

    return {
      ok: false,
      error: error.message || "Spotify listening sync failed.",
      code: error.code || "error",
      sync: buildPublicStatus(nextPayload, {
        configured: hasServerSpotifySyncConfig(),
      }),
      storage_mode: getPublicSyncStorageMode(),
    };
  }
}

export function getPublicPlays(payload = {}, limit = 200) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));

  return (payload.plays || [])
    .map(normalizeStoredPlay)
    .filter(Boolean)
    .slice(0, safeLimit);
}
