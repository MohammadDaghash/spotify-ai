// src/utils/featureEngineering.js

export function normalize(value, min, max) {
  if (max === min) return 0;

  return (value - min) / (max - min);
}

export function buildDynamicUserProfile(tracks) {
  if (!tracks.length) {
    return {
      avgPopularity: 0,
      avgRecency: 0,
      genreWeights: {},
      moodWeights: {},
      artistWeights: {},
    };
  }

  const totalTracks = tracks.length;

  let popularitySum = 0;
  let recencySum = 0;

  const genreWeights = {};
  const moodWeights = {};
  const artistWeights = {};

  for (const track of tracks) {
    popularitySum += track.popularity || 0;
    recencySum += track.recencyScore || 0;

    for (const genre of track.genres || []) {
      genreWeights[genre] = (genreWeights[genre] || 0) + 1;
    }

    for (const mood of track.moods || []) {
      moodWeights[mood] = (moodWeights[mood] || 0) + 1;
    }

    artistWeights[track.artistName] =
      (artistWeights[track.artistName] || 0) + 1;
  }

  Object.keys(genreWeights).forEach((genre) => {
    genreWeights[genre] /= totalTracks;
  });

  Object.keys(moodWeights).forEach((mood) => {
    moodWeights[mood] /= totalTracks;
  });

  Object.keys(artistWeights).forEach((artist) => {
    artistWeights[artist] /= totalTracks;
  });

  return {
    avgPopularity: popularitySum / totalTracks,
    avgRecency: recencySum / totalTracks,
    genreWeights,
    moodWeights,
    artistWeights,
  };
}
