import {
  INK_COLORS,
  INK_VERSION,
  MIN_STEP,
  TOOLS,
  addPoint,
  bounds,
  emptyInk,
  eraseAt,
  inkSize,
  isBlank,
  startStroke,
  strokeStyle,
  strokeWidth,
  toPath,
  toSvg,
  viewBox,
} from './ink.js'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}
const near = (label, got, want, tol = 0.001) => {
  const ok = Math.abs(got - want) <= tol
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${got} want ${want}`}`)
}

// ---- the empty page ---------------------------------------------------------
const blank = emptyInk()
eq('an empty page carries its version', blank.v, INK_VERSION)
eq('and the box it was drawn in',       [blank.w, blank.h], [1000, 620])
eq('and no strokes',                    blank.strokes, [])
eq('empty is blank',                    isBlank(blank), true)
eq('null is blank',                     isBlank(null), true)
eq('junk is blank',                     isBlank({ v: 1 }), true)
eq('a page with a stroke is not blank', isBlank({ strokes: [{ p: [] }] }), false)
eq('the page size is settable', emptyInk(400, 300).w, 400)

// ---- starting a stroke ------------------------------------------------------
const pen = startStroke()
eq('the default tip is the pen', pen.t, 'pen')
eq('the default colour is the first swatch', pen.c, INK_COLORS[0])
eq('a new stroke has no points', pen.p, [])
eq('it takes the tip size', pen.s, TOOLS.pen.size)
eq('a marker is fatter than a pen', startStroke({ tool: 'marker' }).s > pen.s, true)
eq('an explicit size wins', startStroke({ size: 9 }).s, 9)
// A tip name that does not exist must not produce a stroke nothing can draw.
eq('an unknown tip falls back to the pen', startStroke({ tool: 'crayon' }).t, 'pen')
eq('and to the pen size',                  startStroke({ tool: 'crayon' }).s, TOOLS.pen.size)

// ---- adding points ----------------------------------------------------------
const s = startStroke()
addPoint(s, 10, 10, 0.5)
eq('the first point is always kept', s.p.length, 1)

// A pointermove fires far faster than a hand moves. Points that have not
// travelled are the bulk of the payload and none of the drawing.
addPoint(s, 10.2, 10, 0.5)
eq('a point that has not moved is dropped', s.p.length, 1)
addPoint(s, 10 + MIN_STEP + 0.1, 10, 0.5)
eq('a point that has moved is kept', s.p.length, 2)

// The threshold is a distance, not a per-axis one: a diagonal of two half-steps
// is still a move.
const diag = startStroke()
addPoint(diag, 0, 0)
addPoint(diag, MIN_STEP, MIN_STEP)
eq('the step is measured diagonally', diag.p.length, 2)

const round = startStroke()
addPoint(round, 1.234567, 9.87654, 0.5)
eq('coordinates are rounded to a tenth', [round.p[0][0], round.p[0][1]], [1.2, 9.9])
eq('pressure is rounded to a hundredth', addPoint(startStroke(), 0, 0, 0.126789).p[0][2], 0.13)

// Some devices report nonsense; a width computed from it would be nonsense too.
eq('pressure is clamped high', addPoint(startStroke(), 0, 0, 4).p[0][2], 1)
eq('pressure is clamped low',  addPoint(startStroke(), 0, 0, -2).p[0][2], 0)
eq('a mouse gets the middle',  addPoint(startStroke(), 0, 0).p[0][2], 0.5)

// ---- paths ------------------------------------------------------------------
eq('nothing draws nothing', toPath([]), '')
eq('nothing draws nothing, again', toPath(null), '')
// A tap is a full stop, and a one-point path renders as literally nothing.
eq('a single point is a dot', toPath([[5, 6, 1]]), 'M5 6L5 6')
eq('two points are a line',   toPath([[0, 0, 1], [10, 0, 1]]), 'M0 0L10 0')
// Quadratics through the midpoints: the control point is the sample, the end
// point is halfway to the next one, and the last sample closes it.
eq(
  'three points curve through the middle',
  toPath([[0, 0, 1], [10, 0, 1], [20, 0, 1]]),
  'M0 0Q10 0 15 0L20 0',
)
eq('every path starts with a move', toPath([[3, 4, 1], [5, 6, 1]]).startsWith('M3 4'), true)

// ---- width ------------------------------------------------------------------
// A tip that responds to pressure: light presses thin, hard presses fat, and
// the whole stroke gets one width rather than a tapered outline.
const light = { t: 'pen', s: 4, p: [[0, 0, 0]] }
const heavy = { t: 'pen', s: 4, p: [[0, 0, 1]] }
const mid = { t: 'pen', s: 4, p: [[0, 0, 0.5]] }
near('no pressure is the thin end', strokeWidth(light), 4 * 0.7)
near('full pressure is the fat end', strokeWidth(heavy), 4 * 1.3)
near('half pressure is in between', strokeWidth(mid), 4)
eq('harder is wider', strokeWidth(heavy) > strokeWidth(light), true)

// The average across the stroke, so one hard moment does not fatten a whole
// light line.
near('the whole stroke averages', strokeWidth({ t: 'pen', s: 4, p: [[0, 0, 0], [1, 1, 1]] }), 4)

// A marker is a marker. A stylus should not turn a highlighter into a nib.
eq('a marker ignores pressure', strokeWidth({ t: 'marker', s: 14, p: [[0, 0, 1]] }), 14)
eq('and at no pressure too',    strokeWidth({ t: 'marker', s: 14, p: [[0, 0, 0]] }), 14)
eq('a stroke with no points keeps its size', strokeWidth({ t: 'pen', s: 4, p: [] }), 4)

// ---- style ------------------------------------------------------------------
const st = strokeStyle({ t: 'pencil', c: '#123456', s: 2, p: [[0, 0, 0.5]] })
eq('the colour is carried through', st.color, '#123456')
eq('the pencil is translucent',     st.opacity, TOOLS.pencil.opacity)
eq('the pen is not',                strokeStyle({ t: 'pen', c: '#000', s: 3, p: [] }).opacity, 1)
eq('a marker is the most translucent of the three', TOOLS.marker.opacity < TOOLS.pencil.opacity, true)
eq('a round tip is round', st.cap, 'round')
eq('a marker is a chisel', strokeStyle({ t: 'marker', c: '#000', s: 14, p: [] }).cap, 'butt')

// ---- erasing ----------------------------------------------------------------
// Whole strokes, which is the unit people mean: a stroke is a letter or a word.
const strokes = [
  { t: 'pen', c: '#000', s: 3, p: [[0, 0, 1], [5, 5, 1]] },
  { t: 'pen', c: '#000', s: 3, p: [[100, 100, 1], [105, 105, 1]] },
]
eq('the eraser takes the stroke it touches', eraseAt(strokes, 0, 0, 12).length, 1)
eq('and leaves the one it does not',         eraseAt(strokes, 0, 0, 12)[0].p[0][0], 100)
eq('a miss erases nothing',                  eraseAt(strokes, 50, 50, 12).length, 2)
// Any sample counts, not only the first: rubbing the tail of a letter takes it.
eq('touching the far end still erases', eraseAt(strokes, 105, 105, 6).length, 1)
eq('a bigger eraser reaches further',   eraseAt(strokes, 50, 50, 80).length, 0)
eq('erasing does not mutate the original', strokes.length, 2)

// ---- bounds -----------------------------------------------------------------
eq('an empty page has no bounds', bounds(emptyInk()), null)
const boxed = {
  v: 1, w: 1000, h: 620,
  strokes: [{ t: 'marker', c: '#000', s: 10, p: [[100, 100, 1], [200, 300, 1]] }],
}
const b = bounds(boxed)
// The width of the nib counts: half of it sticks out past the centre line, and
// a crop that ignores it clips the edge of the writing.
near('the box starts half a nib early', b.x, 95)
near('and ends half a nib late',        b.w, 110)
near('vertically too',                  b.y, 95)
near('and its height',                  b.h, 210)

// ---- viewBox ----------------------------------------------------------------
eq('the editor sees the whole page', viewBox(boxed), '0 0 1000 620')
eq('a thumbnail crops to the writing', viewBox(boxed, { crop: true, pad: 5 }), '90 90 120 220')
// A grid card two hundred pixels wide showing a whole empty page is a card
// showing nothing, but a blank page has nothing to crop to either.
eq('cropping a blank page falls back to the page', viewBox(emptyInk(), { crop: true }), '0 0 1000 620')
eq('a missing page still gives a box', viewBox(null), '0 0 1000 620')

// ---- svg --------------------------------------------------------------------
const svg = toSvg(boxed)
eq('it is a standalone document', svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), true)
eq('it is closed',                svg.endsWith('</svg>'), true)
eq('it carries the viewBox',      svg.includes('viewBox="0 0 1000 620"'), true)
eq('the stroke is drawn',         svg.includes('<path d="M100 100L200 300"'), true)
eq('strokes are not filled',      svg.includes('fill="none"'), true)
eq('the tip opacity is applied',  svg.includes(`stroke-opacity="${TOOLS.marker.opacity}"`), true)
eq('an empty page is still valid svg', toSvg(emptyInk()).includes('<path'), false)
eq('and a missing one does not throw', typeof toSvg(null), 'string')

// ---- size -------------------------------------------------------------------
// The reason the keys are one letter: a page of handwriting is thousands of
// points, and a page has to stay small enough to keep in a row.
eq('an empty page is tiny', inkSize(emptyInk()) < 60, true)
const heavyPage = emptyInk()
for (let i = 0; i < 20; i += 1) {
  const line = startStroke()
  for (let j = 0; j < 100; j += 1) addPoint(line, j * 3, i * 20, 0.5)
  heavyPage.strokes.push(line)
}
eq('two thousand points fit in 40kB', inkSize(heavyPage) < 40000, true)
eq('and every point was kept',        heavyPage.strokes[0].p.length, 100)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
