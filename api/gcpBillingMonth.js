/**
 * Optional: month-to-date GCP cost from a BigQuery billing export table.
 *
 * Enable Cloud Billing Export to BigQuery in GCP Console, then set:
 *   GCP_BILLING_BQ_TABLE=project_id.dataset.table_name
 * (full table ID for the standard gcp_billing_export_v1_* table)
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS (path) or reuse GCP service account JSON via
 *   GCP_BILLING_SA_JSON (raw JSON string) — optional if default ADC works on your host.
 */
import { BigQuery } from '@google-cloud/bigquery'

function getTableRef() {
  const t = (process.env.GCP_BILLING_BQ_TABLE || '').trim()
  if (!t) return null
  return t.replace(/^`+|`+$/g, '')
}

/**
 * @returns {Promise<{ cost: number, currency: string } | { error: string } | null>}
 */
export async function queryGcpBillingMonthToDate() {
  const table = getTableRef()
  if (!table) return null

  let client
  try {
    const opts = {}
    const raw = process.env.GCP_BILLING_SA_JSON
    if (raw) {
      opts.credentials = JSON.parse(raw)
    }
    client = new BigQuery(opts)
  } catch (e) {
    return { error: `BigQuery client init: ${String(e.message || e)}` }
  }

  const invoiceMonth = new Date().toISOString().slice(0, 7).replace('-', '')

  const sql = `
    SELECT
      ROUND(SUM(cost), 4) AS total_cost,
      ANY_VALUE(currency) AS currency
    FROM \`${table}\`
    WHERE \`invoice.month\` = @invoiceMonth
  `

  try {
    const [rows] = await client.query({
      query: sql,
      params: { invoiceMonth },
    })
    const row = rows[0]
    if (!row) return { cost: 0, currency: 'USD' }
    return {
      cost: Number(row.total_cost) || 0,
      currency: row.currency || 'USD',
    }
  } catch (e) {
    return { error: String(e.message || e) }
  }
}
