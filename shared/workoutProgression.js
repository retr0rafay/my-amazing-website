/** Convert to lb for a single scale when mixing kg/lb across sessions. */
export function weightToLb(weight, unit) {
  if (!Number.isFinite(weight)) return NaN
  return unit === 'kg' ? weight * 2.2046226218 : weight
}

/**
 * One point per workout session: max weight for the named exercise (all sets), in lb.
 * @param {Array<{ workoutDateMs?: number|null, createdAtMs?: number, exercises?: Array<{ name: string, sets?: Array<{ weight: number, unit?: string, reps?: number }> }> }>} items
 * @param {string} exerciseName — exact match to logged exercise name (trimmed)
 * @returns {Array<{ dateMs: number, value: number }>}
 */
export function buildExerciseProgressionSeries(items, exerciseName) {
  const target = String(exerciseName || '').trim()
  if (!target || !Array.isArray(items)) return []

  const points = []
  for (const w of items) {
    const t = Number(w?.workoutDateMs ?? w?.createdAtMs)
    if (!Number.isFinite(t) || t <= 0) continue

    const blocks = (w.exercises || []).filter((e) => String(e?.name || '').trim() === target)
    if (!blocks.length) continue

    let maxLb = -Infinity
    for (const ex of blocks) {
      for (const s of ex.sets || []) {
        const u = s?.unit === 'kg' ? 'kg' : 'lb'
        const lb = weightToLb(s?.weight, u)
        if (Number.isFinite(lb)) maxLb = Math.max(maxLb, lb)
      }
    }
    if (maxLb <= -Infinity) continue
    points.push({ dateMs: t, value: maxLb })
  }

  points.sort((a, b) => a.dateMs - b.dateMs)
  return points
}

/**
 * One point per session: total volume (Σ weight × reps) for the named exercise, weights in lb.
 * @returns {Array<{ dateMs: number, value: number }>}
 */
export function buildExerciseVolumeProgressionSeries(items, exerciseName) {
  const target = String(exerciseName || '').trim()
  if (!target || !Array.isArray(items)) return []

  const points = []
  for (const w of items) {
    const t = Number(w?.workoutDateMs ?? w?.createdAtMs)
    if (!Number.isFinite(t) || t <= 0) continue

    const blocks = (w.exercises || []).filter((e) => String(e?.name || '').trim() === target)
    if (!blocks.length) continue

    let vol = 0
    for (const ex of blocks) {
      for (const s of ex.sets || []) {
        const u = s?.unit === 'kg' ? 'kg' : 'lb'
        const lb = weightToLb(s?.weight, u)
        const reps = Number(s?.reps)
        if (Number.isFinite(lb) && Number.isFinite(reps) && reps >= 0) vol += lb * reps
      }
    }
    if (vol <= 0) continue
    points.push({ dateMs: t, value: vol })
  }

  points.sort((a, b) => a.dateMs - b.dateMs)
  return points
}

/** True if this exercise name appears with at least one set and every set has weight ≤ 0 (bodyweight / BW). */
export function exerciseIsBodyweightOnly(items, exerciseName) {
  const target = String(exerciseName || '').trim()
  if (!target || !Array.isArray(items)) return false
  let sawSet = false
  for (const w of items) {
    for (const ex of w.exercises || []) {
      if (String(ex?.name || '').trim() !== target) continue
      for (const s of ex.sets || []) {
        sawSet = true
        const wt = Number(s?.weight)
        if (Number.isFinite(wt) && wt > 0) return false
      }
    }
  }
  return sawSet
}

/**
 * One point per session: max reps on any set for this exercise (bodyweight-only lifts).
 * @returns {Array<{ dateMs: number, value: number }>}
 */
export function buildExerciseMaxRepsProgressionSeries(items, exerciseName) {
  const target = String(exerciseName || '').trim()
  if (!target || !Array.isArray(items)) return []

  const points = []
  for (const w of items) {
    const t = Number(w?.workoutDateMs ?? w?.createdAtMs)
    if (!Number.isFinite(t) || t <= 0) continue

    const blocks = (w.exercises || []).filter((e) => String(e?.name || '').trim() === target)
    if (!blocks.length) continue

    let maxReps = -Infinity
    let hasWeightedSet = false
    for (const ex of blocks) {
      for (const s of ex.sets || []) {
        const wt = Number(s?.weight)
        if (Number.isFinite(wt) && wt > 0) {
          hasWeightedSet = true
          break
        }
        const reps = Number(s?.reps)
        if (Number.isFinite(reps) && reps >= 0) maxReps = Math.max(maxReps, reps)
      }
      if (hasWeightedSet) break
    }
    if (hasWeightedSet || maxReps <= -Infinity) continue
    points.push({ dateMs: t, value: maxReps })
  }

  points.sort((a, b) => a.dateMs - b.dateMs)
  return points
}

/**
 * @param {Array<{ exercises?: Array<{ name?: string }> }>} items
 * @returns {string[]} sorted unique exercise names
 */
export function listExerciseNamesFromWorkouts(items) {
  const set = new Set()
  for (const w of items || []) {
    for (const ex of w.exercises || []) {
      const n = String(ex?.name || '').trim()
      if (n) set.add(n)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Unique exercise names from a single session’s exercise list (order-preserving names, sorted). */
export function listExerciseNamesFromExercises(exercises) {
  const set = new Set()
  for (const ex of exercises || []) {
    const n = String(ex?.name || '').trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
