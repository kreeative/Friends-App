/**
 * The surplus, and the three ways it could quietly lie.
 *
 * A surplus is a claim that real money is spare. The tests that matter are the
 * ones that check it refuses to make that claim: no income logged, a period
 * still running, a period already swept.
 */
import {
  cushionTarget, history, pendingSweeps, periodResult, periodsFrom,
  recentRate, savedIn, savedTotal, savingsRate, sweptKeys,
} from './savings.js'

let pass = 0
const fails = []
const ok = (what, cond, got) => {
  if (cond) pass++
  else fails.push(`${what}${got === undefined ? '' : `  got: ${got}`}`)
}
const eq = (what, a, b) => ok(what, a === b, `${a} !== ${b}`)

const D = (y, m, d) => new Date(y, m - 1, d)
const e = (kind, cents, on, extra = {}) => ({ kind, amount_cents: cents, happened_on: on, ...extra })

/* --------------------------------------------------------- periodsFrom --- */
{
  const entries = [e('income', 100, '2026-03-14')]
  const rows = periodsFrom({ entries, startDay: 1, today: D(2026, 6, 10) })
  eq('one period per month from the first entry to now', rows.length, 4)
  eq('starting at the first entry period', rows[0].key, '2026-03-01')
  eq('ending at the current one', rows[3].key, '2026-06-01')
  eq('the current period is not closed', rows[3].closed, false)
  eq('past ones are', rows[2].closed, true)
  eq('end is exclusive', rows[0].end, '2026-04-01')
}
{
  const rows = periodsFrom({ entries: [], startDay: 1, today: D(2026, 6, 10) })
  eq('no entries means just the current period', rows.length, 1)
  eq('and it is the one today falls in', rows[0].key, '2026-06-01')
}
{
  /* A period boundary of 15 means March 14 belongs to the period that opened
     on February 15, which is the whole reason startDay exists. */
  const rows = periodsFrom({ entries: [e('income', 1, '2026-03-14')], startDay: 15, today: D(2026, 4, 20) })
  eq('a mid-month payday shifts the first period back', rows[0].key, '2026-02-15')
  eq('and the current one starts on the 15th', rows[rows.length - 1].key, '2026-04-15')
}
{
  const rows = periodsFrom({ entries: [e('income', 1, '2026-01-31')], startDay: 31, today: D(2026, 3, 5) })
  ok('a start day past 28 is capped rather than rolling into the next month',
    rows.every((r) => r.key.endsWith('-28')), rows.map((r) => r.key).join(','))
}
{
  /* A single bad row must not spin the loop. */
  const rows = periodsFrom({ entries: [e('income', 1, '1900-01-01')], startDay: 1, today: D(2026, 6, 10) })
  ok('the walk is bounded', rows.length <= 600, rows.length)
}
{
  const rows = periodsFrom({ entries: [e('income', 1, '')], startDay: 1, today: D(2026, 6, 10) })
  eq('a blank date is ignored rather than becoming period zero', rows.length, 1)
}
{
  /* The period a closing date falls on is closed the moment that date arrives,
     because `end` is exclusive: on June 1 the May period is over. */
  const rows = periodsFrom({ entries: [e('income', 1, '2026-05-02')], startDay: 1, today: D(2026, 6, 1) })
  eq('a period closes the day its end arrives', rows[0].closed, true)
}

/* -------------------------------------------------------- periodResult --- */
{
  const entries = [
    e('income', 300000, '2026-03-01'),
    e('expense', 120000, '2026-03-04'),
    e('expense', 40000, '2026-03-19'),
    e('expense', 999999, '2026-04-02'),
  ]
  const r = periodResult({ entries, start: '2026-03-01', end: '2026-04-01' })
  eq('earned in the period', r.earned, 300000)
  eq('spent in the period', r.spent, 160000)
  eq('surplus is what is left', r.surplus, 140000)
}
{
  const entries = [e('income', 100000, '2026-03-01'), e('expense', 250000, '2026-03-04')]
  eq('an overspent month has no surplus, not a negative one',
    periodResult({ entries, start: '2026-03-01', end: '2026-04-01' }).surplus, 0)
}
{
  const entries = [e('expense', 5000, '2026-03-04')]
  eq('no income logged means no surplus to claim',
    periodResult({ entries, start: '2026-03-01', end: '2026-04-01' }).surplus, 0)
}
{
  const entries = [
    e('income', 300000, '2026-03-01'),
    e('expense', 50000, '2026-03-04', { excluded: true }),
  ]
  const r = periodResult({ entries, start: '2026-03-01', end: '2026-04-01' })
  eq('an excluded row does not count as spending', r.spent, 0)
  eq('so it does not inflate the surplus either', r.surplus, 300000)
}
{
  const r = periodResult({ entries: [e('income', 1, '2026-04-01')], start: '2026-03-01', end: '2026-04-01' })
  eq('the end date belongs to the next period', r.earned, 0)
}

/* -------------------------------------------------------------- history --- */
const ENTRIES = [
  e('income', 300000, '2026-03-02'), e('expense', 200000, '2026-03-10'),
  e('income', 300000, '2026-04-02'), e('expense', 310000, '2026-04-10'),
  e('income', 300000, '2026-05-02'), e('expense', 150000, '2026-05-10'),
  e('expense', 20000, '2026-06-03'),
]
{
  const rows = history({ entries: ENTRIES, startDay: 1, today: D(2026, 6, 10) })
  eq('newest first', rows[0].key, '2026-06-01')
  eq('four periods', rows.length, 4)
  eq('March left a hundred', rows[3].surplus, 100000)
  eq('April overspent, so nothing', rows[2].surplus, 0)
  eq('May left one fifty', rows[1].surplus, 150000)
  eq('June is still running', rows[0].closed, false)
}

/* -------------------------------------------------------- pendingSweeps --- */
{
  const rows = history({ entries: ENTRIES, startDay: 1, today: D(2026, 6, 10) })
  const p = pendingSweeps({ history: rows, savings: [] })
  eq('two months are sweepable', p.length, 2)
  eq('oldest first', p[0].key, '2026-03-01')
  eq('then May', p[1].key, '2026-05-01')
  ok('the open month is never offered', p.every((r) => r.closed))
  ok('nor is the month that overspent', p.every((r) => r.key !== '2026-04-01'))
}
{
  const rows = history({ entries: ENTRIES, startDay: 1, today: D(2026, 6, 10) })
  const savings = [{ amount_cents: 100000, source: 'surplus', period_start: '2026-03-01', happened_on: '2026-04-01' }]
  const p = pendingSweeps({ history: rows, savings })
  eq('a swept month is not offered again', p.length, 1)
  eq('the other one still is', p[0].key, '2026-05-01')
}
{
  const savings = [
    { amount_cents: 5000, source: 'manual', period_start: '2026-05-01', happened_on: '2026-05-04' },
  ]
  const rows = history({ entries: ENTRIES, startDay: 1, today: D(2026, 6, 10) })
  eq('a manual deposit does not count as that month being swept',
    pendingSweeps({ history: rows, savings }).length, 2)
}
{
  eq('sweptKeys only collects surplus rows',
    sweptKeys([
      { source: 'surplus', period_start: '2026-01-01' },
      { source: 'manual', period_start: '2026-02-01' },
    ]).size, 1)
}

/* --------------------------------------------------------------- totals --- */
{
  const savings = [
    { amount_cents: 100000, happened_on: '2026-04-01' },
    { amount_cents: 50000, happened_on: '2026-05-06' },
    { amount_cents: 25000, happened_on: '2026-06-06' },
  ]
  eq('everything ever put aside', savedTotal(savings), 175000)
  eq('and what landed in one period', savedIn(savings, '2026-05-01', '2026-06-01'), 50000)
  eq('an empty ledger totals zero', savedTotal([]), 0)
}

/* --------------------------------------------------------------- rates --- */
{
  eq('a rate is a percentage of what came in', savingsRate({ saved: 25, earned: 100 }), 25)
  eq('nothing came in means we do not know, not zero', savingsRate({ saved: 0, earned: 0 }), null)
  eq('and a negative income is not a rate either', savingsRate({ saved: 10, earned: -5 }), null)
}
{
  const rows = history({ entries: ENTRIES, startDay: 1, today: D(2026, 6, 10) })
  const savings = [
    { amount_cents: 100000, happened_on: '2026-03-20' },
    { amount_cents: 50000, happened_on: '2026-05-20' },
  ]
  const r = recentRate({ history: rows, savings, months: 12 })
  eq('three closed months', r.months, 3)
  eq('everything earned in them', r.earned, 900000)
  eq('everything saved in them', r.saved, 150000)
  ok('so the rate is one sixth', Math.abs(r.rate - 16.6667) < 0.01, r.rate)
}
{
  const rows = history({ entries: ENTRIES, startDay: 1, today: D(2026, 6, 10) })
  const r = recentRate({ history: rows, savings: [], months: 1 })
  eq('the window is honoured', r.months, 1)
  eq('and it is the most recent closed month', r.earned, 300000)
}
{
  const r = recentRate({ history: [], savings: [], months: 12 })
  eq('no history means no rate', r.rate, null)
  eq('and no months', r.months, 0)
}

/* ---------------------------------------------------------- cushionTarget --- */
{
  const rows = [
    { closed: true, spent: 200000 }, { closed: true, spent: 310000 },
    { closed: true, spent: 150000 }, { closed: false, spent: 20000 },
  ]
  const c = cushionTarget({ history: rows, months: 3 })
  eq('the median of the closed months', c.monthly, 200000)
  eq('three of them', c.target, 600000)
  eq('and it says it was measured', c.measured, true)
  ok('the open month is left out', c.monthly !== 20000)
}
{
  const c = cushionTarget({ history: [{ closed: true, spent: 100000 }], months: 3, fallbackMonthly: 250000 })
  eq('one month is not a distribution, so the plan stands in', c.monthly, 250000)
  eq('and it says so', c.measured, false)
}
{
  const c = cushionTarget({ history: [], months: 3, fallbackMonthly: 0 })
  eq('nothing at all is zero, not NaN', c.target, 0)
}
{
  const c = cushionTarget({
    history: [{ closed: true, spent: 100000 }, { closed: true, spent: 200000 }],
    months: 3,
  })
  eq('an even count takes the middle of the two', c.monthly, 150000)
}
{
  /* One catastrophic month must not set the target, which is the entire reason
     this is a median. */
  const spiky = [
    { closed: true, spent: 100000 }, { closed: true, spent: 110000 },
    { closed: true, spent: 105000 }, { closed: true, spent: 9000000 },
  ]
  const c = cushionTarget({ history: spiky, months: 3 })
  ok('one runaway month does not drag the target', c.monthly < 200000, c.monthly)
}

console.log(`\nsavings\n\n  ${pass} passed, ${fails.length} failed\n`)
for (const f of fails) console.log(`  FAIL ${f}`)
process.exit(fails.length ? 1 : 0)
