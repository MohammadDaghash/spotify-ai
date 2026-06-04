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

export async function getArtistRecommendations() {
  const response = await fetch(`${ML_API_BASE_URL}/recommendations/artists`);

  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  return response.json();
}
