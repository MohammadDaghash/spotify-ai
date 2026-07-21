function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildRecommendationFeedbackFeatures(item = {}) {
  const isArtistOnlyItem = Boolean(
    (item.artist || item.artist_name || item.artistName) &&
      !(item.trackName || item.track_name),
  );

  return {
    source: item.source || "ml-api",
    isCatalogBackfill: item.source === "catalog-backfill",
    similarityScore: safeNumber(item.similarityScore ?? item.similarity_score),
    rawSimilarityScore: safeNumber(
      item.rawSimilarityScore ?? item.raw_similarity_score,
    ),
    qualityScore: safeNumber(item.qualityScore ?? item.quality_score),
    heuristicScore: safeNumber(item.heuristicScore ?? item.heuristic_score),
    mlLikeProbability: safeNumber(
      item.mlLikeProbability ?? item.ml_like_probability,
    ),
    mlModelWeight: safeNumber(item.mlModelWeight ?? item.ml_model_weight),
    confidence: safeNumber(item.confidence),
    recencyScore: safeNumber(item.recencyScore ?? item.recency_score),
    knownTrackPenalty: safeNumber(
      item.knownTrackPenalty ?? item.known_track_penalty,
    ),
    knownArtistPenalty: safeNumber(
      item.knownArtistPenalty ?? item.known_artist_penalty,
    ),
    diversityPenalty: safeNumber(item.diversityPenalty ?? item.diversity_penalty),
    feedbackScoreDelta: safeNumber(item.feedbackScoreDelta),
    historyPlayCount: safeNumber(item.historyPlayCount),
    artistStreamCount: safeNumber(
      item.artistStreamCount ??
        item.artist_stream_count ??
        (isArtistOnlyItem ? item.streams : null),
    ),
    skipRate: safeNumber(item.skipRate ?? item.skip_rate),
    listenStrength: safeNumber(item.listenStrength ?? item.listen_strength),
    recentListenStrength: safeNumber(
      item.recentListenStrength ?? item.recent_listen_strength,
    ),
  };
}
