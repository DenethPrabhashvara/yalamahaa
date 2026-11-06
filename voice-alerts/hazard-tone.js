// Puts an attention tone in front of a speech WAV, so one file is played per call.
// The tone is 853 Hz + 960 Hz together (the US Emergency Alert System attention signal), in short
// pulses, followed by a moment of silence before the speech.
const fs = require("node:fs");

const PULSES = 3;
const PULSE_SECONDS = 0.6;
const GAP_SECONDS = 0.15;
const SILENCE_SECONDS = 0.4;

// fmt and data chunks of a PCM WAV
function readWav(buffer) {
  let fmt = null;
  for (let at = 12; at + 8 <= buffer.length; ) {
    const id = buffer.toString("ascii", at, at + 4);
    const size = buffer.readUInt32LE(at + 4);
    if (id === "fmt ") {
      fmt = {
        format: buffer.readUInt16LE(at + 8),
        channels: buffer.readUInt16LE(at + 10),
        sampleRate: buffer.readUInt32LE(at + 12),
        bits: buffer.readUInt16LE(at + 22),
      };
    }
    if (id === "data" && fmt) return { fmt, data: buffer.subarray(at + 8, at + 8 + Math.min(size, buffer.length - at - 8)) };
    at += 8 + size + (size % 2);
  }
  throw new Error("WAV file has no audio data.");
}

function toneSamples(sampleRate) {
  const samples = [];
  const push = (seconds, sound) => {
    const n = Math.round(seconds * sampleRate);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      // 10 ms fade in and out, so the pulses don't click
      const fade = Math.min(1, t / 0.01, (n - i) / sampleRate / 0.01);
      samples.push(sound ? fade * 0.4 * (Math.sin(2 * Math.PI * 853 * t) + Math.sin(2 * Math.PI * 960 * t)) : 0);
    }
  };
  for (let p = 0; p < PULSES; p++) {
    push(PULSE_SECONDS, true);
    push(p < PULSES - 1 ? GAP_SECONDS : SILENCE_SECONDS, false);
  }
  return samples;
}

function encode(samples, { channels, bits }) {
  const bytes = bits / 8;
  const out = Buffer.alloc(samples.length * channels * bytes);
  let at = 0;
  for (const s of samples) {
    for (let c = 0; c < channels; c++) {
      if (bits === 16) out.writeInt16LE(Math.round(s * 32767), at);
      else if (bits === 32) out.writeFloatLE(s, at);
      else if (bits === 8) out.writeUInt8(Math.round(128 + s * 127), at);
      at += bytes;
    }
  }
  return out;
}

// Writes the speech with the tone in front to outFile (a canonical 44-byte-header WAV)
function withHazardTone(speechFile, outFile) {
  const { fmt, data } = readWav(fs.readFileSync(speechFile));
  if (!(fmt.format === 1 && [8, 16].includes(fmt.bits)) && !(fmt.format === 3 && fmt.bits === 32)) {
    throw new Error(`Unsupported WAV format (format ${fmt.format}, ${fmt.bits}-bit).`);
  }
  const audio = Buffer.concat([encode(toneSamples(fmt.sampleRate), fmt), data]);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + audio.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(fmt.format, 20);
  header.writeUInt16LE(fmt.channels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(fmt.sampleRate * fmt.channels * (fmt.bits / 8), 28);
  header.writeUInt16LE(fmt.channels * (fmt.bits / 8), 32);
  header.writeUInt16LE(fmt.bits, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(audio.length, 40);
  fs.writeFileSync(outFile, Buffer.concat([header, audio]));
  return outFile;
}

module.exports = { withHazardTone };
