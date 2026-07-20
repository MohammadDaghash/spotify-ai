import assert from "node:assert/strict";

import {
  fetchUserFeedbackEvents,
  mapFeedbackEventToUserRow,
  syncUserFeedbackEvent,
} from "../src/services/userFeedbackApi.js";

const user = {
  id: "user-id",
  email: "user@example.com",
  provider: "supabase",
};
const event = {
  id: "evt_1",
  timestamp: "2026-07-17T10:00:00.000Z",
  action: "like",
  label: "positive",
  item_type: "song",
  item_key: "song::fresh::artist::album",
  item_name: "Fresh",
  item_artist: "Artist",
  item_album: "Album",
  score: 0.82,
  relative_match: 94,
  reason: "Strong match",
  source: "recommendations",
  mode: "private-user",
  context: {
    route: "/recommendations",
    access_token: "must-not-store",
    nested: {
      refresh_token: "must-not-store",
      safe: "ok",
    },
  },
};

const row = mapFeedbackEventToUserRow(event, user);

assert.deepEqual(row, {
  id: "evt_1",
  user_id: "user-id",
  event_timestamp: "2026-07-17T10:00:00.000Z",
  action: "like",
  label: "positive",
  item_type: "song",
  item_key: "song::fresh::artist::album",
  item_name: "Fresh",
  item_artist: "Artist",
  item_album: "Album",
  score: 0.82,
  relative_match: 94,
  reason: "Strong match",
  source: "recommendations",
  mode: "private-user",
  context: {
    route: "/recommendations",
    nested: {
      safe: "ok",
    },
  },
});

const insertedRows = [];
const fakeSupabaseClient = {
  from(tableName) {
    assert.equal(tableName, "user_feedback_events");

    return {
      insert(rowToInsert) {
        insertedRows.push(rowToInsert);

        return Promise.resolve({ error: null });
      },
    };
  },
};

const syncResult = await syncUserFeedbackEvent(event, {
  user,
  supabaseClient: fakeSupabaseClient,
});

assert.equal(syncResult.ok, true);
assert.equal(syncResult.inserted, 1);
assert.equal(insertedRows.length, 1);
assert.equal(insertedRows[0].user_id, "user-id");
assert.equal("access_token" in insertedRows[0].context, false);

const noUserResult = await syncUserFeedbackEvent(event, {
  user: null,
  supabaseClient: fakeSupabaseClient,
});

assert.equal(noUserResult.ok, false);
assert.equal(noUserResult.skipped, "missing_supabase_user");

const localUserResult = await syncUserFeedbackEvent(event, {
  user: {
    id: "local-user",
    email: "local@example.com",
    provider: "local-dev",
  },
  supabaseClient: fakeSupabaseClient,
});

assert.equal(localUserResult.ok, false);
assert.equal(localUserResult.skipped, "missing_supabase_user");

const fetchedRows = [
  {
    id: "evt_private_1",
    user_id: "user-id",
    event_timestamp: "2026-07-17T10:00:00.000Z",
    action: "like",
    label: "positive",
    item_type: "song",
    item_name: "Private Song",
  },
];
const fakeReadClient = {
  from(tableName) {
    assert.equal(tableName, "user_feedback_events");

    return {
      select(columns) {
        assert.equal(columns, "*");

        return {
          eq(column, value) {
            assert.equal(column, "user_id");
            assert.equal(value, "user-id");

            return {
              order(column, options) {
                assert.equal(column, "event_timestamp");
                assert.deepEqual(options, { ascending: false });

                return {
                  limit(limit) {
                    assert.equal(limit, 500);

                    return Promise.resolve({
                      data: fetchedRows,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};

const fetchResult = await fetchUserFeedbackEvents({
  user,
  supabaseClient: fakeReadClient,
});

assert.equal(fetchResult.ok, true);
assert.deepEqual(fetchResult.events, fetchedRows);

console.log("User feedback API tests passed");
