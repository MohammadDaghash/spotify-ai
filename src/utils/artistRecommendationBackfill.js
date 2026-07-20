import { ARTISTS_BY_LANGUAGE } from "../data/groupMixSurveyData.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getTrackArtistName(track) {
  return track?.artistName || track?.artist_name || track?.artist || "";
}

function getTrackScore(track) {
  return toFiniteNumber(
    track?.score ?? track?.final_score ?? track?.similarity_score,
    0.5,
  );
}

export function buildArtistRecommendationsFromTracks({
  tracks = [],
  existingArtists = [],
} = {}) {
  const existingArtistNames = new Set(
    existingArtists.map((artist) => normalizeName(artist?.artist)),
  );
  const artistScores = new Map();

  for (const track of tracks || []) {
    const artist = getTrackArtistName(track);
    const artistKey = normalizeName(artist);

    if (!artistKey || existingArtistNames.has(artistKey)) continue;

    const current = artistScores.get(artistKey) || {
      artist,
      scoreTotal: 0,
      similarityTotal: 0,
      qualityTotal: 0,
      confidenceTotal: 0,
      recencyTotal: 0,
      streams: 0,
      minutes: 0,
      count: 0,
    };

    current.scoreTotal += getTrackScore(track);
    current.similarityTotal += toFiniteNumber(track?.similarity_score, 0.5);
    current.qualityTotal += toFiniteNumber(track?.quality_score, 0.5);
    current.confidenceTotal += toFiniteNumber(track?.confidence, 0.5);
    current.recencyTotal += toFiniteNumber(track?.recency_score, 0.5);
    current.streams += toFiniteNumber(
      track?.historyPlayCount ?? track?.streams,
      0,
    );
    current.minutes += toFiniteNumber(track?.minutes ?? track?.total_minutes, 0);
    current.count += 1;

    artistScores.set(artistKey, current);
  }

  return [...artistScores.values()]
    .map((artist) => {
      const count = Math.max(artist.count, 1);
      const score = artist.scoreTotal / count;

      return {
        artist: artist.artist,
        score: Number(score.toFixed(3)),
        similarity_score: Number((artist.similarityTotal / count).toFixed(3)),
        raw_similarity_score: Number((score * 0.6).toFixed(3)),
        quality_score: Number((artist.qualityTotal / count).toFixed(3)),
        confidence: Number((artist.confidenceTotal / count).toFixed(3)),
        recency_score: Number((artist.recencyTotal / count).toFixed(3)),
        known_artist_penalty: 0,
        streams: Math.round(artist.streams),
        minutes: Math.round(artist.minutes),
        skip_rate: 0,
        listen_strength: Number((artist.scoreTotal * 10).toFixed(2)),
        recent_listen_strength: Number((artist.recencyTotal * 10).toFixed(2)),
        reason: "Recommended from strong matching song candidates.",
        source: "track-backfill",
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildCatalogArtistBackfills({ existingArtists = [] } = {}) {
  const existingArtistNames = new Set(
    existingArtists.map((artist) => normalizeName(artist?.artist)),
  );
  const catalogArtists = [
    ...new Set(Object.values(ARTISTS_BY_LANGUAGE).flat().filter(Boolean)),
  ];

  return catalogArtists
    .filter((artist) => !existingArtistNames.has(normalizeName(artist)))
    .map((artist, index) => {
      const score = Math.max(0.42, 0.64 - index * 0.002);

      return {
        artist,
        score: Number(score.toFixed(3)),
        similarity_score: Number(Math.max(0.4, score - 0.04).toFixed(3)),
        raw_similarity_score: Number(Math.max(0.25, score - 0.18).toFixed(3)),
        quality_score: Number(Math.max(0.48, score + 0.06).toFixed(3)),
        confidence: Number(Math.max(0.45, score + 0.02).toFixed(3)),
        recency_score: 0.5,
        known_artist_penalty: 0,
        streams: 0,
        minutes: 0,
        skip_rate: 0,
        listen_strength: 0,
        recent_listen_strength: 0,
        reason: "Backup discovery candidate from the broader music catalog.",
        source: "catalog-backfill",
      };
    });
}

export function mergeArtistRecommendationBackfills({
  artistRecommendations = [],
  trackRecommendations = [],
} = {}) {
  const trackBackfills = buildArtistRecommendationsFromTracks({
    tracks: trackRecommendations,
    existingArtists: artistRecommendations,
  });
  const catalogBackfills = buildCatalogArtistBackfills({
    existingArtists: [...artistRecommendations, ...trackBackfills],
  });

  return [
    ...artistRecommendations,
    ...trackBackfills,
    ...catalogBackfills,
  ];
}
