import {
  buildTrackVector,
  buildUserTasteVector,
  buildVectorSchema,
  clamp,
  cosineSimilarity,
  normalizeWeightMap,
} from "./vectorEngine.js";

const DEFAULT_SCORE_WEIGHTS = {
  similarity: 0.4,
  artistAffinity: 0.2,
  genreAffinity: 0.16,
  moodAffinity: 0.12,
  novelty: 0.07,
  recency: 0.05,
};

function averageAffinity(values = [], weights = {}) {
  if (!values.length) return 0;

  const normalizedWeights = normalizeWeightMap(weights);
  const total = values.reduce(
    (sum, value) => sum + getPreferenceWeight(normalizedWeights, value),
    0,
  );

  return clamp(total / Math.sqrt(values.length));
}

function buildPreferenceWeights(userProfile = {}, weightKey, favoriteKey) {
  const weights = {};

  for (const favorite of userProfile[favoriteKey] || []) {
    weights[favorite] = Math.max(weights[favorite] || 0, 1);
  }

  for (const [key, value] of Object.entries(userProfile[weightKey] || {})) {
    weights[key] = (weights[key] || 0) + value;
  }

  return weights;
}

function getPreferenceWeight(normalizedWeights = {}, value = "") {
  if (!value) return 0;

  if (normalizedWeights[value]) {
    return normalizedWeights[value];
  }

  const normalizedValue = value.toLowerCase();
  const matchedEntry = Object.entries(normalizedWeights).find(
    ([key]) => key.toLowerCase() === normalizedValue,
  );

  return matchedEntry?.[1] || 0;
}

function getAdaptiveScoreWeights(userProfile = {}) {
  const confidence = clamp(userProfile.profileConfidence ?? 0.5);
  const coldStartBoost = 1 - confidence;

  return {
    similarity: DEFAULT_SCORE_WEIGHTS.similarity + confidence * 0.08,
    artistAffinity: DEFAULT_SCORE_WEIGHTS.artistAffinity + confidence * 0.04,
    genreAffinity: DEFAULT_SCORE_WEIGHTS.genreAffinity,
    moodAffinity: DEFAULT_SCORE_WEIGHTS.moodAffinity,
    novelty: DEFAULT_SCORE_WEIGHTS.novelty + coldStartBoost * 0.04,
    recency: DEFAULT_SCORE_WEIGHTS.recency + coldStartBoost * 0.04,
  };
}

function normalizeWeightedScore(rawComponents, weights) {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);

  if (totalWeight === 0) return 0;

  return Object.entries(weights).reduce((sum, [component, weight]) => {
    return sum + (rawComponents[component] || 0) * (weight / totalWeight);
  }, 0);
}

function getPopularityDebias(popularity = 0) {
  const normalizedPopularity = clamp(popularity);

  if (normalizedPopularity <= 0.82) {
    return 0;
  }

  return (normalizedPopularity - 0.82) * 0.18;
}

function calculateConfidence(track, components) {
  const evidenceCount = [
    components.similarity > 0.35,
    components.artistAffinity > 0,
    components.genreAffinity > 0,
    components.moodAffinity > 0,
    track.popularity > 0,
    track.recencyScore > 0,
  ].filter(Boolean).length;

  return clamp(evidenceCount / 6);
}

export function calculateRecommendationDetails(
  track,
  userProfile,
  schema = buildVectorSchema({ tracks: [track], userProfile }),
) {
  const userVector = buildUserTasteVector(userProfile, schema);
  const trackVector = buildTrackVector(track, schema);
  const artistWeights = buildPreferenceWeights(
    userProfile,
    "artistWeights",
    "favoriteArtists",
  );
  const genreWeights = buildPreferenceWeights(
    userProfile,
    "genreWeights",
    "favoriteGenres",
  );
  const moodWeights = buildPreferenceWeights(
    userProfile,
    "moodWeights",
    "favoriteMoods",
  );
  const normalizedArtistWeights = normalizeWeightMap(artistWeights);

  const similarity = clamp(cosineSimilarity(userVector, trackVector));
  const artistAffinity = clamp(
    getPreferenceWeight(normalizedArtistWeights, track.artistName),
  );
  const genreAffinity = averageAffinity(track.genres || [], genreWeights);
  const moodAffinity = averageAffinity(track.moods || [], moodWeights);
  const novelty = 1 - clamp(track.popularity || 0);
  const recency = clamp(track.recencyScore || 0);

  const components = {
    similarity,
    artistAffinity,
    genreAffinity,
    moodAffinity,
    novelty,
    recency,
  };
  const weights = getAdaptiveScoreWeights(userProfile);
  const debiasPenalty = getPopularityDebias(track.popularity);
  const rawScore = normalizeWeightedScore(components, weights);
  const confidence = calculateConfidence(track, components);
  const score = clamp(rawScore - debiasPenalty);

  return {
    score,
    confidence,
    debiasPenalty,
    components,
    weights,
  };
}

export function calculateRecommendationScore(track, userProfile) {
  return Number(calculateRecommendationDetails(track, userProfile).score.toFixed(2));
}

function getTopSignals(weightMap = {}, values = [], limit = 2) {
  const normalizedWeights = normalizeWeightMap(weightMap);

  return values
    .map((value) => ({
      value,
      weight: getPreferenceWeight(normalizedWeights, value),
    }))
    .filter((item) => item.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit);
}

export function generateRecommendationReason(track, userProfile, details = null) {
  const modelDetails =
    details || calculateRecommendationDetails(track, userProfile);
  const reasons = [];
  const artistWeights = buildPreferenceWeights(
    userProfile,
    "artistWeights",
    "favoriteArtists",
  );
  const genreWeights = buildPreferenceWeights(
    userProfile,
    "genreWeights",
    "favoriteGenres",
  );
  const moodWeights = buildPreferenceWeights(
    userProfile,
    "moodWeights",
    "favoriteMoods",
  );

  const artistWeight = getPreferenceWeight(
    normalizeWeightMap(artistWeights),
    track.artistName,
  );

  if (artistWeight > 0) {
    reasons.push(`artist affinity (${Math.round(artistWeight * 100)}%)`);
  }

  const strongestGenres = getTopSignals(
    genreWeights,
    track.genres || [],
  );

  if (strongestGenres.length > 0) {
    reasons.push(
      `genre match: ${strongestGenres.map((item) => item.value).join(", ")}`,
    );
  }

  const strongestMoods = getTopSignals(moodWeights, track.moods || []);

  if (strongestMoods.length > 0) {
    reasons.push(
      `mood match: ${strongestMoods.map((item) => item.value).join(", ")}`,
    );
  }

  if (modelDetails.components.similarity >= 0.7) {
    reasons.push(
      `strong vector similarity (${Math.round(modelDetails.components.similarity * 100)}%)`,
    );
  }

  if (modelDetails.components.recency >= 0.75) {
    reasons.push("recent trend fit");
  }

  if (modelDetails.components.novelty >= 0.25) {
    reasons.push("novelty balance");
  }

  if (reasons.length === 0) {
    return "Recommended because it has a balanced model match with your listening profile.";
  }

  return `Recommended because of ${reasons.join(" • ")}.`;
}

function isKnownTrack(track, knownTracks = []) {
  const knownTrackSet = new Set(knownTracks.map((name) => name.toLowerCase()));
  return knownTrackSet.has((track.trackName || "").toLowerCase());
}

function diversityRerank(recommendations, maxPerArtist = 2) {
  const artistCounts = {};

  return recommendations
    .map((recommendation) => {
      const artistCount = artistCounts[recommendation.artistName] || 0;
      const saturationPenalty = Math.max(0, artistCount - maxPerArtist + 1) * 0.08;
      artistCounts[recommendation.artistName] = artistCount + 1;

      return {
        ...recommendation,
        rerankScore: clamp(recommendation.score - saturationPenalty),
        diversityPenalty: Number(saturationPenalty.toFixed(3)),
      };
    })
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .map((recommendation) => ({
      ...recommendation,
      score: Number(recommendation.rerankScore.toFixed(2)),
    }));
}

export function getRankedRecommendations(candidateTracks, userProfile) {
  const knownTracks = userProfile.knownTracks || [];
  const eligibleTracks = candidateTracks.filter(
    (track) => !isKnownTrack(track, knownTracks),
  );
  const schema = buildVectorSchema({
    tracks: eligibleTracks,
    userProfile,
  });

  const scoredRecommendations = eligibleTracks
    .map((track) => {
      const details = calculateRecommendationDetails(track, userProfile, schema);

      return {
        ...track,
        score: Number(details.score.toFixed(2)),
        confidence: Number(details.confidence.toFixed(2)),
        components: Object.fromEntries(
          Object.entries(details.components).map(([key, value]) => [
            key,
            Number(value.toFixed(3)),
          ]),
        ),
        reason: generateRecommendationReason(track, userProfile, details),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.confidence - left.confidence;
    });

  return diversityRerank(scoredRecommendations);
}
