import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardSource = readFileSync("src/pages/Dashboard.jsx", "utf8");

assert.match(
  dashboardSource,
  /Sign in with Spotify to load official album covers and artist images\. Placeholder initials are shown until you connect Spotify\./,
  "Signed-out image status should explain covers/images and placeholder initials clearly.",
);

assert.match(
  dashboardSource,
  /Album covers \/ artist images loaded:/,
  "Signed-in image status should avoid vague artwork wording.",
);

assert.match(
  dashboardSource,
  /Retry covers/,
  "Signed-in retry button should use user-facing cover/image language.",
);

assert.match(
  dashboardSource,
  /Sign in to load covers/,
  "Signed-out state should show an actionable sign-in button instead of disabled retry.",
);

assert.match(
  dashboardSource,
  /onClick=\{\(\) => navigate\("\/login"\)\}/,
  "Sign-in cover button should navigate to the existing Use Your Data flow.",
);

assert.doesNotMatch(
  dashboardSource,
  /disabled=\{!canLoadSpotifyArtwork\}/,
  "Retry covers should not be rendered as a disabled Spotify-login placeholder.",
);

assert.doesNotMatch(
  dashboardSource,
  /Sign in with Spotify to load official artwork|Retry artwork|Artwork loaded:/,
  "Dashboard should not use vague artwork copy in the image loading status.",
);

console.log("Artwork UX tests passed");
