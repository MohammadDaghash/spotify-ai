import { demoSpotifyHistory } from "./demoSpotifyHistory.js";

// Public deployments use sanitized, month-level demo aggregates.
// Raw Spotify exports stay out of the frontend bundle and Git history from now on.
export const allSpotifyHistory = demoSpotifyHistory;
