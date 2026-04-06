/**
 * Trip range estimates for the A2A agent: Tesla Fleet (rated miles) + Google Directions.
 *
 * Env: GOOGLE_MAPS_API_KEY (Directions API enabled), same Tesla vars as teslaChargeNotify.
 * Optional: TESLA_VIN_FILTER (default subset), TESLA_WAKE_BEFORE_NOTIFY, wake timeouts.
 * OAuth: vehicle_device_data; car GPS needs vehicle_location. vehicle_cmds for wake and for door_lock/door_unlock.
 * Firmware 2023.38+: request location_data via the endpoints query param or lat/lon may be omitted.
 */
import {
  refreshAccessToken,
  fleetGet,
  fleetPost,
  extractChargeState,
  extractVehicleState,
  tryWakeAndWaitOnline,
} from './teslaChargeNotify.js'

/** Fleet: include charge_state, drive_state, and location_data (required for GPS on 2023.38+). */
function vehicleDataPath(vin) {
  const qs = new URLSearchParams({
    endpoints: 'charge_state;drive_state;location_data',
  })
  return `/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data?${qs.toString()}`
}

function extractDriveState(vdData) {
  const root = vdData?.response ?? vdData
  return root?.drive_state ?? root?.vehicle?.drive_state ?? null
}

function round2(x) {
  return Math.round(x * 100) / 100
}

function normalizeVehicleList(listData) {
  let vehicles = listData?.response
  if (vehicles && !Array.isArray(vehicles) && Array.isArray(vehicles.vehicles)) {
    vehicles = vehicles.vehicles
  }
  return Array.isArray(vehicles) ? vehicles : []
}

function envVinFilterList() {
  const raw = process.env.TESLA_VIN_FILTER
  if (!raw) return null
  return raw.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean)
}

/**
 * Pick one vehicle: optional query ("Model Y", "Kiryu", full/partial VIN), else TESLA_VIN_FILTER, else first.
 */
export function pickVehicle(vehicles, vehicleQuery) {
  if (!vehicles.length) return null

  const filter = envVinFilterList()
  let pool = vehicles
  if (filter?.length) {
    const filtered = vehicles.filter((x) =>
      filter.includes(String(x.vin || x.id_s || '').toUpperCase()),
    )
    if (filtered.length) pool = filtered
  }

  const q = (vehicleQuery || '').trim().toLowerCase()
  if (q) {
    const byVin = pool.find((x) => {
      const v = String(x.vin || x.id_s || '').toUpperCase()
      return v === q.toUpperCase() || v.endsWith(q.toUpperCase()) || v.includes(q.toUpperCase())
    })
    if (byVin) return byVin

    const byName = pool.find((x) => {
      const name = (x.display_name || x.name || '').toLowerCase()
      const model = String(x.model || '').toLowerCase()
      const hay = `${name} ${model}`.trim()
      if (hay.includes(q)) return true
      const parts = q.split(/\s+/).filter((w) => w.length > 1)
      return parts.length > 0 && parts.every((w) => hay.includes(w))
    })
    if (byName) return byName
  }

  return pool[0]
}

export async function listTeslaVehicles() {
  const accessToken = await refreshAccessToken()
  const { res, data } = await fleetGet(accessToken, '/api/1/vehicles')
  if (!res.ok) {
    return { error: `Tesla vehicle list failed: ${res.status}`, vehicles: [] }
  }
  const vehicles = normalizeVehicleList(data)
  const rows = vehicles.map((x) => {
    const vin = String(x.vin || x.id_s || '')
    return {
      display_name: x.display_name || x.name || 'Vehicle',
      vin_suffix: vin.length >= 6 ? vin.slice(-6) : vin,
      model: x.model || null,
    }
  })
  return { vehicles: rows, count: rows.length }
}

/**
 * Current charge / rated miles for one vehicle (no routing).
 * @param {{ vehicle_query?: string }} opts
 */
export async function getTeslaChargeState(opts = {}) {
  const vehicleQuery = opts?.vehicle_query != null ? String(opts.vehicle_query).trim() : ''

  const accessToken = await refreshAccessToken()
  const { res: listRes, data: listData } = await fleetGet(accessToken, '/api/1/vehicles')
  if (!listRes.ok) {
    throw new Error(`Tesla vehicle list failed: ${listRes.status}`)
  }

  const vehicles = normalizeVehicleList(listData)
  if (!vehicles.length) {
    return { error: 'No vehicles on this account' }
  }

  const v = pickVehicle(vehicles, vehicleQuery)
  if (!v) {
    return { error: 'Could not select a vehicle' }
  }

  const vin = v.vin || v.id_s
  const displayName = v.display_name || v.name || 'Vehicle'

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

  if (wakeBefore && vin) {
    const vPath = `/api/1/vehicles/${encodeURIComponent(vin)}`
    const { res: stRes, data: stData } = await fleetGet(accessToken, vPath)
    const alreadyOnline = stRes.ok && extractVehicleState(stData) === 'online'
    if (!alreadyOnline) {
      await tryWakeAndWaitOnline(accessToken, vin, wakeTimeoutMs, wakePollMs)
    }
  }

  const { res: vdRes, data: vdData } = await fleetGet(accessToken, vehicleDataPath(vin))

  if (vdRes.status === 408) {
    return {
      error:
        'Vehicle data timed out (408). Wake the car or try again.',
      vehicle_name: displayName,
    }
  }
  if (!vdRes.ok) {
    return {
      error: `Tesla vehicle_data failed: ${vdRes.status} ${vdData?.error || vdData?.error_description || ''}`,
    }
  }

  const cs = extractChargeState(vdData)
  const pct = cs?.battery_level
  const rated = cs?.battery_range
  const limit = cs?.charge_limit_soc
  const charging = cs?.charging_state

  return {
    vehicle_name: displayName,
    battery_percent: pct != null ? pct : null,
    rated_range_miles_remaining:
      rated != null && !Number.isNaN(Number(rated)) ? round2(Number(rated)) : null,
    charge_limit_soc: limit != null ? limit : null,
    charging_state: charging || null,
  }
}

/**
 * Lock or unlock all doors via Fleet POST .../command/door_lock|door_unlock.
 * Requires vehicle_cmds OAuth scope. Many vehicles also need the app virtual key installed; unsigned commands may be rejected.
 *
 * @param {{ action: 'lock' | 'unlock', vehicle_query?: string }} opts
 */
export async function teslaFleetDoorCommand(opts = {}) {
  const action = String(opts?.action || '')
    .trim()
    .toLowerCase()
  if (action !== 'lock' && action !== 'unlock') {
    return { error: 'action must be "lock" or "unlock"' }
  }

  const vehicleQuery = opts?.vehicle_query != null ? String(opts.vehicle_query).trim() : ''
  const cmd = action === 'lock' ? 'door_lock' : 'door_unlock'

  const accessToken = await refreshAccessToken()
  const { res: listRes, data: listData } = await fleetGet(accessToken, '/api/1/vehicles')
  if (!listRes.ok) {
    return { error: `Tesla vehicle list failed: ${listRes.status}` }
  }

  const vehicles = normalizeVehicleList(listData)
  if (!vehicles.length) {
    return { error: 'No vehicles on this account' }
  }

  const v = pickVehicle(vehicles, vehicleQuery)
  if (!v) {
    return {
      error:
        'Could not select a vehicle. Use list_tesla_vehicles or pass vehicle_query (e.g. Model Y, nickname, or VIN).',
    }
  }

  const vin = v.vin || v.id_s
  const displayName = v.display_name || v.name || 'Vehicle'

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

  if (wakeBefore && vin) {
    const vPath = `/api/1/vehicles/${encodeURIComponent(vin)}`
    const { res: stRes, data: stData } = await fleetGet(accessToken, vPath)
    const alreadyOnline = stRes.ok && extractVehicleState(stData) === 'online'
    if (!alreadyOnline) {
      await tryWakeAndWaitOnline(accessToken, vin, wakeTimeoutMs, wakePollMs)
    }
  }

  const path = `/api/1/vehicles/${encodeURIComponent(vin)}/command/${cmd}`
  const { res: cmdRes, data: cmdData } = await fleetPost(accessToken, path, {})

  const inner = cmdData?.response ?? cmdData
  const reason = inner?.reason != null ? String(inner.reason) : ''

  if (!cmdRes.ok) {
    const hint =
      cmdData?.error ||
      cmdData?.error_description ||
      reason ||
      cmdRes.statusText
    return {
      error: `Tesla ${cmd} failed: ${cmdRes.status} ${hint || ''}`.trim(),
      vehicle_name: displayName,
      hint:
        'Ensure OAuth includes vehicle_cmds and the vehicle has this app virtual key paired (Fleet may require signed commands on consumer vehicles).',
    }
  }

  if (inner && inner.result === false && reason) {
    return {
      error: `Tesla ${cmd} rejected: ${reason}`,
      vehicle_name: displayName,
    }
  }

  return {
    ok: true,
    action,
    command: cmd,
    vehicle_name: displayName,
    result: inner ?? null,
  }
}

async function directionsDistanceMiles(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set')

  const params = new URLSearchParams({
    origin,
    destination,
    key,
  })
  const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (data.status !== 'OK' || !data.routes?.[0]) {
    const err = data.error_message || data.status || 'Directions error'
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err))
  }
  const meters = data.routes[0].legs.reduce((s, leg) => s + leg.distance.value, 0)
  return meters * 0.000621371
}

/**
 * @param {{ destination: string, origin_address?: string, vehicle_query?: string }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function estimateTeslaTrip(opts) {
  const dest = String(opts?.destination || '').trim()
  if (!dest) throw new Error('destination is required')

  const originAddress =
    opts?.origin_address != null && String(opts.origin_address).trim()
      ? String(opts.origin_address).trim()
      : null

  const vehicleQuery = opts?.vehicle_query != null ? String(opts.vehicle_query).trim() : ''

  const accessToken = await refreshAccessToken()
  const { res: listRes, data: listData } = await fleetGet(accessToken, '/api/1/vehicles')
  if (!listRes.ok) {
    throw new Error(`Tesla vehicle list failed: ${listRes.status}`)
  }

  const vehicles = normalizeVehicleList(listData)
  if (!vehicles.length) {
    throw new Error('No vehicles on this account')
  }

  const v = pickVehicle(vehicles, vehicleQuery)
  if (!v) {
    return { error: 'Could not select a vehicle. Use list_tesla_vehicles or pass vehicle_query (e.g. Model Y, nickname, or VIN).' }
  }

  const vin = v.vin || v.id_s
  const displayName = v.display_name || v.name || 'Vehicle'

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

  if (wakeBefore && vin) {
    const vPath = `/api/1/vehicles/${encodeURIComponent(vin)}`
    const { res: stRes, data: stData } = await fleetGet(accessToken, vPath)
    const alreadyOnline = stRes.ok && extractVehicleState(stData) === 'online'
    if (!alreadyOnline) {
      await tryWakeAndWaitOnline(accessToken, vin, wakeTimeoutMs, wakePollMs)
    }
  }

  const { res: vdRes, data: vdData } = await fleetGet(accessToken, vehicleDataPath(vin))

  if (vdRes.status === 408) {
    return {
      error:
        'Vehicle data timed out (408 — often asleep). Wake the car from the Tesla app, try again, or set origin_address to your starting address.',
      vehicle_name: displayName,
    }
  }
  if (!vdRes.ok) {
    return {
      error: `Tesla vehicle_data failed: ${vdRes.status} ${vdData?.error || vdData?.error_description || ''}`,
    }
  }

  const cs = extractChargeState(vdData)
  const ds = extractDriveState(vdData)
  const rated = cs?.battery_range
  const pct = cs?.battery_level

  let originStr = null
  if (originAddress) {
    originStr = originAddress
  } else if (ds && typeof ds.latitude === 'number' && typeof ds.longitude === 'number') {
    originStr = `${ds.latitude},${ds.longitude}`
  }

  if (!originStr) {
    return {
      error:
        'No starting point: car has no GPS in this response (enable vehicle_location scope / location sharing), or pass origin_address (e.g. home).',
      vehicle_name: displayName,
      battery_percent: pct,
      rated_range_miles_remaining: rated,
    }
  }

  let milesThere
  let milesBack
  try {
    milesThere = await directionsDistanceMiles(originStr, dest)
    milesBack = await directionsDistanceMiles(dest, originStr)
  } catch (e) {
    return { error: `Directions: ${e.message || e}` }
  }

  const ratedNum = typeof rated === 'number' ? rated : parseFloat(rated)
  const atDest =
    ratedNum != null && !Number.isNaN(ratedNum) ? ratedNum - milesThere : null
  const afterRound =
    ratedNum != null && !Number.isNaN(ratedNum)
      ? ratedNum - milesThere - milesBack
      : null

  return {
    vehicle_name: displayName,
    battery_percent: pct,
    rated_range_miles_remaining:
      ratedNum != null && !Number.isNaN(ratedNum) ? round2(ratedNum) : null,
    miles_to_destination: round2(milesThere),
    miles_return_to_origin: round2(milesBack),
    round_trip_driving_miles: round2(milesThere + milesBack),
    estimated_rated_miles_at_destination: atDest != null ? round2(atDest) : null,
    estimated_rated_miles_after_round_trip: afterRound != null ? round2(afterRound) : null,
    likely_enough_for_outbound: atDest != null ? atDest >= 0 : null,
    likely_enough_for_round_trip: afterRound != null ? afterRound >= 0 : null,
    origin_used: originAddress ? 'origin_address' : 'car_gps',
    disclaimer:
      'Rated miles are rough EPA-style estimates. Real range varies with speed, weather, hills, and driving style—not a guarantee.',
  }
}
