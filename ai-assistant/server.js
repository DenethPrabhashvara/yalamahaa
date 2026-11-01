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
Reply in the user's language (Sinhala, Tamil or English). Keep answers short and practical.`;

// POST /chat { message, history?: [{role:"user"|"model", text}] }
app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });
    const contents = [
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];
    const r = await ai.models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash",
      contents,
      config: { systemInstruction: SYSTEM },
    });
    res.json({ reply: r.text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /tts { text, voice? } -> audio/wav
app.post("/tts", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });
    const r = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    });
    const b64 = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return res.status(502).json({ error: "no audio returned" });
    res.type("audio/wav").send(pcmToWav(Buffer.from(b64, "base64")));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
