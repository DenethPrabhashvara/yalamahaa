// Yala Maha AI assistant: Gemini chat + Gemini TTS
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
app.use(cors());
app.use(express.json());

const SYSTEM = `You are the Yala Maha assistant for Sri Lankan farmers and irrigation officers.
Help with paddy cultivation, Yala/Maha seasons, reservoir levels, flood alerts and farmer registration.
Reply in the user's language (Sinhala, Tamil or English). Keep answers short and practical.
Write plain text for a phone chat bubble: no Markdown, no asterisks or headings; use short lines or "-" for lists.`;

// Tried in order: when Gemini is overloaded (503), rate-limited (429), retires a model (404) or times out,
// the next model answers instead of the farmer seeing an error.
const CHAT_MODELS = [...new Set([
  process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
])];
const RETRYABLE = /\b(429|500|503|504|404)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|overloaded|high demand|timed? ?out|abort/i;

// POST /chat { message, history?: [{role:"user"|"model", text}] }
app.post("/chat", async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: "message required" });
  // Gemini needs alternating turns that start with the user; keep the last 12.
  const turns = history
    .filter((h) => (h.role === "user" || h.role === "model") && typeof h.text === "string" && h.text.trim())
    .slice(-12);
  while (turns.length && turns[0].role !== "user") turns.shift();
  const contents = [
    ...turns.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: message }] },
  ];
  let last;
  for (const model of CHAT_MODELS) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: SYSTEM, httpOptions: { timeout: 25000 } },
      });
      if (r.text) return res.json({ reply: r.text, model });
      last = new Error("empty reply");
    } catch (e) {
      last = e;
      console.warn(`chat: ${model} failed: ${e.message}`);
      if (!RETRYABLE.test(e.message)) break;
    }
  }
  res.status(503).json({ error: "busy", detail: last?.message });
});

// POST /tts { text, voice? } -> audio/wav
app.post("/tts", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body || {};
    if (!text) return res.status(400).json({ error: "text required" });
    let last;
    for (const model of TTS_MODELS) {
      try {
        // Without an explicit "read aloud", short texts make the TTS model try to answer them, which it refuses (400).
        const r = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: `Read this aloud exactly as written:\n${text}` }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            httpOptions: { timeout: 45000 },
          },
        });
        const audio = r.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!audio?.data) { last = new Error("no audio returned"); continue; }
        const bytes = Buffer.from(audio.data, "base64");
        // Newer models send a finished WAV; older ones raw PCM ("audio/L16;codec=pcm;rate=24000").
        if (/wav/i.test(audio.mimeType || "")) return res.type("audio/wav").send(bytes);
        const rate = Number(/rate=(\d+)/.exec(audio.mimeType || "")?.[1]) || 24000;
        return res.type("audio/wav").send(pcmToWav(bytes, rate));
      } catch (e) {
        last = e;
        console.warn(`tts: ${model} failed: ${e.message}`);
      }
    }
    res.status(503).json({ error: "busy", detail: last?.message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
const TTS_MODELS = [...new Set([
  process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
  "gemini-3.8-flash-tts",
])];

// Gemini TTS returns raw 16-bit PCM mono at 24 kHz; wrap it in a WAV header
function pcmToWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const PORT = process.env.AI_PORT || 5050;
app.listen(PORT, () => console.log(`AI assistant on http://localhost:${PORT}`));
