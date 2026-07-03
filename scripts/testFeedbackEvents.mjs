import assert from "node:assert/strict";

import {
  FEEDBACK_EVENTS_KEY,
  clearFeedbackEvents,
  getFeedbackEvents,
  recordFeedbackEvent,
  summarizeFeedbackEvents,
} from "../src/utils/feedbackEvents.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

const storage = createMemoryStorage();

clearFeedbackEvents({ storage });

const likedSong = recordFeedbackEvent(
  {
    action: "like",
    itemType: "song",
    item: {
      trackName: "Fresh Match",
      artistName: "Favorite Artist",
      albumName: "Future Album",
      score: 0.82,
      relativeMatch: 94,
      reason: "Strong private-session match",
    },
    mode: "private-user",
    source: "recommendations",
    context: {
      route: "/recommendations",
      maxPlayCount: 10,
    },
  },
  {
    id: "evt_1",
    now: "2026-07-04T10:00:00.000Z",
    storage,
  },
);

const ignoredArtist = recordFeedbackEvent(
  {
    action: "ignore",
    itemType: "artist",
    item: {
      artist: "Ignored Artist",
      score: 0.44,
      reason: "Not the right signal",
      access_token: "must-not-be-stored",
    },
    mode: "public-demo",
    source: "recommendations",
  },
  {
    id: "evt_2",
    now: "2026-07-04T10:01:00.000Z",
    storage,
  },
);

assert.equal(likedSong.id, "evt_1");
assert.equal(likedSong.action, "like");
assert.equal(likedSong.item_type, "song");
assert.equal(likedSong.item_name, "Fresh Match");
assert.equal(likedSong.item_artist, "Favorite Artist");
assert.equal(likedSong.item_album, "Future Album");
assert.equal(likedSong.score, 0.82);
assert.equal(likedSong.relative_match, 94);
assert.equal(likedSong.label, "positive");
assert.deepEqual(likedSong.context, {
  route: "/recommendations",
  maxPlayCount: 10,
});

assert.equal(ignoredArtist.label, "negative");
assert.equal(ignoredArtist.item_name, "Ignored Artist");
assert.equal("access_token" in ignoredArtist, false);

const storedEvents = getFeedbackEvents({ storage });

assert.equal(storedEvents.length, 2);
assert.equal(JSON.parse(storage.getItem(FEEDBACK_EVENTS_KEY)).length, 2);

const stats = summarizeFeedbackEvents(storedEvents);

assert.deepEqual(stats.byAction, {
  like: 1,
  ignore: 1,
});
assert.equal(stats.totalEvents, 2);
assert.equal(stats.positiveEvents, 1);
assert.equal(stats.negativeEvents, 1);
assert.equal(stats.labelableEvents, 2);
assert.equal(stats.acceptanceRate, 0.5);
assert.equal(stats.ignoreRate, 0.5);
assert.equal(stats.songEvents, 1);
assert.equal(stats.artistEvents, 1);

clearFeedbackEvents({ storage });
assert.deepEqual(getFeedbackEvents({ storage }), []);

console.log("Feedback event tests passed");
