import {
  demoArtistRecommendations,
  demoTrackRecommendations,
} from "../data/demoRecommendations.js";
import { allSpotifyHistory } from "../data/loadSpotifyHistory.js";
import { getPublicSyncedHistory } from "./publicListeningApi.js";
import { buildGroupMixPlaylists } from "../utils/groupMixEngine.js";
import { dedupeHistoryEntries } from "../utils/publicListeningHistory.js";

const ML_API_BASE_URL =
  import.meta.env.VITE_ML_API_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8001" : "");

function cloneDemoData(data) {
  return JSON.parse(JSON.stringify(data));
}

function getMlApiBaseUrl() {
  if (!ML_API_BASE_URL) {
    throw new Error("ML backend URL is not configured for this deployment");
  }

  return ML_API_BASE_URL;
}

export async function getMlDashboardAnalytics(
  sortBy = "minutes",
  timeRange = "all",
  selectedYear = "all",
) {
  const params = new URLSearchParams({
    sort_by: sortBy,
    time_range: timeRange,
    year: selectedYear,
  });

  const response = await fetch(
    `${getMlApiBaseUrl()}/analytics/dashboard?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch ML dashboard analytics");
  }

  return response.json();
}

export async function syncRecentlyPlayed(plays = []) {
  const response = await fetch(`${getMlApiBaseUrl()}/listening/recently-played`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plays }),
  });

  if (!response.ok) {
    throw new Error("Failed to sync recently played tracks");
  }

  return response.json();
}

export async function getListeningSyncStatus() {
  const response = await fetch(`${getMlApiBaseUrl()}/listening/status`);

  if (!response.ok) {
    throw new Error("Failed to fetch listening sync status");
  }

  return response.json();
}

export async function getArtistRecommendations({
  topN = 20,
  likedArtists = [],
  ignoredArtists = [],
} = {}) {
  if (!ML_API_BASE_URL) {
    const excludedArtists = new Set([...likedArtists, ...ignoredArtists]);

    return {
      recommendations: cloneDemoData(demoArtistRecommendations)
        .filter((artist) => !excludedArtists.has(artist.artist))
        .slice(0, topN),
    };
  }

  const params = new URLSearchParams({
    top_n: topN,
  });

  likedArtists.forEach((artist) => {
    params.append("liked_artists", artist);
  });

  ignoredArtists.forEach((artist) => {
    params.append("ignored_artists", artist);
  });

  const response = await fetch(
    `${getMlApiBaseUrl()}/recommendations/artists?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  return response.json();
}

export async function getTrackRecommendations({
  topN = 20,
  maxPlayCount = 10,
  likedTracks = [],
  ignoredTracks = [],
} = {}) {
  if (!ML_API_BASE_URL) {
    const excludedTracks = new Set([...likedTracks, ...ignoredTracks]);

    return {
      recommendations: cloneDemoData(demoTrackRecommendations)
        .filter((track) => track.streams < maxPlayCount)
        .filter((track) => !excludedTracks.has(track.track_name))
        .slice(0, topN),
    };
  }

  const params = new URLSearchParams({
    top_n: topN,
    max_play_count: maxPlayCount,
  });

  likedTracks.forEach((track) => {
    params.append("liked_tracks", track);
  });

  ignoredTracks.forEach((track) => {
    params.append("ignored_tracks", track);
  });

  const response = await fetch(
    `${getMlApiBaseUrl()}/recommendations/tracks?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch track recommendations");
  }

  return response.json();
}

export async function getTripPlaylists({
  limit = 25,
  newSongMaxPlays = 5,
  groupMembers = [],
  surveyLikedArtists = [],
  surveyIgnoredArtists = [],
  contextArtists = [],
  hangoutType = "",
  moods = [],
  languages = [],
} = {}) {
  if (!ML_API_BASE_URL) {
    let syncedHistory = [];

    try {
      const syncedData = await getPublicSyncedHistory(500);
      syncedHistory = syncedData.history || [];
    } catch {
      syncedHistory = [];
    }

    return {
      playlists: buildGroupMixPlaylists({
        history: dedupeHistoryEntries([...allSpotifyHistory, ...syncedHistory]),
        groupMembers,
        surveyLikedArtists,
        surveyIgnoredArtists,
        contextArtists,
        limit,
        newSongMaxPlays,
      }),
    };
  }

  const params = new URLSearchParams({
    limit,
    new_song_max_plays: newSongMaxPlays,
  });

  if (hangoutType) {
    params.set("hangout_type", hangoutType);
  }

  surveyLikedArtists.forEach((artist) => {
    params.append("survey_liked_artists", artist);
  });

  surveyIgnoredArtists.forEach((artist) => {
    params.append("survey_ignored_artists", artist);
  });

  contextArtists.forEach((artist) => {
    params.append("context_artists", artist);
  });

  moods.forEach((mood) => {
    params.append("moods", mood);
  });

  languages.forEach((language) => {
    params.append("languages", language);
  });

  const response = await fetch(
    `${getMlApiBaseUrl()}/recommendations/trip-playlists?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch group playlists");
  }

  return response.json();
}
