import {
  ARTIST_DISCOVERY_MAX_STREAMS,
  getArtistStreamCount,
  normalizeArtistKey,
} from "./artistStreamCounts.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];

  for (const item of items || []) {
    const key = getKey(item);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(item);
  }

  return result;
}

export function getVisibleArtistRecommendations({
  recommendations = [],
  likedArtists = [],
  ignoredArtists = [],
  followedArtists = [],
  knownArtistStreamCounts = new Map(),
  maxArtistStreams = ARTIST_DISCOVERY_MAX_STREAMS,
  limit = 5,
} = {}) {
  const excludedArtistNames = new Set(
    [...likedArtists, ...ignoredArtists].map(normalizeArtistKey),
  );
  const followedArtistNames = new Set(
    followedArtists.map((artist) => normalizeArtistKey(artist?.name)),
  );

  return uniqueBy(recommendations, (artist) => normalizeArtistKey(artist?.artist))
    .filter(
      (artist) => !excludedArtistNames.has(normalizeArtistKey(artist.artist)),
    )
    .filter(
      (artist) => !followedArtistNames.has(normalizeArtistKey(artist.artist)),
    )
    .filter((artist) => {
      const candidateStreams = Math.max(
        Number(artist?.streams) || 0,
        getArtistStreamCount(artist?.artist, knownArtistStreamCounts),
      );

      return candidateStreams < maxArtistStreams;
    })
    .slice(0, limit);
}

export function getVisibleSongRecommendations({
  recommendations = [],
  likedSongs = [],
  ignoredSongs = [],
  maxPlayCount = 10,
  limit = 5,
} = {}) {
  const excludedTrackNames = new Set(
    [...likedSongs, ...ignoredSongs].map(normalizeName),
  );

  return uniqueBy(
    recommendations,
    (track) =>
      `${normalizeName(track?.trackName || track?.track_name)}::${normalizeName(
        track?.artistName || track?.artist_name,
      )}`,
  )
    .filter((track) => Number(track.historyPlayCount ?? track.streams ?? 0) < maxPlayCount)
    .filter((track) => !track.liveKnownReason)
    .filter(
      (track) =>
        !excludedTrackNames.has(normalizeName(track.trackName || track.track_name)),
    )
    .slice(0, limit);
}
