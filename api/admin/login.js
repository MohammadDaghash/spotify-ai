import {
  createAdminSessionCookie,
  getAdminEmail,
  getAdminSessionSecret,
} from "../lib/publicListeningSync.js";

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return new Promise((resolve) => {
    let body = "";

    req.on?.("data", (chunk) => {
      body += chunk;
    });

    req.on?.("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!getAdminSessionSecret()) {
    return res.status(500).json({
      error:
        "Admin session secret is not configured. Add ADMIN_SESSION_SECRET or CRON_SECRET in Vercel.",
    });
  }

  const body = await readBody(req);
  const email = String(body?.email || "").trim().toLowerCase();

  if (email !== getAdminEmail()) {
    return res.status(401).json({
      error: "Admin login required.",
    });
  }

  try {
    res.setHeader(
      "Set-Cookie",
      createAdminSessionCookie({
        email,
      }),
    );

    return res.status(200).json({
      ok: true,
      user: {
        email,
        role: "admin",
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Admin login failed.",
    });
  }
}
