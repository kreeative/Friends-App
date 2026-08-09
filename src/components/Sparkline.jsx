import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * A trend line, drawn small.
 *
 * There was already a sparkline here: a bare polyline on the two money tiles,
 * no fill, no endpoint, appearing fully formed. It said the right thing and
 * looked like a diagram. This is the same data with the three things that make
 * a chart on a card read as a chart on a card: a gradient under the curve so
 * the line has weight, a marker on the last point so the eye knows where "now"
 * is, and the line drawing itself in when the card arrives.
 *
 * NO ANIMATION LIBRARY. The brief asked for Framer Motion, and the entire
 * behaviour here is one transition on stroke-dashoffset plus an
 * IntersectionObserver, which is about fifteen lines. framer-motion is around
 * 50kB gzipped against a bundle already flagged at 197kB, for a curve that
 * moves once. The same argument MoodToday makes about its own open animation:
 * pulling in a runtime to move one element is a poor trade.
 *
 * IT MEASURES, AND IT HAS TO.
 *
 * The version this replaces used a fixed viewBox with preserveAspectRatio
 * "none" so it would stretch to any box without a layout read, and paid for it
 * three times over. The stroke needed vector-effect to survive the non-uniform
 * scale; a round endpoint had to be an HTML element because an SVG circle
 * came out an ellipse; and the two together were quietly broken, because
 * non-scaling-stroke measures the dash pattern in rendered pixels while
 * getTotalLength reports user units. On a 390px-wide card a 100-unit dash
 * became dash-gap-dash-gap and the line drew in pieces.
 *
 * One ResizeObserver removes all three. The viewBox is the real pixel box, so
 * the scale is 1:1: the stroke is uniform without a special case, the dot is a
 * circle, and the dash length is the path length because there is no longer
 * any difference between the two.
 */

/* Room for the stroke and the endpoint marker, which would otherwise be cut in
   half by the edges of the box. */
const PAD_Y = 6
const PAD_R = 7

/**
 * Catmull-Rom through the points, emitted as cubic Béziers.
 *
 * A polyline through nine points is a set of hinges, and at this size the
 * corners read as noise in the data rather than as the shape of it. The
 * control points are the standard 1/6-of-the-neighbour-span construction, so
 * the curve passes through every real value: it smooths the join, not the
 * number.
 */
function curve(points) {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  }

  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2

    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6

    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return d
}

/* Read per call rather than held in a constant: somebody can turn the setting
   on mid-session and the next card to arrive should respect it. */
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const TONES = {
  accent: 'text-accent',
  ink: 'text-ink',
  spark: 'text-spark',
  white: 'text-white',
}

export default function Sparkline({ points, tone = 'accent', height = 44, className = '' }) {
  /* useId gives one gradient per instance. Two sparklines on a screen sharing
     an id means the second silently adopts the first one's fill. */
  const gradientId = `spark-${useId().replace(/:/g, '')}`

  const boxRef = useRef(null)
  const pathRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [length, setLength] = useState(0)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geometry = useMemo(() => {
    const values = (points ?? []).filter((n) => Number.isFinite(n))
    if (values.length < 2 || width <= 0) return null

    const max = Math.max(...values)
    const min = Math.min(...values)
    // Floored at 1 so a flat series draws a flat line rather than dividing by
    // zero and collapsing to nothing.
    const range = Math.max(1, max - min)

    const plotW = Math.max(1, width - PAD_R)
    const plotH = Math.max(1, height - PAD_Y * 2)

    const coords = values.map((v, i) => [
      (i / (values.length - 1)) * plotW,
      PAD_Y + plotH - ((v - min) / range) * plotH,
    ])

    const line = curve(coords)
    const tip = coords[coords.length - 1]

    return {
      line,
      // Closed down to the baseline at both ends: the shape the gradient fills.
      area: `${line} L${plotW.toFixed(2)},${height} L0,${height} Z`,
      tipX: tip[0],
      tipY: tip[1],
    }
  }, [points, width, height])

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength())
  }, [geometry])

  /**
   * Drawn when the card arrives, not when the component mounts.
   *
   * A tile three screens down that has already finished animating by the time
   * it is scrolled to has not animated at all, as far as anybody watching is
   * concerned.
   */
  useEffect(() => {
    /**
     * Not until the length is known, and not in the same frame.
     *
     * A CSS transition needs the browser to have painted the starting value.
     * The width arrives from the observer, the length is measured from the
     * path that width produced, and the reveal wants to be a third step: doing
     * all three in one commit sets dasharray and dashoffset to their final
     * values together, so there is nothing to interpolate from and the line is
     * simply there. Which is exactly what happened, and is easy to miss,
     * because a chart that appears instantly looks like a chart rather than
     * like a bug.
     */
    if (!geometry || !length) return

    if (prefersReduced() || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const el = boxRef.current
    if (!el) return

    let first
    let second
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        // Two frames. One is not reliably enough to get React's commit and the
        // paint on opposite sides of the change.
        first = requestAnimationFrame(() => {
          second = requestAnimationFrame(() => setShown(true))
        })
      },
      { threshold: 0.2 },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [Boolean(geometry), length])

  const motion = !prefersReduced()

  return (
    /* Always rendered, even before the width is known, because the box is what
       the ResizeObserver is watching. */
    <div
      ref={boxRef}
      className={`relative ${TONES[tone] ?? TONES.accent} ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {geometry && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.30" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* The wash trails the line rather than arriving with it, so what
              you read first is the shape and not the colour. */}
          <path
            d={geometry.area}
            fill={`url(#${gradientId})`}
            style={{
              opacity: shown ? 1 : 0,
              transition: motion ? 'opacity 700ms ease 260ms' : undefined,
            }}
          />

          <path
            ref={pathRef}
            d={geometry.line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: length || undefined,
              strokeDashoffset: shown ? 0 : length,
              transition: motion
                ? 'stroke-dashoffset 1000ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                : undefined,
            }}
          />

          {/**
           * Now, as a dot. It lands after the line has finished drawing, which
           * is what makes it read as the end of the movement rather than as a
           * third thing on the card.
           *
           * The halo is a second circle at low opacity rather than an SVG
           * filter: a filter would need its own colour space and a region, for
           * a soft edge nobody would notice.
           */}
          <g
            style={{
              transformOrigin: `${geometry.tipX}px ${geometry.tipY}px`,
              transform: `scale(${shown ? 1 : 0})`,
              opacity: shown ? 1 : 0,
              transition: motion
                ? 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1) 820ms, opacity 300ms ease 820ms'
                : undefined,
            }}
          >
            <circle cx={geometry.tipX} cy={geometry.tipY} r="7" fill="currentColor" opacity="0.2" />
            <circle cx={geometry.tipX} cy={geometry.tipY} r="3.5" fill="currentColor" />
          </g>
        </svg>
      )}
    </div>
  )
}
