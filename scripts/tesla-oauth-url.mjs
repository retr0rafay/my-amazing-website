/**
 * Print the Tesla OAuth "authorize" URL so you can open it in a browser and sign in.
 * Includes vehicle_location + prompt_missing_scopes (see Third-Party Tokens doc).
 *
 * Requires: TESLA_CLIENT_ID, TESLA_OAUTH_REDIRECT_URI (must match your Tesla app callback URL exactly)
 * Optional: TESLA_OAUTH_SCOPES — space-separated list (default adds vehicle_location + vehicle_cmds)
 *
 * Then: npm run tesla:exchange -- '<code from redirect URL>'
 */
import 'dotenv/config'
import crypto from 'crypto'

const AUTH_BASE = 'https://auth.tesla.com/oauth2/v3/authorize'

const clientId = process.env.TESLA_CLIENT_ID
const redirectUri =
  process.env.TESLA_OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/tesla/callback'

const defaultScopes =
  'openid offline_access vehicle_device_data vehicle_location vehicle_cmds vehicle_charging_cmds'
const scope = (process.env.TESLA_OAUTH_SCOPES || defaultScopes).trim().replace(/\s+/g, ' ')

if (!clientId) {
  console.error('Set TESLA_CLIENT_ID in .env')
  process.exit(1)
}

const state = crypto.randomBytes(16).toString('hex')

const params = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope,
  state,
  locale: 'en-US',
  prompt_missing_scopes: 'true',
})

const url = `${AUTH_BASE}?${params.toString()}`

console.log('\n--- Tesla OAuth: open this URL in your browser ---\n')
console.log(url)
console.log(`\n--- state (save to verify redirect): ${state} ---`)
console.log(`
Next steps:
  1) Sign in to Tesla and approve every scope (including Vehicle location).
  2) Your browser redirects to TESLA_OAUTH_REDIRECT_URI with ?code=...&state=...
  3) Copy the "code" value (one-time, expires quickly).
  4) Run:  npm run tesla:exchange -- 'PASTE_CODE_HERE'
  5) Put the printed TESLA_REFRESH_TOKEN in .env + Railway; rm data/tesla-fleet-tokens.json if needed.

Redirect URI must match your app in developer.tesla.com exactly: ${redirectUri}
`)
