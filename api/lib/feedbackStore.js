import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_STORAGE_PATH = "spotify-ai/feedback/events.json";
const LOCAL_STORAGE_PATH = path.join(tmpdir(), "spotify-ai-feedback-events.json");
const DEFAULT_EVENT_LIMIT = 5000;
const SECRET_KEY_PATTERN =
  /(access[_-]?token|refresh[_-]?token|id[_-]?token|secret|password|authorization|cookie|api[_-]?key|client[_-]?secret)/i;
const POSITIVE_ACTIONS = new Set(["like", "save", "create_playlist"]);
const NEGATIVE_ACTIONS = new Set(["ignore"]);

function safeString(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeIsoDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function getStoragePath() {
  return process.env.FEEDBACK_STORAGE_PATH || DEFAULT_STORAGE_PATH;
}

function getSnapshotStoragePath() {
  const storagePath = getStoragePath();
  const timestamp = Date.now();

  if (storagePath.endsWith(".json")) {
    return storagePath.replace(/\.json$/, `-${timestamp}.json`);
  }

  return `${storagePath}-${timestamp}.json`;
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobTokenOption() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};

  return {
    token: process.env.BLOB_READ_WRITE_TOKEN,
  };
}

function getLabel(action) {
  if (POSITIVE_ACTIONS.has(action)) return "positive";
  if (NEGATIVE_ACTIONS.has(action)) return "negative";

  return "neutral";
}

function sanitizeValue(value, depth = 0) {
  if (depth > 3) return null;
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 500);

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SECRET_KEY_PATTERN.test(key))
        .map(([key, nestedValue]) => [
          safeString(key, 80),
          sanitizeValue(nestedValue, depth + 1),
        ]),
    );
  }

  return null;
}

function emptyPayload(overrides = {}) {
  return {
    version: 1,
    updated_at: null,
    total_events: 0,
    latest_event_at: null,
    events: [],
    ...overrides,
  };
}

function getEventKey(event) {
  const id = safeString(event?.id, 120);

  if (id) return id;

  return [
    event?.timestamp,
    event?.action,
    event?.item_type,
    event?.item_key,
    event?.item_name,
  ]
    .map((value) => safeString(value).toLowerCase())
    .join("::");
}

export function getFeedbackStorageMode() {
  return hasBlobToken() ? "vercel_blob" : "local_tmp";
}

export function normalizeFeedbackEvent(event) {
  if (!event || typeof event !== "object") return null;

  const action = safeString(event.action, 60).toLowerCase();
  const itemType = safeString(event.item_type || event.itemType, 60).toLowerCase();
  const itemName = safeString(event.item_name || event.itemName, 240);
  const itemArtist = safeString(event.item_artist || event.itemArtist, 240);
  const itemAlbum = safeString(event.item_album || event.itemAlbum, 240);
  const timestamp = normalizeIsoDate(event.timestamp || event.created_at || Date.now());
  const itemKey =
    safeString(event.item_key || event.itemKey, 500) ||
    [itemType, itemName, itemArtist, itemAlbum]
      .map((value) => safeString(value).toLowerCase())
      .join("::");

  if (!action || !itemType || !itemName || !timestamp) return null;

  return {
    id: safeString(event.id, 120) || getEventKey({
      timestamp,
      action,
      item_type: itemType,
      item_key: itemKey,
      item_name: itemName,
    }),
    timestamp,
    action,
    label: getLabel(action),
    item_type: itemType,
    item_key: itemKey,
    item_name: itemName,
    item_artist: itemArtist,
    item_album: itemAlbum,
    score: safeNumber(event.score),
    relative_match: safeNumber(event.relative_match || event.relativeMatch),
    reason: safeString(event.reason, 500),
    source: safeString(event.source, 120),
    mode: safeString(event.mode, 120),
    context: sanitizeValue(event.context || {}) || {},
  };
}

export function normalizeFeedbackPayload(payload) {
  const events = (Array.isArray(payload?.events) ? payload.events : [])
    .map(normalizeFeedbackEvent)
    .filter(Boolean)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return emptyPayload({
    ...payload,
    events,
    total_events: events.length,
    latest_event_at:
      payload?.latest_event_at || events[events.length - 1]?.timestamp || null,
  });
}

export function upsertFeedbackEvents(
  existingPayload = {},
  incomingEvents = [],
  { now = new Date().toISOString(), limit = DEFAULT_EVENT_LIMIT } = {},
) {
  const eventMap = new Map();

  for (const event of normalizeFeedbackPayload(existingPayload).events) {
    eventMap.set(getEventKey(event), event);
  }

  let valid = 0;
  let inserted = 0;

  for (const event of incomingEvents) {
    const normalized = normalizeFeedbackEvent(event);

    if (!normalized) continue;

    valid += 1;

    const key = getEventKey(normalized);

    if (!eventMap.has(key)) {
      inserted += 1;
    }

    eventMap.set(key, normalized);
  }

  const events = [...eventMap.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-limit);
  const payload = emptyPayload({
    updated_at: normalizeIsoDate(now),
    events,
    total_events: events.length,
    latest_event_at: events[events.length - 1]?.timestamp || null,
  });

  return {
    payload,
    valid,
    inserted,
  };
}

export function buildFeedbackStatus(payload = {}) {
  const normalizedPayload = normalizeFeedbackPayload(payload);
  const actionCounts = {};
  const itemTypeCounts = {};

  for (const event of normalizedPayload.events) {
    actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;
    itemTypeCounts[event.item_type] =
      (itemTypeCounts[event.item_type] || 0) + 1;
  }

  return {
    total_events: normalizedPayload.events.length,
    latest_event_at: normalizedPayload.latest_event_at,
    updated_at: normalizedPayload.updated_at || null,
    action_counts: actionCounts,
    item_type_counts: itemTypeCounts,
  };
}

async function readBlobPayload() {
  if (!hasBlobToken()) return emptyPayload();

  const { list } = await import("@vercel/blob");
  const prefix = getStoragePath().replace(/\.json$/, "");
  const { blobs } = await list({
    ...getBlobTokenOption(),
    prefix,
    limit: 100,
  });
  const newestBlob = blobs
    .filter((blob) => blob.pathname.startsWith(prefix))
    .sort((left, right) => {
      return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
    })[0];

  if (!newestBlob?.url) return emptyPayload();

  const separator = newestBlob.url.includes("?") ? "&" : "?";
  const response = await fetch(`${newestBlob.url}${separator}v=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) return emptyPayload();

  return normalizeFeedbackPayload(await response.json());
}

async function writeBlobPayload(payload) {
  const { put } = await import("@vercel/blob");

  await put(getSnapshotStoragePath(), JSON.stringify(payload, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...getBlobTokenOption(),
  });
}

function readLocalPayload() {
  if (!existsSync(LOCAL_STORAGE_PATH)) return emptyPayload();

  try {
    return normalizeFeedbackPayload(
      JSON.parse(readFileSync(LOCAL_STORAGE_PATH, "utf8")),
    );
  } catch {
    return emptyPayload();
  }
}

function writeLocalPayload(payload) {
  writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function readFeedbackPayload() {
  if (hasBlobToken()) return readBlobPayload();

  return readLocalPayload();
}

export async function writeFeedbackPayload(payload) {
  const normalizedPayload = normalizeFeedbackPayload(payload);

  if (hasBlobToken()) {
    await writeBlobPayload(normalizedPayload);
  } else {
    writeLocalPayload(normalizedPayload);
  }

  return normalizedPayload;
}

export async function appendFeedbackEvents(events = []) {
  const existingPayload = await readFeedbackPayload();
  const result = upsertFeedbackEvents(existingPayload, events);
  const payload = await writeFeedbackPayload(result.payload);

  return {
    ...result,
    payload,
    status: buildFeedbackStatus(payload),
    storage_mode: getFeedbackStorageMode(),
  };
}
