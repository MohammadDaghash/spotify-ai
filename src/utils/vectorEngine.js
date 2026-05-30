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
    track.genres.includes("pop") ? 1 : 0,
    track.genres.includes("synth-pop") ? 1 : 0,
    track.genres.includes("dark pop") ? 1 : 0,
    track.moods.includes("energetic") ? 1 : 0,
    track.moods.includes("emotional") ? 1 : 0,
    track.popularity,
    track.recencyScore,
  ];
}

export function buildUserTasteVector(userProfile) {
  return [
    userProfile.favoriteGenres.includes("pop") ? 1 : 0,
    userProfile.favoriteGenres.includes("synth-pop") ? 1 : 0,
    userProfile.favoriteGenres.includes("dark pop") ? 1 : 0,
    userProfile.favoriteMoods.includes("energetic") ? 1 : 0,
    userProfile.favoriteMoods.includes("emotional") ? 1 : 0,
    0.9,
    0.7,
  ];
}
