/**
 * Owner-facing usage: ledger + env rates; optional Anthropic Admin Cost API; optional GCP BigQuery.
 * Anthropic org cost (when ANTHROPIC_ADMIN_API_KEY is set) aligns with Console; other lines are estimates.
 */
import { fetchAnthropicOrgCostMonthToDate } from './anthropicAdminCost.js'
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

  const [anthropicReport, gcp] = await Promise.all([
    fetchAnthropicOrgCostMonthToDate(),
    queryGcpBillingMonthToDate(),
  ])

  let anthropic_cost_report
  if (anthropicReport === null) {
    anthropic_cost_report = {
      configured: false,
      hint:
        'Console-aligned Anthropic MTD USD needs ANTHROPIC_ADMIN_API_KEY (sk-ant-admin…). Many individual/minimal orgs never get Admin keys or the Cost API—use Claude Console → Manage → API keys (per-key Cost) for authoritative spend; this server falls back to ledger × ANTHROPIC_* rates.',
    }
  } else if (anthropicReport.error) {
    anthropic_cost_report = {
      configured: true,
      error: anthropicReport.error,
    }
  } else {
    anthropic_cost_report = {
      configured: true,
      total_usd_mtd: anthropicReport.total_usd,
      bucket_count: anthropicReport.bucket_count,
      line_count: anthropicReport.line_count,
    }
  }

  const anthropicUsdForTotal =
    anthropicReport && anthropicReport.total_usd != null ? anthropicReport.total_usd : anthropicUsd

  let gcpResolved = gcp
  if (gcpResolved === null) {
    gcpResolved = {
      configured: false,
      hint: 'Set GCP_BILLING_BQ_TABLE to your BigQuery billing export table ID (see GCP Console → Billing → Export).',
    }
  }

  const subtotalEstimate = anthropicUsdForTotal + elevenUsd
  let totalWithGcp = subtotalEstimate
  if (gcpResolved && typeof gcpResolved.cost === 'number' && !gcpResolved.error) {
    totalWithGcp += gcpResolved.cost
  }

  return {
    calendar_month: month,
    disclaimer:
      'When ANTHROPIC_ADMIN_API_KEY is set, Anthropic USD is org month-to-date from the Cost API (Console-aligned). Otherwise Anthropic USD is a ledger × ANTHROPIC_* rate estimate. ElevenLabs uses ELEVENLABS_USD_PER_1K_CHARS. GCP uses BigQuery export when configured.',
    anthropic: {
      input_tokens: anth.input_tokens,
      output_tokens: anth.output_tokens,
      estimated_usd: Math.round(anthropicUsd * 10000) / 10000,
      rates_used_usd_per_million: { input: inPerM, output: outPerM },
    },
    anthropic_cost_report: anthropic_cost_report,
    elevenlabs: {
      characters_billed: el.characters,
      estimated_usd: Math.round(elevenUsd * 10000) / 10000,
      rate_used_usd_per_1k_chars: elPer1k,
    },
    gcp: gcpResolved,
    estimated_total_usd_stack: Math.round(totalWithGcp * 10000) / 10000,
    estimated_total_without_gcp: Math.round(subtotalEstimate * 10000) / 10000,
  }
}
