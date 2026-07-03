import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const MAX_LINES = 1000;
const excludedPatterns = [
  /^node_modules\//,
  /^dist\//,
  /^backend-ml\/venv\//,
  /^\.git\//,
  /^\.vercel\//,
  /^package-lock\.json$/,
  /^server\/package-lock\.json$/,
];

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  {
    encoding: "utf8",
  },
)
  .split("\n")
  .filter(Boolean)
  .filter((file) => existsSync(file))
  .filter((file) => !excludedPatterns.some((pattern) => pattern.test(file)));

const oversized = files
  .map((file) => ({
    file,
    lines: readFileSync(file, "utf8").split("\n").length,
  }))
  .filter(({ lines }) => lines > MAX_LINES)
  .sort((left, right) => right.lines - left.lines);

if (oversized.length > 0) {
  console.error(`Files over ${MAX_LINES} lines:`);
  for (const item of oversized) {
    console.error(`${item.lines.toString().padStart(5)} ${item.file}`);
  }
  process.exit(1);
}

console.log(`Line limit check passed: ${files.length} files <= ${MAX_LINES} lines`);
