/**
 * Owner-facing estimates: ledger + env rates + optional GCP BigQuery billing.
 * Dollar amounts are estimates unless noted; not a substitute for vendor invoices.
 */
import { queryGcpBillingMonthToDate } from './gcpBillingMonth.js'
import { currentMonthKey, getLedgerMonth } from './usageLedger.js'

function parseUsdPer(name, fallback) {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * @returns {Promise<object>}
 */
export async function getProviderUsageSummary() {
  const month = currentMonthKey()
  const row = getLedgerMonth(month) || {}
  const anth = row.anthropic || { input_tokens: 0, output_tokens: 0 }
  const el = row.elevenlabs || { characters: 0 }

  const inPerM = parseUsdPer('ANTHROPIC_INPUT_USD_PER_MTOK', 3)
  const outPerM = parseUsdPer('ANTHROPIC_OUTPUT_USD_PER_MTOK', 15)
  const elPer1k = parseUsdPer('ELEVENLABS_USD_PER_1K_CHARS', 0.18)

  const anthropicUsd =
    (anth.input_tokens / 1_000_000) * inPerM + (anth.output_tokens / 1_000_000) * outPerM
  const elevenUsd = (el.characters / 1000) * elPer1k

  let gcp = await queryGcpBillingMonthToDate()
  if (gcp === null) {
    gcp = {
      configured: false,
      hint: 'Set GCP_BILLING_BQ_TABLE to your BigQuery billing export table ID (see GCP Console → Billing → Export).',
    }
  }

  const subtotalEstimate = anthropicUsd + elevenUsd
  let totalWithGcp = subtotalEstimate
  if (gcp && typeof gcp.cost === 'number' && !gcp.error) {
    totalWithGcp += gcp.cost
  }

  return {
    calendar_month: month,
    disclaimer:
      'Anthropic and ElevenLabs USD figures use ANTHROPIC_* and ELEVENLABS_USD_PER_1K_CHARS (defaults are rough; verify against your plan). GCP uses exported billing data when configured.',
    anthropic: {
      input_tokens: anth.input_tokens,
      output_tokens: anth.output_tokens,
      estimated_usd: Math.round(anthropicUsd * 10000) / 10000,
      rates_used_usd_per_million: { input: inPerM, output: outPerM },
    },
    elevenlabs: {
      characters_billed: el.characters,
      estimated_usd: Math.round(elevenUsd * 10000) / 10000,
      rate_used_usd_per_1k_chars: elPer1k,
    },
    gcp: gcp,
    estimated_total_usd_stack: Math.round(totalWithGcp * 10000) / 10000,
    estimated_total_without_gcp: Math.round(subtotalEstimate * 10000) / 10000,
  }
}
