import OpenAI from "openai";

function sanitizeSinger(singer) {
  return String(singer || "").trim().slice(0, 80);
}

function normalizeToBullets(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*[-•]\s*/, "")
        .replace(/^\s*\d+[.)]\s*/, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 10);

  return lines.map((song) => `- ${song}`).join("\n");
}

async function getTopSongsBySinger(singer) {
  const name = sanitizeSinger(singer);

  if (!name) return "";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: `
You are a music expert.
Task: List exactly 10 well-known songs by "${name}".

Rules:
- Output ONLY a bullet list
- Exactly 10 lines
- Each line must be: "- Song Title"
- No extra text, no numbering, no explanations
`,
    temperature: 0.2,
    max_output_tokens: 300,
  });

  return normalizeToBullets(response.output_text || "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key is not configured" });
  }

  const singer = sanitizeSinger(req.body?.singer);

  if (!singer) {
    return res.status(400).json({ error: "Singer is required" });
  }

  try {
    const songs = await getTopSongsBySinger(singer);

    if (!songs) {
      return res.status(502).json({
        error: "AI did not return songs",
        songs: "",
      });
    }

    return res.status(200).json({ songs });
  } catch (error) {
    console.error("/api/songs failed", error);
    return res.status(500).json({ error: "Server error" });
  }
}
