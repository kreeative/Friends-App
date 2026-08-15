/**
 * node src/lib/streak.test.mjs
 *
 * The assertions that matter are the ones about the boundary of today and the
 * ones about days a goal was never due on. Both are the difference between a
 * streak that means something and a number that resets every morning or breaks
 * on a Tuesday for a goal that only runs on Mondays.
 *
 * Every date here is fixed and local. Nothing reads the clock.
 */
import {
  LOOKBACK_DAYS,
  countOn,
  dayKey,
  indexDays,
  nextCount,
  progressFor,
  recentDays,
  shiftDay,
  since,
  streakOf,
} from './streak.js'

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

console.log('\nstreak')

/* Wednesday 12 August 2026, chosen so getDay() is 3 and the week either side
   crosses no month boundary. Local midday, to keep DST out of the fixtures. */
const WED = new Date(2026, 7, 12, 12, 0, 0)
const d = (n) => shiftDay(WED, n)

const daily = { id: 'g1', cadence: 'recurring', target_per_cycle: 1, status: 'active', created_at: '2025-01-01' }
const thrice = { id: 'g3', cadence: 'recurring', target_per_cycle: 3, status: 'active', created_at: '2025-01-01' }
// 1 = Monday, 3 = Wednesday. getDay() numbering, 0 = Sunday.
const monWed = { ...daily, id: 'gmw', active_days: [1, 3] }

/** Rows the way Supabase returns them. */
const tick = (goal, offset, count = null) => ({
  goal_id: goal.id,
  on_date: dayKey(d(offset)),
  count_done: count ?? (goal.target_per_cycle || 1),
})

/* --- dayKey and shiftDay ------------------------------------------------ */
eq('dayKey is local, not UTC', dayKey(new Date(2026, 7, 12, 23, 30)), '2026-08-12')
eq('dayKey pads', dayKey(new Date(2026, 0, 5)), '2026-01-05')
ok(
  'an evening in a negative offset does not roll to tomorrow',
  dayKey(new Date(2026, 7, 12, 21, 0)) === '2026-08-12',
)
eq('shiftDay crosses a month backwards', dayKey(shiftDay(new Date(2026, 7, 2), -3)), '2026-07-30')
eq('shiftDay crosses a year backwards', dayKey(shiftDay(new Date(2026, 0, 1), -1)), '2025-12-31')
eq('shiftDay forwards', dayKey(shiftDay(new Date(2026, 1, 27), 2)), '2026-03-01')

/* --- indexDays ---------------------------------------------------------- */
{
  const ix = indexDays([tick(daily, 0), tick(daily, -1)])
  eq('a tick is found', countOn(ix, 'g1', dayKey(WED)), 1)
  eq('a day with no tick is zero', countOn(ix, 'g1', dayKey(d(-5))), 0)
  eq('an unknown goal is zero', countOn(ix, 'nope', dayKey(WED)), 0)
  eq('a null index is zero', countOn(null, 'g1', dayKey(WED)), 0)
}
{
  // A timestamp in on_date, which is what a careless client would send.
  const ix = indexDays([{ goal_id: 'g1', on_date: '2026-08-12T00:00:00+00:00', count_done: 1 }])
  eq('on_date is read as a calendar date', countOn(ix, 'g1', '2026-08-12'), 1)
}
{
  const ix = indexDays([
    { goal_id: 'g3', on_date: '2026-08-12', count_done: 1 },
    { goal_id: 'g3', on_date: '2026-08-12', count_done: 3 },
  ])
  eq('two rows for one day take the larger', countOn(ix, 'g3', '2026-08-12'), 3)
}
{
  const ix = indexDays([null, {}, { goal_id: 'g1' }, { on_date: '2026-08-12' }])
  eq('junk rows are dropped rather than thrown on', ix.size, 0)
}

/* --- progressFor -------------------------------------------------------- */
{
  const p = progressFor(daily, indexDays([]), WED)
  eq('nothing done today', p.done, 0)
  eq('a daily goal wants one', p.target, 1)
  ok('and it is due', p.due)
  ok('and not complete', !p.complete)
}
{
  const p = progressFor(thrice, indexDays([tick(thrice, 0, 2)]), WED)
  eq('two of three counted', p.done, 2)
  eq('target is three', p.target, 3)
  ok('two of three is not complete', !p.complete)
  eq('and reads as a percentage', p.pct, 67)
}
{
  const p = progressFor(thrice, indexDays([tick(thrice, 0, 9)]), WED)
  eq('a count above target is clamped for display', p.done, 3)
  ok('and is complete', p.complete)
}
{
  // Wednesday is in [1,3], Thursday is not.
  ok('a Mon/Wed goal is due on Wednesday', progressFor(monWed, indexDays([]), WED).due)
  ok('and not due on Thursday', !progressFor(monWed, indexDays([]), d(1)).due)
}
{
  const paused = { ...daily, status: 'paused' }
  ok('a paused goal is not due today', !progressFor(paused, indexDays([]), WED).due)
}

/* --- nextCount ---------------------------------------------------------- */
eq('a once-a-day goal toggles on', nextCount(daily, 0), 1)
eq('and toggles back off', nextCount(daily, 1), 0)
eq('three-a-day counts up', nextCount(thrice, 0), 1)
eq('and up', nextCount(thrice, 1), 2)
eq('and up to target', nextCount(thrice, 2), 3)
eq('then wraps, so there is an undo', nextCount(thrice, 3), 0)
eq('a count past target still wraps rather than sticking', nextCount(thrice, 7), 0)
eq('junk is treated as nothing done', nextCount(daily, undefined), 1)
eq('negative is treated as nothing done', nextCount(daily, -4), 1)
eq('a one-off goal is a single toggle', nextCount({ cadence: 'once' }, 0), 1)

/* --- streakOf: the boundary of today ------------------------------------ */
{
  const ix = indexDays([tick(daily, -1), tick(daily, -2), tick(daily, -3)])
  eq('three yesterdays, nothing today yet, still three', streakOf(daily, ix, WED), 3)
}
{
  const ix = indexDays([tick(daily, 0), tick(daily, -1), tick(daily, -2)])
  eq('today plus two behind it is three', streakOf(daily, ix, WED), 3)
}
{
  const ix = indexDays([tick(daily, 0)])
  eq('today alone is one', streakOf(daily, ix, WED), 1)
}
{
  eq('nothing at all is zero', streakOf(daily, indexDays([]), WED), 0)
}
{
  const ix = indexDays([tick(daily, -2), tick(daily, -3)])
  eq('a missed yesterday ends it', streakOf(daily, ix, WED), 0)
}
{
  const ix = indexDays([tick(daily, 0), tick(daily, -1), tick(daily, -3)])
  eq('a hole two days back stops the count there', streakOf(daily, ix, WED), 2)
}

/* --- streakOf: partial days do not count -------------------------------- */
{
  const ix = indexDays([tick(thrice, -1, 3), tick(thrice, -2, 2), tick(thrice, -3, 3)])
  eq('two of three is not a day kept', streakOf(thrice, ix, WED), 1)
}
{
  const ix = indexDays([tick(thrice, 0, 1), tick(thrice, -1, 3)])
  eq('a partial today does not break yesterday', streakOf(thrice, ix, WED), 1)
}

/* --- streakOf: days the goal never ran on ------------------------------- */
{
  /* Wed 12th, Mon 10th, Wed 5th, Mon 3rd. The Tuesdays, Thursdays, Fridays,
     Saturdays and Sundays in between are not misses. */
  const ix = indexDays([tick(monWed, 0), tick(monWed, -2), tick(monWed, -7), tick(monWed, -9)])
  eq('a Mon/Wed goal is not broken by a Tuesday', streakOf(monWed, ix, WED), 4)
}
{
  const ix = indexDays([tick(monWed, -2), tick(monWed, -7)])
  eq('Thursday, with Wednesday missed, ends it', streakOf(monWed, ix, d(1)), 0)
}
{
  const ix = indexDays([tick(monWed, 0), tick(monWed, -2)])
  eq('Thursday, with Wednesday kept, still counts', streakOf(monWed, ix, d(1)), 2)
}

/* --- streakOf: status is a fact about now, not about history ------------- */
{
  const ix = indexDays([tick(daily, -1), tick(daily, -2), tick(daily, -3)])
  const paused = { ...daily, status: 'paused' }
  eq('pausing does not wipe the streak already earned', streakOf(paused, ix, WED), 3)
  const done = { ...daily, status: 'completed' }
  eq('nor does finishing it', streakOf(done, ix, WED), 3)
}

/* --- streakOf: the goal did not exist yet ------------------------------- */
{
  const born = { ...daily, created_at: dayKey(d(-2)) }
  const ix = indexDays([tick(daily, 0), tick(daily, -1), tick(daily, -2), tick(daily, -3)])
  eq('the walk stops where the goal begins', streakOf(born, ix, WED), 3)
}
{
  const born = { ...daily, created_at: null, starts_on: dayKey(d(-1)) }
  const ix = indexDays([tick(daily, 0), tick(daily, -1), tick(daily, -2)])
  eq('starts_on is used when there is no created_at', streakOf(born, ix, WED), 2)
}

/* --- streakOf: bounded -------------------------------------------------- */
{
  const rows = []
  for (let i = 0; i < LOOKBACK_DAYS + 40; i += 1) rows.push(tick(daily, -i))
  const ix = indexDays(rows)
  const n = streakOf(daily, ix, WED)
  ok('an unbroken year and a bit is capped, not walked forever', n <= LOOKBACK_DAYS, `got ${n}`)
  ok('and it is still a big number', n > 300, `got ${n}`)
}
eq('a goal with no id has no streak', streakOf({}, indexDays([]), WED), 0)
eq('no goal at all has no streak', streakOf(null, indexDays([]), WED), 0)

/* --- recentDays --------------------------------------------------------- */
{
  const row = recentDays(daily, indexDays([tick(daily, 0), tick(daily, -2)]), 7, WED)
  eq('seven days', row.length, 7)
  eq('oldest first', row[0].day, dayKey(d(-6)))
  eq('today last', row[6].day, dayKey(WED))
  ok('today is filled', row[6].done)
  ok('two days back is filled', row[4].done)
  ok('yesterday is not', !row[5].done)
  ok('every day of a daily goal is due', row.every((x) => x.due))
}
{
  const row = recentDays(monWed, indexDays([]), 7, WED)
  eq('a Mon/Wed goal is due twice in seven days', row.filter((x) => x.due).length, 2)
}
{
  const row = recentDays(thrice, indexDays([tick(thrice, 0, 2)]), 3, WED)
  ok('a partial day is not a filled dot', !row[2].done)
}

/* --- since -------------------------------------------------------------- */
eq('the fetch window matches the walk', since(WED), dayKey(shiftDay(WED, -LOOKBACK_DAYS)))
ok('and it is a plain date string', /^\d{4}-\d{2}-\d{2}$/.test(since(WED)))

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
