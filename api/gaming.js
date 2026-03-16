/**
 * PSN Gaming API: last 10 played games with cover art and hours.
 * Set PSN_NPSSO in env (get from https://ca.account.sony.com/api/v1/ssocookie when logged into PlayStation).
 */
import express from 'express'
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getUserPlayedGames,
} from 'psn-api'

const router = express.Router()

// In-memory cache: access token + refresh token. Refresh is used when access expires.
let authCache = null
const CLOCK_SKEW_MS = 60 * 1000 // refresh 1 min before expiry

async function getAuthorization() {
  if (authCache && Date.now() < authCache.accessExpiresAt) {
    return authCache.payload
  }
  // Try refresh token first (no NPSSO needed until refresh expires)
  if (authCache?.refreshToken && Date.now() < authCache.refreshExpiresAt) {
    try {
      const tokenResponse = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken)
      authCache = {
        payload: { accessToken: tokenResponse.accessToken },
        refreshToken: tokenResponse.refreshToken,
        accessExpiresAt: Date.now() + (tokenResponse.expiresIn - 60) * 1000,
        refreshExpiresAt: Date.now() + (tokenResponse.refreshTokenExpiresIn * 1000 - CLOCK_SKEW_MS),
      }
      return authCache.payload
    } catch (e) {
      // Refresh failed (e.g. revoked); fall through to NPSSO
    }
  }
  const npsso = process.env.PSN_NPSSO
  if (!npsso || npsso.length < 10) {
    throw new Error('PSN_NPSSO not set or invalid')
  }
  const accessCode = await exchangeNpssoForAccessCode(npsso)
  const tokenResponse = await exchangeAccessCodeForAuthTokens(accessCode)
  authCache = {
    payload: { accessToken: tokenResponse.accessToken },
    refreshToken: tokenResponse.refreshToken,
    accessExpiresAt: Date.now() + (tokenResponse.expiresIn - 60) * 1000,
    refreshExpiresAt: Date.now() + (tokenResponse.refreshTokenExpiresIn * 1000 - CLOCK_SKEW_MS),
  }
  return authCache.payload
}

/** Parse ISO 8601 duration PT228H56M33S -> { hours, minutes, seconds } */
function parsePlayDuration(str) {
  if (!str || typeof str !== 'string') return { hours: 0, minutes: 0, seconds: 0 }
  const hours = (/(\d+)H/.exec(str) || [0, 0])[1]
  const minutes = (/(\d+)M/.exec(str) || [0, 0])[1]
  const seconds = (/(\d+)S/.exec(str) || [0, 0])[1]
  return {
    hours: parseInt(hours, 10) || 0,
    minutes: parseInt(minutes, 10) || 0,
    seconds: parseInt(seconds, 10) || 0,
  }
}

function playDurationToSeconds(parsed) {
  return (parsed.hours || 0) * 3600 + (parsed.minutes || 0) * 60 + (parsed.seconds || 0)
}

function formatHours(parsed) {
  const totalHours = parsed.hours + parsed.minutes / 60 + parsed.seconds / 3600
  if (totalHours < 1) {
    const m = Math.round(parsed.minutes + parsed.seconds / 60)
    return m <= 0 ? '< 1 hr' : `${m} min`
  }
  const h = Math.floor(totalHours)
  const m = Math.round((totalHours - h) * 60)
  if (m === 0) return `${h} hr`
  return `${h}h ${m}m`
}

/** Normalize name for dedupe: same game + demo → one key; keep the one with more play time. */
function dedupeKey(name) {
  return (name || '')
    .replace(/\s*(?:–|-)?\s*(?:Demo|Trial|Beta|Playable Demo|Free Trial)\s*$/i, '')
    .trim()
    .toLowerCase()
}

router.get('/gaming', async (req, res) => {
  try {
    const authorization = await getAuthorization()
    const limit = 10
    const fetchLimit = 50

    const playedData = await getUserPlayedGames(authorization, 'me', {
      limit: fetchLimit,
      categories: 'ps4_game,ps5_native_game,pspc_game,unknown',
    })

    const allTitles = playedData?.titles || []
    const byKey = new Map()
    for (const t of allTitles) {
      const key = dedupeKey(t.name || t.concept?.name || '')
      if (!key) continue
      const parsed = parsePlayDuration(t.playDuration)
      const seconds = playDurationToSeconds(parsed)
      const existing = byKey.get(key)
      if (!existing || seconds > playDurationToSeconds(parsePlayDuration(existing.playDuration))) {
        byKey.set(key, t)
      }
    }
    const titles = Array.from(byKey.values())
      .sort((a, b) => (b.lastPlayedDateTime || '').localeCompare(a.lastPlayedDateTime || ''))
      .slice(0, limit)

    const games = titles.map((t) => {
      const parsed = parsePlayDuration(t.playDuration)
      const coverUrl =
        t.imageUrl ||
        t.localizedImageUrl ||
        (t.concept?.media?.images?.[0]?.url) ||
        null
      return {
        name: t.name || t.concept?.name || 'Unknown',
        coverUrl,
        playDuration: t.playDuration,
        hoursLabel: formatHours(parsed),
        lastPlayed: t.lastPlayedDateTime || null,
      }
    })

    res.setHeader('Cache-Control', 'public, max-age=300') // 5 min
    res.json({ games })
  } catch (err) {
    console.error('[gaming API]', err.message)
    res.status(500).json({
      error: 'Could not load PSN games',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

export default router
