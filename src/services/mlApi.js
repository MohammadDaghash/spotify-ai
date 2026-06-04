const ML_API_BASE_URL =
  import.meta.env.VITE_ML_API_URL || "http://127.0.0.1:8001";

const dashboardCache = new Map();

export async function getMlDashboardAnalytics(
  sortBy = "minutes",
  timeRange = "all",
  selectedYear = "all",
) {
  const cacheKey = `${sortBy}-${timeRange}-${selectedYear}`;

  if (dashboardCache.has(cacheKey)) {
    return dashboardCache.get(cacheKey);
  }

  const params = new URLSearchParams({
    sort_by: sortBy,
    time_range: timeRange,
    year: selectedYear,
  });

  const response = await fetch(
    `${ML_API_BASE_URL}/analytics/dashboard?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch ML dashboard analytics");
  }

  const data = await response.json();
  dashboardCache.set(cacheKey, data);

  return data;
}

export async function getArtistRecommendations({
  topN = 20,
  likedArtists = [],
  ignoredArtists = [],
} = {}) {
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
    `${ML_API_BASE_URL}/recommendations/artists?${params.toString()}`,
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
    `${ML_API_BASE_URL}/recommendations/tracks?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch track recommendations");
  }

  return response.json();
}

export async function getTripPlaylists({
  limit = 25,
  newSongMaxPlays = 5,
} = {}) {
  const params = new URLSearchParams({
    limit,
    new_song_max_plays: newSongMaxPlays,
  });

  const response = await fetch(
    `${ML_API_BASE_URL}/recommendations/trip-playlists?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch trip playlists");
  }

  return response.json();
}
