/**
 * node src/lib/gesture.test.mjs
 */
import {
  DISMISS_PX,
  DISMISS_VELOCITY,
  FLICK_MIN_PX,
  HOLD_MOVE_PX,
  HOLD_MS,
  centreOf,
  dragOffset,
  flipFrom,
  flipTransform,
  holdProgress,
  movedTooFar,
  rectOf,
  shouldDismiss,
} from './gesture.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
const near = (name, a, b, tol = 1e-6) => ok(name, Math.abs(a - b) <= tol, `got ${a}, want ${b}`)

console.log('\ngesture')

/* --- the hold ---------------------------------------------------------- */
ok('the hold is inside the range that was asked for', HOLD_MS >= 500 && HOLD_MS <= 3000, `${HOLD_MS}ms`)
ok('and past the platform long press, so a tap is never one', HOLD_MS > 500)
ok('the drift tolerance is a wobble, not a swipe', HOLD_MOVE_PX > 4 && HOLD_MOVE_PX < 24)

eq('a still finger is still holding', movedTooFar({ x: 100, y: 200 }, { x: 100, y: 200 }), false)
eq('a small wobble is still holding', movedTooFar({ x: 100, y: 200 }, { x: 105, y: 203 }), false)
eq('exactly at the tolerance is still holding', movedTooFar({ x: 0, y: 0 }, { x: 10, y: 0 }), false)
eq('a pixel past it is not', movedTooFar({ x: 0, y: 0 }, { x: 11, y: 0 }), true)
eq('diagonal drift counts on both axes', movedTooFar({ x: 0, y: 0 }, { x: 8, y: 8 }), true)
eq('a horizontal swipe is not a hold', movedTooFar({ x: 0, y: 0 }, { x: 60, y: 1 }), true)
eq('a vertical scroll is not a hold', movedTooFar({ x: 0, y: 0 }, { x: 0, y: 40 }), true)
eq('a custom tolerance is honoured', movedTooFar({ x: 0, y: 0 }, { x: 30, y: 0 }, 40), false)
eq('nothing to compare is not too far', movedTooFar(null, { x: 900, y: 900 }), false)

near('nothing held yet', holdProgress(0), 0)
near('halfway', holdProgress(HOLD_MS / 2), 0.5)
near('done', holdProgress(HOLD_MS), 1)
near('held past the end stays at one', holdProgress(HOLD_MS * 4), 1)
near('negative time is zero, not a negative ring', holdProgress(-50), 0)
near('a zero-length hold is instantly complete', holdProgress(0, 0), 1)

/* --- dragging ---------------------------------------------------------- */
eq('at rest', dragOffset(300, 300), 0)
eq('down follows the finger exactly', dragOffset(300, 380), 80)
eq('a long drag still follows exactly', dragOffset(300, 700), 400)
eq('up resists', dragOffset(300, 260), -10)
eq('and keeps resisting', dragOffset(300, 100), -50)
ok('resistance is never more movement than the finger made', Math.abs(dragOffset(300, 100)) < 200)

eq('a short slow drag springs back', shouldDismiss(40, 600), false)
eq('past the threshold closes', shouldDismiss(DISMISS_PX, 600), true)
eq('well past closes', shouldDismiss(300, 900), true)
eq('a fast short flick closes', shouldDismiss(50, 60), true)
eq('a twitch at the end of a tap does not', shouldDismiss(FLICK_MIN_PX - 1, 10), false)
eq('dragging up never closes', shouldDismiss(-120, 100), false)
eq('no movement never closes', shouldDismiss(0, 100), false)
eq('a slow drag of the same distance does not', shouldDismiss(50, 4000), false)
eq('a custom threshold is honoured', shouldDismiss(50, 4000, { distance: 40 }), true)
ok('the velocity gate is a real speed', DISMISS_VELOCITY > 0.1 && DISMISS_VELOCITY < 3)

/* --- FLIP -------------------------------------------------------------- */
{
  const cell = { top: 400, left: 40, width: 36, height: 36 }
  const panel = { top: 100, left: 0, width: 390, height: 700 }
  const f = flipFrom(cell, panel)

  eq('moved to the cell on x', f.x, 40)
  eq('moved to the cell on y', f.y, 300)
  near('shrunk to the cell on x', f.scaleX, 36 / 390)
  near('shrunk to the cell on y', f.scaleY, 36 / 700)

  /* The property that matters, checked rather than eyeballed: applying the
     transform to the panel's own rectangle must land exactly on the cell. */
  const landedLeft = panel.left + f.x
  const landedTop = panel.top + f.y
  eq('the transformed panel starts where the cell starts, on x', landedLeft, cell.left)
  eq('the transformed panel starts where the cell starts, on y', landedTop, cell.top)
  near('and is exactly the cell wide', panel.width * f.scaleX, cell.width)
  near('and exactly the cell tall', panel.height * f.scaleY, cell.height)
}

{
  /* A cell above and left of the panel, which is what a date in the top row
     of the calendar looks like against a sheet pinned to the bottom. */
  const f = flipFrom({ top: 120, left: 10, width: 32, height: 54 }, { top: 300, left: 0, width: 320, height: 500 })
  eq('negative y when the cell is higher up', f.y, -180)
  eq('positive x when the cell is further right', f.x, 10)
}

eq('a panel that has not been laid out yet has no morph', flipFrom({ top: 0, left: 0, width: 10, height: 10 }, { top: 0, left: 0, width: 0, height: 0 }), null)
eq('nor does a cell with no size', flipFrom({ top: 0, left: 0, width: 0, height: 0 }, { top: 0, left: 0, width: 10, height: 10 }), null)
eq('nor does a missing rectangle', flipFrom(null, { top: 0, left: 0, width: 10, height: 10 }), null)

/* --- the CSS value ----------------------------------------------------- */
{
  const css = flipTransform({ top: 400, left: 40, width: 36, height: 36 }, { top: 100, left: 0, width: 390, height: 700 })
  ok('it is a transform', /^translate\(.+\) scale\(.+\)$/.test(css), css)
  ok('it carries the offset', css.includes('40px') && css.includes('300px'), css)
  ok('nothing is NaN', !css.includes('NaN'), css)

  const nums = css.match(/-?\d+\.?\d*/g).map(Number)
  ok('nothing is printed at full float width', css.split('.').every((p) => !/^\d{4,}/.test(p)), css)
  ok('every number is finite', nums.every(Number.isFinite))

  /* 36/700 is 0.051, under the floor, so the y scale is clamped and the x
     scale (0.092) is clamped too. Both floors, one number. */
  const scale = css.match(/scale\(([-\d.]+), ([-\d.]+)\)/)
  ok('the vertical scale is floored rather than crushed', Number(scale[2]) >= 0.12, scale[2])
  ok('the horizontal scale is floored too', Number(scale[1]) >= 0.12, scale[1])
}
{
  /* A morph that does not need clamping keeps its real numbers. */
  const css = flipTransform({ top: 0, left: 0, width: 200, height: 350 }, { top: 0, left: 0, width: 400, height: 700 })
  const scale = css.match(/scale\(([-\d.]+), ([-\d.]+)\)/)
  eq('half as wide', Number(scale[1]), 0.5)
  eq('half as tall', Number(scale[2]), 0.5)
}
eq('nothing to morph from is no transform at all', flipTransform(null, { top: 0, left: 0, width: 1, height: 1 }), 'none')
eq('a zero-area panel is no transform at all', flipTransform({ top: 0, left: 0, width: 1, height: 1 }, { top: 0, left: 0, width: 0, height: 1 }), 'none')

/* --- odds and ends ----------------------------------------------------- */
{
  const c = centreOf({ top: 100, left: 40, width: 36, height: 36 })
  eq('centre x', c.x, 58)
  eq('centre y', c.y, 118)
  eq('nothing has no centre', centreOf(null), null)
}
{
  const fake = { getBoundingClientRect: () => ({ top: 5, left: 6, width: 7, height: 8, right: 13, bottom: 13 }) }
  const r = rectOf(fake)
  eq('read from the element', JSON.stringify(r), JSON.stringify({ top: 5, left: 6, width: 7, height: 8 }))
  ok('and it is a plain object, not a live DOMRect', Object.getPrototypeOf(r) === Object.prototype)
  eq('nothing measures to nothing', rectOf(null), null)
  eq('something that is not an element measures to nothing', rectOf({}), null)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
