export const TRACK_DISCOVERY_MAX_PLAYS = 10;

export function normalizeTrackKeyPart(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getTrackIdentityKey(trackName, artistName = "") {
  return `${normalizeTrackKeyPart(trackName)}::${normalizeTrackKeyPart(
    artistName,
  )}`;
}

function firstValue(entry, keys) {
  for (const key of keys) {
    const value = entry?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function getHistoryTrackName(entry) {
  return firstValue(entry, [
    "master_metadata_track_name",
    "track_name",
    "trackName",
  ]);
}

function getHistoryArtistName(entry) {
  return firstValue(entry, [
    "master_metadata_album_artist_name",
    "artist_name",
    "artistName",
  ]);
}

function getHistoryStreamCount(entry) {
  const streams = Number(firstValue(entry, ["streams", "play_count"]));

  return Number.isFinite(streams) && streams > 0 ? streams : 1;
}

export function buildTrackPlayCountMap(history = []) {
  const playCounts = new Map();

  for (const entry of history || []) {
    const trackName = getHistoryTrackName(entry);
    const artistName = getHistoryArtistName(entry);
    const trackKey = normalizeTrackKeyPart(trackName);

    if (!trackKey) continue;

    const streams = getHistoryStreamCount(entry);
    const exactKey = getTrackIdentityKey(trackName, artistName);
    const titleOnlyKey = getTrackIdentityKey(trackName);

    playCounts.set(exactKey, (playCounts.get(exactKey) || 0) + streams);
    playCounts.set(titleOnlyKey, (playCounts.get(titleOnlyKey) || 0) + streams);
  }

  return playCounts;
}

export function getTrackPlayCount(
  trackName,
  artistName = "",
  playCounts = new Map(),
) {
  const exactCount = Number(playCounts.get(getTrackIdentityKey(trackName, artistName)));

  if (Number.isFinite(exactCount) && exactCount > 0) return exactCount;

  const titleOnlyCount = Number(playCounts.get(getTrackIdentityKey(trackName)));

  return Number.isFinite(titleOnlyCount) ? titleOnlyCount : 0;
}
