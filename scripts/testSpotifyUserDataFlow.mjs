import assert from "node:assert/strict";

import {
  buildSpotifyAuthorizeUrl,
  getSpotifyCallbackErrorMessage,
  getSpotifyRedirectUri,
  SPOTIFY_SCOPES,
} from "../src/services/spotifyAuth.js";
import {
  disablePrivateSpotifyDataMode,
  enablePrivateSpotifyDataMode,
  isPrivateSpotifyDataMode,
  mapSpotifyPlaysToHistoryEntries,
  readLocalSpotifyHistory,
  returnToPublicDemoMode,
  saveLocalSpotifyHistory,
  saveSpotifyApiHistory,
  SPOTIFY_API_HISTORY_KEY,
} from "../src/utils/localSpotifyHistory.js";

function createStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();
globalThis.window = {
  dispatchEvent() {},
};

const authUrl = buildSpotifyAuthorizeUrl({
  clientId: "client-id",
  redirectUri: "https://spotify-ai-sooty.vercel.app/callback",
  codeChallenge: "challenge",
  state: "state-value",
});

assert.equal(authUrl.origin, "https://accounts.spotify.com");
assert.equal(
  authUrl.searchParams.get("redirect_uri"),
  "https://spotify-ai-sooty.vercel.app/callback",
);
assert.equal(authUrl.searchParams.get("state"), "state-value");
assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");

for (const scope of [
  "user-read-private",
  "user-read-email",
  "user-read-recently-played",
  "user-read-currently-playing",
  "user-top-read",
  "user-library-read",
  "user-follow-read",
]) {
  assert.ok(SPOTIFY_SCOPES.includes(scope), `${scope} should be requested`);
}

assert.equal(
  getSpotifyRedirectUri({
    configuredRedirectUri: "https://spotify-ai-sooty.vercel.app/callback",
    origin: "https://spotify-ai-sooty.vercel.app",
  }),
  "https://spotify-ai-sooty.vercel.app/callback",
);

assert.match(
  getSpotifyCallbackErrorMessage({
    error: "access_denied",
  }),
  /permission/i,
);

assert.match(
  getSpotifyCallbackErrorMessage({
    tokenError: {
      response: {
        status: 400,
        data: {
          error: "invalid_grant",
          error_description: "Invalid redirect URI",
        },
      },
    },
  }),
  /redirect URI/i,
);

assert.equal(isPrivateSpotifyDataMode(), false);
assert.deepEqual(readLocalSpotifyHistory(), []);

saveLocalSpotifyHistory([
  {
    ts: "2026-06-20T10:00:00.000Z",
    master_metadata_track_name: "Imported Song",
    master_metadata_album_artist_name: "Imported Artist",
    master_metadata_album_album_name: "Imported Album",
    ms_played: 120_000,
  },
]);

assert.equal(isPrivateSpotifyDataMode(), true);
assert.equal(readLocalSpotifyHistory().length, 1);

disablePrivateSpotifyDataMode();
assert.equal(isPrivateSpotifyDataMode(), false);
assert.deepEqual(readLocalSpotifyHistory(), []);

enablePrivateSpotifyDataMode();
assert.equal(readLocalSpotifyHistory().length, 1);

const spotifyHistory = mapSpotifyPlaysToHistoryEntries([
  {
    played_at: "2026-06-22T12:00:00.000Z",
    duration_ms: 210_000,
    track_name: "Recent Song",
    artist_name: "Recent Artist",
    album_name: "Recent Album",
  },
]);

assert.deepEqual(spotifyHistory[0], {
  ts: "2026-06-22T12:00:00.000Z",
  ms_played: 210_000,
  master_metadata_track_name: "Recent Song",
  master_metadata_album_artist_name: "Recent Artist",
  master_metadata_album_album_name: "Recent Album",
});

saveSpotifyApiHistory(spotifyHistory);
assert.equal(isPrivateSpotifyDataMode(), true);
assert.equal(readLocalSpotifyHistory().length, 2);
assert.ok(localStorage.getItem(SPOTIFY_API_HISTORY_KEY));

localStorage.setItem("spotify_access_token", "access-token");
localStorage.setItem("spotify_refresh_token", "refresh-token");
localStorage.setItem("spotify_token_expires_at", "9999999999999");

returnToPublicDemoMode();

assert.equal(isPrivateSpotifyDataMode(), false);
assert.deepEqual(readLocalSpotifyHistory(), []);
assert.equal(localStorage.getItem("spotify_access_token"), null);
assert.equal(localStorage.getItem("spotify_refresh_token"), null);
assert.equal(localStorage.getItem("spotify_token_expires_at"), null);
assert.equal(localStorage.getItem(SPOTIFY_API_HISTORY_KEY), null);

console.log("Spotify user data flow tests passed");
