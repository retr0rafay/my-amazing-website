/**
 * Home Assistant REST API (owner-only; token never sent to browser).
 * https://developers.home-assistant.io/docs/api/rest/
 *
 * HOME_ASSISTANT_URL must be reachable from this Node process (e.g. Railway).
 * A LAN-only URL (192.168.x.x) will not work from cloud hosting unless you use
 * a tunnel (Nabu Casa remote URL, Cloudflare Tunnel, Tailscale, etc.).
 */

function getConfig() {
  const base = (process.env.HOME_ASSISTANT_URL || '').replace(/\/$/, '')
  const token = process.env.HOME_ASSISTANT_TOKEN || ''
  return { base, token }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function parseJsonBody(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

/**
 * @param {string} entityId
 */
export async function haGetState(entityId) {
  const { base, token } = getConfig()
  if (!base || !token) throw new Error('Home Assistant is not configured')
  const url = `${base}/api/states/${encodeURIComponent(entityId)}`
  const res = await fetch(url, { headers: authHeaders(token) })
  const data = await parseJsonBody(res)
  if (!res.ok) {
    throw new Error(data?.message || data?.error || res.statusText || String(data))
  }
  return data
}

/**
 * @param {string} domain e.g. light
 * @param {string} service e.g. turn_on
 * @param {Record<string, unknown>} body merged service data (entity_id required for most)
 */
export async function haCallService(domain, service, body) {
  const { base, token } = getConfig()
  if (!base || !token) throw new Error('Home Assistant is not configured')
  const url = `${base}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body || {}),
  })
  const data = await parseJsonBody(res)
  if (!res.ok) {
    throw new Error(
      typeof data === 'object' && data !== null && 'message' in data
        ? String(data.message)
        : typeof data === 'string'
          ? data
          : res.statusText,
    )
  }
  return data ?? { success: true }
}

/**
 * @param {string} [domainPrefix] e.g. "light" -> entity_id starts with "light."
 */
export async function haListEntities(domainPrefix) {
  const { base, token } = getConfig()
  if (!base || !token) throw new Error('Home Assistant is not configured')
  const res = await fetch(`${base}/api/states`, { headers: authHeaders(token) })
  const data = await parseJsonBody(res)
  if (!res.ok) {
    throw new Error(typeof data === 'object' && data?.message ? data.message : res.statusText)
  }
  if (!Array.isArray(data)) throw new Error('Unexpected /api/states response')
  const prefix = domainPrefix
    ? `${domainPrefix.trim().replace(/\.$/, '')}.`
    : null
  let rows = prefix
    ? data.filter((s) => s.entity_id && s.entity_id.startsWith(prefix))
    : data.filter((s) => {
        const id = s.entity_id || ''
        return (
          id.startsWith('light.') ||
          id.startsWith('switch.') ||
          id.startsWith('scene.') ||
          id.startsWith('climate.') ||
          id.startsWith('cover.')
        )
      })
  rows = rows.slice(0, 60)
  return rows.map((s) => ({
    entity_id: s.entity_id,
    state: s.state,
    friendly_name: s.attributes?.friendly_name ?? null,
  }))
}
