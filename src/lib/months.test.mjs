/**
 * Comparing months, and the four ways a comparison lies.
 *
 * The interesting tests here are not "does it add up". They are the refusals:
 * a running period compared against a whole one, a percentage off a base of
 * zero, an average dragged down by the days that have not happened yet, and a
 * category total that does not reconcile with the total beside it.
 */
import {
  WINDOW, amountIn, categoriesIn, compareMonths, peak, spendHistory, typicalMonth,
} from './months.js'

let pass = 0
const fails = []
const ok = (what, cond, got) => {
  if (cond) pass++
  else fails.push(`${what}${got === undefined ? '' : `  got: ${got}`}`)
}
const eq = (what, a, b) => ok(what, a === b, `${a} !== ${b}`)

const D = (y, m, d) => new Date(y, m - 1, d)
const spend = (cents, on, category = 'food', extra = {}) =>
  ({ kind: 'expense', amount_cents: cents, happened_on: on, category, ...extra })
const earn = (cents, on) => ({ kind: 'income', amount_cents: cents, happened_on: on, category: null })

/* ------------------------------------------------------- spendHistory --- */
{
  const entries = [
    spend(10000, '2026-04-05', 'food'),
    spend(5000, '2026-04-20', 'transport'),
    spend(30000, '2026-05-02', 'food'),
    spend(2000, '2026-06-03', 'fun'),
  ]
  const rows = spendHistory({ entries, startDay: 1, today: D(2026, 6, 6) })
  eq('one row per period, newest first', rows.length, 3)
  eq('newest is the running one', rows[0].key, '2026-06-01')
  eq('and it is marked open', rows[0].closed, false)
  eq('the one before it is closed', rows[1].closed, true)
  eq('April spent its two rows', rows[2].spent, 15000)
  eq('May spent one', rows[1].spent, 30000)
  eq('and the categories split', rows[2].byCategory.food, 10000)
  eq('both ways', rows[2].byCategory.transport, 5000)
  eq('an untouched category is zero, not missing', rows[2].byCategory.health, 0)
}

/* INCOME IS NOT SPENDING. The card says depenses. */
{
  const entries = [spend(10000, '2026-05-04'), earn(900000, '2026-05-01')]
  const rows = spendHistory({ entries, startDay: 1, today: D(2026, 6, 6) })
  const may = rows.find((r) => r.key === '2026-05-01')
  eq('a bonus does not change what was spent', may.spent, 10000)
}

/* Excluded rows are excluded here exactly as they are everywhere else. */
{
  const entries = [spend(10000, '2026-05-04'), spend(50000, '2026-05-06', 'fun', { excluded: true })]
  const rows = spendHistory({ entries, startDay: 1, today: D(2026, 6, 6) })
  const may = rows.find((r) => r.key === '2026-05-01')
  eq('an excluded transaction does not count', may.spent, 10000)
  eq('nor in its category', may.byCategory.fun, 0)
}

/* THE CATEGORIES MUST RECONCILE WITH THE TOTAL BESIDE THEM. An unknown
   category filing nowhere would put two numbers on one screen that disagree. */
{
  const entries = [
    spend(1000, '2026-05-04', 'food'),
    spend(2000, '2026-05-05', 'nonsense'),
    spend(3000, '2026-05-06', null),
  ]
  const rows = spendHistory({ entries, startDay: 1, today: D(2026, 6, 6) })
  const may = rows.find((r) => r.key === '2026-05-01')
  const summed = Object.values(may.byCategory).reduce((n, c) => n + c, 0)
  eq('the categories add up to the total', summed, may.spent)
  eq('an unknown category files under other', may.byCategory.other, 5000)
}

/* The period start day is the plan's, not the first of the month. */
{
  const entries = [spend(1000, '2026-05-10'), spend(4000, '2026-05-20')]
  const rows = spendHistory({ entries, startDay: 15, today: D(2026, 6, 20) })
  const first = rows.find((r) => r.key === '2026-04-15')
  const second = rows.find((r) => r.key === '2026-05-15')
  eq('the 10th falls in the period that opened on the 15th before it', first.spent, 1000)
  eq('and the 20th in the one that opened on the 15th', second.spent, 4000)
}

/* The window is a cap, not a promise. */
{
  const entries = [spend(100, '2024-01-05')]
  const rows = spendHistory({ entries, startDay: 1, today: D(2026, 6, 6) })
  ok('history longer than the window is cut to it', rows.length === WINDOW, String(rows.length))
  eq('and the cut keeps the newest', rows[0].key, '2026-06-01')
  const short = spendHistory({ entries, startDay: 1, today: D(2026, 6, 6), limit: 3 })
  eq('the limit is respected', short.length, 3)
  eq('limit 0 gives nothing rather than everything', spendHistory({ entries, limit: 0 }).length, 0)
}

/* ----------------------------------------------------------- amountIn --- */
{
  const row = { spent: 5000, byCategory: { food: 3000, fun: 2000 } }
  eq('all is the total', amountIn(row, 'all'), 5000)
  eq('a category is its own', amountIn(row, 'food'), 3000)
  eq('a category with nothing in it is zero', amountIn(row, 'health'), 0)
  eq('no row is zero, not a crash', amountIn(null, 'food'), 0)
}

/* ------------------------------------------------------ compareMonths --- */
{
  const rows = [
    { key: 'c', closed: true, spent: 12000, byCategory: { food: 6000 } },
    { key: 'b', closed: true, spent: 10000, byCategory: { food: 8000 } },
    { key: 'a', closed: true, spent: 20000, byCategory: { food: 4000 } },
  ]
  const out = compareMonths(rows)
  eq('the newest is compared with the one before it', out[0].delta, 2000)
  eq('as a percentage of the older figure', out[0].pct, 20)
  eq('a fall is negative', out[1].delta, -10000)
  eq('and its percentage too', out[1].pct, -50)
  eq('the oldest has nothing behind it', out[2].delta, null)
  eq('so no percentage either', out[2].pct, null)

  const byCat = compareMonths(rows, 'food')
  eq('a category is compared on its own numbers', byCat[0].delta, -2000)
  eq('and its own percentage', byCat[0].pct, -25)
}

/* THE RUNNING PERIOD IS NEVER COMPARED. Six days against a whole month is
   "down 78 %", which is true and worthless. */
{
  const rows = [
    { key: 'now', closed: false, spent: 3000, byCategory: {} },
    { key: 'prev', closed: true, spent: 30000, byCategory: {} },
  ]
  const out = compareMonths(rows)
  eq('a month still running gets no delta', out[0].delta, null)
  eq('and no percentage', out[0].pct, null)
  eq('but it still reports what it has spent', out[0].amount, 3000)
  ok('and it still knows what came before', out[0].previous === 30000, String(out[0].previous))
}

/* A PERCENTAGE OFF ZERO IS NOT A PERCENTAGE. */
{
  const rows = [
    { key: 'b', closed: true, spent: 30000, byCategory: {} },
    { key: 'a', closed: true, spent: 0, byCategory: {} },
  ]
  const out = compareMonths(rows)
  eq('the cents are still reportable', out[0].delta, 30000)
  eq('the percentage is refused', out[0].pct, null)
}

/* ------------------------------------------------- peak and typical --- */
{
  const rows = [
    { closed: false, spent: 1000, byCategory: { food: 900 } },
    { closed: true, spent: 30000, byCategory: { food: 1000 } },
    { closed: true, spent: 10000, byCategory: { food: 5000 } },
  ]
  eq('peak is the largest bar to scale against', peak(rows), 30000)
  eq('per category too', peak(rows, 'food'), 5000)
  eq('nothing anywhere is zero, not NaN', peak([]), 0)

  /* 30000 and 10000 are the closed ones: 20000. Including the running 1000
     would give 13667 and a "typical month" that shrinks every time somebody
     opens the app early in the month. */
  eq('the average skips the running period', typicalMonth(rows), 20000)
  eq('and does so per category', typicalMonth(rows, 'food'), 3000)
  eq('no closed period yet is zero', typicalMonth([{ closed: false, spent: 500, byCategory: {} }]), 0)
}

/* --------------------------------------------------------- categories --- */
{
  const rows = [
    { byCategory: { food: 100, transport: 0, home: 0, fun: 5, health: 0, other: 0 } },
    { byCategory: { food: 0, transport: 0, home: 900, fun: 0, health: 0, other: 0 } },
  ]
  const cats = categoriesIn(rows)
  eq('only the categories with something in them', cats.length, 3)
  ok('and in the ramp order, not the order they were found', cats.join(',') === 'food,home,fun', cats.join(','))
  eq('nothing logged offers no filter at all', categoriesIn([]).length, 0)
}

console.log(`\nmonths\n\n  ${pass} passed, ${fails.length} failed\n`)
for (const f of fails) console.log(`  FAIL ${f}`)
process.exit(fails.length ? 1 : 0)
