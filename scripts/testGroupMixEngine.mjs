import assert from "node:assert/strict";

import { buildGroupMixPlaylists } from "../src/utils/groupMixEngine.js";

const history = [
  {
    ts: "2026-07-01T12:00:00.000Z",
    streams: 12,
    total_ms_played: 12 * 180_000,
    master_metadata_track_name: "Shared Hit",
    master_metadata_album_artist_name: "Shared Artist",
    master_metadata_album_album_name: "Shared Album",
  },
  {
    ts: "2026-07-01T12:00:00.000Z",
    streams: 5,
    total_ms_played: 5 * 180_000,
    master_metadata_track_name: "Context Bridge",
    master_metadata_album_artist_name: "Context Star",
    master_metadata_album_album_name: "Context Album",
  },
  {
    ts: "2026-07-01T12:00:00.000Z",
    streams: 8,
    total_ms_played: 8 * 180_000,
    master_metadata_track_name: "Plain Bridge",
    master_metadata_album_artist_name: "Plain Artist",
    master_metadata_album_album_name: "Plain Album",
  },
  {
    ts: "2026-07-01T12:00:00.000Z",
    streams: 3,
    total_ms_played: 3 * 180_000,
    master_metadata_track_name: "Fresh Discovery",
    master_metadata_album_artist_name: "Fresh Artist",
    master_metadata_album_album_name: "Fresh Album",
  },
  {
    ts: "2026-07-01T12:00:00.000Z",
    streams: 20,
    total_ms_played: 20 * 180_000,
    master_metadata_track_name: "Blocked Song",
    master_metadata_album_artist_name: "Ignored Artist",
    master_metadata_album_album_name: "Blocked Album",
  },
];

const playlists = buildGroupMixPlaylists({
  history,
  groupMembers: [
    {
      name: "Survey friend",
      likedArtists: ["Context Star"],
      ignoredArtists: ["Ignored Artist"],
    },
  ],
  contextArtists: ["Context Star"],
  limit: 10,
  newSongMaxPlays: 5,
});

assert.equal(playlists.shared.name, "Group Mix - Shared Favorites");
assert.equal(playlists.bridge.name, "Group Mix - Bridge Picks");
assert.equal(playlists.new.name, "Group Mix - New Discoveries");

const allTracks = Object.values(playlists).flatMap((playlist) => playlist.tracks);
assert.ok(
  allTracks.every((track) => track.artist_name !== "Ignored Artist"),
  "ignored survey artists should be excluded from every group playlist",
);

assert.ok(
  playlists.shared.tracks.some((track) => track.track_name === "Shared Hit"),
  "songs with 10+ plays should be eligible for shared favorites",
);

assert.equal(
  playlists.bridge.tracks[0].track_name,
  "Context Bridge",
  "liked/context artists should outrank similar bridge candidates",
);

assert.ok(
  playlists.new.tracks.every((track) => track.streams < 5),
  "new discoveries should be listened to fewer than the new-song threshold",
);

console.log("Group Mix engine tests passed");
