const TYPE_LABELS = {
  song: "Songs",
  artist: "Artists",
  album: "Albums",
  recommendation: "Recommendations",
};

function safeString(value) {
  return String(value || "").trim();
}

export function normalizeTopbarSearchText(value) {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getHistoryField(row, keys) {
  for (const key of keys) {
    const value = safeString(row?.[key]);

    if (value) return value;
  }

  return "";
}

function getHistoryMetrics(row) {
  const streams = Number(row?.streams || row?.play_count || 1);
  const totalMsPlayed = Number(row?.total_ms_played);
  const msPlayed = Number(row?.ms_played || row?.msPlayed || 0);
  const safeStreams = Number.isFinite(streams) && streams > 0 ? streams : 1;
  const safeMsPlayed =
    Number.isFinite(totalMsPlayed) && totalMsPlayed > 0
      ? totalMsPlayed
      : msPlayed * safeStreams;

  return {
    streams: safeStreams,
    minutes: safeMsPlayed / 60000,
  };
}

function addAggregatedEntry(map, keyParts, values) {
  const key = keyParts.map(normalizeTopbarSearchText).join("|");

  if (!key || map.has(key)) {
    const existing = map.get(key);

    if (existing) {
      existing.count += values.count || 0;
      existing.minutes += values.minutes || 0;
    }

    return;
  }

  map.set(key, {
    count: values.count || 0,
    minutes: values.minutes || 0,
    ...values,
  });
}

function buildRoute(path, search, type = "") {
  const params = new URLSearchParams({
    search,
  });

  if (type) {
    params.set("type", type);
  }

  return `${path}?${params.toString()}`;
}

function buildSearchText(...parts) {
  return parts.map(normalizeTopbarSearchText).filter(Boolean).join(" ");
}

function buildHistoryEntries(historyRows = []) {
  const songMap = new Map();
  const artistMap = new Map();
  const albumMap = new Map();

  for (const row of historyRows || []) {
    const trackName = getHistoryField(row, [
      "master_metadata_track_name",
      "trackName",
      "track_name",
      "name",
    ]);
    const artistName = getHistoryField(row, [
      "master_metadata_album_artist_name",
      "artistName",
      "artist_name",
    ]);
    const albumName = getHistoryField(row, [
      "master_metadata_album_album_name",
      "albumName",
      "album_name",
    ]);

    if (!trackName || !artistName) continue;

    const metrics = getHistoryMetrics(row);

    addAggregatedEntry(songMap, [trackName, artistName, albumName], {
      type: "song",
      label: TYPE_LABELS.song,
      title: trackName,
      subtitle: albumName ? `${artistName} • ${albumName}` : artistName,
      href: buildRoute("/dashboard", trackName, "song"),
      source: "Dashboard",
      count: metrics.streams,
      minutes: metrics.minutes,
      searchText: buildSearchText(trackName, artistName, albumName),
    });

    addAggregatedEntry(artistMap, [artistName], {
      type: "artist",
      label: TYPE_LABELS.artist,
      title: artistName,
      subtitle: "Dashboard artist",
      href: buildRoute("/dashboard", artistName, "artist"),
      source: "Dashboard",
      count: metrics.streams,
      minutes: metrics.minutes,
      searchText: buildSearchText(artistName, trackName, albumName),
    });

    if (albumName) {
      addAggregatedEntry(albumMap, [albumName, artistName], {
        type: "album",
        label: TYPE_LABELS.album,
        title: albumName,
        subtitle: artistName,
        href: buildRoute("/dashboard", albumName, "album"),
        source: "Dashboard",
        count: metrics.streams,
        minutes: metrics.minutes,
        searchText: buildSearchText(albumName, artistName, trackName),
      });
    }
  }

  return [...songMap.values(), ...artistMap.values(), ...albumMap.values()];
}

function buildRecommendationEntries({
  artistRecommendations = [],
  trackRecommendations = [],
  groupPlaylists = null,
} = {}) {
  const entries = [];

  for (const artist of artistRecommendations || []) {
    const artistName = safeString(artist.artist || artist.artist_name);

    if (!artistName) continue;

    entries.push({
      type: "recommendation",
      label: TYPE_LABELS.recommendation,
      title: artistName,
      subtitle: artist.reason || "Recommended artist",
      href: buildRoute("/recommendations", artistName),
      source: "Recommendations",
      count: Number(artist.streams || 0),
      minutes: Number(artist.minutes || 0),
      searchText: buildSearchText(artistName, artist.reason),
    });
  }

  for (const track of trackRecommendations || []) {
    const trackName = safeString(track.track_name || track.trackName);
    const artistName = safeString(track.artist_name || track.artistName);

    if (!trackName) continue;

    entries.push({
      type: "recommendation",
      label: TYPE_LABELS.recommendation,
      title: trackName,
      subtitle: artistName ? `${artistName} • Recommended song` : "Recommended song",
      href: buildRoute("/recommendations", trackName),
      source: "Recommendations",
      count: Number(track.streams || 0),
      minutes: Number(track.minutes || 0),
      searchText: buildSearchText(trackName, artistName, track.reason),
    });
  }

  for (const playlist of Object.values(groupPlaylists || {})) {
    for (const track of playlist?.tracks || []) {
      const trackName = safeString(track.track_name || track.trackName);
      const artistName = safeString(track.artist_name || track.artistName);

      if (!trackName) continue;

      entries.push({
        type: "recommendation",
        label: TYPE_LABELS.recommendation,
        title: trackName,
        subtitle: artistName
          ? `${artistName} • ${playlist.name || "Group playlist"}`
          : playlist.name || "Group playlist",
        href: buildRoute("/recommendations", trackName),
        source: "Group Mix",
        count: Number(track.streams || 0),
        minutes: Number(track.minutes || 0),
        searchText: buildSearchText(trackName, artistName, playlist.name),
      });
    }
  }

  return entries;
}

export function buildTopbarSearchEntries({
  historyRows = [],
  artistRecommendations = [],
  trackRecommendations = [],
  groupPlaylists = null,
} = {}) {
  return [
    ...buildHistoryEntries(historyRows),
    ...buildRecommendationEntries({
      artistRecommendations,
      trackRecommendations,
      groupPlaylists,
    }),
  ];
}

function scoreSearchResult(query, entry) {
  const title = normalizeTopbarSearchText(entry.title);
  const subtitle = normalizeTopbarSearchText(entry.subtitle);
  const searchText = normalizeTopbarSearchText(entry.searchText);
  const queryTokens = normalizeTopbarSearchText(query).split(" ").filter(Boolean);

  if (queryTokens.length === 0) return 0;

  const allTokensMatch = queryTokens.every((token) =>
    searchText.includes(token),
  );

  if (!allTokensMatch) return 0;

  const normalizedQuery = queryTokens.join(" ");

  if (title === normalizedQuery) return 100;
  if (title.startsWith(normalizedQuery)) return 90;
  if (title.includes(normalizedQuery)) return 80;
  if (queryTokens.every((token) => title.includes(token))) return 75;
  if (subtitle.includes(normalizedQuery)) return 65;
  if (queryTokens.every((token) => subtitle.includes(token))) return 60;

  return 50;
}

export function searchTopbarCatalog(query, entries = [], limit = 12) {
  const resultMap = new Map();

  for (const entry of entries || []) {
    const score = scoreSearchResult(query, entry);

    if (score <= 0) continue;

    const key = `${entry.type}|${normalizeTopbarSearchText(entry.title)}|${normalizeTopbarSearchText(entry.subtitle)}`;
    const nextEntry = {
      ...entry,
      score,
    };
    const existingEntry = resultMap.get(key);

    if (!existingEntry || nextEntry.score > existingEntry.score) {
      resultMap.set(key, nextEntry);
    }
  }

  return [...resultMap.values()]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.count !== left.count) return right.count - left.count;
      return left.title.localeCompare(right.title);
    })
    .slice(0, limit);
}

export function groupTopbarSearchResults(results = []) {
  const groups = [];
  const groupMap = new Map();

  for (const result of results) {
    const label = TYPE_LABELS[result.type] || result.label || "Results";

    if (!groupMap.has(label)) {
      const group = {
        label,
        items: [],
      };
      groupMap.set(label, group);
      groups.push(group);
    }

    groupMap.get(label).items.push(result);
  }

  return groups;
}
