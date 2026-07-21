import { candidateTracks } from "../data/demoMusicData.js";
import {
  getTrackIdentityKey,
  getTrackPlayCount,
  TRACK_DISCOVERY_MAX_PLAYS,
} from "./trackPlayCounts.js";

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getCandidateTrackName(track) {
  return track?.trackName || track?.track_name || "";
}

function getCandidateArtistName(track) {
  return track?.artistName || track?.artist_name || "";
}

export function buildCatalogSongBackfills({
  existingTracks = [],
  knownTrackPlayCounts = new Map(),
  maxPlayCount = TRACK_DISCOVERY_MAX_PLAYS,
} = {}) {
  const existingTrackKeys = new Set(
    existingTracks.map((track) =>
      getTrackIdentityKey(getCandidateTrackName(track), getCandidateArtistName(track)),
    ),
  );

  return candidateTracks
    .filter((track) => {
      const trackName = getCandidateTrackName(track);
      const artistName = getCandidateArtistName(track);

      if (existingTrackKeys.has(getTrackIdentityKey(trackName, artistName))) {
        return false;
      }

      return getTrackPlayCount(trackName, artistName, knownTrackPlayCounts) < maxPlayCount;
    })
    .map((track, index) => {
      const popularity = toFiniteNumber(track.popularity, 0.5);
      const recencyScore = toFiniteNumber(track.recencyScore, 0.5);
      const score = Math.max(
        0.18,
        Math.min(0.36, 0.2 + popularity * 0.08 + recencyScore * 0.08 - index * 0.001),
      );
      const trackName = getCandidateTrackName(track);
      const artistName = getCandidateArtistName(track);

      return {
        track_name: trackName,
        artist_name: artistName,
        score: Number(score.toFixed(3)),
        similarity_score: Number(Math.max(0.18, score - 0.04).toFixed(3)),
        raw_similarity_score: Number(Math.max(0.12, score - 0.12).toFixed(3)),
        quality_score: Number(Math.max(0.24, score + 0.06).toFixed(3)),
        confidence: Number(Math.max(0.28, score + 0.02).toFixed(3)),
        recency_score: recencyScore,
        diversity_penalty: 0,
        known_track_penalty: 0,
        recent_listen_strength: 0,
        streams: getTrackPlayCount(trackName, artistName, knownTrackPlayCounts),
        reason: "Backup discovery candidate from the broader song catalog.",
        source: "catalog-backfill",
      };
    });
}

export function mergeSongRecommendationBackfills({
  trackRecommendations = [],
  knownTrackPlayCounts = new Map(),
  maxPlayCount = TRACK_DISCOVERY_MAX_PLAYS,
} = {}) {
  return [
    ...trackRecommendations,
    ...buildCatalogSongBackfills({
      existingTracks: trackRecommendations,
      knownTrackPlayCounts,
      maxPlayCount,
    }),
  ];
}
