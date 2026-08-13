/**
 * Handwriting, as data rather than as a picture.
 *
 * A photograph of handwriting is a photograph: it is the wrong size on every
 * screen it was not drawn on, it cannot be recoloured, and a year of daily
 * notes is a year of PNGs. Strokes are a few hundred numbers, they render
 * sharp at any size because they are drawn rather than scaled, and the whole
 * of a page of writing is smaller than a thumbnail of it.
 *
 * THE SHAPE ON DISK.
 *
 *   { v: 1, w: 1000, h: 620, strokes: [ { t, c, s, p: [[x, y, pressure], …] } ] }
 *
 * `w` and `h` are the box it was drawn in, and they become the SVG viewBox, so
 * the drawing scales to whatever it is rendered at without anything being
 * recomputed. Points are stored in that box's own pixels rather than
 * normalised to 0..1, because a viewBox does the normalising for free and
 * absolute numbers are the ones a person can read when something goes wrong.
 *
 * Keys are one letter. A page of handwriting is a few thousand points, and
 * "pressure" repeated four thousand times is most of the payload.
 *
 * Pure and importless, so the geometry can be tested without a canvas.
 */

export const INK_VERSION = 1

/**
 * Three tips, and what actually differs between them.
 *
 * Not three names for the same line. A pen is opaque and even. A pencil is
 * lighter, thinner and slightly transparent, so overlapping strokes darken the
 * way graphite does. A marker is much fatter and much more transparent, so it
 * behaves like a highlighter when it crosses itself.
 *
 * `pressure` says whether the tip responds to how hard the pencil is pressed.
 * A marker does not, which is true of the real thing and stops a stylus turning
 * a highlighter into a calligraphy nib.
 */
export const TOOLS = {
  pen: { size: 3.2, opacity: 1, pressure: true, cap: 'round' },
  pencil: { size: 2.2, opacity: 0.72, pressure: true, cap: 'round' },
  marker: { size: 14, opacity: 0.38, pressure: false, cap: 'butt' },
}

export const TOOL_NAMES = ['pen', 'pencil', 'marker']

/**
 * The palette.
 *
 * Ink colours rather than theme colours, which is the one place in this app
 * that is deliberately not themed: what somebody wrote is theirs, and having
 * last month's entry change colour because they switched to sea would be the
 * app editing their notebook. Dark enough to read on paper white, and the
 * first one is the default.
 */
export const INK_COLORS = [
  '#1B1B1F', // near black
  '#A3004A', // brand magenta
  '#00647A', // brand teal
  '#B45309', // amber
  '#15803D', // green
  '#5B21B6', // violet
]

/** How far a finger has to travel before a new point is worth keeping. */
export const MIN_STEP = 1.6

/** Empty, and the shape every reader can rely on. */
export function emptyInk(w = 1000, h = 620) {
  return { v: INK_VERSION, w, h, strokes: [] }
}

/** Nothing drawn yet? Used to decide whether an entry is worth saving. */
export function isBlank(ink) {
  return !ink || !Array.isArray(ink.strokes) || ink.strokes.length === 0
}

/** A new stroke, before any point has been added to it. */
export function startStroke({ tool = 'pen', color = INK_COLORS[0], size } = {}) {
  const spec = TOOLS[tool] ?? TOOLS.pen
  return { t: TOOLS[tool] ? tool : 'pen', c: color, s: size ?? spec.size, p: [] }
}

/**
 * Add a point, unless it is on top of the last one.
 *
 * A pointermove fires far faster than a hand moves, so a slow careful line
 * arrives as a hundred points inside two pixels. Dropping the ones that have
 * not travelled keeps the file small and the path smooth, and it costs nothing
 * visible: MIN_STEP is under two pixels.
 *
 * Coordinates are rounded to a tenth of a pixel. Nothing is drawn finer than
 * that and the extra digits are a third of the payload.
 */
export function addPoint(stroke, x, y, pressure = 0.5) {
  const px = Math.round(x * 10) / 10
  const py = Math.round(y * 10) / 10
  const last = stroke.p[stroke.p.length - 1]

  if (last) {
    const dx = px - last[0]
    const dy = py - last[1]
    if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return stroke
  }

  stroke.p.push([px, py, Math.round(Math.min(1, Math.max(0, pressure)) * 100) / 100])
  return stroke
}

/**
 * One stroke, as an SVG path.
 *
 * Quadratic curves through the midpoints of consecutive samples, which is the
 * cheapest smoothing that actually looks like handwriting: the raw polyline
 * shows every sample as a corner, and a full spline fit is a great deal of
 * arithmetic for a difference nobody can see at this scale.
 *
 * A single point is drawn as a dot, because a tap is a full stop and a path
 * with one point renders as nothing at all.
 */
export function toPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) {
    const [x, y] = points[0]
    /* A zero-length line with a round cap is a circle, and it is three numbers
       rather than an arc command. */
    return `M${x} ${y}L${x} ${y}`
  }

  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    d += `Q${x1} ${y1} ${(x1 + x2) / 2} ${(y1 + y2) / 2}`
  }
  const end = points[points.length - 1]
  d += `L${end[0]} ${end[1]}`
  return d
}

/**
 * How wide to draw a stroke.
 *
 * One width for the whole stroke rather than a tapered outline. A true
 * variable-width nib means generating a filled polygon around the path, which
 * is a genuinely large amount of code for a notebook; taking the average
 * pressure of the stroke gives a light line a light weight and a firm one a
 * firm weight, which is most of what people notice.
 *
 * A tip that does not respond to pressure ignores it entirely.
 */
export function strokeWidth(stroke) {
  const spec = TOOLS[stroke.t] ?? TOOLS.pen
  if (!spec.pressure) return stroke.s
  const pts = stroke.p ?? []
  if (pts.length === 0) return stroke.s
  const avg = pts.reduce((sum, p) => sum + (p[2] ?? 0.5), 0) / pts.length
  return Math.round(stroke.s * (0.7 + 0.6 * avg) * 100) / 100
}

/** Everything one stroke needs to be drawn, in either renderer. */
export function strokeStyle(stroke) {
  const spec = TOOLS[stroke.t] ?? TOOLS.pen
  return {
    color: stroke.c,
    width: strokeWidth(stroke),
    opacity: spec.opacity,
    cap: spec.cap,
  }
}

/**
 * Rub out whole strokes rather than parts of them.
 *
 * The same choice Apple Notes offers as its object eraser, and the only one
 * that makes sense with vector storage: erasing part of a stroke means
 * splitting it into two, recomputing both, and doing it again on every frame
 * the eraser moves. Whole strokes are one hit test and one filter, and in
 * practice a stroke is a letter or a word, which is the unit people mean.
 *
 * The test is distance to the nearest sample rather than to the curve. At the
 * sampling rate above, samples are under two pixels apart, so the difference
 * is smaller than the eraser is.
 */
export function eraseAt(strokes, x, y, radius = 12) {
  const r2 = radius * radius
  return strokes.filter((s) => {
    for (const [px, py] of s.p ?? []) {
      const dx = px - x
      const dy = py - y
      if (dx * dx + dy * dy <= r2) return false
    }
    return true
  })
}

/** The box the drawing actually occupies, or null if nothing was drawn. */
export function bounds(ink) {
  if (isBlank(ink)) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const s of ink.strokes) {
    const pad = strokeWidth(s) / 2
    for (const [x, y] of s.p ?? []) {
      if (x - pad < minX) minX = x - pad
      if (y - pad < minY) minY = y - pad
      if (x + pad > maxX) maxX = x + pad
      if (y + pad > maxY) maxY = y + pad
    }
  }

  if (minX === Infinity) return null
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
}

/**
 * The viewBox to render with.
 *
 * The full page for the editor, so what somebody drew is where they drew it.
 * The occupied box, with a little air, for a thumbnail: a grid card two
 * hundred pixels wide showing a whole empty page with three words in the
 * corner is a card showing nothing.
 */
export function viewBox(ink, { crop = false, pad = 16 } = {}) {
  const w = ink?.w ?? 1000
  const h = ink?.h ?? 620
  if (!crop) return `0 0 ${w} ${h}`

  const b = bounds(ink)
  if (!b) return `0 0 ${w} ${h}`
  return `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`
}

/**
 * The whole drawing as a standalone SVG document.
 *
 * Used where a string is wanted rather than a React tree: an export, a data
 * URI, anything outside the app. The component renders the same strokes
 * directly, so there is one description of what a stroke looks like and both
 * readers agree with it.
 */
export function toSvg(ink, { crop = false } = {}) {
  const box = viewBox(ink, { crop })
  const paths = (ink?.strokes ?? [])
    .map((s) => {
      const st = strokeStyle(s)
      return (
        `<path d="${toPath(s.p)}" fill="none" stroke="${st.color}" ` +
        `stroke-width="${st.width}" stroke-opacity="${st.opacity}" ` +
        `stroke-linecap="${st.cap}" stroke-linejoin="round"/>`
      )
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${paths}</svg>`
}

/** Roughly how many bytes this will cost, for deciding what to warn about. */
export function inkSize(ink) {
  return JSON.stringify(ink ?? {}).length
}
