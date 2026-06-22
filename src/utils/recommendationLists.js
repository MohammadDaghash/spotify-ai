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
  limit = 5,
} = {}) {
  const excludedArtistNames = new Set(
    [...likedArtists, ...ignoredArtists].map(normalizeName),
  );
  const followedArtistNames = new Set(
    followedArtists.map((artist) => normalizeName(artist?.name)),
  );

  return uniqueBy(recommendations, (artist) => normalizeName(artist?.artist))
    .filter((artist) => !excludedArtistNames.has(normalizeName(artist.artist)))
    .filter((artist) => !followedArtistNames.has(normalizeName(artist.artist)))
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
