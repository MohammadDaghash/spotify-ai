import {
  appendFeedbackEvents,
  buildFeedbackStatus,
  getFeedbackStorageMode,
  readFeedbackPayload,
} from "../lib/feedbackStore.js";

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

function getLimit(req) {
  const value = Number(req.query?.limit || req.body?.limit || 500);

  if (!Number.isFinite(value)) return 500;

  return Math.max(1, Math.min(Math.round(value), 1000));
}

function getIncomingEvents(req) {
  const body = parseBody(req.body);

  if (Array.isArray(body.events)) return body.events;
  if (body.event) return [body.event];

  return [];
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const payload = await readFeedbackPayload();
    const limit = getLimit(req);
    const events = payload.events.slice(-limit).reverse();

    return res.status(200).json({
      ok: true,
      events,
      status: buildFeedbackStatus(payload),
      storage_mode: getFeedbackStorageMode(),
    });
  }

  const events = getIncomingEvents(req);

  if (events.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "No feedback events were provided.",
    });
  }

  const result = await appendFeedbackEvents(events);

  console.info("Feedback events recorded", {
    received: events.length,
    valid: result.valid,
    inserted: result.inserted,
    total_events: result.status.total_events,
    storage_mode: result.storage_mode,
  });

  return res.status(200).json({
    ok: true,
    received: events.length,
    valid: result.valid,
    inserted: result.inserted,
    status: result.status,
    storage_mode: result.storage_mode,
  });
}
