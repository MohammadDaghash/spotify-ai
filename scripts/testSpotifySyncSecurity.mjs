import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createAdminSessionCookie,
  decryptRefreshToken,
  encryptRefreshToken,
  buildPublicStatus,
  getServerSyncConfigStatus,
  verifyAdminSessionCookie,
} from "../api/lib/publicListeningSync.js";
import adminLoginHandler from "../api/admin/login.js";
import syncHandler from "../api/listening/sync.js";

const vercelConfig = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);
const listeningCron = vercelConfig.crons?.find(
  (cron) => cron.path === "/api/listening/sync",
);

assert.ok(listeningCron);
assert.equal(listeningCron.schedule, "0 3 * * *");

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

const encryptedRefreshToken = encryptRefreshToken(
  "rotated-refresh-token",
  "encryption-secret",
);

assert.notEqual(encryptedRefreshToken, "rotated-refresh-token");
assert.equal(
  decryptRefreshToken(encryptedRefreshToken, "encryption-secret"),
  "rotated-refresh-token",
);
assert.equal(decryptRefreshToken(encryptedRefreshToken, "wrong-secret"), "");

const publicStatus = buildPublicStatus({
  encrypted_refresh_token: encryptedRefreshToken,
  last_sync_status: "success",
});

assert.equal("encrypted_refresh_token" in publicStatus, false);

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

const previousProcessEnv = {
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN,
};

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.CRON_SECRET;
delete process.env.SPOTIFY_CLIENT_ID;
delete process.env.SPOTIFY_CLIENT_SECRET;
delete process.env.SPOTIFY_REFRESH_TOKEN;

const unauthenticatedCronResponse = createMockResponse();
await syncHandler(
  {
    method: "GET",
    headers: {},
  },
  unauthenticatedCronResponse,
);

assert.equal(unauthenticatedCronResponse.statusCode, 401);

process.env.CRON_SECRET = "test-secret";

const invalidCronResponse = createMockResponse();
await syncHandler(
  {
    method: "GET",
    headers: {
      authorization: "Bearer wrong-secret",
    },
  },
  invalidCronResponse,
);

assert.equal(invalidCronResponse.statusCode, 401);

const authenticatedCronResponse = createMockResponse();
await syncHandler(
  {
    method: "GET",
    headers: {
      authorization: "Bearer test-secret",
    },
  },
  authenticatedCronResponse,
);

assert.equal(authenticatedCronResponse.statusCode, 503);
assert.equal(authenticatedCronResponse.body.code, "missing_env");

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

for (const [key, value] of Object.entries(previousProcessEnv)) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

console.log("Spotify sync security/config tests passed");
