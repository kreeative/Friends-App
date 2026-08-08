import { useMemo, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * Consistency over time, as a smooth area with a readout pinned to one point.
 *
 * Built to the reference: a spline rather than a polyline, a fill that fades
 * out under it, a vertical drop from the marker to the baseline, and a dark
 * pill carrying the value. The curve is the point, a straight-segment chart
 * of the same numbers reads as a jagged fever line, which says "volatile"
 * about data that is nothing of the sort.
 *
 * It sits on the theme's ink with the line in yellow. That pairing is what
 * lets every word on the card be white: white on the yellow this used to use
 * as a ground measures 1.4:1, so as a surface it forced black type. As a
 * stroke on a dark ground the same yellow measures about 4.5:1, which is well
 * clear of the 3:1 a graphic needs, and the type above it is at 7:1.
 */

const W = 600
const H = 250
/* The top pad clears the readout pill, which is pinned above the plot rather
   than floating inside it. Overlapping the top gridline made both unreadable. */
const PAD = { top: 46, right: 14, bottom: 28, left: 40 }
const INNER = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

/**
 * The vertical range the curve is drawn in.
 *
 * Not a fixed 0–100. Consistency is a number people keep in the top third, so
 * a fixed axis draws every real series as a flat line pinned to the ceiling
 * with two thirds of the card empty underneath. Technically faithful and
 * completely unreadable. The window follows the data with a margin, and
 * because the axis is labelled with its actual values nothing is being
 * overstated: you can see what range you are looking at.
 *
 * A minimum span stops a genuinely flat run from being magnified into drama.
 */
const MIN_SPAN = 28

function domain(values) {
  let lo = Math.max(0, Math.min(...values) - 6)
  let hi = Math.min(100, Math.max(...values) + 6)

  if (hi - lo < MIN_SPAN) {
    const mid = (hi + lo) / 2
    lo = Math.max(0, Math.min(mid - MIN_SPAN / 2, 100 - MIN_SPAN))
    hi = Math.min(100, lo + MIN_SPAN)
  }
  return { lo, hi }
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson), as cubic béziers.
 *
 * The obvious choice here is Catmull-Rom, and it is wrong. Catmull-Rom
 * overshoots whenever the data turns sharply, so a run of 100% weeks drew a
 * curve that bulged *above* its own axis, the chart was showing better than
 * perfect. On a percentage that is not a rounding artefact, it is a false
 * claim.
 *
 * This limits each tangent to the secants either side of it, which makes
 * overshoot impossible: the curve stays inside the interval its own samples
 * define, and still passes exactly through every one of them.
 */
function spline(pts) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`

  const dx = []
  const secant = []
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = pts[i + 1].x - pts[i].x
    secant[i] = (pts[i + 1].y - pts[i].y) / dx[i]
  }

  // A tangent is the average of its neighbouring secants. Except at a
  // turning point, where it is forced flat so the curve cannot sail past the
  // peak it is supposed to be describing.
  const m = [secant[0]]
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = secant[i - 1] * secant[i] <= 0 ? 0 : (secant[i - 1] + secant[i]) / 2
  }
  m[n - 1] = secant[n - 2]

  // The limiter itself: pull any tangent back inside a circle of radius 3
  // around its segment's slope.
  for (let i = 0; i < n - 1; i += 1) {
    if (secant[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / secant[i]
    const b = m[i + 1] / secant[i]
    const s = a * a + b * b
    if (s > 9) {
      const f = (3 / Math.sqrt(s)) * secant[i]
      m[i] = f * a
      m[i + 1] = f * b
    }
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = pts[i].x + dx[i] / 3
    const c1y = pts[i].y + (m[i] * dx[i]) / 3
    const c2x = pts[i + 1].x - dx[i] / 3
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`
  }
  return d
}

export default function TrendChart({ series, className = '' }) {
  const { t, locale } = useT()
  const [hover, setHover] = useState(null)
  const svg = useRef(null)

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      }),
    [locale],
  )

  const { lo, hi } = useMemo(
    () => (series.length ? domain(series.map((s) => s.pct)) : { lo: 0, hi: 100 }),
    [series],
  )

  const pts = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        x:
          PAD.left +
          (series.length === 1 ? INNER.w / 2 : (i / (series.length - 1)) * INNER.w),
        y: PAD.top + (1 - (s.pct - lo) / (hi - lo)) * INNER.h,
      })),
    [series, lo, hi],
  )

  // Three gridlines: the floor, the middle and the ceiling of whatever range
  // the data actually occupies.
  const ticks = [lo, (lo + hi) / 2, hi]

  /* Defaults to the best week rather than the last one. The reference pins its
     readout to the peak, and on a page about consistency the high-water mark
     is the more useful thing to be reminded of. */
  const peak = useMemo(() => {
    let best = 0
    pts.forEach((p, i) => {
      if (p.pct > pts[best].pct) best = i
    })
    return best
  }, [pts])

  if (pts.length < 2) {
    return (
      <div className={`flex h-[200px] items-center justify-center ${className}`}>
        <p className="text-small text-white/65">{t('me.no_cycles')}</p>
      </div>
    )
  }

  const active = hover ?? peak
  const p = pts[active]
  const line = spline(pts)
  const area = `${line} L ${pts[pts.length - 1].x} ${PAD.top + INNER.h} L ${pts[0].x} ${PAD.top + INNER.h} Z`

  /* Nearest point to the pointer, in viewBox units. Reading the box every
     move rather than caching it, the card is in a responsive grid, so its
     width changes without this component re-rendering. */
  function track(e) {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    const x = ((e.clientX - box.left) / box.width) * W
    let near = 0
    pts.forEach((q, i) => {
      if (Math.abs(q.x - x) < Math.abs(pts[near].x - x)) near = i
    })
    setHover(near)
  }

  // Enough room for "100%" plus the date, and clamped to the plot so it can
  // neither hang off the right edge nor ride over the axis labels on the left.
  const tipW = 118
  const tipX = Math.min(Math.max(p.x - tipW / 2, PAD.left), W - PAD.right - tipW)

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full touch-none ${className}`}
      role="img"
      aria-label={t('me.last12')}
      onPointerMove={track}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        {/* The same yellow as the line, fading out. A separate hue under the
            curve would put a third colour on a card that has two. */}
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-spark))" stopOpacity="0.30" />
          <stop offset="100%" stopColor="rgb(var(--c-spark))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((v, i) => {
        const y = PAD.top + (1 - (v - lo) / (hi - lo)) * INNER.h
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="rgb(255 255 255)"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 9}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="600"
              fill="rgb(255 255 255)"
              fillOpacity="0.6"
            >
              {Math.round(v)}
            </text>
          </g>
        )
      })}

      <path d={area} fill="url(#trend-fill)" />
      <path
        d={line}
        fill="none"
        stroke="rgb(var(--c-spark))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* First and last dates only. A label under every point is unreadable at
          this width and says nothing the shape does not. */}
      {[0, pts.length - 1].map((i) => (
        <text
          key={i}
          x={pts[i].x}
          y={H - 8}
          textAnchor={i === 0 ? 'start' : 'end'}
          fontSize="11"
          fontWeight="600"
          fill="rgb(255 255 255)"
          fillOpacity="0.6"
        >
          {fmt.format(new Date(pts[i].at))}
        </text>
      ))}

      {/* The drop line, straight from the marker to the floor. It is what ties
          the readout to a position on the axis instead of leaving it hovering. */}
      <line
        x1={p.x}
        y1={p.y}
        x2={p.x}
        y2={PAD.top + INNER.h}
        stroke="rgb(255 255 255)"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <circle cx={p.x} cy={PAD.top + INNER.h} r="4" fill="rgb(var(--c-spark))" />
      <circle
        cx={p.x}
        cy={p.y}
        r="6"
        fill="rgb(var(--c-spark))"
        stroke="rgb(var(--c-ink))"
        strokeWidth="2.5"
      />

      <g transform={`translate(${tipX} 2)`}>
        <rect width={tipW} height="34" rx="17" fill="rgb(var(--c-spark))" />
        <text
          x={tipW / 2}
          y="22"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="rgb(16 14 20)"
        >
          {p.pct}% · {fmt.format(new Date(p.at))}
        </text>
      </g>
    </svg>
  )
}
