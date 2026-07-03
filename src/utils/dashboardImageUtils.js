export const IMAGE_LOOKUP_DELAY_MS = 250;

const RANKING_IMAGE_CACHE_KEY = "spotify_ai_dashboard_ranking_images_v4";
const MAX_CACHED_RANKING_IMAGES = 500;
const RANKING_IMAGE_TYPE_PRIORITY = {
  track: 0,
  artist: 1,
  album: 2,
};

export function getStoredRankingImages() {
  if (typeof localStorage === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(RANKING_IMAGE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function storeRankingImages(images) {
  if (typeof localStorage === "undefined") return;

  const entries = Object.entries(images).slice(-MAX_CACHED_RANKING_IMAGES);
  localStorage.setItem(
    RANKING_IMAGE_CACHE_KEY,
    JSON.stringify(Object.fromEntries(entries)),
  );
}

export function getBestSpotifyImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return "";

  const mediumImage = images.find(
    (image) => image.width >= 120 && image.width <= 320,
  );

  return mediumImage?.url || images[images.length - 1]?.url || images[0]?.url || "";
}

export function getRankingImageKey(type, ...parts) {
  return [type, ...parts].map((part) => part || "").join("::").toLowerCase();
}

export function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function getRetryAfterMs(error) {
  const status = error?.response?.status;
  const retryAfter = Number(error?.response?.headers?.["retry-after"]);

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  if (status === 429) {
    return 5_000;
  }

  return 0;
}

export function sortRowsForImageLoading(rows) {
  return [...rows].sort((left, right) => {
    const rankDiff = (left.rank || 999) - (right.rank || 999);

    if (rankDiff !== 0) return rankDiff;

    return (
      (RANKING_IMAGE_TYPE_PRIORITY[left.imageType] ?? 99) -
      (RANKING_IMAGE_TYPE_PRIORITY[right.imageType] ?? 99)
    );
  });
}
