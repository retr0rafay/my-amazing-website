/**
 * One-time: register your Fleet API app in a region (fixes HTTP 412 on /vehicles).
 *
 * Prereqs (Tesla docs):
 * 1) Generate an EC keypair (prime256v1) and keep the PRIVATE key secret.
 * 2) Place the PUBLIC key at:
 *    public/.well-known/appspecific/com.tesla.3p.public-key.pem
 * 3) Deploy so https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem returns 200.
 * 4) Domain must match allowed origin root. Tesla fetches https://YOUR_DOMAIN/.well-known/...
 *    If apex (e.g. rafaysyed.dev) 301-redirects to www, registration must use the host that
 *    returns 200 on that URL (often www), or point apex DNS at the same app so there is no redirect.
 *
 * Then run (with .env loaded):
 *   npm run tesla:register
 *
 * Env: TESLA_CLIENT_ID, TESLA_CLIENT_SECRET, TESLA_PARTNER_DOMAIN (e.g. rafaysyed.dev)
 * Optional: TESLA_FLEET_BASE_URL, TESLA_TOKEN_AUDIENCE
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_FLEET = 'https://fleet-api.prd.na.vn.cloud.tesla.com'
const TOKEN_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'
const PEM_REL = 'public/.well-known/appspecific/com.tesla.3p.public-key.pem'

/** Tesla expects audience with no trailing slash (see Partner Tokens doc). */
function fleetAudience() {
  const raw =
    process.env.TESLA_TOKEN_AUDIENCE ||
    process.env.TESLA_FLEET_BASE_URL ||
    DEFAULT_FLEET
  return raw.trim().replace(/\/+$/, '')
}

const clientId = process.env.TESLA_CLIENT_ID
const clientSecret = process.env.TESLA_CLIENT_SECRET
const domain = process.env.TESLA_PARTNER_DOMAIN
const audience = fleetAudience()
const fleetBase = audience

const missing = []
if (!clientId) missing.push('TESLA_CLIENT_ID')
if (!clientSecret) missing.push('TESLA_CLIENT_SECRET')
if (!domain) missing.push('TESLA_PARTNER_DOMAIN')
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`)
  console.error('Example: TESLA_PARTNER_DOMAIN=rafaysyed.dev')
  process.exit(1)
}

const pemPath = path.join(__dirname, '..', PEM_REL)
if (!fs.existsSync(pemPath)) {
  console.error(`Missing public key file:\n  ${PEM_REL}\n`)
  console.error('Generate keys (run from project root), then copy the public PEM to that path:\n')
  console.error(
    '  openssl ecparam -name prime256v1 -genkey -noout -out data/tesla-fleet-ec-private.pem',
  )
  console.error(
    '  openssl ec -in data/tesla-fleet-ec-private.pem -pubout -out public/.well-known/appspecific/com.tesla.3p.public-key.pem',
  )
  console.error('\nDeploy, verify URL in browser, then run this script again.\n')
  process.exit(1)
}

const body = new URLSearchParams({
  grant_type: 'client_credentials',
  client_id: clientId,
  client_secret: clientSecret,
  audience,
  scope: 'openid vehicle_device_data vehicle_cmds vehicle_charging_cmds',
})

const tr = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
})
const td = await tr.json().catch(() => ({}))
if (!tr.ok) {
  console.error('Partner token failed:', tr.status, td)
  if (td.error === 'invalid_audience') {
    console.error(`Audience sent was: "${audience}"`)
    console.error(
      'Use NA default, or set TESLA_TOKEN_AUDIENCE to your region base (no trailing slash), e.g. https://fleet-api.prd.eu.vn.cloud.tesla.com',
    )
    console.error('If TESLA_TOKEN_AUDIENCE is set in .env, remove it or fix the URL.')
  }
  process.exit(1)
}
const partnerToken = td.access_token
if (!partnerToken) {
  console.error('No access_token in partner token response:', td)
  process.exit(1)
}

const reg = await fetch(`${fleetBase}/api/1/partner_accounts`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${partnerToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ domain }),
})

const rd = await reg.json().catch(() => ({}))
if (!reg.ok) {
  console.error('Register failed:', reg.status, rd)
  process.exit(1)
}

console.log('Partner registration OK:', JSON.stringify(rd, null, 2))
console.log('\nYou can run: npm run tesla-notify:run\n')
