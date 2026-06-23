import assert from "node:assert/strict";

import {
  buildAuthorizeUrl,
  buildTokenRequestOptions,
  getSetupConfig,
  readEnvFiles,
} from "./spotifyRefreshTokenSetup.mjs";

const env = readEnvFiles([
  {
    exists: true,
    content: `
VITE_SPOTIFY_CLIENT_ID=client-from-vite
SPOTIFY_CLIENT_SECRET=super-secret
SPOTIFY_REFRESH_SETUP_REDIRECT_URI=http://127.0.0.1:9999/callback
`,
  },
]);

assert.equal(env.VITE_SPOTIFY_CLIENT_ID, "client-from-vite");
assert.equal(env.SPOTIFY_CLIENT_SECRET, "super-secret");

const config = getSetupConfig(env);

assert.equal(config.clientId, "client-from-vite");
assert.equal(config.clientSecret, "super-secret");
assert.equal(config.redirectUri, "http://127.0.0.1:9999/callback");
assert.equal(config.port, 9999);
assert.equal(config.usesClientSecret, true);

const authorizeUrl = buildAuthorizeUrl({
  clientId: "client-id",
  redirectUri: "http://127.0.0.1:8888/callback",
  scopes: ["user-read-recently-played", "user-read-currently-playing"],
  state: "state-value",
  codeChallenge: "challenge-value",
  usesClientSecret: false,
});

assert.equal(authorizeUrl.origin, "https://accounts.spotify.com");
assert.equal(authorizeUrl.pathname, "/authorize");
assert.equal(authorizeUrl.searchParams.get("client_id"), "client-id");
assert.equal(authorizeUrl.searchParams.get("response_type"), "code");
assert.equal(
  authorizeUrl.searchParams.get("redirect_uri"),
  "http://127.0.0.1:8888/callback",
);
assert.equal(
  authorizeUrl.searchParams.get("scope"),
  "user-read-recently-played user-read-currently-playing",
);
assert.equal(authorizeUrl.searchParams.get("state"), "state-value");
assert.equal(authorizeUrl.searchParams.get("code_challenge"), "challenge-value");
assert.equal(authorizeUrl.searchParams.get("code_challenge_method"), "S256");

const pkceTokenRequest = buildTokenRequestOptions({
  code: "auth-code",
  clientId: "client-id",
  redirectUri: "http://127.0.0.1:8888/callback",
  codeVerifier: "code-verifier",
});

assert.equal(pkceTokenRequest.headers.Authorization, undefined);
assert.equal(pkceTokenRequest.body.get("client_id"), "client-id");
assert.equal(pkceTokenRequest.body.get("code_verifier"), "code-verifier");

const secretTokenRequest = buildTokenRequestOptions({
  code: "auth-code",
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:8888/callback",
});

assert.equal(secretTokenRequest.body.get("client_id"), null);
assert.equal(secretTokenRequest.body.get("code_verifier"), null);
assert.match(secretTokenRequest.headers.Authorization, /^Basic /);

console.log("Spotify refresh token setup tests passed");
