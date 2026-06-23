import { mapPublicPlaysToHistory } from "../utils/publicListeningHistory.js";

async function fetchJson(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Public listening sync request failed");
  }

  return data;
}

export async function getPublicListeningStatus() {
  return fetchJson("/api/listening/status");
}

export async function getPublicRecentPlays(limit = 300) {
  return fetchJson(`/api/listening/recent?limit=${encodeURIComponent(limit)}`);
}

export async function syncPublicListeningNow() {
  return fetchJson("/api/listening/sync", {
    method: "POST",
  });
}

export async function getPublicSyncedHistory(limit = 300) {
  const data = await getPublicRecentPlays(limit);

  return {
    ...data,
    history: mapPublicPlaysToHistory(data.plays || []),
  };
}
