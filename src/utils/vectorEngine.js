export function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce(
    (sum, value, index) => sum + value * vecB[index],
    0,
  );

  const magnitudeA = Math.sqrt(
    vecA.reduce((sum, value) => sum + value * value, 0),
  );

  const magnitudeB = Math.sqrt(
    vecB.reduce((sum, value) => sum + value * value, 0),
  );

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

export function buildTrackVector(track) {
  return [
    track.genres?.includes("pop") ? 1 : 0,
    track.genres?.includes("synth-pop") ? 1 : 0,
    track.genres?.includes("dark pop") ? 1 : 0,
    track.moods?.includes("energetic") ? 1 : 0,
    track.moods?.includes("emotional") ? 1 : 0,
    track.popularity || 0,
    track.recencyScore || 0,
  ];
}

export function buildUserTasteVector(userProfile) {
  return [
    userProfile.genreWeights?.pop || 0,
    userProfile.genreWeights?.["synth-pop"] || 0,
    userProfile.genreWeights?.["dark pop"] || 0,
    userProfile.moodWeights?.energetic || 0,
    userProfile.moodWeights?.emotional || 0,
    userProfile.avgPopularity || 0,
    userProfile.avgRecency || 0,
  ];
}
