import assert from "node:assert/strict";

import { mergeArtistRecommendationBackfills } from "../src/utils/artistRecommendationBackfill.js";
import { getVisibleArtistRecommendations } from "../src/utils/recommendationLists.js";

const artistRecommendations = [
  { artist: "Artist A", score: 0.9 },
  { artist: "Artist B", score: 0.8 },
  { artist: "Artist C", score: 0.7 },
];

const trackRecommendations = [
  {
    track_name: "Fresh Track 1",
    artist_name: "Artist D",
    score: 0.77,
    similarity_score: 0.72,
    quality_score: 0.85,
    confidence: 0.8,
    recency_score: 0.74,
    streams: 3,
  },
  {
    track_name: "Fresh Track 2",
    artist_name: "Artist E",
    score: 0.73,
    similarity_score: 0.7,
    quality_score: 0.82,
    confidence: 0.76,
    recency_score: 0.71,
    streams: 2,
  },
  {
    track_name: "Fresh Track 3",
    artist_name: "Artist F",
    score: 0.71,
    similarity_score: 0.68,
    quality_score: 0.8,
    confidence: 0.74,
    recency_score: 0.69,
    streams: 1,
  },
  {
    track_name: "Fresh Track 4",
    artist_name: "Artist G",
    score: 0.69,
    similarity_score: 0.66,
    quality_score: 0.78,
    confidence: 0.72,
    recency_score: 0.67,
    streams: 1,
  },
  {
    track_name: "Fresh Track 5",
    artist_name: "Artist H",
    score: 0.67,
    similarity_score: 0.64,
    quality_score: 0.76,
    confidence: 0.7,
    recency_score: 0.65,
    streams: 1,
  },
];

const candidatePool = mergeArtistRecommendationBackfills({
  artistRecommendations,
  trackRecommendations,
});

assert.equal(candidatePool.length, 8);

const visibleArtists = getVisibleArtistRecommendations({
  recommendations: candidatePool,
  likedArtists: ["Artist A", "Artist B", "Artist C"],
  ignoredArtists: [],
  followedArtists: [],
  limit: 5,
}).map((artist) => artist.artist);

assert.deepEqual(visibleArtists, [
  "Artist D",
  "Artist E",
  "Artist F",
  "Artist G",
  "Artist H",
]);

console.log("Artist recommendation backfill tests passed");
