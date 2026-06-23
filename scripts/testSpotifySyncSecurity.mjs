import assert from "node:assert/strict";

import {
  createAdminSessionCookie,
  getServerSyncConfigStatus,
  verifyAdminSessionCookie,
} from "../api/lib/publicListeningSync.js";
import adminLoginHandler from "../api/admin/login.js";
import syncHandler from "../api/listening/sync.js";

function createMockResponse() {
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
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const missingConfig = getServerSyncConfigStatus({
  NODE_ENV: "production",
});

assert.equal(missingConfig.configured, false);
assert.deepEqual(missingConfig.missing_required_env, [
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_REFRESH_TOKEN",
]);
assert.deepEqual(missingConfig.missing_recommended_env, [
  "BLOB_READ_WRITE_TOKEN",
]);
assert.equal(missingConfig.storage_persistent, false);

const configuredWithoutBlob = getServerSyncConfigStatus({
  NODE_ENV: "production",
  SPOTIFY_CLIENT_ID: "client-id",
  SPOTIFY_REFRESH_TOKEN: "refresh-token",
});

assert.equal(configuredWithoutBlob.configured, true);
assert.equal(configuredWithoutBlob.storage_persistent, false);
assert.deepEqual(configuredWithoutBlob.missing_required_env, []);
assert.deepEqual(configuredWithoutBlob.missing_recommended_env, [
  "BLOB_READ_WRITE_TOKEN",
]);

const configuredWithBlob = getServerSyncConfigStatus({
  NODE_ENV: "production",
  SPOTIFY_CLIENT_ID: "client-id",
  SPOTIFY_REFRESH_TOKEN: "refresh-token",
  BLOB_READ_WRITE_TOKEN: "blob-token",
});

assert.equal(configuredWithBlob.configured, true);
assert.equal(configuredWithBlob.storage_persistent, true);
assert.deepEqual(configuredWithBlob.missing_recommended_env, []);

const cookie = createAdminSessionCookie({
  email: "mohammad.da1212@gmail.com",
  now: 1_800_000_000_000,
  secret: "test-secret",
});

assert.ok(cookie.includes("HttpOnly"));
assert.ok(cookie.includes("SameSite=Lax"));

assert.equal(
  verifyAdminSessionCookie({
    cookieHeader: cookie,
    now: 1_800_000_000_000,
    secret: "test-secret",
  }).ok,
  true,
);

assert.equal(
  verifyAdminSessionCookie({
    cookieHeader: cookie.replace("mohammad", "attacker"),
    now: 1_800_000_000_000,
    secret: "test-secret",
  }).ok,
  false,
);

assert.equal(
  verifyAdminSessionCookie({
    cookieHeader: cookie,
    now: 1_800_000_000_000 + 8 * 60 * 60 * 1000,
    secret: "test-secret",
  }).ok,
  false,
);

process.env.CRON_SECRET = process.env.CRON_SECRET || "test-secret";

const unauthenticatedSyncResponse = createMockResponse();
await syncHandler(
  {
    method: "POST",
    headers: {},
  },
  unauthenticatedSyncResponse,
);

assert.equal(unauthenticatedSyncResponse.statusCode, 401);

const loginResponse = createMockResponse();
await adminLoginHandler(
  {
    method: "POST",
    headers: {},
    body: {
      email: "mohammad.da1212@gmail.com",
    },
  },
  loginResponse,
);

assert.equal(loginResponse.statusCode, 200);
assert.ok(loginResponse.headers["set-cookie"]);

const authenticatedSyncResponse = createMockResponse();
await syncHandler(
  {
    method: "POST",
    headers: {
      cookie: loginResponse.headers["set-cookie"],
    },
  },
  authenticatedSyncResponse,
);

assert.equal(authenticatedSyncResponse.statusCode, 503);
assert.equal(authenticatedSyncResponse.body.code, "missing_env");

console.log("Spotify sync security/config tests passed");
