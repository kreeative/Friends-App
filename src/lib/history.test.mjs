/**
 * node src/lib/history.test.mjs
 *
 * The assertions that matter are the date ones. "Yesterday" is the label most
 * likely to be quietly wrong, and it is wrong in ways nobody notices until
 * the one day a year it matters: across a month end, across a year end, and
 * across a daylight-saving change, where a day is not 86400 seconds long and
 * timestamp arithmetic lands in the wrong date.
 */
import {
  categoriesIn,
  countHistory,
  dayHeading,
  filterHistory,
  groupByDay,
  shiftDay,
} from './history.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/* --- shifting days ------------------------------------------------------- */

{
  ok('an ordinary day back', shiftDay('2026-08-26', -1) === '2026-08-25')
  ok('across a month end', shiftDay('2026-08-01', -1) === '2026-07-31', shiftDay('2026-08-01', -1))
  ok('across a year end', shiftDay('2026-01-01', -1) === '2025-12-31', shiftDay('2026-01-01', -1))
  ok('into a leap day', shiftDay('2024-03-01', -1) === '2024-02-29', shiftDay('2024-03-01', -1))
  ok('and out of February in a normal year',
     shiftDay('2026-03-01', -1) === '2026-02-28', shiftDay('2026-03-01', -1))
  ok('forwards works too', shiftDay('2026-12-31', 1) === '2027-01-01')
  ok('rubbish in gives empty, not Invalid Date', shiftDay('nonsense', -1) === '')
  ok('undefined too', shiftDay(undefined, -1) === '')

  /* DST. In most of Canada the clocks go forward on the second Sunday of
     March; 2026-03-08 is that Sunday. Subtracting 86400000ms from local
     midnight on the 9th lands at 01:00 on the 8th, which still formats as the
     8th, but the same trick on the way OUT of DST lands at 23:00 on the day
     before the one you wanted. Building from parts sidesteps both. */
  ok('the day after the spring-forward Sunday', shiftDay('2026-03-09', -1) === '2026-03-08')
  ok('the day after the autumn-back Sunday', shiftDay('2026-11-02', -1) === '2026-11-01')
}

/* --- headings ------------------------------------------------------------ */

{
  const today = '2026-08-26'
  ok('today is today', dayHeading('2026-08-26', today).key === 'today')
  ok('yesterday is yesterday', dayHeading('2026-08-25', today).key === 'yesterday')
  ok('anything older is a date', dayHeading('2026-08-24', today).key === 'date')
  ok('and so is tomorrow, which a back-dated typo can produce',
     dayHeading('2026-08-27', today).key === 'date')
  ok('the day survives on the result', dayHeading('2026-08-24', today).day === '2026-08-24')

  /* The month-end case, where a naive "same month, day - 1" check breaks. */
  ok('yesterday across a month end',
     dayHeading('2026-07-31', '2026-08-01').key === 'yesterday')
  ok('yesterday across a year end',
     dayHeading('2025-12-31', '2026-01-01').key === 'yesterday')
}

/* --- grouping ------------------------------------------------------------ */

const E = [
  { id: 'a', kind: 'expense', amount_cents: 1200, category: 'food', note: 'Café', happened_on: '2026-08-26', created_at: '2026-08-26T09:00:00Z' },
  { id: 'b', kind: 'expense', amount_cents: 5000, category: 'food', note: 'Épicerie', happened_on: '2026-08-26', created_at: '2026-08-26T18:00:00Z' },
  { id: 'c', kind: 'income', amount_cents: 300000, category: null, note: 'Paie', happened_on: '2026-08-01', created_at: '2026-08-01T08:00:00Z' },
  { id: 'd', kind: 'expense', amount_cents: 900, category: 'transport', note: 'Bus', happened_on: '2026-07-30', created_at: '2026-07-30T08:00:00Z' },
  { id: 'e', kind: 'expense', amount_cents: 4000, category: 'fun', note: 'Cadeau', happened_on: '2026-08-26', created_at: '2026-08-26T12:00:00Z', excluded: true },
]

{
  const g = groupByDay(E)
  ok('three days', g.length === 3, String(g.length))
  ok('newest day first', g[0].day === '2026-08-26', g[0].day)
  ok('oldest day last', g[2].day === '2026-07-30', g[2].day)
  ok('the busy day has all three of its rows', g[0].entries.length === 3, String(g[0].entries.length))
  ok('newest row first inside the day', g[0].entries[0].id === 'b', g[0].entries.map((x) => x.id).join())
  ok('and oldest last', g[0].entries[2].id === 'a', g[0].entries.map((x) => x.id).join())

  /* 26 August: -1200 and -5000 count, the excluded 4000 does not. */
  ok('the day net ignores excluded rows', g[0].net === -6200, String(g[0].net))
  ok('an income day is positive', g[1].net === 300000, String(g[1].net))
}

{
  /* The order arrives from the database, but the client edits optimistically,
     so a row appended after an edit must not sit at the bottom of its day. */
  const shuffled = [E[3], E[1], E[2], E[0], E[4]]
  const g = groupByDay(shuffled)
  ok('shuffled input groups the same', g.map((x) => x.day).join() === '2026-08-26,2026-08-01,2026-07-30',
     g.map((x) => x.day).join())
  ok('and orders inside the day the same', g[0].entries[0].id === 'b')
}

{
  ok('an empty list groups to nothing', groupByDay([]).length === 0)
  ok('undefined does not throw', groupByDay().length === 0)
  ok('a row with no date is dropped rather than grouped under ""',
     groupByDay([{ id: 'x', kind: 'expense', amount_cents: 1 }]).length === 0)
  ok('rows with the same timestamp still order deterministically',
     groupByDay([
       { id: 'p', kind: 'expense', amount_cents: 1, happened_on: '2026-08-26', created_at: 'T' },
       { id: 'q', kind: 'expense', amount_cents: 1, happened_on: '2026-08-26', created_at: 'T' },
     ])[0].entries.map((x) => x.id).join() === 'q,p')
}

/* --- filtering ----------------------------------------------------------- */

{
  ok('all is everything', filterHistory(E, { kind: 'all' }).length === 5)
  ok('income only', filterHistory(E, { kind: 'income' }).map((x) => x.id).join() === 'c')
  ok('expenses only', filterHistory(E, { kind: 'expense' }).length === 4)
  ok('one category', filterHistory(E, { category: 'food' }).map((x) => x.id).join() === 'a,b')

  /* Income carries no category, so the combination is legitimately empty
     rather than an error. */
  ok('income and a category is empty, not broken',
     filterHistory(E, { kind: 'income', category: 'food' }).length === 0)

  ok('search matches the note', filterHistory(E, { query: 'bus' }).map((x) => x.id).join() === 'd')
  ok('search matches the category too',
     filterHistory(E, { query: 'transport' }).map((x) => x.id).join() === 'd')
  ok('search ignores case', filterHistory(E, { query: 'CAFÉ' }).map((x) => x.id).join() === 'a')

  /* Requiring the accent means the search only works for people who already
     know how the row was typed. */
  ok('search ignores accents', filterHistory(E, { query: 'epicerie' }).map((x) => x.id).join() === 'b')
  ok('and the other way round', filterHistory(E, { query: 'Café' }).map((x) => x.id).join() === 'a')

  ok('filters combine', filterHistory(E, { kind: 'expense', query: 'e' }).length >= 1)
  ok('no match is empty', filterHistory(E, { query: 'zzzz' }).length === 0)
  ok('an empty query does not filter', filterHistory(E, { query: '   ' }).length === 5)
  ok('no options at all is everything', filterHistory(E).length === 5)
  ok('undefined entries do not throw', filterHistory().length === 0)
  ok('a null row is dropped', filterHistory([null, E[0]]).length === 1)
}

{
  ok('categories are the real ones, sorted',
     categoriesIn(E).join() === 'food,fun,transport', categoriesIn(E).join())
  ok('income contributes no category', !categoriesIn(E).includes(null))
  ok('an empty list has no categories', categoriesIn([]).length === 0)
  ok('countHistory agrees with filterHistory',
     countHistory(E, { kind: 'expense' }) === filterHistory(E, { kind: 'expense' }).length)
}

console.log(`\nhistory\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
