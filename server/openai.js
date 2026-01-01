const dotenv = require("dotenv");
dotenv.config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("🔵 openai.js loaded");
console.log("🔵 OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);


const getTopSongsBySinger = async (singer) => {

      console.log("🟢 getTopSongsBySinger called with:", singer);
  const prompt = `
Give me the top 10 (2025)songs by ${singer}.
Return only a bullet list, one song per line.
`;


const response = await openai.responses.create({
    model:"gpt-4.1-mini",
    input: prompt,
})

const text= response.output_text

return text
};

module.exports = { getTopSongsBySinger }
