# Yala-Maha — Phone IVR

Farmers call the pbx.im number. pbx.im passes the call to an endpoint that this server registers as, and Asterisk hands it to `agi.js`:

- **1** (or no key): the latest level of the caller's tank or reservoir, found by their phone number in `farmers`. Unregistered callers hear the tanks above `ALERT_THRESHOLD` (90%).
- **2**: the Yala Maha assistant. The caller speaks after the beep, Gemini hears the recording and answers, Gemini TTS speaks the answer. Up to 5 questions a call.

```
pbx.im number -> PBX Studio -> Endpoint -> asterisk (SIP/RTP, host network) -> agi.js (FastAGI :4573) -> Gemini + Postgres
```

## Setup

1. `cp ivr/.env.example ivr/.env`. Fill in from pbx.im → Settings → Endpoints → pencil icon: **Username** (e.g. `d173320`, not the name `Web-u…`), **Password**, and the **SIP server/domain**. The IP:PORT column is where a phone connects *from*; don't use it.
2. pbx.im → Call routing → **PBX Studio**: trigger **Phone Number** → node **Endpoint** → pick that endpoint.
3. AWS security group of the server: allow **TCP 5060** from `34.22.195.163` (a111162.pbx.im) and **UDP 10000–10100** (RTP) from anywhere.
4. `docker compose up -d --build agi asterisk`
5. Check it registered: `docker compose exec asterisk asterisk -rx "pjsip show registrations"` should say `Registered`.
6. Call the number. Follow along with `docker compose logs -f agi asterisk`.

## Limits

- **Gemini free tier:** about 3 TTS requests a minute per model. `agi.js` falls through four TTS models, caches the fixed prompts and alert texts, and lets at most `MAX_AI_CALLS` (3) callers use the assistant at once and each number 4 times an hour. For real traffic, turn on billing for the key.
- **Wait per answer:** 3–7 s (hold music plays).
- **Listen to the numbers.** Gemini TTS read "සියයට 80" back as 85 in a test.

## Files

```
agi.js                       call flow, caller lookup, Gemini, 24 kHz → 8 kHz audio
asterisk/pjsip.conf.tmpl     registration to pbx.im; only pbx.im's IP may send calls
asterisk/extensions.conf     every call → agi.js
asterisk/entrypoint.sh       fills in the template from ivr/.env, finds the public IP
```
