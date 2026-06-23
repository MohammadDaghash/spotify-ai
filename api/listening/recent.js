import {
  buildPublicStatus,
  getPublicPlays,
  getPublicSyncStorageMode,
  getServerSyncConfigStatus,
  readPublicSyncPayload,
} from "../lib/publicListeningSync.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = await readPublicSyncPayload();
    const limit = req.query?.limit;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      plays: getPublicPlays(payload, limit),
      sync: buildPublicStatus(payload, {
        config: getServerSyncConfigStatus(),
      }),
      storage_mode: getPublicSyncStorageMode(),
    });
  } catch (error) {
    console.error("/api/listening/recent failed", error);
    return res.status(500).json({
      error: "Public synced plays are unavailable right now.",
      plays: [],
      sync: buildPublicStatus(
        {
          last_sync_status: "error",
        },
        {
          config: getServerSyncConfigStatus(),
        },
      ),
      storage_mode: getPublicSyncStorageMode(),
    });
  }
}
