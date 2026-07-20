import { getCurrentUser, getSupabaseClient } from "./userAuth.js";

const USER_FEEDBACK_TABLE = "user_feedback_events";
const SECRET_KEY_PATTERN =
  /(access[_-]?token|refresh[_-]?token|id[_-]?token|secret|password|authorization|cookie|api[_-]?key|client[_-]?secret)/i;

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
          String(key).trim().slice(0, 80),
          sanitizeValue(nestedValue, depth + 1),
        ]),
    );
  }

  return null;
}

function safeString(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function mapFeedbackEventToUserRow(event, user) {
  return {
    id: safeString(event?.id, 120),
    user_id: safeString(user?.id, 120),
    event_timestamp: safeString(event?.timestamp || new Date().toISOString()),
    action: safeString(event?.action, 60),
    label: safeString(event?.label, 60),
    item_type: safeString(event?.item_type, 60),
    item_key: safeString(event?.item_key, 500),
    item_name: safeString(event?.item_name, 240),
    item_artist: safeString(event?.item_artist, 240),
    item_album: safeString(event?.item_album, 240),
    score: safeNumber(event?.score),
    relative_match: safeNumber(event?.relative_match ?? event?.relativeMatch),
    reason: safeString(event?.reason, 500),
    source: safeString(event?.source, 120),
    mode: safeString(event?.mode, 120),
    context: sanitizeValue(event?.context || {}) || {},
  };
}

export async function syncUserFeedbackEvent(
  event,
  { env, user, supabaseClient } = {},
) {
  const currentUser =
    user === undefined ? await getCurrentUser({ env, supabaseClient }) : user;

  if (!currentUser?.id || currentUser.provider !== "supabase") {
    return {
      ok: false,
      skipped: "missing_supabase_user",
    };
  }

  const client = supabaseClient || (await getSupabaseClient({ env }));

  if (!client) {
    return {
      ok: false,
      skipped: "supabase_not_configured",
    };
  }

  const row = mapFeedbackEventToUserRow(event, currentUser);
  const { error } = await client.from(USER_FEEDBACK_TABLE).insert(row);

  if (error) throw error;

  return {
    ok: true,
    inserted: 1,
  };
}

export async function fetchUserFeedbackEvents({
  env,
  user,
  limit = 500,
  supabaseClient,
} = {}) {
  const currentUser =
    user === undefined ? await getCurrentUser({ env, supabaseClient }) : user;

  if (!currentUser?.id || currentUser.provider !== "supabase") {
    return {
      ok: false,
      events: [],
      skipped: "missing_supabase_user",
    };
  }

  const client = supabaseClient || (await getSupabaseClient({ env }));

  if (!client) {
    return {
      ok: false,
      events: [],
      skipped: "supabase_not_configured",
    };
  }

  const { data, error } = await client
    .from(USER_FEEDBACK_TABLE)
    .select("*")
    .eq("user_id", currentUser.id)
    .order("event_timestamp", { ascending: false })
    .limit(Math.max(1, Math.min(Number(limit) || 500, 1000)));

  if (error) throw error;

  return {
    ok: true,
    events: data || [],
  };
}
