export const LOCAL_SPOTIFY_HISTORY_KEY = "spotify_ai_local_history_v1";
export const SPOTIFY_API_HISTORY_KEY = "spotify_ai_spotify_api_history_v1";
export const PRIVATE_SPOTIFY_DATA_MODE_KEY =
  "spotify_ai_private_data_mode_v1";
export const PRIVATE_SPOTIFY_DATA_CHANGED_EVENT =
  "spotify_ai_private_data_changed";

export const PRIVATE_SPOTIFY_EXPORT_FIELDS = [
  "platform",
  "conn_country",
  "ip_addr",
  "user_agent",
  "username",
  "reason_start",
  "reason_end",
  "shuffle",
  "skipped",
  "offline",
  "offline_timestamp",
  "incognito_mode",
  "spotify_track_uri",
  "episode_name",
  "episode_show_name",
  "spotify_episode_uri",
  "audiobook_title",
  "audiobook_uri",
  "audiobook_chapter_uri",
  "audiobook_chapter_title",
];

function firstValue(entry, keys) {
  for (const key of keys) {
    if (entry?.[key] !== undefined && entry[key] !== null && entry[key] !== "") {
      return entry[key];
    }
  }

  return "";
}

function emitPrivateSpotifyDataChanged() {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(new Event(PRIVATE_SPOTIFY_DATA_CHANGED_EVENT));
  } catch {
    window.dispatchEvent(new CustomEvent(PRIVATE_SPOTIFY_DATA_CHANGED_EVENT));
  }
}

function normalizeTimestamp(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) return "";

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toISOString();
}

function buildHistoryEntryKey(entry) {
  return [
    entry.ts,
    entry.master_metadata_track_name,
    entry.master_metadata_album_artist_name,
    entry.master_metadata_album_album_name,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function dedupePrivateHistoryEntries(entries = []) {
  const entryMap = new Map();

  for (const entry of normalizeSpotifyHistoryEntries(entries)) {
    entryMap.set(buildHistoryEntryKey(entry), entry);
  }

  return [...entryMap.values()].sort((left, right) =>
    right.ts.localeCompare(left.ts),
  );
}

function readHistoryKey(key) {
  if (typeof localStorage === "undefined") return [];

  try {
    return normalizeSpotifyHistoryEntries(
      JSON.parse(localStorage.getItem(key) || "[]"),
    );
  } catch {
    return [];
  }
}

function writeHistoryKey(key, entries) {
  if (typeof localStorage === "undefined") return [];

  const normalizedEntries = dedupePrivateHistoryEntries(entries);

  localStorage.setItem(key, JSON.stringify(normalizedEntries));

  return normalizedEntries;
}

export function normalizeSpotifyHistoryEntries(entries = []) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      const trackName = firstValue(entry, [
        "master_metadata_track_name",
        "trackName",
        "track_name",
      ]);
      const artistName = firstValue(entry, [
        "master_metadata_album_artist_name",
        "artistName",
        "artist_name",
      ]);
      const albumName = firstValue(entry, [
        "master_metadata_album_album_name",
        "albumName",
        "album_name",
      ]);
      const msPlayed = Number(firstValue(entry, ["ms_played", "msPlayed"]));

      if (!trackName || !artistName || !albumName || !Number.isFinite(msPlayed)) {
        return null;
      }

      return {
        ts: normalizeTimestamp(firstValue(entry, ["ts", "endTime", "played_at"])),
        ms_played: Math.max(0, Math.round(msPlayed)),
        master_metadata_track_name: String(trackName).trim(),
        master_metadata_album_artist_name: String(artistName).trim(),
        master_metadata_album_album_name: String(albumName).trim(),
      };
    })
    .filter(
      (entry) =>
        entry &&
        entry.ts &&
        entry.ms_played > 0 &&
        entry.master_metadata_track_name &&
        entry.master_metadata_album_artist_name &&
        entry.master_metadata_album_album_name,
    );
}

export function enablePrivateSpotifyDataMode() {
  if (typeof localStorage === "undefined") return [];

  localStorage.setItem(PRIVATE_SPOTIFY_DATA_MODE_KEY, "1");
  emitPrivateSpotifyDataChanged();
}

export function disablePrivateSpotifyDataMode() {
  if (typeof localStorage === "undefined") return;

  localStorage.removeItem(PRIVATE_SPOTIFY_DATA_MODE_KEY);
  emitPrivateSpotifyDataChanged();
}

export function isPrivateSpotifyDataMode() {
  if (typeof localStorage === "undefined") return false;

  return localStorage.getItem(PRIVATE_SPOTIFY_DATA_MODE_KEY) === "1";
}

export function readImportedSpotifyHistory() {
  return readHistoryKey(LOCAL_SPOTIFY_HISTORY_KEY);
}

export function readSpotifyApiHistory() {
  return readHistoryKey(SPOTIFY_API_HISTORY_KEY);
}

export function readLocalSpotifyHistory({ requirePrivateMode = true } = {}) {
  if (requirePrivateMode && !isPrivateSpotifyDataMode()) return [];

  return dedupePrivateHistoryEntries([
    ...readImportedSpotifyHistory(),
    ...readSpotifyApiHistory(),
  ]);
}

export function saveLocalSpotifyHistory(entries) {
  if (typeof localStorage === "undefined") return [];

  const normalizedEntries = writeHistoryKey(LOCAL_SPOTIFY_HISTORY_KEY, entries);

  enablePrivateSpotifyDataMode();

  return normalizedEntries;
}

export function saveSpotifyApiHistory(entries, { merge = true } = {}) {
  if (typeof localStorage === "undefined") return [];

  const existingEntries = merge ? readSpotifyApiHistory() : [];
  const normalizedEntries = writeHistoryKey(SPOTIFY_API_HISTORY_KEY, [
    ...existingEntries,
    ...entries,
  ]);

  enablePrivateSpotifyDataMode();

  return normalizedEntries;
}

export function clearSpotifyApiHistory() {
  if (typeof localStorage === "undefined") return;

  localStorage.removeItem(SPOTIFY_API_HISTORY_KEY);
  emitPrivateSpotifyDataChanged();
}

export function clearLocalSpotifyHistory() {
  if (typeof localStorage === "undefined") return;

  localStorage.removeItem(LOCAL_SPOTIFY_HISTORY_KEY);
  emitPrivateSpotifyDataChanged();
}

export function clearSpotifyTokens() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("spotify_access_token");
    localStorage.removeItem("spotify_token_expires_at");
    localStorage.removeItem("spotify_refresh_token");
    localStorage.removeItem("access_token");
  }

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("spotify_code_verifier");
    sessionStorage.removeItem("spotify_redirect_uri");
    sessionStorage.removeItem("spotify_auth_state");
    sessionStorage.removeItem("spotify_auth_error");
  }
}

export function returnToPublicDemoMode() {
  clearSpotifyTokens();
  clearSpotifyApiHistory();
  disablePrivateSpotifyDataMode();
}

export function mapSpotifyPlaysToHistoryEntries(plays = []) {
  return normalizeSpotifyHistoryEntries(
    plays.map((play) => ({
      ts: play.played_at,
      ms_played: play.duration_ms || play.ms_played,
      master_metadata_track_name: play.track_name,
      master_metadata_album_artist_name: play.artist_name,
      master_metadata_album_album_name: play.album_name,
    })),
  );
}

export function mapSpotifyRecentItemsToHistoryEntries(items = []) {
  return mapSpotifyPlaysToHistoryEntries(
    items
      .map((item) => {
        const track = item?.track;

        if (!track?.name) return null;

        return {
          played_at: item.played_at,
          duration_ms: track.duration_ms,
          track_name: track.name,
          artist_name:
            track.artists?.map((artist) => artist.name).join(", ") || "",
          album_name: track.album?.name || "",
        };
      })
      .filter(Boolean),
  );
}

export function mapCurrentlyPlayingToHistoryEntry(data) {
  const track = data?.item;

  if (!data?.is_playing || !track?.name || track.type !== "track") return [];

  return mapSpotifyPlaysToHistoryEntries([
    {
      played_at: new Date().toISOString(),
      duration_ms: Math.max(0, data.progress_ms || 0),
      track_name: track.name,
      artist_name:
        track.artists?.map((artist) => artist.name).join(", ") || "",
      album_name: track.album?.name || "",
    },
  ]);
}

export function hasStoredPrivateSpotifyHistory() {
  return readLocalSpotifyHistory({ requirePrivateMode: false }).length > 0;
}

export async function readSpotifyHistoryFiles(files = []) {
  const parsedFiles = await Promise.all(
    [...files].map(async (file) => {
      const text = await file.text();
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    }),
  );

  return normalizeSpotifyHistoryEntries(parsedFiles.flat());
}
