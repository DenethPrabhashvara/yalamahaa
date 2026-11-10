// Sinhala speech from Dialog's SinhalaVITS (https://huggingface.co/dialoglk, MPL-2.0) through its free
// public demo, for the storm / tank warning calls. Same approach as voice-alerts/sinhala-tts.js; copied
// because the API's Docker image only contains api/.
//
// Files are saved in assets/voice/generated/, which app.js serves at /api/voice/generated/, so Twilio can
// <Play> them. They are named by a hash of voice + text, so a message is only made once.
// The demo sleeps when nobody uses it: the first request can take a minute.
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const SPACE_API = process.env.SINHALA_TTS_URL || 'https://dialoglk-sinhalavits.hf.space/gradio_api'
const OUT_DIR = path.join(__dirname, '..', 'assets', 'voice', 'generated')
const TIMEOUT_MS = 3 * 60 * 1000
const KEEP_DAYS = 30

const VOICES = { female1: 'Female Voice 1', female2: 'Female Voice 2', male1: 'Male Voice 1', male2: 'Male Voice 2' }

// the demo answers as server-sent events; the last "complete" or "error" event is the result
function parseGradioEvents(stream) {
  let result = null
  for (const block of stream.split(/\r?\n\r?\n/)) {
    const event = block.match(/^event: *(.+)$/m)?.[1].trim()
    const data = block.match(/^data: *(.*)$/m)?.[1]
    if (event === 'complete') result = { ok: true, data: JSON.parse(data) }
    else if (event === 'error') result = { ok: false, message: data && data !== 'null' ? JSON.parse(data) : null }
  }
  return result
}

// length of a PCM WAV, from its fmt and data chunks; throws if it isn't one
function wavSeconds(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file')
  let byteRate = null
  for (let at = 12; at + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', at, at + 4)
    const size = buffer.readUInt32LE(at + 4)
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(at + 16)
    if (id === 'data' && byteRate) return Math.min(size, buffer.length - at - 8) / byteRate
    at += 8 + size + (size % 2)
  }
  throw new Error('WAV file has no audio data')
}

async function speak(text, voice) {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const start = await fetch(`${SPACE_API}/call/generate_speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [text, VOICES[voice]] }),
    signal,
  })
  if (!start.ok) throw new Error(`SinhalaVITS HTTP ${start.status}`)
  const { event_id: eventId } = await start.json()
  const stream = await (await fetch(`${SPACE_API}/call/generate_speech/${eventId}`, { signal })).text()
  const result = parseGradioEvents(stream)
  if (!result?.ok) throw new Error(`SinhalaVITS could not read the text${result?.message ? `: ${result.message}` : ''}`)
  const audio = await fetch(result.data[0].url, { signal })
  if (!audio.ok) throw new Error(`SinhalaVITS audio download HTTP ${audio.status}`)
  return Buffer.from(await audio.arrayBuffer())
}

// one message at a time per text, so a batch of farmers asks the demo once
const pending = new Map()

/** { name, file, seconds } for this text, made once and reused. Throws if SinhalaVITS fails. */
async function sinhalaAudio(text, voice = process.env.SINHALA_VOICE || 'female1') {
  if (!VOICES[voice]) throw new Error(`unknown SinhalaVITS voice "${voice}"`)
  const name = `si-${voice}-${crypto.createHash('sha256').update(`${voice}\n${text}`).digest('hex').slice(0, 12)}.wav`
  const file = path.join(OUT_DIR, name)
  if (fs.existsSync(file)) return { name, file, seconds: wavSeconds(fs.readFileSync(file)) }
  if (!pending.has(name)) {
    pending.set(name, (async () => {
      const wav = await speak(text, voice)
      const seconds = wavSeconds(wav)
      fs.mkdirSync(OUT_DIR, { recursive: true })
      fs.writeFileSync(file, wav)
      cleanup()
      return { name, file, seconds }
    })().finally(() => pending.delete(name)))
  }
  return pending.get(name)
}

// old messages are never needed again
function cleanup() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400000
    for (const f of fs.readdirSync(OUT_DIR)) {
      const p = path.join(OUT_DIR, f)
      if (f.endsWith('.wav') && fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p)
    }
  } catch { /* not important */ }
}

module.exports = { VOICES, sinhalaAudio, wavSeconds, parseGradioEvents, OUT_DIR }
