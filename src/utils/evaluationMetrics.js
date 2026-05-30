export function precisionAtK(recommendations, relevantTrackNames, k = 3) {
  const topK = recommendations.slice(0, k);

  if (topK.length === 0) {
    return 0;
  }

  const relevantCount = topK.filter((track) =>
    relevantTrackNames.includes(track.trackName),
  ).length;

  return Number((relevantCount / topK.length).toFixed(2));
}

export function hitAtK(recommendations, relevantTrackNames, k = 3) {
  const topK = recommendations.slice(0, k);

  return topK.some((track) => relevantTrackNames.includes(track.trackName))
    ? 1
    : 0;
}

export function catalogCoverage(recommendations, allCandidateTracks) {
  if (allCandidateTracks.length === 0) {
    return 0;
  }

  const uniqueRecommendedTracks = new Set(
    recommendations.map((track) => track.trackName),
  );

  return Number(
    (uniqueRecommendedTracks.size / allCandidateTracks.length).toFixed(2),
  );
}

export function artistDiversity(recommendations) {
  if (recommendations.length === 0) {
    return 0;
  }

  const uniqueArtists = new Set(
    recommendations.map((track) => track.artistName),
  );

  return Number((uniqueArtists.size / recommendations.length).toFixed(2));
}

export function evaluateRecommendations({
  recommendations,
  relevantTrackNames,
  allCandidateTracks,
  k = 3,
}) {
  return {
    precisionAtK: precisionAtK(recommendations, relevantTrackNames, k),
    hitAtK: hitAtK(recommendations, relevantTrackNames, k),
    catalogCoverage: catalogCoverage(recommendations, allCandidateTracks),
    artistDiversity: artistDiversity(recommendations),
  };
}
