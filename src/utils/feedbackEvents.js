export const FEEDBACK_EVENTS_KEY = "spotify_ai_feedback_events_v1";
export const FEEDBACK_EVENTS_CHANGED_EVENT = "spotify_ai_feedback_events_changed";

const POSITIVE_ACTIONS = new Set(["like", "save", "create_playlist"]);
const NEGATIVE_ACTIONS = new Set(["ignore"]);
const STORAGE_LIMIT = 2_000;

function getDefaultStorage() {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getEventLabel(action) {
  if (POSITIVE_ACTIONS.has(action)) return "positive";
  if (NEGATIVE_ACTIONS.has(action)) return "negative";

  return "neutral";
}

function createEventId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function emitFeedbackEventsChanged() {
  if (typeof window === "undefined" || !window.dispatchEvent) return;

  window.dispatchEvent(new Event(FEEDBACK_EVENTS_CHANGED_EVENT));
}

function readEventsFromStorage(storage) {
  if (!storage) return [];

  try {
    const events = JSON.parse(storage.getItem(FEEDBACK_EVENTS_KEY) || "[]");
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

function writeEventsToStorage(events, storage) {
  if (!storage) return;

  storage.setItem(
    FEEDBACK_EVENTS_KEY,
    JSON.stringify(events.slice(-STORAGE_LIMIT)),
  );
  emitFeedbackEventsChanged();
}

function getItemName(item = {}, itemType = "") {
  if (itemType === "artist") {
    return normalizeText(item.artist || item.artist_name || item.artistName);
  }

  if (itemType === "album") {
    return normalizeText(item.album_name || item.albumName || item.name);
  }

  if (itemType === "group_playlist") {
    return normalizeText(item.name || item.playlistName);
  }

  return normalizeText(
    item.trackName || item.track_name || item.name || item.artist,
  );
}

function getItemArtist(item = {}) {
  return normalizeText(item.artistName || item.artist_name || item.artist);
}

function getItemAlbum(item = {}) {
  return normalizeText(item.albumName || item.album_name);
}

function getItemKey({ itemName, itemArtist, itemAlbum, itemType }) {
  return [itemType, itemName, itemArtist, itemAlbum]
    .map((value) => normalizeText(value).toLowerCase())
    .join("::");
}

export function createFeedbackEvent(
  {
    action,
    itemType,
    item = {},
    mode = "public-demo",
    source = "recommendations",
    context = {},
  },
  { id = createEventId(), now = new Date().toISOString() } = {},
) {
  const normalizedAction = normalizeText(action).toLowerCase();
  const normalizedItemType = normalizeText(itemType).toLowerCase();
  const itemName = getItemName(item, normalizedItemType);
  const itemArtist = getItemArtist(item);
  const itemAlbum = getItemAlbum(item);
  const score = normalizeNumber(item.score);
  const relativeMatch = normalizeNumber(item.relativeMatch || item.relative_match);

  return {
    id,
    timestamp: now,
    action: normalizedAction,
    label: getEventLabel(normalizedAction),
    item_type: normalizedItemType,
    item_key: getItemKey({
      itemName,
      itemArtist,
      itemAlbum,
      itemType: normalizedItemType,
    }),
    item_name: itemName,
    item_artist: itemArtist,
    item_album: itemAlbum,
    score,
    relative_match: relativeMatch,
    reason: normalizeText(item.reason),
    source: normalizeText(source),
    mode: normalizeText(mode),
    context,
  };
}

export function getFeedbackEvents({ storage = getDefaultStorage() } = {}) {
  return readEventsFromStorage(storage);
}

export function recordFeedbackEvent(
  eventInput,
  { storage = getDefaultStorage(), id, now } = {},
) {
  const event = createFeedbackEvent(eventInput, { id, now });
  const events = [...readEventsFromStorage(storage), event];

  writeEventsToStorage(events, storage);

  return event;
}

export function clearFeedbackEvents({ storage = getDefaultStorage() } = {}) {
  if (!storage) return;

  storage.removeItem(FEEDBACK_EVENTS_KEY);
  emitFeedbackEventsChanged();
}

export function summarizeFeedbackEvents(events = []) {
  const byAction = {};
  let positiveEvents = 0;
  let negativeEvents = 0;
  let songEvents = 0;
  let artistEvents = 0;

  for (const event of events) {
    byAction[event.action] = (byAction[event.action] || 0) + 1;

    if (event.label === "positive") {
      positiveEvents += 1;
    } else if (event.label === "negative") {
      negativeEvents += 1;
    }

    if (event.item_type === "song") {
      songEvents += 1;
    } else if (event.item_type === "artist") {
      artistEvents += 1;
    }
  }

  const labelableEvents = positiveEvents + negativeEvents;

  return {
    totalEvents: events.length,
    positiveEvents,
    negativeEvents,
    neutralEvents: events.length - labelableEvents,
    labelableEvents,
    acceptanceRate:
      labelableEvents > 0 ? positiveEvents / labelableEvents : 0,
    ignoreRate:
      labelableEvents > 0 ? negativeEvents / labelableEvents : 0,
    songEvents,
    artistEvents,
    byAction,
  };
}
