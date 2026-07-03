import { normalizeTopbarSearchText } from "./topbarSearch.js";

export const ARTIST_RECOMMENDATION_RANKING_KEY =
  "spotify_ai_previous_artist_recommendation_ranking";
export const SONG_RECOMMENDATION_RANKING_KEY =
  "spotify_ai_previous_song_recommendation_ranking";

export function getNumericScore(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

export function formatScore(value) {
  const numericValue = getNumericScore(value);

  if (numericValue === null) return "—";

  return `${Math.round(numericValue * 100)}%`;
}

export function getSpotifySearchUrl(query) {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

export function getTrackHistoryKey(trackName, artistName) {
  return `${trackName || ""}::${artistName || ""}`.toLowerCase();
}

export function getSpotifyTrackKey(track) {
  return getTrackHistoryKey(track?.name, track?.artists?.[0]?.name);
}

export function getStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export function storeRankingRows(key, rows) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        rows.map((row, index) => ({
          ...row,
          rank: Number(row.rank || index + 1),
        })),
      ),
    );
  } catch {
    // Local ranking history is optional. Ignore storage failures.
  }
}

export function getStoredGroupMembers() {
  try {
    return JSON.parse(
      localStorage.getItem("spotify_ai_group_members") ||
        localStorage.getItem("spotify_ai_trip_members") ||
        "[]",
    );
  } catch {
    return [];
  }
}

export function applyWeightDelta(weights, key, delta) {
  if (!key) return;
  weights[key] = Math.max(0, (weights[key] || 0) + delta);
}

export function getTopWeights(weights, limit = 3) {
  return Object.entries(weights || {})
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([name, weight]) => ({
      name,
      weight: Number(weight.toFixed(2)),
    }));
}

export function recommendationMatchesSearch(item, query) {
  const normalizedQuery = normalizeTopbarSearchText(query);

  if (!normalizedQuery) return true;

  const itemText = normalizeTopbarSearchText(
    [
      item.artist,
      item.artist_name,
      item.artistName,
      item.track_name,
      item.trackName,
      item.name,
      item.reason,
      item.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => itemText.includes(token));
}

export function filterTripPlaylistsForSearch(playlists, query) {
  if (!playlists || !query) return playlists;

  return Object.fromEntries(
    Object.entries(playlists)
      .map(([playlistKey, playlist]) => {
        const playlistMatches = recommendationMatchesSearch(
          {
            name: playlist.name,
            description: playlist.description,
          },
          query,
        );
        const tracks = playlistMatches
          ? playlist.tracks
          : playlist.tracks.filter((track) =>
              recommendationMatchesSearch(track, query),
            );

        return [
          playlistKey,
          {
            ...playlist,
            tracks,
          },
        ];
      })
      .filter(([, playlist]) => playlist.tracks.length > 0),
  );
}

export function addRelativeMatchScores(recommendations) {
  if (recommendations.length === 0) return [];

  const scores = recommendations.map((rec) => rec.score || 0);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  return recommendations.map((rec, index) => {
    let relativeMatch = 100;

    if (maxScore !== minScore) {
      relativeMatch =
        60 + ((rec.score - minScore) / (maxScore - minScore)) * 40;
    } else if (index > 0) {
      relativeMatch = 90;
    }

    return {
      ...rec,
      relativeMatch: Math.round(relativeMatch),
    };
  });
}

export function calculateDiscoveryMetrics({
  recommendations,
  visibleRecommendations,
  eligibleRecommendations,
  k = 3,
}) {
  const topK = visibleRecommendations.slice(0, k);
  const relevantTopK = topK.filter(
    (track) => track.historyPlayCount < 10 && !track.liveKnownReason,
  );
  const uniqueVisibleArtists = new Set(
    visibleRecommendations.map((track) => track.artistName),
  );

  return {
    precisionAtK:
      topK.length === 0
        ? 0
        : Number((relevantTopK.length / topK.length).toFixed(2)),
    hitAtK: relevantTopK.length > 0 ? 1 : 0,
    catalogCoverage:
      recommendations.length === 0
        ? 0
        : Number(
            (eligibleRecommendations.length / recommendations.length).toFixed(
              2,
            ),
          ),
    artistDiversity:
      visibleRecommendations.length === 0
        ? 0
        : Number(
            (
              uniqueVisibleArtists.size / visibleRecommendations.length
            ).toFixed(2),
          ),
  };
}
