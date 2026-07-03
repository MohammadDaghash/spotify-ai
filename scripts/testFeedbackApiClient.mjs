import assert from "node:assert/strict";

import {
  fetchServerFeedbackEvents,
  syncFeedbackEvent,
} from "../src/services/feedbackApi.js";

const calls = [];

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, options });

  if (options.method === "POST") {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        inserted: 1,
      }),
    };
  }

  return {
    ok: true,
    json: async () => ({
      ok: true,
      events: [{ id: "evt_server" }],
      status: {
        total_events: 1,
      },
    }),
  };
};

const syncResult = await syncFeedbackEvent({
  id: "evt_client",
  action: "like",
  item_type: "song",
  item_name: "Client Song",
});

assert.equal(syncResult.ok, true);
assert.equal(syncResult.inserted, 1);
assert.equal(calls[0].url, "/api/feedback/events");
assert.equal(calls[0].options.method, "POST");
assert.equal(calls[0].options.headers["Content-Type"], "application/json");
assert.deepEqual(JSON.parse(calls[0].options.body), {
  event: {
    id: "evt_client",
    action: "like",
    item_type: "song",
    item_name: "Client Song",
  },
});

const eventsResult = await fetchServerFeedbackEvents(25);

assert.equal(calls[1].url, "/api/feedback/events?limit=25");
assert.deepEqual(eventsResult.events, [{ id: "evt_server" }]);
assert.equal(eventsResult.status.total_events, 1);

globalThis.fetch = async () => ({
  ok: false,
  status: 503,
  json: async () => ({ error: "Storage unavailable" }),
});

await assert.rejects(
  () => syncFeedbackEvent({ id: "evt_fail", action: "like" }),
  /Storage unavailable/,
);

console.log("Feedback API client tests passed");
