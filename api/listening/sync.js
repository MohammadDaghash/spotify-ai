import {
  runSpotifyListeningSync,
  verifyAdminSessionCookie,
} from "../lib/publicListeningSync.js";

function getHeader(req, name) {
  const lowerName = name.toLowerCase();
  return req.headers?.[lowerName] || req.headers?.[name] || "";
}

function isAuthorizedSyncRequest(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = getHeader(req, "authorization");

  if (req.method === "GET") {
    return Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
  }

  if (req.method === "POST") {
    return verifyAdminSessionCookie({
      cookieHeader: getHeader(req, "cookie"),
    }).ok;
  }

  return false;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorizedSyncRequest(req)) {
    console.warn("Spotify listening sync unauthorized", {
      method: req.method,
    });

    return res.status(401).json({
      error: "Admin or Vercel Cron authorization is required to run sync.",
    });
  }

  const result = await runSpotifyListeningSync();
  const trigger = req.method === "GET" ? "cron" : "manual";
  const status = result.ok
    ? 200
    : ["not_configured", "missing_env"].includes(result.code)
      ? 503
      : 502;

  console.info("Spotify listening sync finished", {
    trigger,
    ok: result.ok,
    code: result.code,
    received: result.received,
    valid: result.valid,
    inserted: result.inserted,
    storage_mode: result.storage_mode,
    last_sync_status: result.sync?.last_sync_status,
    last_synced_at: result.sync?.last_synced_at,
    total_plays: result.sync?.total_plays,
    latest_played_at: result.sync?.latest_played_at,
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(result);
}
