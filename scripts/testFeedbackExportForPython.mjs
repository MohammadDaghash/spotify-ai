import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildFeedbackExportUrl,
  exportFeedbackForPython,
  normalizeSourceUrl,
} from "./exportFeedbackForPython.mjs";

assert.equal(
  normalizeSourceUrl("https://spotify-ai-sooty.vercel.app/"),
  "https://spotify-ai-sooty.vercel.app",
);
assert.equal(
  buildFeedbackExportUrl({
    sourceUrl: "https://spotify-ai-sooty.vercel.app/",
    limit: 25,
  }),
  "https://spotify-ai-sooty.vercel.app/api/feedback/events?limit=25",
);

const tempDir = await mkdtemp(path.join(tmpdir(), "spotify-ai-feedback-export-"));
const outputPath = path.join(tempDir, "events.json");
const fetchCalls = [];

try {
  const result = await exportFeedbackForPython({
    sourceUrl: "https://example.test/",
    limit: 2,
    outputPath,
    now: "2026-07-20T12:00:00.000Z",
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });

      return {
        ok: true,
        json: async () => ({
          ok: true,
          storage_mode: "local_tmp",
          status: {
            total_events: 1,
          },
          events: [
            {
              id: "evt_like",
              action: "like",
              label: "positive",
              item_type: "song",
              item_name: "Exported Song",
              item_artist: "Exported Artist",
            },
          ],
        }),
      };
    },
  });
  const exportedPayload = JSON.parse(await readFile(outputPath, "utf8"));

  assert.equal(
    fetchCalls[0].url,
    "https://example.test/api/feedback/events?limit=2",
  );
  assert.deepEqual(fetchCalls[0].options.headers, {
    Accept: "application/json",
  });
  assert.equal(result.eventCount, 1);
  assert.equal(result.storageMode, "local_tmp");
  assert.equal(exportedPayload.exported_at, "2026-07-20T12:00:00.000Z");
  assert.equal(exportedPayload.source_url, "https://example.test");
  assert.equal(exportedPayload.events[0].item_name, "Exported Song");
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

await assert.rejects(
  () =>
    exportFeedbackForPython({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    }),
  /events array/,
);

console.log("Feedback export for Python tests passed");
