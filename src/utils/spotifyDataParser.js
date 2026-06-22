const ARTIST_CREDIT_SPLIT_PATTERN =
  /\s*(?:,|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)\s*/i;
const PROTECTED_COMMA_ARTIST_NAMES = new Set(["tyler, the creator"]);
const PROTECTED_COMMA_ARTIST_PATTERNS = [/tyler,\s*the creator/i];

function normalizeArtistNameKey(artistName) {
  return String(artistName || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function splitArtistNames(artistName) {
  const cleanName = String(artistName || "").trim().replace(/\s+/g, " ");

  if (!cleanName) return [];

  if (PROTECTED_COMMA_ARTIST_NAMES.has(normalizeArtistNameKey(cleanName))) {
    return [cleanName];
  }

  const protectedArtists = {};
  let protectedName = cleanName;

  PROTECTED_COMMA_ARTIST_PATTERNS.forEach((pattern, index) => {
    const placeholder = `__protected_artist_${index}__`;

    protectedName = protectedName.replace(pattern, (match) => {
      protectedArtists[placeholder] = match;
      return placeholder;
    });
  });

  const parts = protectedName
    .split(ARTIST_CREDIT_SPLIT_PATTERN)
    .map((part) => protectedArtists[part.trim()] || part.trim())
    .filter(Boolean);

  return parts.length > 0 ? [...new Set(parts)] : [cleanName];
}

function getEntryTrackName(entry) {
  return entry.master_metadata_track_name || entry.track_name || entry.trackName;
}

function getEntryArtistName(entry) {
  return (
    entry.master_metadata_album_artist_name ||
    entry.artist_name ||
    entry.artistName
  );
}

function getEntryAlbumName(entry) {
  return (
    entry.master_metadata_album_album_name ||
    entry.album_name ||
    entry.albumName
  );
}

function getEntryStreamCount(entry) {
  const streamCount = Number(entry.streams || entry.play_count || 1);

  return Number.isFinite(streamCount) && streamCount > 0 ? streamCount : 1;
}

function getEntryTotalMsPlayed(entry) {
  const totalMsPlayed = Number(entry.total_ms_played);

  if (Number.isFinite(totalMsPlayed) && totalMsPlayed > 0) {
    return totalMsPlayed;
  }

  const msPlayed = Number(entry.ms_played || entry.msPlayed || 0);

  return msPlayed * getEntryStreamCount(entry);
}

export function parseSpotifyHistory(rawData, sortBy = "minutes") {
  const trackMap = {};
  const artistMap = {};
  const albumMap = {};

  rawData.forEach((entry) => {
    const trackName = getEntryTrackName(entry);
    const artistName = getEntryArtistName(entry);
    const albumName = getEntryAlbumName(entry);
    const streamCount = getEntryStreamCount(entry);
    const totalMsPlayed = getEntryTotalMsPlayed(entry);

    if (!trackName || !artistName || !albumName || totalMsPlayed <= 0) return;

    const trackKey = `${trackName}-${artistName}`;
    const albumKey = `${albumName}-${artistName}`;

    if (!trackMap[trackKey]) {
      trackMap[trackKey] = {
        trackName,
        artistName,
        albumName,
        totalMsPlayed: 0,
        streams: 0,
      };
    }

    trackMap[trackKey].totalMsPlayed += totalMsPlayed;
    trackMap[trackKey].streams += streamCount;

    splitArtistNames(artistName).forEach((artistCreditName) => {
      if (!artistMap[artistCreditName]) {
        artistMap[artistCreditName] = {
          artistName: artistCreditName,
          totalMsPlayed: 0,
          streams: 0,
          songsInLibrary: 0,
        };
      }

      artistMap[artistCreditName].totalMsPlayed += totalMsPlayed;
      artistMap[artistCreditName].streams += streamCount;
    });

    if (!albumMap[albumKey]) {
      albumMap[albumKey] = {
        albumName,
        artistName,
        totalMsPlayed: 0,
        streams: 0,
      };
    }

    albumMap[albumKey].totalMsPlayed += totalMsPlayed;
    albumMap[albumKey].streams += streamCount;
  });

  const topTracks = Object.values(trackMap)
    .sort((a, b) =>
      sortBy === "streams"
        ? b.streams - a.streams
        : b.totalMsPlayed - a.totalMsPlayed,
    )
    .slice(0, 100)
    .map((track, index) => ({
      ...track,
      rank: index + 1,
      minutesPlayed: Math.round(track.totalMsPlayed / 60000),
    }));

  const topArtists = Object.values(artistMap)
    .sort((a, b) =>
      sortBy === "streams"
        ? b.streams - a.streams
        : b.totalMsPlayed - a.totalMsPlayed,
    )
    .slice(0, 20)
    .map((artist, index) => ({
      ...artist,
      rank: index + 1,
      minutesPlayed: Math.round(artist.totalMsPlayed / 60000),
    }));

  const topAlbums = Object.values(albumMap)
    .sort((a, b) =>
      sortBy === "streams"
        ? b.streams - a.streams
        : b.totalMsPlayed - a.totalMsPlayed,
    )
    .slice(0, 20)
    .map((album, index) => ({
      ...album,
      rank: index + 1,
      minutesPlayed: Math.round(album.totalMsPlayed / 60000),
    }));

  return {
    topTracks,
    topArtists,
    topAlbums,
  };
}

export function getListeningTrend(rawData, timeRange) {
  const trendMap = {};

  rawData.forEach((entry) => {
    const timestamp = entry.ts;
    const streamCount = getEntryStreamCount(entry);
    const totalMsPlayed = getEntryTotalMsPlayed(entry);

    if (!timestamp || totalMsPlayed <= 0) return;

    const date = new Date(timestamp);

    let key;

    if (timeRange === "30d") {
      key = date.toISOString().slice(0, 10); // daily
    } else if (timeRange === "6m") {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().slice(0, 10); // weekly
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}`; // monthly
    }

    if (!trendMap[key]) {
      const labelDate = new Date(key);

      trendMap[key] = {
        date: key,
        displayDate:
          timeRange === "30d"
            ? labelDate.toLocaleDateString("en-GB")
            : timeRange === "6m"
              ? `Week of ${labelDate.toLocaleDateString("en-GB")}`
              : `${String(labelDate.getMonth() + 1).padStart(2, "0")}/${labelDate.getFullYear()}`,
        streams: 0,
        minutesPlayed: 0,
      };
    }

    trendMap[key].streams += streamCount;
    trendMap[key].minutesPlayed += totalMsPlayed / 60000;
  });

  return Object.values(trendMap)
    .map((item) => ({
      ...item,
      minutesPlayed: Math.round(item.minutesPlayed),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
