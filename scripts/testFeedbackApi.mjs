import assert from "node:assert/strict";

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.FEEDBACK_STORAGE_PATH;

const { default: handler } = await import("../api/feedback/events.js");
const { writeFeedbackPayload } = await import("../api/lib/feedbackStore.js");

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

await writeFeedbackPayload({
  version: 1,
  updated_at: null,
  total_events: 0,
  latest_event_at: null,
  events: [],
});

const postResponse = createResponse();

await handler(
  {
    method: "POST",
    body: {
      event: {
        id: "evt_api_like",
        timestamp: "2026-07-04T12:00:00.000Z",
        action: "like",
        item_type: "artist",
        item_name: "API Artist",
        source: "recommendations",
        context: {
          route: "/recommendations",
          access_token: "must-not-be-stored",
        },
      },
    },
  },
  postResponse,
);

assert.equal(postResponse.statusCode, 200);
assert.equal(postResponse.body.ok, true);
assert.equal(postResponse.body.received, 1);
assert.equal(postResponse.body.valid, 1);
assert.equal(postResponse.body.inserted, 1);
assert.equal(postResponse.body.status.total_events, 1);
assert.equal(postResponse.headers["cache-control"], "no-store");

const getResponse = createResponse();

await handler(
  {
    method: "GET",
    query: {
      limit: "1",
    },
  },
  getResponse,
);

assert.equal(getResponse.statusCode, 200);
assert.equal(getResponse.body.events.length, 1);
assert.equal(getResponse.body.events[0].id, "evt_api_like");
assert.equal(getResponse.body.events[0].item_name, "API Artist");
assert.equal("access_token" in getResponse.body.events[0].context, false);
assert.equal(getResponse.body.status.total_events, 1);

const badMethodResponse = createResponse();

await handler(
  {
    method: "DELETE",
  },
  badMethodResponse,
);

assert.equal(badMethodResponse.statusCode, 405);
assert.equal(badMethodResponse.headers.allow, "GET, POST");

console.log("Feedback API tests passed");
