import assert from "node:assert/strict";

import {
  addRankMovementToRows,
  getPreviousHistoryWindow,
} from "../src/utils/rankMovement.js";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyRedirectUri,
} from "../src/services/spotifyAuth.js";

const movedRows = addRankMovementToRows(
  [
    { name: "A", rank: 1 },
    { name: "B", rank: 2 },
    { name: "C", rank: 3 },
    { name: "D", rank: 4 },
  ],
  [
    { name: "B", rank: 1 },
    { name: "A", rank: 2 },
    { name: "C", rank: 3 },
  ],
  ["name"],
);

assert.equal(movedRows[0].rank_direction, "up");
assert.equal(movedRows[0].rank_change, 1);
assert.equal(movedRows[1].rank_direction, "down");
assert.equal(movedRows[1].rank_change, -1);
assert.equal(movedRows[2].rank_direction, "same");
assert.equal(movedRows[2].rank_change, 0);
assert.equal(movedRows[3].rank_direction, "new");
assert.equal(movedRows[3].previous_rank, null);

const normalizedRows = addRankMovementToRows(
  [
    {
      albumName: "eternal sunshine",
      artistName: "Ariana Grande",
      rank: 1,
    },
    {
      albumName: "  HIT ME HARD AND SOFT ",
      artistName: "BILLIE EILISH",
      rank: 2,
    },
  ],
  [
    {
      albumName: "eternal sunshine (deluxe)",
      artistName: "Ariana Grande",
      rank: 1,
    },
    {
      albumName: "hit me hard and soft",
      artistName: "Billie Eilish",
      rank: 4,
    },
  ],
  ["albumName", "artistName"],
);

assert.equal(normalizedRows[0].rank_direction, "same");
assert.equal(normalizedRows[1].rank_direction, "up");
assert.equal(normalizedRows[1].rank_change, 2);

const previousThirtyDays = getPreviousHistoryWindow(
  [
    { ts: "2026-05-30T12:00:00.000Z" },
    { ts: "2026-05-01T12:00:00.000Z" },
    { ts: "2026-04-15T12:00:00.000Z" },
  ],
  {
    timeRange: "30d",
    selectedYear: "all",
    now: new Date("2026-06-13T12:00:00.000Z"),
  },
);

assert.deepEqual(
  previousThirtyDays.map((row) => row.ts),
  ["2026-05-01T12:00:00.000Z", "2026-04-15T12:00:00.000Z"],
);

assert.equal(
  getSpotifyRedirectUri({
    configuredRedirectUri: "http://127.0.0.1:5174/callback",
    origin: "https://spotify-ai-sooty.vercel.app",
  }),
  "https://spotify-ai-sooty.vercel.app/callback",
);

assert.equal(
  getSpotifyRedirectUri({
    configuredRedirectUri: "https://spotify-ai-sooty.vercel.app/callback",
    origin: "https://spotify-ai-sooty.vercel.app",
  }),
  "https://spotify-ai-sooty.vercel.app/callback",
);

const authUrl = buildSpotifyAuthorizeUrl({
  clientId: "client-id",
  redirectUri: "https://spotify-ai-sooty.vercel.app/callback",
  codeChallenge: "challenge",
  scopes: "user-read-email user-top-read",
});

assert.equal(authUrl.origin, "https://accounts.spotify.com");
assert.equal(authUrl.pathname, "/authorize");
assert.equal(
  authUrl.searchParams.get("redirect_uri"),
  "https://spotify-ai-sooty.vercel.app/callback",
);
assert.equal(authUrl.searchParams.get("response_type"), "code");
assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");

console.log("Public demo bug tests passed");
