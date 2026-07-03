const ARTIST_SPLIT_PATTERN =
  /\s*(?:,|&|\band\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)\s*/i;

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
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function splitArtistCredits(artistName) {
  const cleanName = String(artistName || "").trim().replace(/\s+/g, " ");

  if (!cleanName) return [];

  if (normalizeName(cleanName) === "tyler the creator") {
    return [cleanName];
  }

  return [
    ...new Set(
      cleanName
        .split(ARTIST_SPLIT_PATTERN)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
}

function buildArtistSet(names = []) {
  return new Set(
    names
      .flatMap((name) => splitArtistCredits(name))
      .map(normalizeName)
      .filter(Boolean),
  );
}

function artistMatches(artistName, artistSet) {
  if (!artistSet || artistSet.size === 0) return false;

  return splitArtistCredits(artistName).some((artist) =>
    artistSet.has(normalizeName(artist)),
  );
}

function getEntryTrackName(entry) {
  return firstValue(entry, [
    "master_metadata_track_name",
    "track_name",
    "trackName",
    "name",
  ]);
}

function getEntryArtistName(entry) {
  return firstValue(entry, [
    "master_metadata_album_artist_name",
    "artist_name",
    "artistName",
  ]);
}

function getEntryAlbumName(entry) {
  return firstValue(entry, [
    "master_metadata_album_album_name",
    "album_name",
    "albumName",
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

function getEntryPlayedAt(entry) {
  const rawTimestamp = firstValue(entry, ["ts", "played_at", "endTime"]);
  const parsedDate = new Date(rawTimestamp);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getTrackKey(trackName, artistName, albumName) {
  return [trackName, artistName, albumName].map(normalizeName).join("::");
}

function roundNumber(value, decimals = 2) {
  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}

function serializeTrack(track, reason) {
  return {
    track_name: track.track_name,
    artist_name: track.artist_name,
    album_name: track.album_name,
    streams: Math.round(track.streams),
    minutes: Math.round(track.total_minutes),
    skip_rate: roundNumber(track.skip_rate),
    listen_strength: roundNumber(track.listen_strength),
    recent_7d_streams: Math.round(track.recent_7d_streams),
    recent_30d_streams: Math.round(track.recent_30d_streams),
    group_score: roundNumber(track.group_score),
    reason,
  };
}

function collectMemberArtists(groupMembers, fieldName) {
  return groupMembers.flatMap((member) =>
    Array.isArray(member?.[fieldName]) ? member[fieldName] : [],
  );
}

export function buildGroupMixPlaylists({
  history = [],
  groupMembers = [],
  surveyLikedArtists = [],
  surveyIgnoredArtists = [],
  contextArtists = [],
  limit = 25,
  newSongMaxPlays = 5,
} = {}) {
  const safeLimit = Math.max(1, Number(limit) || 25);
  const safeNewSongMaxPlays = Math.max(1, Number(newSongMaxPlays) || 5);
  const likedArtistSet = buildArtistSet([
    ...surveyLikedArtists,
    ...collectMemberArtists(groupMembers, "likedArtists"),
  ]);
  const ignoredArtistSet = buildArtistSet([
    ...surveyIgnoredArtists,
    ...collectMemberArtists(groupMembers, "ignoredArtists"),
  ]);
  const contextArtistSet = buildArtistSet(contextArtists);
  const validEntries = history
    .map((entry) => {
      const trackName = getEntryTrackName(entry);
      const artistName = getEntryArtistName(entry);
      const albumName = getEntryAlbumName(entry);
      const streams = getEntryStreamCount(entry);
      const totalMsPlayed = getEntryTotalMsPlayed(entry, streams);
      const playedAt = getEntryPlayedAt(entry);

      if (!trackName || !artistName || !albumName || totalMsPlayed <= 0) {
        return null;
      }

      return {
        trackName: String(trackName).trim(),
        artistName: String(artistName).trim(),
        albumName: String(albumName).trim(),
        streams,
        totalMsPlayed,
        playedAt,
      };
    })
    .filter(Boolean);

  const maxPlayedAt = validEntries.reduce((latestDate, entry) => {
    if (!entry.playedAt) return latestDate;
    if (!latestDate || entry.playedAt > latestDate) return entry.playedAt;

    return latestDate;
  }, null);
  const trackMap = new Map();

  for (const entry of validEntries) {
    const key = getTrackKey(entry.trackName, entry.artistName, entry.albumName);
    const averageMsPerStream = entry.totalMsPlayed / entry.streams;
    const isSkip = averageMsPerStream < 30_000;
    const daysSinceLatest =
      maxPlayedAt && entry.playedAt
        ? (maxPlayedAt.getTime() - entry.playedAt.getTime()) / 86_400_000
        : Infinity;
    const existingTrack = trackMap.get(key) || {
      track_name: entry.trackName,
      artist_name: entry.artistName,
      album_name: entry.albumName,
      streams: 0,
      total_ms_played: 0,
      skip_streams: 0,
      recent_7d_streams: 0,
      recent_30d_streams: 0,
      last_played_at: entry.playedAt,
    };

    existingTrack.streams += entry.streams;
    existingTrack.total_ms_played += entry.totalMsPlayed;
    existingTrack.skip_streams += isSkip ? entry.streams : 0;

    if (daysSinceLatest <= 7) {
      existingTrack.recent_7d_streams += entry.streams;
    }

    if (daysSinceLatest <= 30) {
      existingTrack.recent_30d_streams += entry.streams;
    }

    if (
      entry.playedAt &&
      (!existingTrack.last_played_at || entry.playedAt > existingTrack.last_played_at)
    ) {
      existingTrack.last_played_at = entry.playedAt;
    }

    trackMap.set(key, existingTrack);
  }

  const tracks = [...trackMap.values()]
    .map((track) => {
      const totalMinutes = track.total_ms_played / 60_000;
      const skipRate = track.streams > 0 ? track.skip_streams / track.streams : 1;
      const listenStrength = totalMinutes * (1 - skipRate);
      const likedArtistBoost = artistMatches(track.artist_name, likedArtistSet)
        ? 35
        : 0;
      const contextArtistBoost = artistMatches(track.artist_name, contextArtistSet)
        ? 18
        : 0;
      const ignoredArtistPenalty = artistMatches(
        track.artist_name,
        ignoredArtistSet,
      )
        ? 1
        : 0;
      const recencyScore =
        track.recent_7d_streams * 8 +
        track.recent_30d_streams * 3 +
        Math.log1p(track.streams) * 6;

      return {
        ...track,
        total_minutes: totalMinutes,
        skip_rate: skipRate,
        listen_strength: listenStrength,
        ignored_artist_penalty: ignoredArtistPenalty,
        group_score:
          recencyScore +
          listenStrength * 0.8 +
          likedArtistBoost +
          contextArtistBoost,
      };
    })
    .filter((track) => track.ignored_artist_penalty === 0)
    .filter((track) => track.listen_strength > 0);

  const sortByGroupScore = (left, right) =>
    right.group_score - left.group_score ||
    right.recent_7d_streams - left.recent_7d_streams ||
    right.streams - left.streams;

  const sharedTracks = tracks
    .filter((track) => track.streams >= 10 && track.skip_rate <= 0.45)
    .sort(sortByGroupScore)
    .slice(0, safeLimit);
  const bridgeTracks = tracks
    .filter(
      (track) =>
        track.streams >= safeNewSongMaxPlays &&
        track.streams < 10 &&
        track.skip_rate <= 0.5,
    )
    .sort(sortByGroupScore)
    .slice(0, safeLimit);
  const newTracks = tracks
    .filter(
      (track) =>
        track.streams < safeNewSongMaxPlays && track.skip_rate <= 0.5,
    )
    .sort(sortByGroupScore)
    .slice(0, safeLimit);

  return {
    shared: {
      name: "Group Mix - Shared Favorites",
      description: "Songs the group is already likely to know and enjoy.",
      tracks: sharedTracks.map((track) =>
        serializeTrack(track, "Strong shared-history candidate"),
      ),
    },
    bridge: {
      name: "Group Mix - Bridge Picks",
      description:
        "Songs not common to everyone yet, but likely to work for the group.",
      tracks: bridgeTracks.map((track) =>
        serializeTrack(track, "Known by at least one listener and likely to transfer"),
      ),
    },
    new: {
      name: "Group Mix - New Discoveries",
      description: `Songs everyone should know less than ${safeNewSongMaxPlays} times.`,
      tracks: newTracks.map((track) =>
        serializeTrack(track, "New-to-the-group discovery candidate"),
      ),
    },
  };
}
