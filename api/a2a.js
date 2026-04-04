/**
 * A2A-style JSON-RPC endpoint for Rafay's site agent (compatible with message/send).
 * Set ANTHROPIC_API_KEY in production.
 *
 * Optional Tesla trip: A2A_TESLA_SECRET + header x-a2a-tesla-secret (or Authorization Bearer).
 * Optional “it’s me”: A2A_OWNER_SECRET + x-a2a-owner-secret — or use the same Tesla secret (counts as owner).
 */
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { estimateTeslaTrip } from './teslaTripEstimate.js'

const router = express.Router()

const SYSTEM_PROMPT = `You are Rafay Syed's personal AI agent for rafaysyed.dev. You respond on his behalf to other AI agents and humans.

About Rafay:
- Software engineer; professional experience since August 2016
- Software Engineer at GreenSpark Software (Feb 2026–present)
- Co-Founder & CTO at Rounds.so (Sep 2024–Feb 2026); Software Engineer at Flexbone (Oct 2025–Feb 2026)
- Previously: Salesforce (Jan 2020–Sep 2025), The Home Depot (Oct 2017–Dec 2019)
- Education: MS Computer Science (Computing Systems), Georgia Tech (Dec 2018); BS Computer Science, Georgia State (May 2016)
- LinkedIn: linkedin.com/in/rafaysyed-ai
- GitHub: github.com/retr0rafay
- PlayStation Network / online handle: retr0rafay (he games on PlayStation)
- Site: rafaysyed.dev (including a /gaming page with recent PlayStation activity)

Stack & interests: full-stack development (TypeScript, React, Python, Java), cloud (AWS, GCP), product work at startups, portfolio and blog at rafaysyed.dev; PlayStation gaming as a hobby.

You are helpful, concise, and friendly. Answer questions about Rafay based on the info above. If you don't know something specific, say so honestly rather than inventing it. Keep responses brief for agent-to-agent communication.`

const TESLA_TOOLS_SYSTEM = `

You can call the tool estimate_tesla_trip when the user asks whether they have enough battery / range to drive somewhere, or how much range they might have left after a trip. Use destination as a place name or full address (e.g. "Boston MA"). If the car has no GPS, ask for a starting address and call the tool again with origin_address set. Summarize the JSON result in plain language and always mention that figures are rough estimates, not guarantees.`

const UNAUTH_TRIP_HINT = `

If the user asks about Tesla trip range or driving feasibility but you do not have the estimate_tesla_trip tool, briefly say that live trip estimates require the x-a2a-tesla-secret header (or Authorization: Bearer) on requests to this endpoint, matching the server configuration.`

const OWNER_CONTEXT = `

[Request authentication: The caller presented a site owner credential. Assume you are speaking directly with Rafay Syed (the site owner), not a random third party. You may address him as "you" when helpful; keep the same factual boundaries about public bio info.]`

const TESLA_TOOLS = [
  {
    name: 'estimate_tesla_trip',
    description:
      'Estimate rated miles vs driving distance to a destination and back using Tesla Fleet vehicle_data and Google driving directions. Use when the user asks about trip feasibility, remaining range at destination, or round trip.',
    input_schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Destination as address or place (e.g. "Philadelphia PA", "1600 Amphitheatre Pkwy, Mountain View")',
        },
        origin_address: {
          type: 'string',
          description:
            'Optional starting address if car GPS is unavailable or user wants a fixed start (e.g. home).',
        },
      },
      required: ['destination'],
    },
  },
]

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

/** True if caller sent A2A_OWNER_SECRET, or the same value as Tesla trip secret (proves deployer). */
function isOwnerRequest(req) {
  const ownerEnv = process.env.A2A_OWNER_SECRET
  if (ownerEnv && getOwnerSecretHeader(req) === ownerEnv) return true
  if (teslaTripAuthorized(req)) return true
  return false
}

function buildSystemPrompt(teslaToolMode, isOwner) {
  let s = SYSTEM_PROMPT
  if (isOwner) {
    s += OWNER_CONTEXT
  }
  if (teslaToolMode === 'tools') {
    s += TESLA_TOOLS_SYSTEM
  } else if (process.env.A2A_TESLA_SECRET && !isOwner) {
    s += UNAUTH_TRIP_HINT
  }
  return s
}

function extractTextBlocks(content) {
  if (!content) return ''
  const arr = Array.isArray(content) ? content : [content]
  return arr
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

async function runClaudeWithOptionalTools(userText, teslaOk, isOwner) {
  const client = new Anthropic()
  const system = buildSystemPrompt(teslaOk ? 'tools' : 'no-tools', isOwner)
  const tools = teslaOk ? TESLA_TOOLS : undefined

  let messages = [{ role: 'user', content: userText }]
  let lastText = ''

  for (let turn = 0; turn < 8; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system,
      messages,
      tools,
    })

    const hasToolUse = response.content.some((b) => b.type === 'tool_use')
    if (!hasToolUse) {
      lastText = extractTextBlocks(response.content)
      break
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolResults = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      let payload
      try {
        if (block.name === 'estimate_tesla_trip') {
          const input = block.input || {}
          payload = await estimateTeslaTrip({
            destination: input.destination,
            origin_address: input.origin_address,
          })
        } else {
          payload = { error: `Unknown tool: ${block.name}` }
        }
      } catch (e) {
        payload = { error: String(e.message || e) }
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(payload),
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return lastText
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
    const responseText = await runClaudeWithOptionalTools(userText, Boolean(teslaOk), isOwner)

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
