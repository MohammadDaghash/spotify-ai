export const LOCAL_SPOTIFY_HISTORY_KEY = "spotify_ai_local_history_v1";

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

function normalizeTimestamp(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) return "";

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toISOString();
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

export function readLocalSpotifyHistory() {
  if (typeof localStorage === "undefined") return [];

  try {
    return normalizeSpotifyHistoryEntries(
      JSON.parse(localStorage.getItem(LOCAL_SPOTIFY_HISTORY_KEY) || "[]"),
    );
  } catch {
    return [];
  }
}

export function saveLocalSpotifyHistory(entries) {
  if (typeof localStorage === "undefined") return [];

  const normalizedEntries = normalizeSpotifyHistoryEntries(entries);

  localStorage.setItem(
    LOCAL_SPOTIFY_HISTORY_KEY,
    JSON.stringify(normalizedEntries),
  );

  return normalizedEntries;
}

export function clearLocalSpotifyHistory() {
  if (typeof localStorage === "undefined") return;

  localStorage.removeItem(LOCAL_SPOTIFY_HISTORY_KEY);
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
