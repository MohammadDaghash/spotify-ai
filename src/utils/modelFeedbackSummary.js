const ACTION_LABELS = {
  like: "Liked",
  ignore: "Ignored",
  save: "Saved",
  open_spotify: "Opened Spotify",
  create_playlist: "Created playlist",
};

const POSITIVE_ACTIONS = ["like", "save", "create_playlist"];
const NEGATIVE_ACTIONS = ["ignore"];
const NEUTRAL_ACTIONS = ["open_spotify"];

function safeCount(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function formatRate(numerator, denominator) {
  if (!denominator) return "0%";

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function getActionCount(actionCounts = {}, actions = []) {
  return actions.reduce((total, action) => total + safeCount(actionCounts[action]), 0);
}

function getEventTimestamp(event = {}) {
  return event.timestamp || event.event_timestamp || "";
}

function getEventDescription(event = {}) {
  const itemName = String(event.item_name || "Unknown item").trim();
  const itemArtist = String(event.item_artist || "").trim();

  if (itemArtist) return `${itemName} by ${itemArtist}`;

  return itemName;
}

function normalizeRecentEvent(event = {}) {
  return {
    id: event.id || `${getEventTimestamp(event)}-${event.action}-${event.item_name}`,
    timestamp: getEventTimestamp(event),
    action: event.action || "",
    actionLabel: ACTION_LABELS[event.action] || event.action || "Event",
    itemType: event.item_type || "",
    description: getEventDescription(event),
    source: event.source || "",
    mode: event.mode || "",
  };
}

function incrementCount(counts, key) {
  const safeKey = String(key || "").trim();

  if (!safeKey) return;

  counts[safeKey] = safeCount(counts[safeKey]) + 1;
}

function buildStatusFromEvents(events = []) {
  const actionCounts = {};
  const itemTypeCounts = {};
  const timestamps = [];

  for (const event of events) {
    incrementCount(actionCounts, event.action);
    incrementCount(itemTypeCounts, event.item_type);

    const timestamp = getEventTimestamp(event);

    if (timestamp) timestamps.push(timestamp);
  }

  const latestEventAt = timestamps.sort().at(-1) || null;

  return {
    total_events: events.length,
    latest_event_at: latestEventAt,
    updated_at: latestEventAt,
    action_counts: actionCounts,
    item_type_counts: itemTypeCounts,
  };
}

export function buildModelFeedbackSummary({ status = {}, events = [] } = {}) {
  const normalizedStatus =
    status.total_events === undefined ? buildStatusFromEvents(events) : status;
  const actionCounts = normalizedStatus.action_counts || {};
  const itemTypeCounts = normalizedStatus.item_type_counts || {};
  const positiveLabels = getActionCount(actionCounts, POSITIVE_ACTIONS);
  const negativeLabels = getActionCount(actionCounts, NEGATIVE_ACTIONS);
  const neutralSignals = getActionCount(actionCounts, NEUTRAL_ACTIONS);
  const labelableEvents = positiveLabels + negativeLabels;
  const recentEvents = [...events]
    .sort((left, right) =>
      String(getEventTimestamp(right)).localeCompare(String(getEventTimestamp(left))),
    )
    .slice(0, 8)
    .map(normalizeRecentEvent);

  return {
    totalEvents: safeCount(normalizedStatus.total_events),
    positiveLabels,
    negativeLabels,
    neutralSignals,
    labelableEvents,
    acceptanceRate: formatRate(positiveLabels, labelableEvents),
    ignoreRate: formatRate(negativeLabels, labelableEvents),
    songEvents: safeCount(itemTypeCounts.song),
    artistEvents: safeCount(itemTypeCounts.artist),
    groupPlaylistEvents: safeCount(itemTypeCounts.group_playlist),
    latestEventAt: normalizedStatus.latest_event_at || null,
    updatedAt: normalizedStatus.updated_at || null,
    actionRows: Object.entries(ACTION_LABELS)
      .map(([action, label]) => ({
        label,
        count: safeCount(actionCounts[action]),
      }))
      .filter((row) => row.count > 0),
    recentEvents,
  };
}
