import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardSource = readFileSync("src/pages/Dashboard.jsx", "utf8");
const privateNoticeSource = readFileSync(
  "src/components/dashboard/PrivateDataModeNotice.jsx",
  "utf8",
);
const dashboardUxSource = `${dashboardSource}\n${privateNoticeSource}`;

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
  /onClick=\{connectSpotifyForCovers\}/,
  "Sign-in cover button should use the cover-specific Spotify connection flow.",
);

assert.match(
  dashboardSource,
  /authMode: "connect"/,
  "Cover login should not automatically switch the dashboard to private data mode.",
);

assert.match(
  dashboardUxSource,
  /Back to public demo/,
  "Private mode should provide an explicit way back to public demo data.",
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
