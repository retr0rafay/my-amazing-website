/**
 * Owner-only Eleven Labs text-to-speech for Rafay Bot (API key never exposed to browser).
 *
 * Env:
 *   ELEVENLABS_API_KEY   — required
 *   ELEVENLABS_VOICE_ID  — required (voice ID from Eleven Labs dashboard)
 *   ELEVENLABS_MODEL_ID  — optional, default eleven_multilingual_v2
 *   ELEVENLABS_API_BASE  — optional API origin (default https://api.elevenlabs.io).
 *     EU data residency / isolated orgs may need https://api.eu.residency.elevenlabs.io
 *     with a key created for that environment (see ElevenLabs data residency docs).
 *   ELEVENLABS_STREAMING_LATENCY — 0–4, default 4 (fastest TTFB; may affect number pronunciation).
 *   ELEVENLABS_OUTPUT_FORMAT — e.g. mp3_44100_128 (default), mp3_22050_32 for slightly smaller/faster files.
 */
import express from 'express'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { requireOwner } from './authOwner.js'
import { recordElevenLabsCharacters } from './usageLedger.js'
import { stripMarkdownForSpeech } from './ttsStrip.js'

const router = express.Router()

const MAX_CHARS = 4500

/** Railway/env often adds trailing newlines or pasted quotes around secrets. */
function sanitizeEnvString(v) {
  if (v == null) return ''
  let s = String(v).trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function getElevenLabsEnv() {
  return {
    key: sanitizeEnvString(process.env.ELEVENLABS_API_KEY),
    voiceId: sanitizeEnvString(process.env.ELEVENLABS_VOICE_ID),
  }
}

function getApiBase() {
  const raw = sanitizeEnvString(process.env.ELEVENLABS_API_BASE) || 'https://api.elevenlabs.io'
  return raw.replace(/\/$/, '')
}

function getStreamingLatency() {
  const n = parseInt(process.env.ELEVENLABS_STREAMING_LATENCY ?? '4', 10)
  if (Number.isNaN(n)) return 4
  return Math.min(4, Math.max(0, n))
}

function getOutputFormat() {
  return sanitizeEnvString(process.env.ELEVENLABS_OUTPUT_FORMAT) || 'mp3_44100_128'
}

function parseElevenLabsErrorBody(errBody) {
  try {
    const j = JSON.parse(errBody)
    const d = j.detail
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      if (d.message) return String(d.message)
      if (d.status) return String(d.status)
    }
    if (j.message) return String(j.message)
  } catch {
    /* ignore */
  }
  return errBody ? errBody.slice(0, 200) : ''
}

router.get('/owner-tts/status', requireOwner, (req, res) => {
  const { key, voiceId } = getElevenLabsEnv()
  res.json({
    enabled: !!(key && voiceId),
  })
})

/** Owner-only: lengths + GET /v1/user probe (no secrets). Helps debug 401 / wrong API host. */
router.get('/owner-tts/diag', requireOwner, async (req, res) => {
  const { key, voiceId } = getElevenLabsEnv()
  const base = getApiBase()
  let userProbe = null
  if (key) {
    try {
      const r = await fetch(`${base}/v1/user`, {
        headers: { 'xi-api-key': key },
      })
      const txt = await r.text()
      userProbe = {
        status: r.status,
        ok: r.ok,
        detail: r.ok ? 'key accepted for this API base' : parseElevenLabsErrorBody(txt),
      }
    } catch (e) {
      userProbe = { error: String(e.message || e) }
    }
  }
  res.json({
    apiBase: base,
    keyLength: key.length,
    voiceIdLength: voiceId.length,
    userProbe,
  })
})

router.post('/owner-tts', requireOwner, async (req, res) => {
  const { key, voiceId } = getElevenLabsEnv()
  if (!key || !voiceId) {
    return res.status(503).json({
      error: 'Voice is not configured (set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID on the server).',
    })
  }

  const raw = req.body?.text
  if (raw == null || typeof raw !== 'string') {
    return res.status(400).json({ error: 'text (string) is required' })
  }

  let text = stripMarkdownForSpeech(raw)
  if (!text) {
    return res.status(400).json({ error: 'text is empty after stripping' })
  }
  if (text.length > MAX_CHARS) {
    text = `${text.slice(0, MAX_CHARS)}…`
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const base = getApiBase()
  const qs = new URLSearchParams({
    optimize_streaming_latency: String(getStreamingLatency()),
    output_format: getOutputFormat(),
  })
  const url = `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?${qs.toString()}`

  try {
    const elRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': key,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
      }),
    })

    if (!elRes.ok) {
      const errBody = await elRes.text().catch(() => '')
      const parsed = parseElevenLabsErrorBody(errBody)
      console.error('[owner-tts] ElevenLabs error', elRes.status, errBody.slice(0, 500))
      let hint = 'Check voice ID and API key.'
      if (elRes.status === 401) {
        hint =
          '401 = API key not accepted on this API host. Fix: (1) Create a new key in ElevenLabs → Profile → API keys and paste again in Railway (no quotes). (2) If your org uses EU data residency, set ELEVENLABS_API_BASE=https://api.eu.residency.elevenlabs.io and use a key from that environment. (3) Redeploy after saving env. GET /api/owner-tts/diag (signed in) shows whether /v1/user accepts your key.'
      } else if (elRes.status === 402) {
        hint =
          '402 = subscription: many “library” voices require a paid plan for API use on ElevenLabs. Options: upgrade your plan, or change ELEVENLABS_VOICE_ID to a voice allowed on your tier (e.g. a premade voice ID from their docs, or a custom voice you created in the dashboard). The detail below is from ElevenLabs.'
      } else if (elRes.status === 400) {
        hint =
          'Bad request — often wrong model_id (set ELEVENLABS_MODEL_ID) or invalid voice ID.'
      }
      return res.status(502).json({
        error: `Eleven Labs error (${elRes.status}). ${hint}`,
        elevenLabsDetail: parsed || undefined,
        apiBase: base,
      })
    }

    recordElevenLabsCharacters(text.length)

    if (!elRes.body) {
      return res.status(502).json({ error: 'Eleven Labs returned an empty body stream.' })
    }

    const upstreamType = elRes.headers.get('content-type') || 'audio/mpeg'
    res.setHeader('Content-Type', upstreamType.startsWith('audio/') ? upstreamType : 'audio/mpeg')
    res.setHeader('Cache-Control', 'private, no-store')

    try {
      await pipeline(Readable.fromWeb(elRes.body), res)
    } catch (pipeErr) {
      console.error('[owner-tts] stream pipe', pipeErr)
      if (!res.headersSent) {
        return res.status(502).json({ error: 'Failed to stream audio from Eleven Labs.' })
      }
    }
  } catch (e) {
    console.error('[owner-tts]', e)
    if (!res.headersSent) {
      return res.status(500).json({ error: String(e.message || e) })
    }
  }
})

export default router
