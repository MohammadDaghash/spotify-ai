import assert from "node:assert/strict";

import {
  buildPrivateRecommendationProfile,
  rankPrivateTrackRecommendations,
} from "../src/utils/privateRecommendations.js";

const privateHistory = [
  {
    ts: "2026-07-02T12:00:00.000Z",
    streams: 10,
    total_ms_played: 10 * 180_000,
    master_metadata_track_name: "Known Song",
    master_metadata_album_artist_name: "Favorite Artist",
    master_metadata_album_album_name: "Known Album",
  },
  {
    ts: "2026-07-02T13:00:00.000Z",
    streams: 6,
    total_ms_played: 6 * 180_000,
    master_metadata_track_name: "Another Known Song",
    master_metadata_album_artist_name: "Favorite Artist",
    master_metadata_album_album_name: "Known Album",
  },
];

const candidateTracks = [
  {
    trackName: "Known Song",
    artistName: "Favorite Artist",
    genres: ["pop"],
    moods: ["energetic"],
    popularity: 0.6,
    recencyScore: 0.5,
  },
  {
    trackName: "Fresh Match",
    artistName: "Favorite Artist",
    genres: ["pop"],
    moods: ["energetic"],
    popularity: 0.65,
    recencyScore: 0.9,
  },
  {
    trackName: "Unrelated Song",
    artistName: "Other Artist",
    genres: ["rock"],
    moods: ["dark"],
    popularity: 0.65,
    recencyScore: 0.9,
  },
];

const profile = buildPrivateRecommendationProfile(privateHistory);

assert.equal(profile.favoriteArtists[0], "Favorite Artist");
assert.ok(profile.knownTracks.includes("Known Song"));
assert.ok(profile.artistWeights["Favorite Artist"] > 0);

const recommendations = rankPrivateTrackRecommendations({
  history: privateHistory,
  candidateTracks,
  topN: 5,
});

assert.deepEqual(
  recommendations.map((track) => track.track_name),
  ["Fresh Match", "Unrelated Song"],
  "known private-history tracks should be removed and matching artists should rank first",
);

assert.equal(recommendations[0].artist_name, "Favorite Artist");
assert.equal(recommendations[0].source, "private-session");
assert.equal(recommendations[0].streams, 0);

console.log("Private recommendation tests passed");
