export function calculateRecommendationScore(track, userProfile) {
  let score = 0;

  if (userProfile.favoriteArtists.includes(track.artistName)) {
    score += 0.35;
  }

  const sharedGenres = track.genres.filter((genre) =>
    userProfile.favoriteGenres.includes(genre),
  ).length;

  score += sharedGenres * 0.15;

  const sharedMoods = track.moods.filter((mood) =>
    userProfile.favoriteMoods.includes(mood),
  ).length;

  score += sharedMoods * 0.1;

  score += track.popularity * 0.2;
  score += track.recencyScore * 0.2;

  return Number(Math.min(score, 1).toFixed(2));
}

export function generateRecommendationReason(track, userProfile) {
  const reasons = [];

  if (userProfile.favoriteArtists.includes(track.artistName)) {
    reasons.push("artist affinity");
  }

  const sharedGenres = track.genres.filter((genre) =>
    userProfile.favoriteGenres.includes(genre),
  );

  if (sharedGenres.length > 0) {
    reasons.push(`genre overlap: ${sharedGenres.join(", ")}`);
  }

  const sharedMoods = track.moods.filter((mood) =>
    userProfile.favoriteMoods.includes(mood),
  );

  if (sharedMoods.length > 0) {
    reasons.push(`mood match: ${sharedMoods.join(", ")}`);
  }

  return `Recommended because of ${reasons.join(" • ")}.`;
}

export function getRankedRecommendations(candidateTracks, userProfile) {
  return candidateTracks
    .filter((track) => !userProfile.knownTracks.includes(track.trackName))
    .map((track) => ({
      ...track,
      score: calculateRecommendationScore(track, userProfile),
      reason: generateRecommendationReason(track, userProfile),
    }))
    .sort((a, b) => b.score - a.score);
}
