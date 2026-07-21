import assert from "node:assert/strict";

import {
  getVisibleArtistRecommendations,
  getVisibleSongRecommendations,
} from "../src/utils/recommendationLists.js";
import { mergeSongRecommendationBackfills } from "../src/utils/songRecommendationBackfill.js";
import { buildTrackPlayCountMap } from "../src/utils/trackPlayCounts.js";

const artistPool = [
  { artist: "A", score: 0.9 },
  { artist: "B", score: 0.8 },
  { artist: "C", score: 0.7 },
  { artist: "D", score: 0.6 },
  { artist: "E", score: 0.5 },
  { artist: "F", score: 0.4 },
  { artist: "A", score: 0.3 },
];

assert.deepEqual(
  getVisibleArtistRecommendations({
    recommendations: artistPool,
    likedArtists: ["B"],
    ignoredArtists: ["D"],
    followedArtists: [],
    limit: 5,
  }).map((artist) => artist.artist),
  ["A", "C", "E", "F"],
);

assert.deepEqual(
  getVisibleArtistRecommendations({
    recommendations: artistPool,
    likedArtists: ["B"],
    ignoredArtists: [],
    followedArtists: [{ name: "A" }],
    limit: 5,
  }).map((artist) => artist.artist),
  ["C", "D", "E", "F"],
);

const largerArtistPool = [
  { artist: "A", score: 0.9 },
  { artist: "B", score: 0.8 },
  { artist: "C", score: 0.7 },
  { artist: "D", score: 0.6 },
  { artist: "E", score: 0.5 },
  { artist: "F", score: 0.4 },
  { artist: "G", score: 0.3 },
];

assert.deepEqual(
  getVisibleArtistRecommendations({
    recommendations: largerArtistPool,
    likedArtists: ["C"],
    ignoredArtists: [],
    followedArtists: [],
    limit: 5,
  }).map((artist) => artist.artist),
  ["A", "B", "D", "E", "F"],
);

assert.deepEqual(
  getVisibleArtistRecommendations({
    recommendations: largerArtistPool,
    likedArtists: [],
    ignoredArtists: [],
    followedArtists: [],
    knownArtistStreamCounts: new Map([["b", 50]]),
    maxArtistStreams: 50,
    limit: 5,
  }).map((artist) => artist.artist),
  ["A", "C", "D", "E", "F"],
);

const songPool = [
  { trackName: "A", artistName: "Artist 1", historyPlayCount: 1 },
  { trackName: "B", artistName: "Artist 2", historyPlayCount: 1 },
  { trackName: "C", artistName: "Artist 3", historyPlayCount: 11 },
  { trackName: "D", artistName: "Artist 4", historyPlayCount: 1 },
  { trackName: "E", artistName: "Artist 5", historyPlayCount: 1 },
  { trackName: "F", artistName: "Artist 6", historyPlayCount: 1 },
  { trackName: "G", artistName: "Artist 7", historyPlayCount: 1 },
];

assert.deepEqual(
  getVisibleSongRecommendations({
    recommendations: songPool,
    likedSongs: ["B"],
    ignoredSongs: ["D"],
    maxPlayCount: 10,
    limit: 5,
  }).map((track) => track.trackName),
  ["A", "E", "F", "G"],
);

const knownTrackPlayCounts = buildTrackPlayCountMap([
  {
    master_metadata_track_name: "A",
    master_metadata_album_artist_name: "Artist 1",
    streams: 10,
  },
  {
    master_metadata_track_name: "E",
    master_metadata_album_artist_name: "Different credit",
    streams: 12,
  },
]);

assert.deepEqual(
  getVisibleSongRecommendations({
    recommendations: songPool,
    likedSongs: [],
    ignoredSongs: [],
    knownTrackPlayCounts,
    maxPlayCount: 10,
    limit: 5,
  }).map((track) => track.trackName),
  ["B", "D", "F", "G"],
);

const fallbackTrackPlayCounts = buildTrackPlayCountMap([
  {
    master_metadata_track_name: "Less Than Zero",
    master_metadata_album_artist_name: "The Weeknd",
    streams: 10,
  },
  {
    master_metadata_track_name: "CHIHIRO",
    master_metadata_album_artist_name: "Billie Eilish",
    streams: 10,
  },
]);
const fallbackSongPool = mergeSongRecommendationBackfills({
  trackRecommendations: [],
  knownTrackPlayCounts: fallbackTrackPlayCounts,
  maxPlayCount: 10,
});
const fallbackVisibleSongs = getVisibleSongRecommendations({
  recommendations: fallbackSongPool,
  knownTrackPlayCounts: fallbackTrackPlayCounts,
  maxPlayCount: 10,
  limit: 5,
});

assert.equal(fallbackVisibleSongs.length, 5);
assert.ok(
  fallbackVisibleSongs.every((track) => track.source === "catalog-backfill"),
);
assert.ok(
  !fallbackVisibleSongs
    .map((track) => track.trackName || track.track_name)
    .includes("Less Than Zero"),
);
assert.ok(
  !fallbackVisibleSongs
    .map((track) => track.trackName || track.track_name)
    .includes("CHIHIRO"),
);

console.log("Recommendation replacement tests passed");
