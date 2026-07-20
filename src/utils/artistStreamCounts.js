export const ARTIST_DISCOVERY_MAX_STREAMS = 50;

const ARTIST_CREDIT_SPLIT_PATTERN =
  /\s*(?:,|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)\s*/i;
const PROTECTED_COMMA_ARTIST_NAMES = new Set(["tyler, the creator"]);
const PROTECTED_COMMA_ARTIST_PATTERNS = [/tyler,\s*the creator/i];

export function normalizeArtistKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\w]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitArtistNames(artistName) {
  const cleanName = String(artistName || "").trim().replace(/\s+/g, " ");

  if (!cleanName) return [];

  if (PROTECTED_COMMA_ARTIST_NAMES.has(normalizeArtistKey(cleanName))) {
    return [cleanName];
  }

  const protectedArtists = {};
  let protectedName = cleanName;

  PROTECTED_COMMA_ARTIST_PATTERNS.forEach((pattern, index) => {
    const placeholder = `__protected_artist_${index}__`;

    protectedName = protectedName.replace(pattern, (match) => {
      protectedArtists[placeholder] = match;
      return placeholder;
    });
  });

  return [
    ...new Set(
      protectedName
        .split(ARTIST_CREDIT_SPLIT_PATTERN)
        .map((part) => protectedArtists[part.trim()] || part.trim())
        .filter(Boolean),
    ),
  ];
}

function getHistoryArtistName(entry) {
  return (
    entry?.master_metadata_album_artist_name ||
    entry?.artist_name ||
    entry?.artistName ||
    ""
  );
}

function getHistoryStreamCount(entry) {
  const streams = Number(entry?.streams || entry?.play_count || 1);
  return Number.isFinite(streams) && streams > 0 ? streams : 1;
}

export function buildArtistStreamCountMap(history = []) {
  const streamCounts = new Map();

  for (const entry of history || []) {
    const streams = getHistoryStreamCount(entry);

    for (const artistName of splitArtistNames(getHistoryArtistName(entry))) {
      const artistKey = normalizeArtistKey(artistName);

      if (!artistKey) continue;

      streamCounts.set(artistKey, (streamCounts.get(artistKey) || 0) + streams);
    }
  }

  return streamCounts;
}

export function getArtistStreamCount(artistName, streamCounts = new Map()) {
  return Number(streamCounts.get(normalizeArtistKey(artistName)) || 0);
}
