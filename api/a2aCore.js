/**
 * Shared Claude + optional Tesla tool loop for public /a2a and authenticated /owner-chat.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  estimateTeslaTrip,
  getTeslaChargeState,
  listTeslaVehicles,
} from './teslaTripEstimate.js'

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

Tesla account may have multiple vehicles. Use list_tesla_vehicles when the user asks about "the other car" or which vehicle is used, or when you need display names to pick the right car. For current battery % and rated miles without a destination, use get_tesla_charge_state with vehicle_query (e.g. "Model Y", a nickname, or last 6 of VIN). For trip feasibility, use estimate_tesla_trip with destination and optional vehicle_query so the right car is selected (defaults to first vehicle or TESLA_VIN_FILTER if set). Use destination as a place name or full address (e.g. "Boston MA"). If the car has no GPS, ask for a starting address and call again with origin_address set. Summarize JSON in plain language and note that figures are rough estimates, not guarantees.`

const UNAUTH_TRIP_HINT = `

If the user asks about Tesla trip range or driving feasibility but you do not have the estimate_tesla_trip tool, briefly say that live trip estimates require the x-a2a-tesla-secret header (or Authorization: Bearer) on requests to this endpoint, matching the server configuration.`

const OWNER_CONTEXT = `

[Request authentication: The caller presented a site owner credential. Assume you are speaking directly with Rafay Syed (the site owner), not a random third party. You may address him as "you" when helpful; keep the same factual boundaries about public bio info.]`

const TESLA_TOOLS = [
  {
    name: 'list_tesla_vehicles',
    description:
      'List vehicles on the linked Tesla account (display name, model if known, last 6 of VIN). Use when the user has multiple cars or asks which vehicle data applies.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_tesla_charge_state',
    description:
      'Current battery percent and rated miles remaining for one vehicle via Tesla Fleet. Use when the user asks how much battery/range they have without naming a destination.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_query: {
          type: 'string',
          description:
            'Optional: which car — nickname, "Model Y", model name, full or partial VIN. Omit to use default (first vehicle or TESLA_VIN_FILTER).',
        },
      },
    },
  },
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
        vehicle_query: {
          type: 'string',
          description:
            'Optional: which car — nickname, "Model Y", model name, full or partial VIN. Omit to use default (first vehicle or TESLA_VIN_FILTER).',
        },
      },
      required: ['destination'],
    },
  },
]

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

/**
 * @param {string} userText
 * @param {{ teslaOk: boolean, isOwner: boolean }} opts
 */
export async function runA2aAgent(userText, opts) {
  const { teslaOk, isOwner } = opts
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
        if (block.name === 'list_tesla_vehicles') {
          payload = await listTeslaVehicles()
        } else if (block.name === 'get_tesla_charge_state') {
          const input = block.input || {}
          payload = await getTeslaChargeState({
            vehicle_query: input.vehicle_query,
          })
        } else if (block.name === 'estimate_tesla_trip') {
          const input = block.input || {}
          payload = await estimateTeslaTrip({
            destination: input.destination,
            origin_address: input.origin_address,
            vehicle_query: input.vehicle_query,
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
