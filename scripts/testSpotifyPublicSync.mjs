import assert from "node:assert/strict";

import {
  buildPublicStatus,
  mapStoredPlayToHistoryEntry,
  normalizeSpotifyRecentPlay,
  upsertPublicPlays,
} from "../api/lib/publicListeningSync.js";

function makeRecentItem({ id, playedAt, name = "Song", artist = "Artist" }) {
  return {
    played_at: playedAt,
    track: {
      id,
      name,
      duration_ms: 180000,
      uri: `spotify:track:${id}`,
      external_urls: {
        spotify: `https://open.spotify.com/track/${id}`,
      },
      album: {
        name: "Album",
      },
      artists: [
        {
          name: artist,
        },
      ],
    },
  };
}

const firstPlay = normalizeSpotifyRecentPlay(
  makeRecentItem({
    id: "track-1",
    playedAt: "2026-06-22T10:00:00.000Z",
    name: "First Song",
    artist: "First Artist",
  }),
);

assert.equal(firstPlay.play_key, "track-1|2026-06-22T10:00:00.000Z");
assert.equal(firstPlay.track_id, "track-1");
assert.equal(firstPlay.track_name, "First Song");
assert.equal(firstPlay.artist_name, "First Artist");
assert.equal(firstPlay.album_name, "Album");
assert.equal(firstPlay.duration_ms, 180000);
assert.equal(firstPlay.source, "spotify_recently_played");

const merged = upsertPublicPlays(
  {
    plays: [
      {
        ...firstPlay,
        track_name: "Original Stored Song",
      },
    ],
  },
  [
    firstPlay,
    normalizeSpotifyRecentPlay(
      makeRecentItem({
        id: "track-2",
        playedAt: "2026-06-22T11:00:00.000Z",
        name: "Second Song",
        artist: "Second Artist",
      }),
    ),
    normalizeSpotifyRecentPlay(
      makeRecentItem({
        id: "track-1",
        playedAt: "2026-06-22T10:00:00.000Z",
        name: "Duplicate Song",
        artist: "Duplicate Artist",
      }),
    ),
  ],
);

assert.equal(merged.inserted, 1);
assert.equal(merged.total_plays, 2);
assert.equal(merged.plays[0].track_id, "track-2");
assert.equal(merged.plays[1].track_id, "track-1");
assert.equal(merged.latest_played_at, "2026-06-22T11:00:00.000Z");

const status = buildPublicStatus({
  last_sync_finished_at: "2026-06-22T12:00:00.000Z",
  last_sync_status: "success",
  plays: merged.plays,
  currently_playing: {
    track_name: "Current Song",
    artist_name: "Current Artist",
  },
}, {
  config: {
    configured: true,
    storage_persistent: true,
    missing_required_env: [],
    missing_recommended_env: [],
  },
});

assert.deepEqual(status, {
  configured: true,
  last_synced_at: "2026-06-22T12:00:00.000Z",
  last_sync_status: "success",
  last_sync_error: "",
  latest_played_at: "2026-06-22T11:00:00.000Z",
  total_plays: 2,
  currently_playing: {
    track_name: "Current Song",
    artist_name: "Current Artist",
  },
  storage_persistent: true,
  missing_required_env: [],
  missing_recommended_env: [],
});

const historyEntry = mapStoredPlayToHistoryEntry(firstPlay);

assert.deepEqual(historyEntry, {
  ts: "2026-06-22T10:00:00.000Z",
  ms_played: 180000,
  master_metadata_track_name: "First Song",
  master_metadata_album_artist_name: "First Artist",
  master_metadata_album_album_name: "Album",
  total_ms_played: 180000,
  streams: 1,
});

console.log("Spotify public sync utility tests passed");
