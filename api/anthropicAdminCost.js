/**
 * Anthropic org cost from the Usage & Cost Admin API (matches Console cost data).
 * Requires ANTHROPIC_ADMIN_API_KEY (sk-ant-admin...) — org admin only; not the standard API key.
 * @see https://docs.anthropic.com/en/docs/build-with-claude/usage-cost-api
 */

const COST_URL = 'https://api.anthropic.com/v1/organizations/cost_report'

function adminKey() {
  return (process.env.ANTHROPIC_ADMIN_API_KEY || '').trim()
}

/**
 * Sum USD for [startingAt, endingAt) from daily cost buckets. Amounts are in cents (minor units).
 * @param {Date} startingAt inclusive UTC start
 * @param {Date} endingAt exclusive end
 * @returns {Promise<{ total_usd: number, bucket_count: number, line_count: number } | { error: string } | null>}
 */
export async function fetchAnthropicOrgCostUsdRange(startingAt, endingAt) {
  const key = adminKey()
  if (!key) return null

  let totalMinor = 0
  let bucketCount = 0
  let lineCount = 0
  let page = undefined

  try {
    for (let i = 0; i < 50; i++) {
      const params = new URLSearchParams()
      params.set('starting_at', startingAt.toISOString())
      params.set('ending_at', endingAt.toISOString())
      params.set('bucket_width', '1d')
      params.set('limit', '31')
      if (page) params.set('page', page)

      const res = await fetch(`${COST_URL}?${params}`, {
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': key,
        },
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          body?.error?.message ||
          body?.message ||
          `HTTP ${res.status}`
        return { error: msg }
      }

      const data = body.data
      if (!Array.isArray(data)) {
        return { error: 'Unexpected cost_report response shape' }
      }

      for (const bucket of data) {
        bucketCount++
        const results = bucket.results
        if (!Array.isArray(results)) continue
        for (const row of results) {
          lineCount++
          const raw = row.amount
          const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
          if (Number.isFinite(n)) totalMinor += n
        }
      }

      if (!body.has_more || !body.next_page) break
      page = body.next_page
    }
  } catch (e) {
    return { error: String(e.message || e) }
  }

  return {
    total_usd: Math.round((totalMinor / 100) * 10000) / 10000,
    bucket_count: bucketCount,
    line_count: lineCount,
  }
}

/**
 * Calendar month-to-date (UTC): first day 00:00:00Z through now.
 */
export async function fetchAnthropicOrgCostMonthToDate() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  return fetchAnthropicOrgCostUsdRange(start, now)
}
