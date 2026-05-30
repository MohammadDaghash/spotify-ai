export function parseSpotifyHistory(rawData, sortBy = "minutes") {
  const trackMap = {};
  const artistMap = {};
  const albumMap = {};

  rawData.forEach((entry) => {
    const trackName = entry.master_metadata_track_name;
    const artistName = entry.master_metadata_album_artist_name;
    const albumName = entry.master_metadata_album_album_name;
    const msPlayed = Number(entry.ms_played || 0);

    if (!trackName || !artistName || !albumName || msPlayed <= 0) return;

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

    trackMap[trackKey].totalMsPlayed += msPlayed;
    trackMap[trackKey].streams += 1;

    if (!artistMap[artistName]) {
      artistMap[artistName] = {
        artistName,
        totalMsPlayed: 0,
        streams: 0,
        songsInLibrary: 0,
      };
    }

    artistMap[artistName].totalMsPlayed += msPlayed;
    artistMap[artistName].streams += 1;

    if (!albumMap[albumKey]) {
      albumMap[albumKey] = {
        albumName,
        artistName,
        totalMsPlayed: 0,
        streams: 0,
      };
    }

    albumMap[albumKey].totalMsPlayed += msPlayed;
    albumMap[albumKey].streams += 1;
  });

  const topTracks = Object.values(trackMap)
    .sort((a, b) =>
      sortBy === "streams"
        ? b.streams - a.streams
        : b.totalMsPlayed - a.totalMsPlayed,
    )
    .slice(0, 20)
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
    const msPlayed = Number(entry.ms_played || 0);

    if (!timestamp || msPlayed <= 0) return;

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

    trendMap[key].streams += 1;
    trendMap[key].minutesPlayed += msPlayed / 60000;
  });

  return Object.values(trendMap)
    .map((item) => ({
      ...item,
      minutesPlayed: Math.round(item.minutesPlayed),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
