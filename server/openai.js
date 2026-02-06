// server/openai.js
const dotenv = require("dotenv");
dotenv.config();

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("🔵 openai.js loaded");
console.log("🔵 OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

// --- helpers ---
function sanitizeSinger(singer) {
  return String(singer || "")
    .trim()
    .slice(0, 80);
}

function normalizeToBullets(text) {
  // Force a clean "\n- Song" format
  const lines = String(text || "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*[-•]\s*/, "") // "- " or "• "
        .replace(/^\s*\d+[.)]\s*/, "") // "1. " or "1) "
        .trim()
    )
    .filter(Boolean)
    .slice(0, 10);

  if (!lines.length) return "";

  return lines.map((s) => `- ${s}`).join("\n");
}

async function callModel(prompt, model = "gpt-4.1-mini") {
  const response = await openai.responses.create({
    model,
    input: prompt,
    // keep it tight + consistent
    temperature: 0.2,
    max_output_tokens: 300,
  });

  return response.output_text || "";
}

const getTopSongsBySinger = async (singer) => {
  const name = sanitizeSinger(singer);
  if (!name) return "";

  console.log("🟢 getTopSongsBySinger called with:", name);

  // Primary prompt: strict formatting rules
  const prompt = `
You are a music expert.
Task: List exactly 10 well-known songs by "${name}".

Rules:
- Output ONLY a bullet list
- Exactly 10 lines
- Each line must be: "- Song Title"
- No extra text, no numbering, no explanations
`;

  try {
    const raw = await callModel(prompt, "gpt-4.1-mini");
    const cleaned = normalizeToBullets(raw);

    // Fallback if formatting/content is bad
    if (!cleaned || cleaned.split("\n").length < 8) {
      const fallbackPrompt = `
Return exactly 10 song titles by "${name}".
Output format MUST be exactly:
- title 1
- title 2
...
- title 10
No other text.
`;
      const raw2 = await callModel(fallbackPrompt, "gpt-4.1-mini");
      return normalizeToBullets(raw2);
    }

    return cleaned;
  } catch (err) {
    console.error("🔴 OpenAI call failed:", err);
    return "";
  }
};

module.exports = { getTopSongsBySinger };
