function getTrackName(track) {
  return track.trackName || track.track_name || track.name || "";
}

function getArtistName(track) {
  return track.artistName || track.artist_name || "";
}

function getRelevantSet(relevantTrackNames = []) {
  return new Set(relevantTrackNames.map((trackName) => trackName.toLowerCase()));
}

function isRelevant(track, relevantSet) {
  return relevantSet.has(getTrackName(track).toLowerCase());
}

export function precisionAtK(recommendations, relevantTrackNames, k = 3) {
  const topK = recommendations.slice(0, k);

  if (topK.length === 0) {
    return 0;
  }

  const relevantSet = getRelevantSet(relevantTrackNames);
  const relevantCount = topK.filter((track) => isRelevant(track, relevantSet)).length;

  return Number((relevantCount / topK.length).toFixed(2));
}

export function recallAtK(recommendations, relevantTrackNames, k = 3) {
  const relevantSet = getRelevantSet(relevantTrackNames);

  if (relevantSet.size === 0) {
    return 0;
  }

  const topK = recommendations.slice(0, k);
  const relevantCount = topK.filter((track) => isRelevant(track, relevantSet)).length;

  return Number((relevantCount / relevantSet.size).toFixed(2));
}

export function hitAtK(recommendations, relevantTrackNames, k = 3) {
  const relevantSet = getRelevantSet(relevantTrackNames);
  const topK = recommendations.slice(0, k);

  return topK.some((track) => isRelevant(track, relevantSet)) ? 1 : 0;
}

export function ndcgAtK(recommendations, relevantTrackNames, k = 3) {
  const relevantSet = getRelevantSet(relevantTrackNames);

  if (relevantSet.size === 0) {
    return 0;
  }

  const topK = recommendations.slice(0, k);
  const dcg = topK.reduce((sum, track, index) => {
    if (!isRelevant(track, relevantSet)) {
      return sum;
    }

    return sum + 1 / Math.log2(index + 2);
  }, 0);
  const idealRelevantCount = Math.min(k, relevantSet.size);
  const idealDcg = Array.from({ length: idealRelevantCount }).reduce(
    (sum, _, index) => sum + 1 / Math.log2(index + 2),
    0,
  );

  if (idealDcg === 0) {
    return 0;
  }

  return Number((dcg / idealDcg).toFixed(2));
}

export function catalogCoverage(recommendations, allCandidateTracks) {
  if (allCandidateTracks.length === 0) {
    return 0;
  }

  const uniqueRecommendedTracks = new Set(recommendations.map(getTrackName));

  return Number(
    (uniqueRecommendedTracks.size / allCandidateTracks.length).toFixed(2),
  );
}

export function artistDiversity(recommendations) {
  if (recommendations.length === 0) {
    return 0;
  }

  const uniqueArtists = new Set(recommendations.map(getArtistName));

  return Number((uniqueArtists.size / recommendations.length).toFixed(2));
}

export function noveltyScore(recommendations) {
  if (recommendations.length === 0) {
    return 0;
  }

  const novelty = recommendations.reduce(
    (sum, track) => sum + (1 - Math.min(1, track.popularity || 0)),
    0,
  );

  return Number((novelty / recommendations.length).toFixed(2));
}

export function personalizationScore(recommendations, globalTopTracks = []) {
  if (recommendations.length === 0) {
    return 0;
  }

  const globalTopSet = new Set(globalTopTracks.map((track) => getTrackName(track)));
  const personalizedCount = recommendations.filter(
    (track) => !globalTopSet.has(getTrackName(track)),
  ).length;

  return Number((personalizedCount / recommendations.length).toFixed(2));
}

export function recommendationStability(
  recommendations,
  previousRecommendations = [],
  k = 10,
) {
  if (previousRecommendations.length === 0) {
    return 1;
  }

  const currentTopK = new Set(recommendations.slice(0, k).map(getTrackName));
  const previousTopK = new Set(previousRecommendations.slice(0, k).map(getTrackName));
  const overlap = [...currentTopK].filter((trackName) =>
    previousTopK.has(trackName),
  ).length;
  const union = new Set([...currentTopK, ...previousTopK]).size;

  if (union === 0) {
    return 1;
  }

  return Number((overlap / union).toFixed(2));
}

export function evaluateRecommendations({
  recommendations,
  relevantTrackNames,
  allCandidateTracks,
  previousRecommendations = [],
  globalTopTracks = [],
  k = 3,
}) {
  return {
    precisionAtK: precisionAtK(recommendations, relevantTrackNames, k),
    recallAtK: recallAtK(recommendations, relevantTrackNames, k),
    hitAtK: hitAtK(recommendations, relevantTrackNames, k),
    ndcgAtK: ndcgAtK(recommendations, relevantTrackNames, k),
    catalogCoverage: catalogCoverage(recommendations, allCandidateTracks),
    artistDiversity: artistDiversity(recommendations),
    novelty: noveltyScore(recommendations),
    personalization: personalizationScore(recommendations, globalTopTracks),
    stability: recommendationStability(
      recommendations,
      previousRecommendations,
      k,
    ),
  };
}
