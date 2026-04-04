/**
 * Twice-daily Pushover summaries of Tesla battery charge via Tesla Fleet API.
 *
 * Required env (when TESLA_NOTIFY_ENABLED=true):
 *   TESLA_CLIENT_ID, TESLA_CLIENT_SECRET — from developer.tesla.com
 *   TESLA_REFRESH_TOKEN — from OAuth (scopes: offline_access, vehicle_device_data)
 *   PUSHOVER_USER_KEY, PUSHOVER_APP_TOKEN — from pushover.net
 *
 * Optional:
 *   TESLA_FLEET_BASE_URL — default https://fleet-api.prd.na.vn.cloud.tesla.com
 *   TESLA_TOKEN_AUDIENCE — OAuth audience for token refresh (default: fleet base URL + /)
 *   TESLA_AUTH_TOKEN_URL — default https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token
 *   TESLA_NOTIFY_CRON — default "0 7,19 * * *" (07:00 and 19:00)
 *   TESLA_NOTIFY_TZ — default America/New_York
 *   TESLA_NOTIFY_HOOK_SECRET — if set, POST /api/tesla-charge-notify with header x-cron-secret triggers a run
 *   TESLA_WAKE_BEFORE_NOTIFY — if "true", POST /wake_up then poll until online before vehicle_data (needs vehicle_cmds OAuth scope)
 *   TESLA_WAKE_TIMEOUT_MS — max wait for online after wake (default 120000)
 *   TESLA_WAKE_POLL_INTERVAL_MS — poll interval ms (default 4000)
 *
 * Refresh tokens rotate: persisted to data/tesla-fleet-tokens.json (gitignored).
 * Last good charge_state per VIN: data/tesla-charge-snapshot.json (gitignored) — used when
 * vehicle_data returns 408 (asleep) so Pushover still shows last known % (stale until next wake).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKEN_FILE = path.join(__dirname, '..', 'data', 'tesla-fleet-tokens.json')
const CHARGE_SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'tesla-charge-snapshot.json')

const DEFAULT_FLEET_BASE = 'https://fleet-api.prd.na.vn.cloud.tesla.com'
const DEFAULT_AUTH_TOKEN_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'

function readStoredRefreshToken() {
  const trim = (s) => (typeof s === 'string' ? s.trim().replace(/^["']|["']$/g, '') : null)
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const j = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
      if (j.refresh_token && typeof j.refresh_token === 'string') return trim(j.refresh_token)
    }
  } catch (e) {
    console.warn('[tesla-notify] Could not read token file:', e.message)
  }
  return trim(process.env.TESLA_REFRESH_TOKEN) || null
}

function persistRefreshToken(refreshToken) {
  if (!refreshToken) return
  try {
    const dir = path.dirname(TOKEN_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify({ refresh_token: refreshToken, updated_at: new Date().toISOString() }, null, 2),
      'utf8',
    )
  } catch (e) {
    console.error('[tesla-notify] Failed to persist refresh token:', e.message)
  }
}

async function refreshAccessToken() {
  const clientId = process.env.TESLA_CLIENT_ID
  const clientSecret = process.env.TESLA_CLIENT_SECRET
  const refresh = readStoredRefreshToken()
  const tokenUrl = process.env.TESLA_AUTH_TOKEN_URL || DEFAULT_AUTH_TOKEN_URL

  if (!clientId || !clientSecret || !refresh) {
    throw new Error('Missing TESLA_CLIENT_ID, TESLA_CLIENT_SECRET, or TESLA_REFRESH_TOKEN (or token file)')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
  })
  // Some setups require audience on refresh; set TESLA_TOKEN_AUDIENCE if Tesla returns 401 (e.g. https://fleet-api.prd.na.vn.cloud.tesla.com/)
  const aud = process.env.TESLA_TOKEN_AUDIENCE
  if (aud) {
    body.set('audience', aud)
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.error_description || data.error || res.statusText
    throw new Error(`Tesla token refresh failed: ${res.status} ${msg}`)
  }

  const accessToken = data.access_token
  const newRefresh = data.refresh_token
  if (!accessToken) throw new Error('Tesla token response missing access_token')

  if (newRefresh && newRefresh !== refresh) {
    persistRefreshToken(newRefresh)
    console.log('[tesla-notify] Stored rotated Tesla refresh token')
  }

  return accessToken
}

function fleetBase() {
  return (process.env.TESLA_FLEET_BASE_URL || DEFAULT_FLEET_BASE).replace(/\/$/, '')
}

async function fleetGet(accessToken, pathname) {
  const url = `${fleetBase()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

async function fleetPost(accessToken, pathname, bodyObj = {}) {
  const url = `${fleetBase()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyObj),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractVehicleState(vehicleBody) {
  const r = vehicleBody?.response ?? vehicleBody
  return r?.state ?? null
}

/**
 * POST wake_up, then poll GET /vehicles/{vin} until state === "online" or timeout.
 * Returns true if online was seen; false if wake failed or timed out (caller still tries vehicle_data).
 */
async function tryWakeAndWaitOnline(accessToken, vin, timeoutMs, intervalMs) {
  const vPath = `/api/1/vehicles/${encodeURIComponent(vin)}`
  const { res: wRes, data: wData } = await fleetPost(accessToken, `${vPath}/wake_up`, {})
  if (!wRes.ok) {
    const hint = wData?.error || wData?.error_description || wRes.statusText
    console.warn(`[tesla-notify] wake_up failed for ${vin}: ${wRes.status} ${hint}`)
    return false
  }

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { res, data } = await fleetGet(accessToken, vPath)
    if (res.ok && extractVehicleState(data) === 'online') {
      console.log(`[tesla-notify] ${vin} online after ${Date.now() - start}ms`)
      return true
    }
    await sleep(intervalMs)
  }
  console.warn(`[tesla-notify] wake: ${vin} not online within ${timeoutMs}ms`)
  return false
}

function extractChargeState(vehicleDataBody) {
  const root = vehicleDataBody?.response ?? vehicleDataBody
  const cs = root?.charge_state ?? root?.vehicle?.charge_state
  if (!cs && root && typeof root === 'object') {
    const v = root.vehicle || root
    if (v?.charge_state) return v.charge_state
  }
  return cs || null
}

function formatChargeStateParts(chargeState) {
  if (!chargeState) return null
  const pct = chargeState.battery_level
  const limit = chargeState.charge_limit_soc
  const range = chargeState.battery_range
  const charging = chargeState.charging_state
  const parts = []
  if (pct != null) parts.push(`${pct}%`)
  if (limit != null) parts.push(`limit ${limit}%`)
  if (range != null) parts.push(`~${Math.round(range)} mi`)
  if (charging && charging !== 'Disconnected' && charging !== 'Complete') parts.push(charging)
  return parts.length ? parts.join(' · ') : null
}

function formatVehicleLine(vin, displayName, chargeState, errorText) {
  const name = displayName || vin || 'Vehicle'
  if (errorText) return `• ${name}: ${errorText}`
  if (!chargeState) return `• ${name}: (no charge data)`
  const inner = formatChargeStateParts(chargeState)
  return `• ${name}: ${inner || 'unknown'}`
}

function readChargeSnapshot() {
  try {
    if (!fs.existsSync(CHARGE_SNAPSHOT_FILE)) return { vehicles: {} }
    const j = JSON.parse(fs.readFileSync(CHARGE_SNAPSHOT_FILE, 'utf8'))
    if (j && typeof j.vehicles === 'object' && j.vehicles) return j
  } catch (e) {
    console.warn('[tesla-notify] Could not read charge snapshot:', e.message)
  }
  return { vehicles: {} }
}

function persistChargeSnapshot(vin, displayName, chargeState) {
  if (!vin || !chargeState) return
  try {
    const dir = path.dirname(CHARGE_SNAPSHOT_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const snap = readChargeSnapshot()
    const key = String(vin).toUpperCase()
    snap.vehicles[key] = {
      display_name: displayName || null,
      updated_at: new Date().toISOString(),
      charge_state: chargeState,
    }
    fs.writeFileSync(CHARGE_SNAPSHOT_FILE, JSON.stringify(snap, null, 2), 'utf8')
  } catch (e) {
    console.warn('[tesla-notify] Could not persist charge snapshot:', e.message)
  }
}

function formatAsleepWithLastKnown(vin, displayName, cached, tz) {
  const name = displayName || vin || 'Vehicle'
  const parts = formatChargeStateParts(cached.charge_state)
  const when = new Date(cached.updated_at).toLocaleString('en-US', {
    timeZone: tz || 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const core = parts || 'unknown'
  return `• ${name}: asleep — last known: ${core} (${when})`
}

export async function runTeslaChargeNotifyJob() {
  const missing = []
  if (!process.env.TESLA_CLIENT_ID) missing.push('TESLA_CLIENT_ID')
  if (!process.env.TESLA_CLIENT_SECRET) missing.push('TESLA_CLIENT_SECRET')
  if (!readStoredRefreshToken()) missing.push('TESLA_REFRESH_TOKEN (or data/tesla-fleet-tokens.json)')
  if (!process.env.PUSHOVER_USER_KEY) missing.push('PUSHOVER_USER_KEY')
  if (!process.env.PUSHOVER_APP_TOKEN) missing.push('PUSHOVER_APP_TOKEN')
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(', ')}`)
  }

  const user = process.env.PUSHOVER_USER_KEY
  const appTok = process.env.PUSHOVER_APP_TOKEN

  const accessToken = await refreshAccessToken()
  const { res: listRes, data: listData } = await fleetGet(accessToken, '/api/1/vehicles')

  if (!listRes.ok) {
    const err =
      listData?.error_description || listData?.error || listRes.statusText || 'vehicle list failed'
    throw new Error(`Tesla vehicles: ${listRes.status} ${err}`)
  }

  let vehicles = listData?.response
  if (vehicles && !Array.isArray(vehicles) && Array.isArray(vehicles.vehicles)) {
    vehicles = vehicles.vehicles
  }
  if (!Array.isArray(vehicles)) vehicles = []
  if (vehicles.length === 0) {
    await sendPushover(user, appTok, 'Tesla charge', 'No vehicles on this account.')
    return
  }

  const lines = []
  const vins = process.env.TESLA_VIN_FILTER
    ? process.env.TESLA_VIN_FILTER.split(',').map((v) => v.trim().toUpperCase())
    : null
  const notifyTz = process.env.TESLA_NOTIFY_TZ || 'America/New_York'
  const snapshot = readChargeSnapshot()
  const wakeBefore =
    process.env.TESLA_WAKE_BEFORE_NOTIFY === 'true' || process.env.TESLA_WAKE_BEFORE_NOTIFY === '1'
  const wakeTimeoutMs = Math.max(
    5000,
    parseInt(process.env.TESLA_WAKE_TIMEOUT_MS || '120000', 10) || 120000,
  )
  const wakePollMs = Math.max(
    1000,
    parseInt(process.env.TESLA_WAKE_POLL_INTERVAL_MS || '4000', 10) || 4000,
  )

  for (const v of vehicles) {
    const vin = v.vin || v.id_s
    const displayName = v.display_name || v.name
    if (vins && vin && !vins.includes(String(vin).toUpperCase())) continue

    if (wakeBefore && vin) {
      const vPath = `/api/1/vehicles/${encodeURIComponent(vin)}`
      const { res: stRes, data: stData } = await fleetGet(accessToken, vPath)
      const alreadyOnline = stRes.ok && extractVehicleState(stData) === 'online'
      if (!alreadyOnline) {
        await tryWakeAndWaitOnline(accessToken, vin, wakeTimeoutMs, wakePollMs)
      }
    }

    const { res: vdRes, data: vdData } = await fleetGet(
      accessToken,
      `/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data`,
    )

    if (vdRes.status === 408) {
      const cached = snapshot.vehicles[String(vin).toUpperCase()]
      if (cached?.charge_state) {
        lines.push(formatAsleepWithLastKnown(vin, displayName, cached, notifyTz))
      } else {
        lines.push(formatVehicleLine(vin, displayName, null, 'asleep / unavailable (408)'))
      }
      continue
    }
    if (!vdRes.ok) {
      const hint = vdData?.error || vdData?.error_description || vdRes.statusText
      lines.push(formatVehicleLine(vin, displayName, null, `error ${vdRes.status}: ${hint}`))
      continue
    }

    const cs = extractChargeState(vdData)
    if (cs) persistChargeSnapshot(vin, displayName, cs)
    lines.push(formatVehicleLine(vin, displayName, cs, null))
  }

  const title = 'Tesla charge'
  const when = new Date().toLocaleString('en-US', {
    timeZone: process.env.TESLA_NOTIFY_TZ || 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const message = [when, '', ...lines].join('\n')
  await sendPushover(user, appTok, title, message)
}

async function sendPushover(user, appTok, title, message) {
  const body = new URLSearchParams({
    token: appTok,
    user,
    title,
    message,
  })
  const res = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status !== 1) {
    throw new Error(`Pushover failed: ${res.status} ${JSON.stringify(data)}`)
  }
}

function startCron() {
  const expr = process.env.TESLA_NOTIFY_CRON || '0 7,19 * * *'
  const tz = process.env.TESLA_NOTIFY_TZ || 'America/New_York'

  const job = async () => {
    try {
      console.log('[tesla-notify] Running scheduled job…')
      await runTeslaChargeNotifyJob()
      console.log('[tesla-notify] Job finished OK')
    } catch (e) {
      console.error('[tesla-notify] Job failed:', e)
      try {
        await sendPushover(
          process.env.PUSHOVER_USER_KEY,
          process.env.PUSHOVER_APP_TOKEN,
          'Tesla notify error',
          String(e.message || e).slice(0, 1024),
        )
      } catch (_) {
        /* ignore */
      }
    }
  }

  if (!cron.validate(expr)) {
    console.error('[tesla-notify] Invalid TESLA_NOTIFY_CRON:', expr)
    return
  }

  cron.schedule(
    expr,
    () => {
      job()
    },
    { timezone: tz },
  )

  console.log(`[tesla-notify] Cron scheduled: "${expr}" (${tz})`)
}

export function setupTeslaChargeNotifications(app) {
  if (process.env.TESLA_NOTIFY_ENABLED !== 'true') {
    return
  }

  startCron()

  if (process.env.TESLA_WAKE_BEFORE_NOTIFY === 'true' || process.env.TESLA_WAKE_BEFORE_NOTIFY === '1') {
    console.log(
      '[tesla-notify] Wake-before-notify enabled (OAuth token must include vehicle_cmds scope)',
    )
  }

  const secret = process.env.TESLA_NOTIFY_HOOK_SECRET
  if (secret && app) {
    const router = express.Router()
    router.post('/tesla-charge-notify', express.json(), async (req, res) => {
      if (req.headers['x-cron-secret'] !== secret) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      try {
        await runTeslaChargeNotifyJob()
        res.json({ ok: true })
      } catch (e) {
        console.error('[tesla-notify] Hook run failed:', e)
        res.status(500).json({ error: String(e.message || e) })
      }
    })
    app.use('/api', router)
    console.log('[tesla-notify] POST /api/tesla-charge-notify enabled (x-cron-secret)')
  }
}
