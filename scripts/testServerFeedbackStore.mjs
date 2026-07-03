import assert from "node:assert/strict";

import {
  buildFeedbackStatus,
  normalizeFeedbackEvent,
  upsertFeedbackEvents,
} from "../api/lib/feedbackStore.js";

const rawEvent = {
  id: "evt_like_song",
  timestamp: "2026-07-04T10:00:00.000Z",
  action: "like",
  label: "positive",
  item_type: "song",
  item_key: "song::fresh match::favorite artist::future album",
  item_name: "Fresh Match",
  item_artist: "Favorite Artist",
  item_album: "Future Album",
  score: 0.82,
  relative_match: 94,
  reason: "Strong private-session match",
  source: "recommendations",
  mode: "private-user",
  context: {
    route: "/recommendations",
    maxPlayCount: 10,
    access_token: "must-not-be-stored",
  },
  refresh_token: "must-not-be-stored",
};

const normalizedEvent = normalizeFeedbackEvent(rawEvent);

assert.equal(normalizedEvent.id, "evt_like_song");
assert.equal(normalizedEvent.action, "like");
assert.equal(normalizedEvent.label, "positive");
assert.equal(normalizedEvent.item_type, "song");
assert.equal(normalizedEvent.item_name, "Fresh Match");
assert.equal(normalizedEvent.item_artist, "Favorite Artist");
assert.equal(normalizedEvent.item_album, "Future Album");
assert.equal(normalizedEvent.score, 0.82);
assert.equal(normalizedEvent.relative_match, 94);
assert.equal(normalizedEvent.reason, "Strong private-session match");
assert.equal(normalizedEvent.context.route, "/recommendations");
assert.equal(normalizedEvent.context.maxPlayCount, 10);
assert.equal("access_token" in normalizedEvent.context, false);
assert.equal("refresh_token" in normalizedEvent, false);

assert.equal(
  normalizeFeedbackEvent({
    id: "missing_item",
    action: "like",
    item_type: "song",
  }),
  null,
);

assert.equal(
  normalizeFeedbackEvent({
    id: "missing_action",
    item_type: "artist",
    item_name: "Artist",
  }),
  null,
);

const existingPayload = {
  version: 1,
  updated_at: "2026-07-04T09:00:00.000Z",
  events: [
    {
      id: "evt_existing",
      timestamp: "2026-07-04T09:00:00.000Z",
      action: "ignore",
      label: "negative",
      item_type: "artist",
      item_key: "artist::ignored artist::::",
      item_name: "Ignored Artist",
      item_artist: "",
      item_album: "",
      score: 0.44,
      relative_match: null,
      reason: "",
      source: "recommendations",
      mode: "public-demo",
      context: {},
    },
  ],
};

const upserted = upsertFeedbackEvents(
  existingPayload,
  [
    rawEvent,
    {
      ...rawEvent,
      item_name: "Fresh Match Duplicate",
    },
    {
      id: "evt_saved_song",
      timestamp: "2026-07-04T10:02:00.000Z",
      action: "save",
      item_type: "song",
      item_name: "Saved Match",
      item_artist: "Favorite Artist",
      source: "recommendations",
      mode: "private-user",
    },
  ],
  {
    now: "2026-07-04T10:05:00.000Z",
    limit: 10,
  },
);

assert.equal(upserted.inserted, 2);
assert.equal(upserted.valid, 3);
assert.equal(upserted.payload.events.length, 3);
assert.deepEqual(
  upserted.payload.events.map((event) => event.id),
  ["evt_existing", "evt_like_song", "evt_saved_song"],
);
assert.equal(upserted.payload.updated_at, "2026-07-04T10:05:00.000Z");
assert.equal(upserted.payload.total_events, 3);
assert.equal(upserted.payload.latest_event_at, "2026-07-04T10:02:00.000Z");

const status = buildFeedbackStatus(upserted.payload);

assert.deepEqual(status, {
  total_events: 3,
  latest_event_at: "2026-07-04T10:02:00.000Z",
  updated_at: "2026-07-04T10:05:00.000Z",
  action_counts: {
    ignore: 1,
    like: 1,
    save: 1,
  },
  item_type_counts: {
    artist: 1,
    song: 2,
  },
});

const capped = upsertFeedbackEvents(
  { version: 1, events: [] },
  Array.from({ length: 12 }, (_, index) => ({
    id: `evt_${index}`,
    timestamp: `2026-07-04T10:${String(index).padStart(2, "0")}:00.000Z`,
    action: "open_spotify",
    item_type: "artist",
    item_name: `Artist ${index}`,
  })),
  {
    now: "2026-07-04T11:00:00.000Z",
    limit: 5,
  },
);

assert.equal(capped.payload.events.length, 5);
assert.deepEqual(
  capped.payload.events.map((event) => event.id),
  ["evt_7", "evt_8", "evt_9", "evt_10", "evt_11"],
);

console.log("Server feedback store tests passed");
