import { getRankedRecommendations } from "./recommendationEngine.js";

function firstValue(entry, keys) {
  for (const key of keys) {
    const value = entry?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getEntryTrackName(entry) {
  return firstValue(entry, [
    "master_metadata_track_name",
    "track_name",
    "trackName",
  ]);
}

function getEntryArtistName(entry) {
  return firstValue(entry, [
    "master_metadata_album_artist_name",
    "artist_name",
    "artistName",
  ]);
}

function getEntryStreamCount(entry) {
  const streamCount = Number(firstValue(entry, ["streams", "play_count"]));

  if (Number.isFinite(streamCount) && streamCount > 0) {
    return streamCount;
  }

  return 1;
}

function getEntryTotalMsPlayed(entry, streamCount) {
  const totalMsPlayed = Number(firstValue(entry, ["total_ms_played"]));

  if (Number.isFinite(totalMsPlayed) && totalMsPlayed > 0) {
    return totalMsPlayed;
  }

  const msPlayed = Number(firstValue(entry, ["ms_played", "msPlayed"]));

  if (Number.isFinite(msPlayed) && msPlayed > 0) {
    return msPlayed * streamCount;
  }

  return 0;
}

function getEntryAgeWeight(entry, maxPlayedAt) {
  const playedAt = new Date(firstValue(entry, ["ts", "played_at", "endTime"]));

  if (Number.isNaN(playedAt.getTime()) || !maxPlayedAt) {
    return 1;
  }

  const ageDays = Math.max(
    0,
    (maxPlayedAt.getTime() - playedAt.getTime()) / 86_400_000,
  );

  return Math.exp(-ageDays / 60);
}

function getMaxPlayedAt(history) {
  return history.reduce((latestDate, entry) => {
    const playedAt = new Date(firstValue(entry, ["ts", "played_at", "endTime"]));

    if (Number.isNaN(playedAt.getTime())) return latestDate;
    if (!latestDate || playedAt > latestDate) return playedAt;

    return latestDate;
  }, null);
}

function sortWeightEntries(weights) {
  return Object.entries(weights).sort(([, left], [, right]) => right - left);
}

function getCandidateKey(track) {
  return `${normalizeName(track.trackName)}::${normalizeName(track.artistName)}`;
}

export function buildPrivateRecommendationProfile(history = []) {
  const maxPlayedAt = getMaxPlayedAt(history);
  const artistWeights = {};
  const trackWeights = {};
  const knownTracks = new Set();

  for (const entry of history) {
    const trackName = getEntryTrackName(entry);
    const artistName = getEntryArtistName(entry);
    const streams = getEntryStreamCount(entry);
    const totalMsPlayed = getEntryTotalMsPlayed(entry, streams);

    if (!trackName || !artistName || totalMsPlayed <= 0) continue;

    const minutes = totalMsPlayed / 60_000;
    const averageMsPerStream = totalMsPlayed / streams;
    const completionWeight = averageMsPerStream >= 30_000 ? 1 : 0.25;
    const ageWeight = getEntryAgeWeight(entry, maxPlayedAt);
    const weight = Math.log1p(streams) * Math.max(0.1, minutes) * completionWeight * ageWeight;

    artistWeights[artistName] = (artistWeights[artistName] || 0) + weight;
    trackWeights[trackName] = (trackWeights[trackName] || 0) + weight;
    knownTracks.add(trackName);
  }

  const favoriteArtists = sortWeightEntries(artistWeights)
    .slice(0, 10)
    .map(([artist]) => artist);

  return {
    avgPopularity: 0.5,
    avgRecency: 0.5,
    favoriteArtists,
    favoriteGenres: [],
    favoriteMoods: [],
    knownTracks: [...knownTracks],
    artistWeights,
    genreWeights: {},
    moodWeights: {},
    trackWeights,
    interactionCount: history.length,
    profileConfidence: Math.min(1, Math.log1p(history.length) / Math.log1p(50)),
  };
}

export function getPrivateTrackPlayCounts(history = []) {
  const playCounts = new Map();

  for (const entry of history) {
    const trackName = getEntryTrackName(entry);
    const artistName = getEntryArtistName(entry);
    const streams = getEntryStreamCount(entry);

    if (!trackName || !artistName) continue;

    const key = `${normalizeName(trackName)}::${normalizeName(artistName)}`;
    playCounts.set(key, (playCounts.get(key) || 0) + streams);
  }

  return playCounts;
}

export function rankPrivateTrackRecommendations({
  history = [],
  candidateTracks = [],
  topN = 30,
} = {}) {
  const profile = buildPrivateRecommendationProfile(history);
  const playCounts = getPrivateTrackPlayCounts(history);

  return getRankedRecommendations(candidateTracks, profile)
    .slice(0, topN)
    .map((track) => {
      const playCount = playCounts.get(getCandidateKey(track)) || 0;

      return {
        track_name: track.trackName,
        artist_name: track.artistName,
        album_name: track.albumName || "",
        score: track.score,
        similarity_score: track.components?.similarity || 0,
        raw_similarity_score: track.components?.similarity || 0,
        quality_score: track.score,
        confidence: track.confidence,
        diversity_penalty: track.diversityPenalty || 0,
        known_track_penalty: playCount > 0 ? 0.08 : 0,
        streams: playCount,
        minutes: 0,
        skip_rate: 0,
        listen_strength: 0,
        recent_listen_strength: 0,
        recency_score: track.recencyScore || 0,
        reason: track.reason,
        source: "private-session",
      };
    });
}
