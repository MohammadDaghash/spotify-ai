import assert from "node:assert/strict";

import {
  dedupeHistoryEntries,
  mapPublicPlayToHistoryEntry,
} from "../src/utils/publicListeningHistory.js";

const mapped = mapPublicPlayToHistoryEntry({
  played_at: "2026-06-22T10:00:00.000Z",
  duration_ms: 210000,
  track_name: "Synced Track",
  artist_name: "Synced Artist",
  album_name: "Synced Album",
});

assert.deepEqual(mapped, {
  ts: "2026-06-22T10:00:00.000Z",
  ms_played: 210000,
  master_metadata_track_name: "Synced Track",
  master_metadata_album_artist_name: "Synced Artist",
  master_metadata_album_album_name: "Synced Album",
  total_ms_played: 210000,
  streams: 1,
});

const deduped = dedupeHistoryEntries([
  mapped,
  {
    ...mapped,
    total_ms_played: 999999,
  },
  {
    ...mapped,
    ts: "2026-06-22T11:00:00.000Z",
  },
]);

assert.equal(deduped.length, 2);
assert.equal(deduped[0].total_ms_played, 999999);
assert.equal(deduped[1].ts, "2026-06-22T11:00:00.000Z");

console.log("Public listening history utility tests passed");
