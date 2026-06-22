import assert from "node:assert/strict";

import { parseSpotifyHistory, getListeningTrend } from "../src/utils/spotifyDataParser.js";
import {
  normalizeSpotifyHistoryEntries,
  PRIVATE_SPOTIFY_EXPORT_FIELDS,
} from "../src/utils/localSpotifyHistory.js";

const aggregateRows = [
  {
    ts: "2026-06-15T12:00:00.000Z",
    master_metadata_track_name: "Demo Song",
    master_metadata_album_artist_name: "Demo Artist",
    master_metadata_album_album_name: "Demo Album",
    streams: 7,
    total_ms_played: 1_260_000,
  },
];

const parsed = parseSpotifyHistory(aggregateRows, "streams");

assert.equal(parsed.topTracks[0].streams, 7);
assert.equal(parsed.topTracks[0].minutesPlayed, 21);
assert.equal(parsed.topArtists[0].streams, 7);
assert.equal(parsed.topAlbums[0].streams, 7);

const trend = getListeningTrend(aggregateRows, "30d");

assert.equal(trend[0].streams, 7);
assert.equal(trend[0].minutesPlayed, 21);

const normalized = normalizeSpotifyHistoryEntries([
  {
    ts: "2026-06-12T10:22:00Z",
    platform: "iOS",
    conn_country: "US",
    ip_addr: "127.0.0.1",
    master_metadata_track_name: "Private Song",
    master_metadata_album_artist_name: "Private Artist",
    master_metadata_album_album_name: "Private Album",
    ms_played: 180_000,
    incognito_mode: false,
  },
]);

assert.equal(normalized.length, 1);
assert.deepEqual(Object.keys(normalized[0]).sort(), [
  "master_metadata_album_album_name",
  "master_metadata_album_artist_name",
  "master_metadata_track_name",
  "ms_played",
  "ts",
]);

for (const privateField of PRIVATE_SPOTIFY_EXPORT_FIELDS) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized[0], privateField),
    false,
    `${privateField} should not be kept in normalized history`,
  );
}

console.log("Demo data safety tests passed");
