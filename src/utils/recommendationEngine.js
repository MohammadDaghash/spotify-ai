import {
  buildTrackVector,
  buildUserTasteVector,
  cosineSimilarity,
} from "./vectorEngine.js";

export function calculateRecommendationScore(track, userProfile) {
  const userVector = buildUserTasteVector(userProfile);
  const trackVector = buildTrackVector(track);

  const similarityScore = cosineSimilarity(userVector, trackVector);

  const artistAffinity = userProfile.favoriteArtists.includes(track.artistName)
    ? 1
    : 0;

  const finalScore =
    similarityScore * 0.55 +
    artistAffinity * 0.25 +
    track.popularity * 0.1 +
    track.recencyScore * 0.1;

  return Number(Math.min(finalScore, 1).toFixed(2));
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
    reasons.push(`genre vector overlap: ${sharedGenres.join(", ")}`);
  }

  const sharedMoods = track.moods.filter((mood) =>
    userProfile.favoriteMoods.includes(mood),
  );

  if (sharedMoods.length > 0) {
    reasons.push(`mood vector overlap: ${sharedMoods.join(", ")}`);
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
