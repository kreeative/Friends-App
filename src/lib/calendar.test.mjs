/**
 * node src/lib/calendar.test.mjs
 *
 * The cases worth having are the ones a hand-check gets wrong: a month that
 * starts on a Sunday, a month that needs all six rows, February in a leap
 * year, and the two mornings a year a clock shifts.
 */
import {
  COLS,
  CURRENT_MONTH,
  MONTHS_BACK,
  MONTHS_FORWARD,
  ROWS,
  addMonths,
  calendarRange,
  key,
  monthGrid,
  monthRows,
  monthStart,
  monthsAround,
  rowOfDay,
  sameMonth,
} from './calendar.js'

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

console.log('\ncalendar')

/* --- shape ------------------------------------------------------------- */
eq('seven columns', COLS, 7)
eq('six rows, always', ROWS, 6)
eq('forty two cells', monthGrid(new Date(2025, 5, 15)).length, 42)
eq('six rows of seven', monthRows(new Date(2025, 5, 15)).length, 6)
ok('every row is a full week', monthRows(new Date(2025, 5, 15)).every((r) => r.length === 7))

/* --- key --------------------------------------------------------------- */
eq('pads', key(new Date(2025, 0, 5)), '2025-01-05')
eq('december', key(new Date(2025, 11, 31)), '2025-12-31')

/* --- monthStart -------------------------------------------------------- */
eq('the first', key(monthStart(new Date(2025, 6, 23))), '2025-07-01')
eq('already the first', key(monthStart(new Date(2025, 6, 1))), '2025-07-01')

/* --- addMonths --------------------------------------------------------- */
eq('forward', key(addMonths(new Date(2025, 0, 1), 1)), '2025-02-01')
eq('over the year end', key(addMonths(new Date(2025, 11, 1), 1)), '2026-01-01')
eq('back over the year start', key(addMonths(new Date(2025, 0, 1), -1)), '2024-12-01')
eq('a long way back', key(addMonths(new Date(2025, 5, 1), -18)), '2023-12-01')
/* The trap: stepping months from the 31st. addMonths normalises to the 1st
   first, so there is no 31 February to roll into March. */
eq('from a 31st', key(addMonths(new Date(2025, 0, 31), 1)), '2025-02-01')

/* --- sameMonth --------------------------------------------------------- */
ok('same', sameMonth(new Date(2025, 3, 1), new Date(2025, 3, 30)))
ok('different month', !sameMonth(new Date(2025, 3, 30), new Date(2025, 4, 1)))
ok('same month, different year', !sameMonth(new Date(2024, 3, 1), new Date(2025, 3, 1)))
ok('nothing is not the same as something', !sameMonth(null, new Date()))

/* --- the grid ---------------------------------------------------------- */
{
  // June 2025: the 1st is a Sunday. The grid should start exactly on it, with
  // no leading tail at all.
  const g = monthGrid(new Date(2025, 5, 10))
  eq('a month starting on a Sunday starts the grid', key(g[0]), '2025-06-01')
  eq('and runs into the next month at the end', key(g[41]), '2025-07-12')
  ok('every cell is a Sunday-first week', g.every((d, i) => d.getDay() === i % 7))
}
{
  // August 2025: the 1st is a Friday, 31 days. This is the six-row case.
  const g = monthGrid(new Date(2025, 7, 1))
  eq('leading tail from July', key(g[0]), '2025-07-27')
  eq('the 1st lands on Friday, column five', key(g[5]), '2025-08-01')
  eq('the 31st is in the last row', key(g[35]), '2025-08-31')
  ok('the sixth row is needed', monthRows(new Date(2025, 7, 1))[5].some((d) => d.getMonth() === 7))
}
{
  // February 2024: leap year, 29 days, starts on a Thursday.
  const g = monthGrid(new Date(2024, 1, 14))
  eq('leap february has a 29th', g.filter((d) => d.getMonth() === 1).length, 29)
  eq('and it is where it should be', key(g[4 + 28]), '2024-02-29')
}
{
  // February 2025: 28 days, starts on a Saturday. The tightest month there is.
  const g = monthGrid(new Date(2025, 1, 14))
  eq('short february', g.filter((d) => d.getMonth() === 1).length, 28)
  eq('starts late', key(g[0]), '2025-01-26')
}

/* Consecutive, with no repeats and no gaps, across every month of two years.
   This is the assertion that would catch a millisecond-arithmetic rewrite. */
{
  let bad = null
  for (let m = 0; m < 24 && !bad; m++) {
    const g = monthGrid(addMonths(new Date(2024, 0, 1), m))
    for (let i = 1; i < g.length; i++) {
      const step = Math.round((g[i] - g[i - 1]) / 3600000)
      /* 24 hours, or 23 or 25 across a daylight shift. What must never happen
         is 0 or 48: a repeated or a skipped date. */
      if (step < 22 || step > 26) bad = `${key(g[i - 1])} -> ${key(g[i])} (${step}h)`
    }
    const keys = g.map(key)
    if (new Set(keys).size !== 42) bad = `duplicate day in ${key(g[0])}`
  }
  ok('two years of grids are consecutive with no repeats', bad === null, bad ?? '')
}

/* March 2025, the spring forward in North America, and October 2025, the
   autumn shift in Europe. Named because these are the two the naive version
   gets wrong. */
eq('the day the clocks go forward is one cell', monthGrid(new Date(2025, 2, 1)).filter((d) => key(d) === '2025-03-09').length, 1)
eq('the day they go back is one cell', monthGrid(new Date(2025, 9, 1)).filter((d) => key(d) === '2025-10-26').length, 1)

/* --- rowOfDay ---------------------------------------------------------- */
{
  const august = new Date(2025, 7, 1)
  eq('the 1st is in row zero', rowOfDay(august, new Date(2025, 7, 1)), 0)
  eq('the 3rd starts row one', rowOfDay(august, new Date(2025, 7, 3)), 1)
  eq('the 31st is in row five', rowOfDay(august, new Date(2025, 7, 31)), 5)
  eq('a day from the leading tail is found too', rowOfDay(august, new Date(2025, 6, 28)), 0)
  eq('a day outside the grid is not', rowOfDay(august, new Date(2025, 9, 1)), -1)
  eq('nothing is not', rowOfDay(august, null), -1)
  /* The clock is stripped: a day picked at four in the afternoon is the same
     row as the same day at midnight. */
  eq('the time of day does not matter', rowOfDay(august, new Date(2025, 7, 14, 16, 30)), 2)
}

/* --- the pager --------------------------------------------------------- */
{
  const list = monthsAround(new Date(2025, 7, 20))
  eq('one slide per month', list.length, MONTHS_BACK + 1 + MONTHS_FORWARD)
  eq('current sits at the index the component uses', key(list[CURRENT_MONTH]), '2025-08-01')
  eq('oldest first', key(list[0]), '2024-09-01')
  eq('one month ahead at the end', key(list[list.length - 1]), '2025-09-01')
  ok('every slide is a first of a month', list.every((d) => d.getDate() === 1))
  ok(
    'consecutive months, no gaps',
    list.every((d, i) => i === 0 || key(d) === key(addMonths(list[i - 1], 1))),
  )
  eq('a custom span', monthsAround(new Date(2025, 7, 20), 2, 0).length, 3)
}

/* --- the fetch window -------------------------------------------------- */
{
  const list = monthsAround(new Date(2025, 7, 20))
  const { from, to } = calendarRange(list)
  eq('starts where the oldest grid starts', key(from), key(monthGrid(list[0])[0]))
  eq('ends where the newest grid ends', key(to), key(monthGrid(list[list.length - 1])[41]))
  ok('and it covers everything in between', from < to)
  ok('every day of every grid is inside it', list.every((m) => monthGrid(m).every((d) => d >= from && d <= to)))
  ok('called with nothing it still answers', calendarRange().from instanceof Date)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
