import { DECAY, GRAVITY, TICKS, isDead, life, makeParticle, step } from './burst.js'
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

/* A fixed sequence, so the maths is the same on every run. 0.5 is the middle
   of every range the constructor uses, which makes the expected values
   something a person can work out by hand. */
const half = () => 0.5
const seed = (over = {}) =>
  makeParticle({ x: 100, y: 200, angle: 90, spread: 0, speed: 20, color: 'red', random: half, ...over })

// ---- what a particle starts as ---------------------------------------------
const p = seed()
eq('it starts where it was thrown from', [p.x, p.y], [100, 200])
// 90 degrees is straight up, and screen coordinates put up at negative y.
near('straight up is negative vy', p.vy, -20 * 0.775)
near('and no sideways drift',      p.vx, 0, 1e-9)
eq('it starts unaged', p.tick, 0)

// The angle is degrees anticlockwise from east, inverted once inside.
const right = seed({ angle: 0 })
near('east is positive vx', right.vx, 20 * 0.775)
near('east is level',       right.vy, 0, 1e-9)

// ---- one frame --------------------------------------------------------------
const q = seed({ angle: 0 })
const vx0 = q.vx
step(q)
near('drag is applied to vx', q.vx, vx0 * DECAY)
near('gravity is applied after drag', q.vy, 0 * DECAY + GRAVITY)
eq('and it ages', q.tick, 1)

// Gravity accumulates: a piece thrown level is falling by the third frame.
const r = seed({ angle: 0 })
step(r); step(r); step(r)
eq('gravity wins quickly', r.vy > 0, true)
eq('drag bleeds the throw away', Math.abs(r.vx) < Math.abs(vx0), true)

// ---- life -------------------------------------------------------------------
eq('a new one is fully alive', life(seed()), 1)
near('halfway through is a half', life({ tick: TICKS / 2 }), 0.5)
eq('a spent one is zero',     life({ tick: TICKS }), 0)
eq('life never goes negative', life({ tick: TICKS * 3 }), 0)

// ---- death ------------------------------------------------------------------
eq('a new one is not dead',   isDead(seed()), false)
eq('an old one is dead',      isDead({ tick: TICKS, y: 0 }), true)
// Below the fold is dead too, so a tall burst does not run its full age
// drawing pieces nobody can see.
eq('one that fell off the screen is dead', isDead({ tick: 0, y: 900 }, TICKS, 800), true)
eq('one still on screen is not',           isDead({ tick: 0, y: 700 }, TICKS, 800), false)
eq('the margin is forgiving', isDead({ tick: 0, y: 820 }, TICKS, 800), false)

// ---- the spread ------------------------------------------------------------
// With no spread every piece leaves on the same line; with spread they do not.
const a = seed({ spread: 0 })
const b = seed({ spread: 0 })
near('no spread is deterministic', a.vx, b.vx)

let seq = [0, 1]
let i = 0
const walk = () => seq[i++ % seq.length]
const lo = makeParticle({ x: 0, y: 0, angle: 90, spread: 90, speed: 10, color: 'x', random: walk })
i = 0
seq = [1, 0]
const hi = makeParticle({ x: 0, y: 0, angle: 90, spread: 90, speed: 10, color: 'x', random: walk })
eq('spread throws them apart', Math.abs(lo.vx - hi.vx) > 1, true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
