import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SOURCE_URL = "https://spotify-ai-sooty.vercel.app";
const DEFAULT_OUTPUT_PATH = "backend-ml/data/feedback/events.json";
const DEFAULT_LIMIT = 1000;

function getArgValue(args, name) {
  const index = args.indexOf(name);

  if (index === -1) return "";

  return args[index + 1] || "";
}

export function normalizeSourceUrl(sourceUrl = DEFAULT_SOURCE_URL) {
  const cleanUrl = String(sourceUrl || DEFAULT_SOURCE_URL).trim();

  if (!cleanUrl) return DEFAULT_SOURCE_URL;

  return cleanUrl.replace(/\/+$/, "");
}

export function buildFeedbackExportUrl({
  sourceUrl = DEFAULT_SOURCE_URL,
  limit = DEFAULT_LIMIT,
} = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 1000));

  return `${normalizeSourceUrl(sourceUrl)}/api/feedback/events?limit=${safeLimit}`;
}

export async function fetchFeedbackPayload({
  sourceUrl = DEFAULT_SOURCE_URL,
  limit = DEFAULT_LIMIT,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is unavailable in this Node runtime.");
  }

  const url = buildFeedbackExportUrl({ sourceUrl, limit });
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Feedback export failed with ${response.status}`);
  }

  if (!Array.isArray(payload.events)) {
    throw new Error("Feedback API response did not include an events array.");
  }

  return {
    url,
    payload,
  };
}

export async function exportFeedbackForPython({
  sourceUrl = DEFAULT_SOURCE_URL,
  limit = DEFAULT_LIMIT,
  outputPath = DEFAULT_OUTPUT_PATH,
  fetchImpl,
  now = new Date().toISOString(),
} = {}) {
  const { url, payload } = await fetchFeedbackPayload({
    sourceUrl,
    limit,
    fetchImpl,
  });
  const outputPayload = {
    version: 1,
    exported_at: now,
    source_url: normalizeSourceUrl(sourceUrl),
    status: payload.status || {},
    storage_mode: payload.storage_mode || "unknown",
    events: payload.events,
  };
  const resolvedOutputPath = path.resolve(outputPath);

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    `${JSON.stringify(outputPayload, null, 2)}\n`,
    "utf8",
  );

  return {
    eventCount: outputPayload.events.length,
    exportedAt: outputPayload.exported_at,
    outputPath: resolvedOutputPath,
    sourceUrl: url,
    storageMode: outputPayload.storage_mode,
  };
}

function parseCliArgs(args) {
  return {
    sourceUrl:
      getArgValue(args, "--source-url") ||
      getArgValue(args, "--url") ||
      process.env.FEEDBACK_API_URL ||
      DEFAULT_SOURCE_URL,
    outputPath: getArgValue(args, "--output") || DEFAULT_OUTPUT_PATH,
    limit: Number(getArgValue(args, "--limit") || DEFAULT_LIMIT),
  };
}

async function main() {
  const result = await exportFeedbackForPython(parseCliArgs(process.argv.slice(2)));

  console.log("Feedback exported for Python ML:");
  console.log(`source: ${result.sourceUrl}`);
  console.log(`output: ${result.outputPath}`);
  console.log(`events: ${result.eventCount}`);
  console.log(`storage mode: ${result.storageMode}`);

  if (result.eventCount === 0) {
    console.log("No events found yet. Like/Ignore recommendations first, then rerun.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(`Feedback export failed: ${error.message}`);
    process.exit(1);
  });
}
