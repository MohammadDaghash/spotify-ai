import {
  buildTrackVector,
  buildUserTasteVector,
  cosineSimilarity,
} from "./vectorEngine.js";

export function calculateRecommendationScore(track, userProfile) {
  const userVector = buildUserTasteVector(userProfile);
  const trackVector = buildTrackVector(track);

  const similarityScore = cosineSimilarity(userVector, trackVector);

  const artistAffinity = userProfile.artistWeights?.[track.artistName] || 0;

  let genreScore = 0;

  for (const genre of track.genres || []) {
    genreScore += userProfile.genreWeights?.[genre] || 0;
  }

  genreScore = track.genres?.length > 0 ? genreScore / track.genres.length : 0;

  let moodScore = 0;

  for (const mood of track.moods || []) {
    moodScore += userProfile.moodWeights?.[mood] || 0;
  }

  moodScore = track.moods?.length > 0 ? moodScore / track.moods.length : 0;

  const popularityScore = track.popularity || 0;
  const recencyScore = track.recencyScore || 0;

  const finalScore =
    similarityScore * 0.35 +
    artistAffinity * 0.2 +
    genreScore * 0.2 +
    moodScore * 0.15 +
    popularityScore * 0.05 +
    recencyScore * 0.05;

  return Number(Math.min(finalScore, 1).toFixed(2));
}

export function generateRecommendationReason(track, userProfile) {
  const reasons = [];

  const artistWeight = userProfile.artistWeights?.[track.artistName] || 0;

  if (artistWeight > 0) {
    reasons.push("artist affinity");
  }

  const sharedGenres = (track.genres || []).filter(
    (genre) => (userProfile.genreWeights?.[genre] || 0) > 0,
  );

  if (sharedGenres.length > 0) {
    reasons.push(`genre vector overlap: ${sharedGenres.join(", ")}`);
  }

  const sharedMoods = (track.moods || []).filter(
    (mood) => (userProfile.moodWeights?.[mood] || 0) > 0,
  );

  if (sharedMoods.length > 0) {
    reasons.push(`mood vector overlap: ${sharedMoods.join(", ")}`);
  }

  if (track.popularity >= 0.85) {
    reasons.push("strong popularity signal");
  }

  if (track.recencyScore >= 0.8) {
    reasons.push("recent listening trend fit");
  }

  if (reasons.length === 0) {
    return "Recommended because it has a balanced match with your listening profile.";
  }

  return `Recommended because of ${reasons.join(" • ")}.`;
}

export function getRankedRecommendations(candidateTracks, userProfile) {
  const knownTracks = userProfile.knownTracks || [];

  return candidateTracks
    .filter((track) => !knownTracks.includes(track.trackName))
    .map((track) => ({
      ...track,
      score: calculateRecommendationScore(track, userProfile),
      reason: generateRecommendationReason(track, userProfile),
    }))
    .sort((a, b) => b.score - a.score);
}
