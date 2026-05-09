import { useEffect, useId, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import SEO from '../components/SEO/SEO'
import { auth } from '../lib/firebase'
import { parseRepcountWorkout } from '../../shared/repcountParse.js'
import {
  buildExerciseMaxRepsProgressionSeries,
  buildExerciseProgressionSeries,
  buildExerciseVolumeProgressionSeries,
  exerciseIsBodyweightOnly,
} from '../../shared/workoutProgression.js'
import './Workouts.css'

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function formatWorkoutDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatWeight(w) {
  if (!Number.isFinite(w)) return ''
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10)
}

function volumeForExercise(ex) {
  if (!ex?.sets?.length) return null
  const unit = ex.sets[0]?.unit === 'kg' ? 'kg' : 'lb'
  let vol = 0
  for (const s of ex.sets) {
    if (!Number.isFinite(s.weight) || !Number.isFinite(s.reps)) continue
    vol += s.weight * s.reps
  }
  return { unit, value: Math.round(vol) }
}

/** Best single-set rep count for this exercise block (bodyweight sessions). */
function maxRepsForExercise(ex) {
  if (!ex?.sets?.length) return null
  let m = 0
  for (const s of ex.sets) {
    const r = Number(s.reps)
    if (Number.isFinite(r) && r > m) m = r
  }
  return m > 0 ? m : null
}

function workoutSummary(exercises) {
  const liftCount = exercises.length
  const setCount = exercises.reduce((n, ex) => n + (ex.sets?.length || 0), 0)
  return { liftCount, setCount }
}

function formatChartDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** “Nice” step (1–2–5–10…) so axis labels aren’t arbitrary fractions. */
function niceStepForSpan(span, integersOnly) {
  if (!Number.isFinite(span) || span <= 0) return integersOnly ? 1 : 1
  const target = span / 5
  if (integersOnly) {
    const t = Math.max(1, Math.ceil(target))
    if (t <= 1) return 1
    if (t <= 2) return 2
    if (t <= 5) return 5
    if (t <= 10) return 10
    const pow = 10 ** Math.floor(Math.log10(t))
    const b = t / pow
    const nb = b <= 1 ? 1 : b <= 2 ? 2 : b <= 5 ? 5 : 10
    return nb * pow
  }
  const exp = Math.floor(Math.log10(target))
  const f = target / 10 ** exp
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * 10 ** exp
}

/**
 * Chart Y domain + tick values: reps use whole-number grid only; weight/volume use round steps.
 * Plot still uses raw point values; hover keeps exact numbers.
 */
function buildChartYAxis(values, metric) {
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const integersOnly = metric === 'maxReps'

  if (lo === hi) {
    const pad =
      metric === 'volume'
        ? 50
        : metric === 'maxReps'
          ? Math.max(2, Math.round(lo * 0.15) || 2)
          : Math.max(5, lo * 0.08 || 5)
    lo = Math.max(0, lo - pad)
    hi = hi + pad
  } else {
    const pad = (hi - lo) * 0.08
    lo = Math.max(0, lo - pad)
    hi = hi + pad
  }

  if (integersOnly) {
    lo = Math.floor(lo)
    hi = Math.ceil(hi)
    if (lo === hi) hi = lo + 1
  }

  const span = hi - lo || 1
  const step = niceStepForSpan(span, integersOnly)
  const axisMin = Math.floor(lo / step) * step
  const axisMax = Math.ceil(hi / step) * step

  const tickValues = []
  let v = axisMin
  let guard = 0
  while (v <= axisMax + step * 1e-9 && guard < 48) {
    const tick = integersOnly ? Math.round(v) : Math.round(v * 1000) / 1000
    tickValues.push(tick)
    v += step
    guard++
  }

  return { minY: axisMin, maxY: axisMax, tickValues, step }
}

/** SVG line chart: X = session date, Y = max lb, volume lb, or max reps (BW). */
function ProgressionChart({ series, exerciseName, compact, metric = 'maxWeight' }) {
  const chartUid = useId()
  const [hoverDotKey, setHoverDotKey] = useState(null)

  const chartGeom = useMemo(() => {
    const W = 640
    const H = compact ? 230 : 280
    const padL = 54
    const padR = 16
    const padT = compact ? 16 : 20
    const padB = compact ? 40 : 48
    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW: W - padL - padR,
      plotH: H - padT - padB,
    }
  }, [compact])

  const { polylinePoints, circles, yTicks, xLabels } = useMemo(() => {
    const { H, padL, padR, padT, padB, plotW, plotH } = chartGeom
    if (!series?.length) {
      return { polylinePoints: '', circles: [], yTicks: [], xLabels: [] }
    }

    const values = series.map((p) => p.value)
    const { minY, maxY, tickValues, step: yStep } = buildChartYAxis(values, metric)

    const times = series.map((p) => p.dateMs)
    const minT = Math.min(...times)
    const maxT = Math.max(...times)
    const tRange = maxT - minT || 1

    const xAt = (t) => padL + ((t - minT) / tRange) * plotW
    const yAt = (v) => padT + plotH - ((v - minY) / (maxY - minY || 1)) * plotH

    const fmtYTick = (tick) => {
      if (metric === 'volume' && tick >= 10000) return `${Math.round(tick / 1000)}k`
      if (metric === 'maxReps') return String(Math.round(tick))
      if (metric === 'volume' || (Number.isFinite(yStep) && yStep >= 1)) {
        return String(Math.round(tick))
      }
      const rounded = Math.round(tick)
      if (Math.abs(tick - rounded) < 1e-6) return String(rounded)
      return tick.toFixed(1)
    }

    const ptTitle = (p) => {
      const d = formatChartDate(p.dateMs)
      if (metric === 'volume') {
        return `${d} — ${Math.round(p.value).toLocaleString()} lb volume`
      }
      if (metric === 'maxReps') {
        return `${d} — ${Math.round(p.value)} reps max`
      }
      return `${d} — ${formatWeight(p.value)} lb max`
    }

    const pts = series.map((p) => `${xAt(p.dateMs)},${yAt(p.value)}`)
    const poly = pts.join(' ')

    const circs = series.map((p, i) => ({
      key: `${p.dateMs}-${i}`,
      cx: xAt(p.dateMs),
      cy: yAt(p.value),
      title: ptTitle(p),
      valueLabel:
        metric === 'volume'
          ? `${Math.round(p.value).toLocaleString()} lb`
          : metric === 'maxReps'
            ? `${Math.round(p.value)} reps`
            : `${formatWeight(p.value)} lb`,
    }))

    const yTicksLocal = tickValues.map((tv) => ({
      y: yAt(tv),
      label: fmtYTick(tv),
    }))

    const maxLabels = 6
    const step = Math.max(1, Math.ceil(series.length / maxLabels))
    const idxSet = new Set()
    for (let i = 0; i < series.length; i += step) idxSet.add(i)
    idxSet.add(series.length - 1)
    const xLabelsLocal = [...idxSet]
      .sort((a, b) => a - b)
      .map((i) => ({
        x: xAt(series[i].dateMs),
        label: formatChartDate(series[i].dateMs),
      }))

    return {
      polylinePoints: poly,
      circles: circs,
      yTicks: yTicksLocal,
      xLabels: xLabelsLocal,
    }
  }, [series, chartGeom, metric])

  if (!series?.length) {
    return (
      <p className="workouts__progression-empty">
        No sessions found for “
        {exerciseName}
        ” yet.
      </p>
    )
  }

  const titleId = `${chartUid}-title`
  const descId = `${chartUid}-desc`
  const { W, H, padL, padT, plotW, plotH } = chartGeom

  const hoveredDot = hoverDotKey ? circles.find((c) => c.key === hoverDotKey) : null
  let hoveredTipY
  let hoveredTipTw
  let hoveredTipTx
  if (hoveredDot) {
    const margin = 12
    let tipY = hoveredDot.cy - 26
    if (tipY < padT + margin) tipY = hoveredDot.cy + 26
    if (tipY > padT + plotH - margin) tipY = hoveredDot.cy - 26
    hoveredTipY = tipY
    hoveredTipTw = Math.max(hoveredDot.valueLabel.length * 7 + 14, 52)
    hoveredTipTx = hoveredDot.cx - hoveredTipTw / 2
  }

  return (
    <figure
      className={`workouts__progression-chart${compact ? ' workouts__progression-chart--compact' : ''}`}
    >
      <figcaption id={titleId} className="workouts__progression-caption">
        {metric === 'volume'
          ? 'Volume per session — '
          : metric === 'maxReps'
            ? 'Max reps per session — '
            : 'Max weight per session — '}
        {exerciseName}
      </figcaption>
      <p id={descId} className="workouts__sr-only">
        {metric === 'volume'
          ? 'Line chart of total training volume in pound-reps per session. Horizontal axis is date; vertical axis is volume.'
          : metric === 'maxReps'
            ? 'Line chart of maximum reps on a single set per session for bodyweight exercises. Horizontal axis is date; vertical axis is reps.'
            : 'Line chart of maximum weight in pounds for each logged session. Horizontal axis is date; vertical axis is weight.'}
      </p>
      <svg
        className="workouts__progression-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="rgba(34, 211, 238, 0.04)"
          stroke="rgba(148, 230, 255, 0.18)"
          strokeWidth={1}
          rx={8}
        />
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={padL}
              y1={t.y}
              x2={padL + plotW}
              y2={t.y}
              stroke="rgba(148, 230, 255, 0.1)"
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="workouts__progression-axis-text"
              fill="currentColor"
            >
              {t.label}
            </text>
          </g>
        ))}
        <text
          x={16}
          y={(padT + plotH / 2).toFixed(0)}
          transform={`rotate(-90 16 ${padT + plotH / 2})`}
          className="workouts__progression-axis-label"
          fill="currentColor"
        >
          {metric === 'volume' ? 'Volume (lb)' : metric === 'maxReps' ? 'Reps' : 'Weight (lb)'}
        </text>
        <polyline
          fill="none"
          stroke="var(--persona-cyan, #22d3ee)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
        {circles.map((c) => (
          <g key={c.key}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={5}
              fill="rgba(12, 20, 32, 0.95)"
              stroke="var(--persona-cyan, #22d3ee)"
              strokeWidth={2}
              pointerEvents="none"
            />
            <circle
              cx={c.cx}
              cy={c.cy}
              r={14}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverDotKey(c.key)}
              onMouseLeave={() => setHoverDotKey(null)}
            >
              <title>{c.title}</title>
            </circle>
          </g>
        ))}
        {hoveredDot && (
          <g className="workouts__progression-dot-tip" pointerEvents="none">
            <rect
              className="workouts__progression-dot-tip-bg"
              x={hoveredTipTx}
              y={hoveredTipY - 11}
              width={hoveredTipTw}
              height={22}
              rx={6}
            />
            <text
              className="workouts__progression-dot-tip-text"
              x={hoveredDot.cx}
              y={hoveredTipY}
              dominantBaseline="middle"
              textAnchor="middle"
            >
              {hoveredDot.valueLabel}
            </text>
          </g>
        )}
        {xLabels.map((xl, i) => (
          <text
            key={`xl-${i}`}
            x={xl.x}
            y={H - 12}
            textAnchor="middle"
            className="workouts__progression-axis-text workouts__progression-axis-text--x"
            fill="currentColor"
          >
            {xl.label}
          </text>
        ))}
      </svg>
      <p className="workouts__progression-note">
        {metric === 'volume'
          ? (compact
              ? 'Volume = Σ (weight × reps) per session, lb.'
              : 'Volume sums every set for this lift that session (weight × reps), all in lb.')
          : metric === 'maxReps'
            ? (compact
                ? 'Best single set by reps (bodyweight only).'
                : 'Y-axis is the heaviest set by rep count that session; only exercises logged with BW (no added weight).')
            : (compact
                ? 'Max weight per session (lb); kg converted.'
                : 'Y-axis is max weight that session (heaviest set). Mixed kg/lb logs are converted to lb for one scale.')}
      </p>
    </figure>
  )
}

async function compressImageIfNeeded(inputFile) {
  if (!inputFile.type.startsWith('image/')) return inputFile
  const targetMime = 'image/webp'
  const maxSide = 1600
  const quality = 0.82

  const bitmap = await createImageBitmap(inputFile)
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * ratio))
  const height = Math.max(1, Math.round(bitmap.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const compressed = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Image compression failed'))
      resolve(blob)
    }, targetMime, quality)
  })

  if (compressed.size >= inputFile.size) return inputFile
  return new File([compressed], inputFile.name.replace(/\.[^.]+$/, '.webp'), { type: targetMime })
}

function ExerciseMiniCard({ exercise, allWorkouts, preview }) {
  const [chartOpen, setChartOpen] = useState(false)
  const [chartMetric, setChartMetric] = useState('maxWeight')
  const vol = volumeForExercise(exercise)
  const maxReps = maxRepsForExercise(exercise)
  const isBwExercise = useMemo(() => {
    if (preview) {
      const sets = exercise.sets || []
      return (
        sets.length > 0 &&
        sets.every((s) => !Number.isFinite(Number(s.weight)) || Number(s.weight) <= 0)
      )
    }
    return exerciseIsBodyweightOnly(allWorkouts || [], exercise.name)
  }, [preview, exercise.sets, exercise.name, allWorkouts])

  const series = useMemo(() => {
    if (isBwExercise) {
      return buildExerciseMaxRepsProgressionSeries(allWorkouts || [], exercise.name)
    }
    if (chartMetric === 'volume') {
      return buildExerciseVolumeProgressionSeries(allWorkouts || [], exercise.name)
    }
    return buildExerciseProgressionSeries(allWorkouts || [], exercise.name)
  }, [allWorkouts, exercise.name, chartMetric, isBwExercise])
  const showProgression = !preview && Array.isArray(allWorkouts)

  return (
    <section className="workouts__exercise workouts__exercise--mini">
      <div className="workouts__exercise-head">
        <div className="workouts__exercise-title-row">
          <h3 className="workouts__exercise-name">{exercise.name}</h3>
          {showProgression ? (
            <button
              type="button"
              className="workouts__mini-prog-btn"
              onClick={() => setChartOpen((o) => !o)}
              aria-expanded={chartOpen}
            >
              <span>{chartOpen ? 'Hide' : 'Progression'}</span>
              <span className="workouts__mini-prog-chevron" aria-hidden>
                {chartOpen ? '▴' : '▾'}
              </span>
            </button>
          ) : null}
        </div>
        {isBwExercise && maxReps != null ? (
          <span className="workouts__volume" title="Best set this session">
            Max
            {' '}
            {maxReps.toLocaleString()}
            {' '}
            reps
          </span>
        ) : !isBwExercise && vol != null ? (
          <span className="workouts__volume" title="Volume (weight × reps)">
            Σ {vol.value.toLocaleString()}
            {vol.unit}
          </span>
        ) : null}
      </div>
      <ul className="workouts__sets">
        {exercise.sets.map((s, j) => (
          <li key={`${exercise.name}-set-${j}`} className="workouts__set">
            <span className="workouts__set-weight">
              {s.weight > 0 ? (
                <>
                  {formatWeight(s.weight)}
                  {s.unit === 'kg' ? 'kg' : 'lb'}
                </>
              ) : (
                'BW'
              )}
            </span>
            <span className="workouts__set-x">×</span>
            <span className="workouts__set-reps">{s.reps}</span>
          </li>
        ))}
      </ul>
      {showProgression && chartOpen ? (
        <div className="workouts__mini-prog-panel">
          {!isBwExercise ? (
            <div className="workouts__chart-metric" role="group" aria-label="Chart type">
              <button
                type="button"
                className={`workouts__chart-metric-btn${chartMetric === 'maxWeight' ? ' is-active' : ''}`}
                onClick={() => setChartMetric('maxWeight')}
              >
                Max weight
              </button>
              <button
                type="button"
                className={`workouts__chart-metric-btn${chartMetric === 'volume' ? ' is-active' : ''}`}
                onClick={() => setChartMetric('volume')}
              >
                Volume
              </button>
            </div>
          ) : null}
          <ProgressionChart
            series={series}
            exerciseName={exercise.name}
            compact
            metric={isBwExercise ? 'maxReps' : chartMetric}
          />
        </div>
      ) : null}
    </section>
  )
}

function WorkoutCardBody({ exercises, allWorkouts, preview }) {
  return (
    <div className="workouts__card-body">
      {exercises.map((ex, i) => (
        <ExerciseMiniCard
          key={`${ex.name}-${i}`}
          exercise={ex}
          allWorkouts={allWorkouts}
          preview={preview}
        />
      ))}
    </div>
  )
}

function WorkoutCard({
  exercises,
  dateMs,
  photoUrl,
  showPlaceholderVisual,
  footerExtra,
  actions,
  preview,
  allWorkouts,
}) {
  const { liftCount, setCount } = workoutSummary(exercises)
  const hasPhoto = !!photoUrl

  return (
    <article
      className={
        `workouts__card${preview ? ' workouts__card--preview' : ''}${hasPhoto ? ' workouts__card--has-photo' : ' workouts__card--no-photo'}`
      }
    >
      <div className="workouts__card-layout">
        {(hasPhoto || showPlaceholderVisual) && (
          <div
            className={
              `workouts__card-visual${hasPhoto ? '' : ' workouts__card-visual--placeholder'}`
            }
          >
            {hasPhoto ? (
              <>
                <img src={photoUrl} alt="" className="workouts__card-photo" decoding="async" />
                <div className="workouts__card-photo-scrim" aria-hidden />
              </>
            ) : (
              <div className="workouts__card-photo-fallback" aria-hidden />
            )}
            <div className="workouts__card-visual-badge">
              <time dateTime={dateMs ? new Date(dateMs).toISOString() : undefined}>
                {dateMs ? formatWorkoutDate(dateMs) : 'Session'}
              </time>
            </div>
          </div>
        )}

        <div className="workouts__card-main">
          {!hasPhoto && !showPlaceholderVisual && (
            <header className="workouts__card-topbar">
              <div className="workouts__card-topbar-text">
                <p className="workouts__card-kicker">Training log</p>
                <time className="workouts__card-date" dateTime={dateMs ? new Date(dateMs).toISOString() : undefined}>
                  {dateMs ? formatWorkoutDate(dateMs) : 'Session'}
                </time>
              </div>
              {actions ? <div className="workouts__card-actions">{actions}</div> : null}
            </header>
          )}

          {(hasPhoto || showPlaceholderVisual) && (
            <header className="workouts__card-toolbar">
              <div className="workouts__card-meta">
                {hasPhoto && !preview ? (
                  <time
                    className="workouts__card-toolbar-date"
                    dateTime={dateMs ? new Date(dateMs).toISOString() : undefined}
                  >
                    {dateMs ? formatWorkoutDate(dateMs) : 'Session'}
                  </time>
                ) : null}
                <span className="workouts__pill">{liftCount} lifts</span>
                <span className="workouts__pill">{setCount} sets</span>
              </div>
              {actions ? <div className="workouts__card-actions">{actions}</div> : null}
            </header>
          )}

          {!hasPhoto && !showPlaceholderVisual ? (
            <div className="workouts__card-meta workouts__card-meta--inline">
              <span className="workouts__pill">{liftCount} lifts</span>
              <span className="workouts__pill">{setCount} sets</span>
            </div>
          ) : null}

          <WorkoutCardBody exercises={exercises} allWorkouts={allWorkouts} preview={!!preview} />

          {footerExtra ? (
            <footer className="workouts__card-foot">
              <span className="workouts__card-foot-extra">{footerExtra}</span>
            </footer>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function Workouts() {
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [listStatus, setListStatus] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const ownerEmails = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_EMAILS), [])
  const ownerUids = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_UIDS), [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null)
    })
    return () => unsub()
  }, [])

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
  }, [photoPreviewUrl])

  const isOwner = !!user && (
    (user.email && ownerEmails.includes(user.email.toLowerCase())) ||
    (user.uid && ownerUids.includes(user.uid.toLowerCase()))
  )

  const previewParsed = useMemo(() => parseRepcountWorkout(pasteText), [pasteText])

  function onPhotoPick(nextFile) {
    setPhotoFile(nextFile || null)
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return nextFile ? URL.createObjectURL(nextFile) : ''
    })
  }

  function clearPhoto() {
    onPhotoPick(null)
  }

  async function loadWorkouts() {
    try {
      setLoading(true)
      const res = await fetch(`/api/haven/workouts?limit=250&t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Could not load workouts')
      const payload = await res.json()
      setItems(Array.isArray(payload.items) ? payload.items : [])
      setListStatus('')
    } catch {
      setListStatus('Could not load workouts right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkouts()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!user || !isOwner || isSaving) return
    const rawText = pasteText.trim()
    if (!rawText) {
      setSaveStatus('Paste your workout text first.')
      return
    }
    const parsed = parseRepcountWorkout(rawText)
    if (!parsed.ok) {
      setSaveStatus(parsed.error)
      return
    }
    try {
      setIsSaving(true)
      setSaveStatus('Saving...')
      const token = await user.getIdToken()

      let photoPayload = {}
      if (photoFile) {
        setSaveStatus('Optimizing photo...')
        const uploadFile = await compressImageIfNeeded(photoFile)
        const signedRes = await fetch('/api/haven/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: uploadFile.name,
            contentType: uploadFile.type || 'application/octet-stream',
            mediaType: 'image',
          }),
        })
        if (!signedRes.ok) throw new Error('Could not get upload URL')
        const { uploadUrl, objectPath } = await signedRes.json()

        setSaveStatus('Uploading photo...')
        const ct = uploadFile.type || 'application/octet-stream'
        const bytes = await uploadFile.arrayBuffer()
        if (!bytes.byteLength) throw new Error('Photo file is empty.')

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ct },
          body: bytes,
        })
        if (!uploadRes.ok) {
          const detail = (await uploadRes.text()).slice(0, 280)
          throw new Error(
            detail ? `Photo upload failed (${uploadRes.status}): ${detail}` : `Photo upload failed (${uploadRes.status}).`,
          )
        }

        photoPayload = {
          photoObjectPath: objectPath,
          photoContentType: uploadFile.type || 'application/octet-stream',
          photoMediaType: 'image',
          photoSizeBytes: uploadFile.size,
        }
      }

      setSaveStatus('Saving workout...')
      const res = await fetch('/api/haven/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawText, ...photoPayload }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Could not save workout')
      }
      const saveBody = await res.json()
      setPasteText('')
      clearPhoto()
      setSaveStatus('Saved.')
      await loadWorkouts()
      // GET list can briefly omit a just-written doc; upsert the POST payload so the UI matches preview.
      if (saveBody?.item && saveBody?.id) {
        setItems((prev) => {
          const rest = prev.filter((w) => w.id !== saveBody.id)
          return [...rest, saveBody.item]
        })
      }
    } catch (err) {
      setSaveStatus(err.message || 'Could not save workout.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!user || !isOwner || !id) return
    try {
      setDeletingId(id)
      const token = await user.getIdToken()
      const res = await fetch(`/api/haven/workouts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Could not delete workout')
      setSaveStatus('Workout removed.')
      setItems((prev) => prev.filter((w) => w.id !== id))
    } catch {
      setSaveStatus('Could not delete workout.')
    } finally {
      setDeletingId('')
    }
  }

  function displayMs(workout) {
    return workout.workoutDateMs ?? workout.createdAtMs ?? null
  }

  const previewDateMs = previewParsed.ok ? previewParsed.value.workoutDateMs : null
  const previewExercises = previewParsed.ok ? previewParsed.value.exercises : []

  /** Newest session date first (matches card date: workout date, else save/sort time). */
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.workoutDateMs ?? a.createdAtMs ?? null
      const tb = b.workoutDateMs ?? b.createdAtMs ?? null
      if (ta == null && tb == null) return String(a.id).localeCompare(String(b.id))
      if (ta == null) return 1
      if (tb == null) return -1
      const diff = tb - ta
      if (diff !== 0) return diff
      return String(b.id).localeCompare(String(a.id))
    })
  }, [items])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))

  useEffect(() => {
    setPage((prev) => {
      const tp = Math.max(1, Math.ceil(sortedItems.length / pageSize))
      return Math.min(Math.max(1, prev), tp)
    })
  }, [sortedItems.length, pageSize])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [sortedItems, page, pageSize])

  return (
    <main className="workouts page">
      <SEO
        title="Workouts"
        description="Training log — pasted workouts and optional photos."
        path="/workouts"
      />
      <div className="workouts__inner">
        <header className="workouts__intro">
          <h1 className="workouts__title">Workouts</h1>
        </header>

        {isOwner && (
          <form className="workouts__form" onSubmit={handleSave}>
            <label className="workouts__label" htmlFor="workouts-paste">
              Paste workout
            </label>
            <textarea
              id="workouts-paste"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'May 8, 2026\n\nBench Press\n135lb x 5\n...'}
              spellCheck={false}
            />

            <div className="workouts__photo-field">
              <span className="workouts__label workouts__label--inline">Photo that day</span>
              <span className="workouts__photo-hint">Optional · JPEG / PNG / WebP</span>
              <div className="workouts__photo-row">
                <label className="workouts__file-btn">
                  <input
                    type="file"
                    accept="image/*"
                    className="workouts__file-input"
                    onChange={(e) => onPhotoPick(e.target.files?.[0] || null)}
                  />
                  Choose image
                </label>
                {photoFile ? (
                  <button type="button" className="workouts__btn workouts__btn--ghost workouts__btn--sm" onClick={clearPhoto}>
                    Remove
                  </button>
                ) : null}
              </div>
              {photoPreviewUrl ? (
                <img className="workouts__photo-thumb" src={photoPreviewUrl} alt="Your preview" />
              ) : null}
            </div>

            <div className="workouts__actions">
              <button className="workouts__btn" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save workout'}
              </button>
            </div>
            <p className="workouts__state">
              {pasteText.length.toLocaleString()}
              {' '}
              characters
              {saveStatus ? ` · ${saveStatus}` : ''}
            </p>
          </form>
        )}

        {isOwner && pasteText.trim() && (
          <div className="workouts__preview-wrap">
            <p className="workouts__preview-label">Preview</p>
            {previewParsed.ok ? (
              <WorkoutCard
                preview
                exercises={previewExercises}
                dateMs={previewDateMs}
                photoUrl={photoPreviewUrl || undefined}
                showPlaceholderVisual={!photoPreviewUrl}
                footerExtra={previewDateMs ? null : 'No date line detected · ordering uses save time'}
              />
            ) : (
              <p className="workouts__preview-error">{previewParsed.error}</p>
            )}
          </div>
        )}

        {loading && <p className="workouts__state">Loading workouts…</p>}
        {listStatus && <p className="workouts__state">{listStatus}</p>}
        {!loading && sortedItems.length === 0 && !listStatus && (
          <p className="workouts__state">No workouts logged yet.</p>
        )}

        {sortedItems.length > 0 && (
          <>
            <div className="workouts__pager workouts__pager--top">
              <label className="workouts__pager-label">
                Per page
                <select
                  className="workouts__pager-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  aria-label="Workouts per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
              <span className="workouts__pager-meta">
                {(page - 1) * pageSize + 1}
                –
                {Math.min(page * pageSize, sortedItems.length)}
                {' '}
                of
                {' '}
                {sortedItems.length}
              </span>
            </div>
            <ul className="workouts__list">
              {paginatedItems.map((w) => (
                <li key={w.id}>
                  <WorkoutCard
                    exercises={w.exercises}
                    dateMs={displayMs(w)}
                    photoUrl={w.photoUrl || undefined}
                    showPlaceholderVisual={!w.photoUrl}
                    allWorkouts={sortedItems}
                    actions={isOwner ? (
                      <button
                        type="button"
                        className="workouts__icon-btn"
                        onClick={() => handleDelete(w.id)}
                        disabled={deletingId === w.id}
                        title="Delete workout"
                      >
                        {deletingId === w.id ? '…' : '✕'}
                      </button>
                    ) : null}
                  />
                </li>
              ))}
            </ul>
            <nav className="workouts__pager workouts__pager--bottom" aria-label="Workout pages">
              <button
                type="button"
                className="workouts__btn workouts__btn--ghost workouts__btn--sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="workouts__pager-page">
                Page
                {' '}
                {page}
                {' '}
                of
                {' '}
                {totalPages}
              </span>
              <button
                type="button"
                className="workouts__btn workouts__btn--ghost workouts__btn--sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </nav>
          </>
        )}
      </div>
    </main>
  )
}
