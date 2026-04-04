/**
 * Exchange a Tesla OAuth authorization code for access + refresh tokens.
 * Usage: node scripts/tesla-exchange-code.mjs 'NA_...'
 *
 * Requires in .env: TESLA_CLIENT_ID, TESLA_CLIENT_SECRET
 * Optional: TESLA_TOKEN_AUDIENCE (default NA fleet base), TESLA_OAUTH_REDIRECT_URI
 *
 * When authorizing in the browser, the authorize URL MUST request every scope you need.
 * Typical sets:
 *   - Notifier: offline_access openid vehicle_device_data (and vehicle_cmds if wake)
 *   - + Trip / car GPS: add vehicle_location
 * Example scope query value (encode spaces as %20):
 *   offline_access%20openid%20vehicle_device_data%20vehicle_location%20vehicle_cmds
 * Re-consent after changing scopes, then exchange the new code and replace TESLA_REFRESH_TOKEN.
 */
import 'dotenv/config'

const DEFAULT_AUDIENCE = 'https://fleet-api.prd.na.vn.cloud.tesla.com/'
const DEFAULT_REDIRECT = 'http://localhost:5173/auth/tesla/callback'
const TOKEN_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'

const code = process.argv[2]
if (!code || code.startsWith('-')) {
  console.error('Usage: node scripts/tesla-exchange-code.mjs <authorization_code>')
  process.exit(1)
}

const clientId = process.env.TESLA_CLIENT_ID
const clientSecret = process.env.TESLA_CLIENT_SECRET
const redirectUri = process.env.TESLA_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT
const audience = process.env.TESLA_TOKEN_AUDIENCE || DEFAULT_AUDIENCE

if (!clientId || !clientSecret) {
  console.error('Set TESLA_CLIENT_ID and TESLA_CLIENT_SECRET in .env')
  process.exit(1)
}

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: clientId,
  client_secret: clientSecret,
  code: code.trim(),
  redirect_uri: redirectUri,
  audience,
})

const res = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
})

const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Token exchange failed:', res.status, data)
  process.exit(1)
}

console.log('\n--- Add this to .env ---\n')
console.log(`TESLA_REFRESH_TOKEN='${data.refresh_token}'`)
console.log('\n(access_token received; refresh_token is what the server uses long-term)\n')
