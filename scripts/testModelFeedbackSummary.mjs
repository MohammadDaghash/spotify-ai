import assert from "node:assert/strict";

import { buildModelFeedbackSummary } from "../src/utils/modelFeedbackSummary.js";

const summary = buildModelFeedbackSummary({
  status: {
    total_events: 6,
    latest_event_at: "2026-07-04T12:05:00.000Z",
    updated_at: "2026-07-04T12:06:00.000Z",
    action_counts: {
      like: 2,
      ignore: 1,
      save: 1,
      open_spotify: 1,
      create_playlist: 1,
    },
    item_type_counts: {
      song: 4,
      artist: 1,
      group_playlist: 1,
    },
  },
  events: [
    {
      id: "evt_like",
      timestamp: "2026-07-04T12:00:00.000Z",
      action: "like",
      label: "positive",
      item_type: "song",
      item_name: "Liked Song",
      item_artist: "Artist A",
      source: "recommendations",
      mode: "private-user",
    },
    {
      id: "evt_ignore",
      timestamp: "2026-07-04T12:01:00.000Z",
      action: "ignore",
      label: "negative",
      item_type: "artist",
      item_name: "Ignored Artist",
      source: "recommendations",
      mode: "public-demo",
    },
    {
      id: "evt_open",
      timestamp: "2026-07-04T12:02:00.000Z",
      action: "open_spotify",
      label: "neutral",
      item_type: "song",
      item_name: "Opened Song",
      item_artist: "Artist B",
      source: "recommendations",
      mode: "public-demo",
    },
  ],
});

assert.equal(summary.totalEvents, 6);
assert.equal(summary.positiveLabels, 4);
assert.equal(summary.negativeLabels, 1);
assert.equal(summary.neutralSignals, 1);
assert.equal(summary.labelableEvents, 5);
assert.equal(summary.acceptanceRate, "80%");
assert.equal(summary.ignoreRate, "20%");
assert.equal(summary.songEvents, 4);
assert.equal(summary.artistEvents, 1);
assert.equal(summary.groupPlaylistEvents, 1);
assert.equal(summary.latestEventAt, "2026-07-04T12:05:00.000Z");
assert.equal(summary.updatedAt, "2026-07-04T12:06:00.000Z");
assert.deepEqual(summary.actionRows, [
  { label: "Liked", count: 2 },
  { label: "Ignored", count: 1 },
  { label: "Saved", count: 1 },
  { label: "Opened Spotify", count: 1 },
  { label: "Created playlist", count: 1 },
]);
assert.deepEqual(
  summary.recentEvents.map((event) => event.id),
  ["evt_open", "evt_ignore", "evt_like"],
);
assert.equal(summary.recentEvents[0].description, "Opened Song by Artist B");

const emptySummary = buildModelFeedbackSummary({});

assert.equal(emptySummary.totalEvents, 0);
assert.equal(emptySummary.acceptanceRate, "0%");
assert.equal(emptySummary.ignoreRate, "0%");
assert.deepEqual(emptySummary.recentEvents, []);

console.log("Model feedback summary tests passed");
