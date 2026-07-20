const POSITIVE_ACTION_WEIGHTS = {
  like: 1,
  save: 0.8,
  create_playlist: 0.5,
  open_spotify: 0.18,
};
const NEGATIVE_ACTION_WEIGHTS = {
  ignore: -1.15,
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function getTimestamp(event = {}) {
  return event.timestamp || event.event_timestamp || "";
}

function getActionWeight(event = {}) {
  const action = normalizeKey(event.action);

  if (Object.hasOwn(POSITIVE_ACTION_WEIGHTS, action)) {
    return POSITIVE_ACTION_WEIGHTS[action];
  }

  if (Object.hasOwn(NEGATIVE_ACTION_WEIGHTS, action)) {
    return NEGATIVE_ACTION_WEIGHTS[action];
  }

  if (event.label === "positive") return 0.7;
  if (event.label === "negative") return -1;

  return 0;
}

function getRecencyMultiplier(timestamp, now = Date.now()) {
  const eventTime = new Date(timestamp).getTime();

  if (!Number.isFinite(eventTime)) return 0.65;

  const ageDays = Math.max(0, (now - eventTime) / 86_400_000);

  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.82;
  if (ageDays <= 90) return 0.62;

  return 0.42;
}

function addWeight(map, key, amount) {
  const normalizedKey = normalizeKey(key);

  if (!normalizedKey || !Number.isFinite(amount) || amount === 0) return;

  map.set(normalizedKey, (map.get(normalizedKey) || 0) + amount);
}

function uniqueValues(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

export function getFeedbackSongKey(trackName, artistName) {
  return `${normalizeKey(trackName)}::${normalizeKey(artistName)}`;
}

export function buildFeedbackPreferenceSignals(events = [], { now } = {}) {
  const songWeights = new Map();
  const artistWeights = new Map();
  const likedSongs = [];
  const ignoredSongs = [];
  const likedArtists = [];
  const ignoredArtists = [];
  const currentTime = now === undefined ? Date.now() : now;

  for (const event of events) {
    const itemType = normalizeKey(event.item_type);
    const itemName = normalizeText(event.item_name);
    const itemArtist = normalizeText(event.item_artist);
    const action = normalizeKey(event.action);
    const weight =
      getActionWeight(event) * getRecencyMultiplier(getTimestamp(event), currentTime);

    if (itemType === "song") {
      const songKey = getFeedbackSongKey(itemName, itemArtist);

      addWeight(songWeights, songKey, weight);
      addWeight(artistWeights, itemArtist, weight * 0.45);

      if (action === "like") likedSongs.push(itemName);
      if (action === "ignore") ignoredSongs.push(itemName);
    }

    if (itemType === "artist") {
      addWeight(artistWeights, itemName, weight);

      if (action === "like") likedArtists.push(itemName);
      if (action === "ignore") ignoredArtists.push(itemName);
    }
  }

  return {
    songWeights,
    artistWeights,
    likedSongs: uniqueValues(likedSongs),
    ignoredSongs: uniqueValues(ignoredSongs),
    likedArtists: uniqueValues(likedArtists),
    ignoredArtists: uniqueValues(ignoredArtists),
  };
}

function getRecommendationScore(recommendation = {}) {
  const score = Number(recommendation.score);

  return Number.isFinite(score) ? score : 0;
}

function getSongFeedbackDelta(recommendation, signals) {
  const trackName = recommendation.trackName || recommendation.track_name;
  const artistName = recommendation.artistName || recommendation.artist_name;
  const songWeight =
    signals.songWeights.get(getFeedbackSongKey(trackName, artistName)) || 0;
  const artistWeight = signals.artistWeights.get(normalizeKey(artistName)) || 0;

  return songWeight * 0.16 + artistWeight * 0.08;
}

function getArtistFeedbackDelta(recommendation, signals) {
  const artistName =
    recommendation.artist || recommendation.artistName || recommendation.artist_name;

  return (signals.artistWeights.get(normalizeKey(artistName)) || 0) * 0.14;
}

export function applyFeedbackPreferenceReranking(
  recommendations = [],
  { signals, itemType } = {},
) {
  if (!signals) return recommendations;

  return recommendations
    .map((recommendation) => {
      const feedbackDelta =
        itemType === "artist"
          ? getArtistFeedbackDelta(recommendation, signals)
          : getSongFeedbackDelta(recommendation, signals);
      const score = Math.max(0, getRecommendationScore(recommendation) + feedbackDelta);

      return {
        ...recommendation,
        score: Number(score.toFixed(3)),
        feedbackScoreDelta: Number(feedbackDelta.toFixed(3)),
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function getFeedbackArtistPreferenceLists(
  signals,
  { limit = 50, positiveThreshold = 0.05, negativeThreshold = -0.05 } = {},
) {
  const sortedWeights = [...(signals?.artistWeights || new Map()).entries()]
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, Math.max(1, limit));

  return {
    likedArtists: sortedWeights
      .filter(([, weight]) => weight >= positiveThreshold)
      .map(([artist]) => artist),
    ignoredArtists: sortedWeights
      .filter(([, weight]) => weight <= negativeThreshold)
      .map(([artist]) => artist),
  };
}
