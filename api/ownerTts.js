/**
 * Owner-only Eleven Labs text-to-speech for Rafay Bot (API key never exposed to browser).
 *
 * Env:
 *   ELEVENLABS_API_KEY   — required
 *   ELEVENLABS_VOICE_ID  — required (voice ID from Eleven Labs dashboard)
 *   ELEVENLABS_MODEL_ID  — optional, default eleven_turbo_v2_5
 */
import express from 'express'
import { requireOwner } from './authOwner.js'
import { stripMarkdownForSpeech } from './ttsStrip.js'

const router = express.Router()

const MAX_CHARS = 4500

router.get('/owner-tts/status', requireOwner, (req, res) => {
  res.json({
    enabled: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
  })
})

router.post('/owner-tts', requireOwner, async (req, res) => {
  const key = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
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

  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`

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
      console.error('[owner-tts] ElevenLabs error', elRes.status, errBody.slice(0, 500))
      return res.status(502).json({
        error: `Eleven Labs error (${elRes.status}). Check voice ID and API key.`,
      })
    }

    const buf = Buffer.from(await elRes.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'private, no-store')
    return res.send(buf)
  } catch (e) {
    console.error('[owner-tts]', e)
    return res.status(500).json({ error: String(e.message || e) })
  }
})

export default router
