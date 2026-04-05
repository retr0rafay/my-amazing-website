/**
 * Google Home / automation bridge → same scoped agent as POST /api/owner-chat (owner context + Tesla tools when configured).
 *
 * Google no longer hosts open-ended "talk to my webhook" Conversational Actions (sunset 2023). Typical setup:
 * - IFTTT: Google Assistant trigger (phrase + text ingredient) → Webhooks action POST JSON to this URL.
 * - Home Assistant: rest_command or automation calling this URL with the shared secret.
 *
 * Env: GOOGLE_HOME_BRIDGE_SECRET — long random string; send as Authorization: Bearer <secret> or X-Rafay-Bridge-Secret.
 *
 * POST /api/google-home/chat
 * Headers: Authorization: Bearer <GOOGLE_HOME_BRIDGE_SECRET>  (or X-Rafay-Bridge-Secret: <secret>)
 * Body (JSON): { "message": "user utterance or typed text" }
 * Response: { "text": "assistant reply" }
 */
import crypto from 'crypto'
import express from 'express'
import { runA2aAgent } from './a2aCore.js'

const router = express.Router()

const MAX_MESSAGE_CHARS = 8000

function getProvidedSecret(req) {
  const auth = req.headers.authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  const h = req.headers['x-rafay-bridge-secret'] || req.headers['x-google-home-bridge-secret']
  return typeof h === 'string' ? h.trim() : ''
}

function secretsMatch(expected, provided) {
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(provided, 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

router.post('/google-home/chat', async (req, res) => {
  const expected = process.env.GOOGLE_HOME_BRIDGE_SECRET
  if (!expected) {
    return res.status(503).json({ error: 'GOOGLE_HOME_BRIDGE_SECRET is not set on the server' })
  }

  const provided = getProvidedSecret(req)
  if (!provided || !secretsMatch(expected, provided)) {
    return res.status(401).json({ error: 'Invalid or missing bridge secret' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set' })
  }

  const message = req.body?.message
  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'JSON body must include message (string)' })
  }

  const trimmed = message.trim()
  if (!trimmed) {
    return res.status(400).json({ error: 'message cannot be empty' })
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `message too long (max ${MAX_MESSAGE_CHARS} characters)` })
  }

  const teslaOk = !!(process.env.TESLA_CLIENT_ID && process.env.TESLA_CLIENT_SECRET)

  try {
    const text = await runA2aAgent(trimmed, { teslaOk, isOwner: true })
    return res.json({ text: text || '' })
  } catch (e) {
    console.error('[google-home-bridge]', e)
    return res.status(500).json({ error: String(e.message || e) })
  }
})

export default router
