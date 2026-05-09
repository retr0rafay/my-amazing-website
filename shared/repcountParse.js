/**
 * Parses pasted workout text (exercise names + set lines).
 * Set lines: “125lb x 8”, bare reps “12”, or reps + ignored note “6 This one is wider”.
 */

/** Weight × reps; optional trailing note (e.g. “48lb x 40 Kettlebells”). */
const SET_LINE =
  /^\s*([\d.]+)\s*(lb|lbs|kg|kgs)?\s*[x×]\s*(\d+)\s*.*$/i

/** Bodyweight / reps-only: a single integer (line is only that number). */
const REPS_BARE_LINE = /^\s*(\d+)\s*$/i

/**
 * Reps + trailing note (note ignored). Note must be two or more words so lines like
 * “100 Pushups” stay exercise titles, not “100 reps + Pushups”.
 */
const REPS_AND_NOTE_LINE = /^\s*(\d+)\s+(.+)$/i

function normalizeUnit(raw) {
  if (!raw) return 'lb'
  const u = raw.toLowerCase()
  return u.startsWith('kg') ? 'kg' : 'lb'
}

function stripFooter(lines) {
  return lines.filter((l) => !/^logged using repcount/i.test(l))
}

/**
 * @param {string} raw
 * @returns {{ ok: true, value: { workoutDateMs: number | null, exercises: Array<{ name: string, sets: Array<{ weight: number, unit: string, reps: number }> }> } } | { ok: false, error: string }}
 */
export function parseRepcountWorkout(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: false, error: 'Paste your workout text first.' }

  let lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  lines = stripFooter(lines)

  let workoutDateMs = null
  if (lines.length > 0) {
    const ts = Date.parse(lines[0])
    if (!Number.isNaN(ts)) {
      workoutDateMs = ts
      lines = lines.slice(1)
    }
  }

  /** @type {Array<{ name: string, sets: Array<{ weight: number, unit: string, reps: number }> }>} */
  const exercises = []
  /** @type {{ name: string, sets: Array<{ weight: number, unit: string, reps: number }> } | null} */
  let current = null

  const pushBodyweightSet = (reps) => {
    current.sets.push({
      weight: 0,
      unit: 'lb',
      reps,
    })
  }

  for (const line of lines) {
    const m = line.match(SET_LINE)
    if (m) {
      const weight = Number.parseFloat(m[1])
      const reps = Number.parseInt(m[3], 10)
      if (!current || !Number.isFinite(weight) || !Number.isFinite(reps)) continue
      current.sets.push({
        weight,
        unit: normalizeUnit(m[2]),
        reps,
      })
      continue
    }

    const bare = line.match(REPS_BARE_LINE)
    if (bare && current) {
      const reps = Number.parseInt(bare[1], 10)
      if (Number.isFinite(reps) && reps > 0) pushBodyweightSet(reps)
      continue
    }

    const rn = line.match(REPS_AND_NOTE_LINE)
    if (rn && current) {
      const reps = Number.parseInt(rn[1], 10)
      const note = String(rn[2] ?? '').trim()
      const noteWords = note.split(/\s+/).filter(Boolean)
      let asSet = false
      if (Number.isFinite(reps) && reps > 0) {
        if (noteWords.length >= 2) {
          asSet = true
        } else if (noteWords.length === 1 && reps <= 12) {
          // “6 wide” — ignore short tail; “15 Pushups” as a title stays an exercise (reps > 12).
          asSet = true
        }
      }
      if (asSet) pushBodyweightSet(reps)
      else {
        current = { name: line.slice(0, 240), sets: [] }
        exercises.push(current)
      }
      continue
    }

    current = { name: line.slice(0, 240), sets: [] }
    exercises.push(current)
  }

  const filtered = exercises.filter((e) => e.sets.length > 0)
  if (filtered.length === 0) {
    return {
      ok: false,
      error:
        'Could not find any exercises with sets (e.g. “125lb x 8”, “12”, or “8 slow tempo”). Check the format and try again.',
    }
  }

  if (filtered.length > 80) {
    return { ok: false, error: 'Too many exercises in one workout.' }
  }

  for (const ex of filtered) {
    if (ex.sets.length > 120) {
      return { ok: false, error: 'Too many sets on one exercise.' }
    }
  }

  return {
    ok: true,
    value: {
      workoutDateMs,
      exercises: filtered,
    },
  }
}
