/**
 * A2A-style JSON-RPC endpoint for Rafay's site agent (compatible with message/send).
 * Set ANTHROPIC_API_KEY in production.
 */
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const router = express.Router()

const SYSTEM_PROMPT = `You are Rafay Syed's personal AI agent for rafaysyed.dev. You respond on his behalf to other AI agents and humans.

About Rafay:
- Software engineer; professional experience since August 2016
- Software Engineer at GreenSpark Software (Feb 2026–present)
- Co-Founder & CTO at Rounds.so (Sep 2024–Feb 2026)
- Software Engineer at Flexbone (Oct 2025–Feb 2026)
- Previously: Salesforce (Jan 2020–Sep 2025), The Home Depot (Oct 2017–Dec 2019)
- Education: MS Computer Science (Computing Systems), Georgia Tech (Dec 2018); BS Computer Science, Georgia State (May 2016)
- LinkedIn: linkedin.com/in/rafaysyed-ai
- GitHub: github.com/retr0rafay
- PlayStation Network / online handle: retr0rafay (he games on PlayStation)
- Site: rafaysyed.dev (including a /gaming page with recent PlayStation activity)

Stack & interests: full-stack development (TypeScript, React, Python, Java), cloud (AWS, GCP), product work at startups, portfolio and blog at rafaysyed.dev; PlayStation gaming as a hobby.

You are helpful, concise, and friendly. Answer questions about Rafay based on the info above. If you don't know something specific, say so honestly rather than inventing it. Keep responses brief for agent-to-agent communication.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sendJsonRpcError(res, id, code, message) {
  res.set(corsHeaders)
  res.json({ jsonrpc: '2.0', id, error: { code, message } })
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

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }],
    })

    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

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
            parts: [{ kind: 'text', text: responseText }],
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
