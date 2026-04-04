/**
 * Trip range estimates for the A2A agent: Tesla Fleet (rated miles) + Google Directions.
 *
 * Env: GOOGLE_MAPS_API_KEY (Directions API enabled), same Tesla vars as teslaChargeNotify.
 * Optional: TESLA_VIN_FILTER, TESLA_WAKE_BEFORE_NOTIFY, wake timeouts.
 * OAuth: vehicle_device_data; car GPS needs vehicle_location. vehicle_cmds if wake is used.
 */
import {
  refreshAccessToken,
  fleetGet,
  extractChargeState,
  extractVehicleState,
  tryWakeAndWaitOnline,
} from './teslaChargeNotify.js'

function extractDriveState(vdData) {
  const root = vdData?.response ?? vdData
  return root?.drive_state ?? root?.vehicle?.drive_state ?? null
}

function round2(x) {
  return Math.round(x * 100) / 100
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
 * @param {{ destination: string, origin_address?: string }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function estimateTeslaTrip(opts) {
  const dest = String(opts?.destination || '').trim()
  if (!dest) throw new Error('destination is required')

  const originAddress =
    opts?.origin_address != null && String(opts.origin_address).trim()
      ? String(opts.origin_address).trim()
      : null

  const accessToken = await refreshAccessToken()
  const { res: listRes, data: listData } = await fleetGet(accessToken, '/api/1/vehicles')
  if (!listRes.ok) {
    throw new Error(`Tesla vehicle list failed: ${listRes.status}`)
  }

  let vehicles = listData?.response
  if (vehicles && !Array.isArray(vehicles) && Array.isArray(vehicles.vehicles)) {
    vehicles = vehicles.vehicles
  }
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    throw new Error('No vehicles on this account')
  }

  const vinFilter = process.env.TESLA_VIN_FILTER
    ? process.env.TESLA_VIN_FILTER.split(',').map((v) => v.trim().toUpperCase())
    : null

  let v = vehicles[0]
  if (vinFilter?.length) {
    const found = vehicles.find((x) =>
      vinFilter.includes(String(x.vin || x.id_s || '').toUpperCase()),
    )
    if (found) v = found
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

  const { res: vdRes, data: vdData } = await fleetGet(
    accessToken,
    `/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data`,
  )

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
