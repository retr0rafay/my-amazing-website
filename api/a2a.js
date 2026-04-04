/**
 * A2A-style JSON-RPC endpoint for Rafay's site agent (compatible with message/send).
 * Set ANTHROPIC_API_KEY in production.
 *
 * Optional Tesla trip: A2A_TESLA_SECRET + header x-a2a-tesla-secret (or Authorization Bearer).
 * Optional “it’s me”: A2A_OWNER_SECRET + x-a2a-owner-secret — or use the same Tesla secret (counts as owner).
 */
import express from 'express'
import { runA2aAgent } from './a2aCore.js'

const router = express.Router()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-a2a-tesla-secret, x-a2a-owner-secret',
}

function sendJsonRpcError(res, id, code, message) {
  res.set(corsHeaders)
  res.json({ jsonrpc: '2.0', id, error: { code, message } })
}

function getTeslaSecret(req) {
  const auth = req.headers['authorization']
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim()
  }
  const h = req.headers['x-a2a-tesla-secret']
  return typeof h === 'string' ? h.trim() : null
}

function teslaTripAuthorized(req) {
  const secret = process.env.A2A_TESLA_SECRET
  if (!secret) return false
  return getTeslaSecret(req) === secret
}

function getOwnerSecretHeader(req) {
  const h = req.headers['x-a2a-owner-secret']
  return typeof h === 'string' ? h.trim() : null
}

function isOwnerRequest(req) {
  const ownerEnv = process.env.A2A_OWNER_SECRET
  if (ownerEnv && getOwnerSecretHeader(req) === ownerEnv) return true
  if (teslaTripAuthorized(req)) return true
  return false
}

router.options('/a2a', (req, res) => {
  res.set(corsHeaders)
  res.status(204).send()
})

router.post('/a2a', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJsonRpcError(
      res,
      req.body?.id ?? null,
      -32603,
      'Server misconfigured: ANTHROPIC_API_KEY is not set',
    )
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const id = body.id ?? null
  const method = body?.method

  if (method !== 'message/send' && method !== 'SendMessage') {
    return sendJsonRpcError(res, id, -32601, `Method not found: ${method}`)
  }

  const message = body?.params?.message
  const parts = message?.parts

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return sendJsonRpcError(res, id, -32602, 'Invalid params: message.parts is required')
  }

  const textParts = parts
    .filter((p) => p?.kind === 'text' || p?.type === 'text')
    .map((p) => p.text)
    .filter(Boolean)

  if (textParts.length === 0) {
    return sendJsonRpcError(res, id, -32602, 'Invalid params: no text parts found')
  }

  const userText = textParts.join('\n')

  const teslaOk =
    teslaTripAuthorized(req) && process.env.TESLA_CLIENT_ID && process.env.TESLA_CLIENT_SECRET
  const isOwner = isOwnerRequest(req)

  try {
    const responseText = await runA2aAgent(userText, {
      teslaOk: Boolean(teslaOk),
      isOwner,
    })

    const taskId = `task-${Date.now()}`

    res.set(corsHeaders)
    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        id: taskId,
        status: { state: 'completed' },
        artifacts: [
          {
            parts: [{ kind: 'text', text: responseText || '(no text response)' }],
          },
        ],
      },
    })
  } catch (error) {
    console.error('Anthropic API error:', error)
    sendJsonRpcError(res, id, -32603, 'Internal error: failed to generate response')
  }
})

export default router
