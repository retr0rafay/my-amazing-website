/**
 * Owner-only chat UI backend: Firebase ID token + same allowlist as Haven.
 * Injects Tesla tools server-side (no A2A_TESLA_SECRET in the browser).
 */
import express from 'express'
import { requireOwner } from './authOwner.js'
import { runA2aAgent } from './a2aCore.js'

const router = express.Router()

router.post('/owner-chat', requireOwner, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set' })
  }

  const message = req.body?.message
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message (string) is required' })
  }

  const trimmed = message.trim()
  if (!trimmed) {
    return res.status(400).json({ error: 'message cannot be empty' })
  }

  const teslaOk = !!(process.env.TESLA_CLIENT_ID && process.env.TESLA_CLIENT_SECRET)

  try {
    const text = await runA2aAgent(trimmed, { teslaOk, isOwner: true })
    return res.json({ text: text || '' })
  } catch (e) {
    console.error('[owner-chat]', e)
    return res.status(500).json({ error: String(e.message || e) })
  }
})

export default router
