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
    if (!cronSecret) return true;
    return authorization === `Bearer ${cronSecret}`;
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
    return res.status(401).json({
      error: "Admin or Vercel Cron authorization is required to run sync.",
    });
  }

  const result = await runSpotifyListeningSync();
  const status = result.ok
    ? 200
    : ["not_configured", "missing_env"].includes(result.code)
      ? 503
      : 502;

  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(result);
}
