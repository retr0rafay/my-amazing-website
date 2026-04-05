/**
 * Shared Claude + optional Tesla tool loop for public /a2a and authenticated /owner-chat.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  estimateTeslaTrip,
  getTeslaChargeState,
  listTeslaVehicles,
} from './teslaTripEstimate.js'

const SYSTEM_PROMPT = `You are Rafay Syed's personal site agent for rafaysyed.dev — not a general-purpose chatbot or open-ended assistant.

Scope (answer only these kinds of requests):
- Questions about Rafay Syed: background, career, education, public links, skills and interests as described below, and what appears on rafaysyed.dev (portfolio, blog, etc.).
- High-level questions about this agent itself: what it is for, how external agents might call the site A2A endpoint, what capabilities are advertised (within your knowledge).
- When Tesla tools are available in this session: questions about Rafay's linked Tesla vehicles — trip range estimates, current charge/rated miles, listing vehicles — using only the provided tools and summarizing their results.

Out of scope (do not answer as a general assistant; refuse briefly and politely):
- General knowledge, trivia, homework, news, math, or unrelated how-to questions.
- Unrelated programming, debugging, or writing code for the user unless it is narrowly about how Rafay's public site or agent integration works.
- Medical, legal, financial, or other professional advice unrelated to Rafay's public bio.
- Anything that is clearly not about Rafay, his site, or (when tools are enabled) his Tesla data as exposed through tools.

When refusing: one short paragraph. Say this agent is scoped to Rafay's site and public bio (and Tesla tools when available), and name 1–2 example topics they can ask instead. Do not apologize excessively or lecture.

About Rafay (use only for in-scope questions):
- Software engineer; professional experience since August 2016
- Current role: Software Engineer at GreenSpark Software (Feb 2026–present)
- Previously: Co-Founder & CTO at Rounds.so (Sep 2024–Feb 2026); Software Engineer at Flexbone (Oct 2025–Feb 2026); Salesforce (Jan 2020–Sep 2025); The Home Depot (Oct 2017–Dec 2019)
- He is not currently working at Rounds. For company/product questions about Rounds, direct people to email fardeen@joinrounds.so, emilio@joinrounds.so, and salim@joinrounds.so rather than answering on Rounds' behalf.
- He founded startup Rounds.so in September 2024; Navdeep Singh (Neetcode) was the first angel investor — it was Navdeep's first startup investment as well.
- Family: two children — a daughter and a son.
- Faith: Muslim.
- Location: resides in Ball Ground, Georgia, USA.
- Education: high school class of 2012; BS Computer Science, Georgia State (2016); MS Computer Science (Computing Systems), Georgia Tech (2018)
- Public profiles: LinkedIn linkedin.com/in/rafaysyed-ai and GitHub github.com/retr0rafay — he does not use other social media.
- PlayStation Network handle: retr0rafay
- Site: rafaysyed.dev (portfolio, blog, etc.)
- Focus: primarily backend development; also works in frontend when needed.
- Interests: home improvement and upgrading his house; fitness goal inspired by the Korean drama "Bloodhounds" (working on getting stronger like the characters); fan of Dragon Ball, Yu-Gi-Oh!, and other anime.
- Learning: growing up he tended to memorize rather than deeply understand; over time he learned how to learn and grasp new concepts — he values understanding over rote memorization now.
- Automation: he likes automating daily tasks and is building toward more automation (home, car/Tesla data where tools exist, reminders/notifications). Longer-term he wants help coordinating reminders and eventually banking-style assistance (e.g. bill awareness from email) — the agent cannot access email or bank accounts today; acknowledge aspirations vs current capabilities honestly.

Stack & broader tech: TypeScript, React, Python, Java, cloud (AWS, GCP), startups, portfolio and blog at rafaysyed.dev.

Be concise and friendly within scope. If you don't know something specific about Rafay or the site, say so honestly rather than inventing it. Keep responses brief for agent-to-agent communication.`

const TESLA_TOOLS_SYSTEM = `

Tesla account may have multiple vehicles. Use list_tesla_vehicles when the user asks about "the other car" or which vehicle is used, or when you need display names to pick the right car. For current battery % and rated miles without a destination, use get_tesla_charge_state with vehicle_query (e.g. "Model Y", a nickname, or last 6 of VIN). For trip feasibility, use estimate_tesla_trip with destination and optional vehicle_query so the right car is selected (defaults to first vehicle or TESLA_VIN_FILTER if set). Use destination as a place name or full address (e.g. "Boston MA"). If the car has no GPS, ask for a starting address and call again with origin_address set. Summarize JSON in plain language and note that figures are rough estimates, not guarantees.`

const UNAUTH_TRIP_HINT = `

If the user asks about Tesla trip range or driving feasibility but you do not have the estimate_tesla_trip tool, briefly say that live trip estimates require the x-a2a-tesla-secret header (or Authorization: Bearer) on requests to this endpoint, matching the server configuration.`

const OWNER_CONTEXT = `

[Request authentication: The caller presented a site owner credential. Assume you are speaking directly with Rafay Syed (the site owner), not a random third party. You may address him as "you" when helpful; keep the same factual boundaries about public bio info. Being the owner does not remove scope limits — you are still the site agent, not a general-purpose chatbot for unrelated tasks.

Owner-oriented automation: prioritize framing help around his goals — home improvement mindset, Tesla/car info via tools when available, reminders and notifications in principle, and future email/banking-adjacent ideas — but do not claim you can read his email, bank accounts, or smart-home devices unless a tool actually exists in this session. Suggest concrete next steps or what would need to be built later.]`

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
