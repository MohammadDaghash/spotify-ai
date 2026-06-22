const NUMERIC_FEATURES = ["popularity", "recencyScore"];

export function clamp(value, min = 0, max = 1) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

export function normalizeWeightMap(weights = {}) {
  const entries = Object.entries(weights).filter(([, value]) => value > 0);
  const maxWeight = Math.max(...entries.map(([, value]) => value), 0);

  if (maxWeight === 0) {
    return {};
  }

  return Object.fromEntries(
    entries.map(([key, value]) => [key, clamp(value / maxWeight)]),
  );
}

export function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce(
    (sum, value, index) => sum + value * (vecB[index] || 0),
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

export function l2Normalize(vector) {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );

  if (magnitude === 0) {
    return vector.map(() => 0);
  }

  return vector.map((value) => value / magnitude);
}

function collectKeysFromTracks(tracks = [], key) {
  return tracks.flatMap((track) => track[key] || []);
}

function collectKeysFromWeights(weights = {}) {
  return Object.keys(weights || {});
}

function buildPreferenceWeights(weights = {}, favorites = []) {
  const mergedWeights = {};

  for (const favorite of favorites || []) {
    mergedWeights[favorite] = Math.max(mergedWeights[favorite] || 0, 1);
  }

  for (const [key, value] of Object.entries(weights || {})) {
    mergedWeights[key] = (mergedWeights[key] || 0) + value;
  }

  return mergedWeights;
}

export function buildVectorSchema({ tracks = [], userProfile = {} } = {}) {
  const genreWeights = buildPreferenceWeights(
    userProfile.genreWeights,
    userProfile.favoriteGenres,
  );
  const moodWeights = buildPreferenceWeights(
    userProfile.moodWeights,
    userProfile.favoriteMoods,
  );

  const genres = new Set([
    ...collectKeysFromTracks(tracks, "genres"),
    ...collectKeysFromWeights(genreWeights),
    ...(userProfile.favoriteGenres || []),
  ]);

  const moods = new Set([
    ...collectKeysFromTracks(tracks, "moods"),
    ...collectKeysFromWeights(moodWeights),
    ...(userProfile.favoriteMoods || []),
  ]);

  return {
    genreDimensions: [...genres].sort(),
    moodDimensions: [...moods].sort(),
    numericDimensions: NUMERIC_FEATURES,
  };
}

function buildWeightedMultiHot(values = [], dimensions = []) {
  if (dimensions.length === 0) {
    return [];
  }

  const uniqueValues = [...new Set(values)];
  const valueWeight = uniqueValues.length > 0 ? 1 / Math.sqrt(uniqueValues.length) : 0;
  const valueSet = new Set(uniqueValues);

  return dimensions.map((dimension) => (valueSet.has(dimension) ? valueWeight : 0));
}

function buildPreferenceVector(weights = {}, dimensions = []) {
  const normalizedWeights = normalizeWeightMap(weights);

  return dimensions.map((dimension) => normalizedWeights[dimension] || 0);
}

export function buildTrackVector(track, schema = buildVectorSchema({ tracks: [track] })) {
  const genreVector = buildWeightedMultiHot(
    track.genres || [],
    schema.genreDimensions,
  );
  const moodVector = buildWeightedMultiHot(track.moods || [], schema.moodDimensions);
  const numericVector = [
    clamp(track.popularity || 0),
    clamp(track.recencyScore || 0),
  ];

  return l2Normalize([...genreVector, ...moodVector, ...numericVector]);
}

export function buildUserTasteVector(
  userProfile,
  schema = buildVectorSchema({ userProfile }),
) {
  const genreWeights = buildPreferenceWeights(
    userProfile.genreWeights,
    userProfile.favoriteGenres,
  );
  const moodWeights = buildPreferenceWeights(
    userProfile.moodWeights,
    userProfile.favoriteMoods,
  );

  const genreVector = buildPreferenceVector(genreWeights, schema.genreDimensions);
  const moodVector = buildPreferenceVector(moodWeights, schema.moodDimensions);
  const numericVector = [
    clamp(userProfile.avgPopularity || 0),
    clamp(userProfile.avgRecency || 0),
  ];

  return l2Normalize([...genreVector, ...moodVector, ...numericVector]);
}
