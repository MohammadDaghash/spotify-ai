import { clamp, normalizeWeightMap } from "./vectorEngine.js";

export function normalize(value, min, max) {
  if (max === min) return 0;

  return clamp((value - min) / (max - min));
}

function getTrackInteractionWeight(track, now = Date.now()) {
  const explicitWeight = track.interactionWeight ?? track.weight;

  if (Number.isFinite(explicitWeight)) {
    return Math.max(0, explicitWeight);
  }

  const playCount = track.playCount ?? track.streams ?? 1;
  const completion = track.completionRate ?? track.listenCompletion ?? 1;
  const likedBoost = track.liked ? 2 : 1;
  const skippedPenalty = track.skipped ? 0.25 : 1;
  const baseWeight = Math.log1p(Math.max(0, playCount)) * completion;

  if (!track.playedAt && !track.lastPlayedAt) {
    return Math.max(0.1, baseWeight * likedBoost * skippedPenalty);
  }

  const playedAt = new Date(track.playedAt || track.lastPlayedAt).getTime();

  if (!Number.isFinite(playedAt)) {
    return Math.max(0.1, baseWeight * likedBoost * skippedPenalty);
  }

  const ageDays = Math.max(0, (now - playedAt) / (1000 * 60 * 60 * 24));
  const temporalDecay = Math.exp(-ageDays / 60);

  return Math.max(0.1, baseWeight * temporalDecay * likedBoost * skippedPenalty);
}

function addWeightedSignal(weightMap, key, weight) {
  if (!key) return;

  weightMap[key] = (weightMap[key] || 0) + weight;
}

function normalizeProfileWeights(profile) {
  return {
    ...profile,
    genreWeights: normalizeWeightMap(profile.genreWeights),
    moodWeights: normalizeWeightMap(profile.moodWeights),
    artistWeights: normalizeWeightMap(profile.artistWeights),
  };
}

export function buildDynamicUserProfile(tracks = []) {
  if (!tracks.length) {
    return {
      avgPopularity: 0,
      avgRecency: 0,
      genreWeights: {},
      moodWeights: {},
      artistWeights: {},
      interactionCount: 0,
      profileConfidence: 0,
    };
  }

  const now = Date.now();
  let totalWeight = 0;
  let popularitySum = 0;
  let recencySum = 0;

  const genreWeights = {};
  const moodWeights = {};
  const artistWeights = {};

  for (const track of tracks) {
    const interactionWeight = getTrackInteractionWeight(track, now);
    totalWeight += interactionWeight;
    popularitySum += (track.popularity || 0) * interactionWeight;
    recencySum += (track.recencyScore || 0) * interactionWeight;

    const genreShare =
      track.genres?.length > 0 ? interactionWeight / Math.sqrt(track.genres.length) : 0;
    const moodShare =
      track.moods?.length > 0 ? interactionWeight / Math.sqrt(track.moods.length) : 0;

    for (const genre of track.genres || []) {
      addWeightedSignal(genreWeights, genre, genreShare);
    }

    for (const mood of track.moods || []) {
      addWeightedSignal(moodWeights, mood, moodShare);
    }

    addWeightedSignal(artistWeights, track.artistName, interactionWeight);
  }

  const profile = {
    avgPopularity: totalWeight > 0 ? clamp(popularitySum / totalWeight) : 0,
    avgRecency: totalWeight > 0 ? clamp(recencySum / totalWeight) : 0,
    genreWeights,
    moodWeights,
    artistWeights,
    interactionCount: tracks.length,
    profileConfidence: clamp(Math.log1p(tracks.length) / Math.log1p(50)),
  };

  return normalizeProfileWeights(profile);
}
