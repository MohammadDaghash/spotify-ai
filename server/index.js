// server/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const { getTopSongsBySinger } = require("./openai");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Allow your Vite dev server + JSON
app.use(cors());
app.use(express.json());

// Rate limit: protects /api/songs from spam
const songsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/songs", songsLimiter, async (req, res) => {
  try {
    const singer = String(req.body?.singer || "").trim();

    if (!singer) {
      return res.status(400).json({ error: "Singer is required" });
    }

    const songs = await getTopSongsBySinger(singer);

    if (!songs) {
      return res.status(502).json({
        error: "AI did not return songs (try again).",
        songs: "",
      });
    }

    res.json({ songs });
  } catch (err) {
    console.error("🔴 /api/songs failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ server running on port ${PORT}`);
});
