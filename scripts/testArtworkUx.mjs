import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardSource = readFileSync("src/pages/Dashboard.jsx", "utf8");

assert.match(
  dashboardSource,
  /Sign in with Spotify to load official album covers and artist images\./,
  "Signed-out image status should explain album covers and artist images clearly.",
);

assert.match(
  dashboardSource,
  /Album covers \/ artist images loaded:/,
  "Signed-in image status should avoid vague artwork wording.",
);

assert.match(
  dashboardSource,
  /Retry covers/,
  "Retry button should use user-facing cover/image language.",
);

assert.match(
  dashboardSource,
  /disabled=\{!canLoadSpotifyArtwork\}/,
  "Retry should be disabled when Spotify login is unavailable.",
);

assert.doesNotMatch(
  dashboardSource,
  /Sign in with Spotify to load official artwork|Retry artwork|Artwork loaded:/,
  "Dashboard should not use vague artwork copy in the image loading status.",
);

console.log("Artwork UX tests passed");
