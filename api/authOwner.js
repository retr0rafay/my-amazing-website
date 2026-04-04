/**
 * Shared Firebase Admin auth for allowlisted owner routes (Haven, owner chat, etc.).
 * Env: FIREBASE_SERVICE_ACCOUNT_JSON, OWNER_EMAILS, OWNER_UIDS
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

export function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set')
  const parsed = JSON.parse(raw)
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email/private_key/project_id')
  }
  return parsed
}

export function initFirebaseAdmin() {
  if (getApps().length > 0) return
  const serviceAccount = getServiceAccountFromEnv()
  initializeApp({ credential: cert(serviceAccount) })
}

function parseAllowlist(value) {
  return new Set(
    (value || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  )
}

function requireAllowlistedOwner(decodedToken) {
  const emails = parseAllowlist(process.env.OWNER_EMAILS)
  const uids = parseAllowlist(process.env.OWNER_UIDS)
  const email = (decodedToken.email || '').toLowerCase()
  const uid = (decodedToken.uid || '').toLowerCase()

  if (emails.size === 0 && uids.size === 0) {
    throw new Error('OWNER_EMAILS or OWNER_UIDS must be configured')
  }
  if ((emails.size > 0 && emails.has(email)) || (uids.size > 0 && uids.has(uid))) return
  throw new Error('Forbidden')
}

export async function requireOwner(req, res, next) {
  try {
    initFirebaseAdmin()
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Missing auth token' })
    const decoded = await getAuth().verifyIdToken(token)
    requireAllowlistedOwner(decoded)
    req.owner = decoded
    return next()
  } catch (err) {
    const msg = err.message || 'Unauthorized'
    const status = msg === 'Forbidden' ? 403 : 401
    return res.status(status).json({ error: msg })
  }
}
