import {
  buildPublicStatus,
  getServerSyncConfigStatus,
  getPublicSyncStorageMode,
  readPublicSyncPayload,
} from "../lib/publicListeningSync.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = await readPublicSyncPayload();

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      sync: buildPublicStatus(payload, {
        config: getServerSyncConfigStatus(),
      }),
      storage_mode: getPublicSyncStorageMode(),
    });
  } catch (error) {
    console.error("/api/listening/status failed", error);
    return res.status(500).json({
      error: "Public listening sync status is unavailable right now.",
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
