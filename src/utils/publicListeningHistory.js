function safeString(value) {
  return String(value || "").trim();
}

function safeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function getEntryKey(entry) {
  return [
    safeString(entry.ts),
    safeString(
      entry.master_metadata_track_name || entry.track_name || entry.trackName,
    ).toLowerCase(),
    safeString(
      entry.master_metadata_album_artist_name ||
        entry.artist_name ||
        entry.artistName,
    ).toLowerCase(),
  ].join("|");
}

export function mapPublicPlayToHistoryEntry(play) {
  const timestamp = safeString(play?.played_at);
  const trackName = safeString(play?.track_name);
  const artistName = safeString(play?.artist_name);

  if (!timestamp || !trackName || !artistName) return null;

  const durationMs = safeInteger(play?.duration_ms || play?.ms_played);

  return {
    ts: timestamp,
    ms_played: durationMs,
    master_metadata_track_name: trackName,
    master_metadata_album_artist_name: artistName,
    master_metadata_album_album_name: safeString(play?.album_name),
    total_ms_played: durationMs,
    streams: 1,
  };
}

export function mapPublicPlaysToHistory(plays = []) {
  return plays.map(mapPublicPlayToHistoryEntry).filter(Boolean);
}

export function dedupeHistoryEntries(entries = []) {
  const merged = new Map();

  for (const entry of entries) {
    const key = getEntryKey(entry);

    if (key.replace(/\|/g, "")) {
      merged.set(key, entry);
    }
  }

  return [...merged.values()].sort((left, right) =>
    safeString(left.ts).localeCompare(safeString(right.ts)),
  );
}
