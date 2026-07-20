import assert from "node:assert/strict";

import {
  applyFeedbackPreferenceReranking,
  buildFeedbackPreferenceSignals,
  getFeedbackArtistPreferenceLists,
  getFeedbackSongKey,
} from "../src/utils/feedbackPreferenceSignals.js";

const now = new Date("2026-07-17T12:00:00.000Z").getTime();
const events = [
  {
    id: "like_artist",
    event_timestamp: "2026-07-17T10:00:00.000Z",
    action: "like",
    label: "positive",
    item_type: "artist",
    item_name: "Halsey",
  },
  {
    id: "ignore_artist",
    event_timestamp: "2026-07-17T10:05:00.000Z",
    action: "ignore",
    label: "negative",
    item_type: "artist",
    item_name: "Ignored Artist",
  },
  {
    id: "like_song",
    event_timestamp: "2026-07-17T10:10:00.000Z",
    action: "like",
    label: "positive",
    item_type: "song",
    item_name: "Liked Song",
    item_artist: "Favorite Artist",
  },
  {
    id: "open_song",
    event_timestamp: "2026-05-01T10:10:00.000Z",
    action: "open_spotify",
    label: "neutral",
    item_type: "song",
    item_name: "Opened Song",
    item_artist: "Curious Artist",
  },
];

const signals = buildFeedbackPreferenceSignals(events, { now });

assert.deepEqual(signals.likedArtists, ["Halsey"]);
assert.deepEqual(signals.ignoredArtists, ["Ignored Artist"]);
assert.deepEqual(signals.likedSongs, ["Liked Song"]);
assert.equal(
  signals.songWeights.has(getFeedbackSongKey("Liked Song", "Favorite Artist")),
  true,
);
assert.equal(signals.artistWeights.get("halsey") > 0, true);
assert.equal(signals.artistWeights.get("ignored artist") < 0, true);
assert.equal(
  signals.artistWeights.get("favorite artist") >
    signals.artistWeights.get("curious artist"),
  true,
);

const artistPreferenceLists = getFeedbackArtistPreferenceLists(signals);

assert.equal(artistPreferenceLists.likedArtists.includes("halsey"), true);
assert.equal(
  artistPreferenceLists.likedArtists.includes("favorite artist"),
  true,
);
assert.equal(
  artistPreferenceLists.ignoredArtists.includes("ignored artist"),
  true,
);

const artistRecommendations = applyFeedbackPreferenceReranking(
  [
    { artist: "Neutral Artist", score: 0.42 },
    { artist: "Halsey", score: 0.4 },
    { artist: "Ignored Artist", score: 0.5 },
  ],
  {
    signals,
    itemType: "artist",
  },
);

assert.equal(
  artistRecommendations[0].artist,
  "Halsey",
  "liked artists should move up before visible filtering is applied",
);
assert.equal(
  artistRecommendations.at(-1).artist,
  "Ignored Artist",
  "ignored artists should be penalized before visible filtering is applied",
);

const songRecommendations = applyFeedbackPreferenceReranking(
  [
    { trackName: "Fresh Song", artistName: "Favorite Artist", score: 0.4 },
    { trackName: "Other Song", artistName: "Other Artist", score: 0.42 },
  ],
  {
    signals,
    itemType: "song",
  },
);

assert.equal(
  songRecommendations[0].artistName,
  "Favorite Artist",
  "songs by positively weighted artists should move up",
);
assert.equal(songRecommendations[0].feedbackScoreDelta > 0, true);

console.log("Feedback preference signal tests passed");
