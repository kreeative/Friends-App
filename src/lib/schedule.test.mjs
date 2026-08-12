import { dueOn, isDueOn, outcomeFor, targetFor } from './schedule.js'
let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

const wed = new Date(2026, 7, 12)   // Wednesday 12 August 2026
const sat = new Date(2026, 7, 15)

// ---- recurring, and the days it runs on ------------------------------------
const daily = { cadence: 'recurring', status: 'active', target_per_cycle: 3 }
eq('no days means every day',      isDueOn(daily, wed), true)
eq('empty days means every day',   isDueOn({ ...daily, active_days: [] }, wed), true)
eq('null days means every day',    isDueOn({ ...daily, active_days: null }, wed), true)

const twice = { ...daily, target_per_cycle: 1, active_days: [1, 3] }  // Mon, Wed
eq('due on a listed day',      isDueOn(twice, wed), true)
eq('not due on an unlisted one', isDueOn(twice, sat), false)

// ---- the window a goal is alive for ----------------------------------------
eq('before it starts',  isDueOn({ ...daily, starts_on: '2026-08-20' }, wed), false)
eq('on the day it starts', isDueOn({ ...daily, starts_on: '2026-08-12' }, wed), true)
eq('after it ends',     isDueOn({ ...daily, ends_on: '2026-08-01' }, wed), false)
eq('on the day it ends', isDueOn({ ...daily, ends_on: '2026-08-12' }, wed), true)

// A date column is a calendar date. Parsed as an instant it reads as the day
// before for everybody west of Greenwich.
eq('dates are not instants', isDueOn({ ...daily, starts_on: '2026-08-12T00:00:00Z' }, wed), true)

// ---- paused and finished goals are not on anybody's list -------------------
eq('paused is not due',    isDueOn({ ...daily, status: 'paused' }, wed), false)
eq('completed is not due', isDueOn({ ...daily, status: 'completed' }, wed), false)
eq('no status is assumed live', isDueOn({ cadence: 'recurring' }, wed), true)
eq('nothing is not due',   isDueOn(null, wed), false)

// ---- one-offs wait for their deadline, then never let go -------------------
const once = { cadence: 'once', status: 'active' }
eq('no deadline is always due', isDueOn(once, wed), true)
eq('far off is out of the way', isDueOn({ ...once, due_on: '2026-08-30' }, wed), false)
eq('a week out is in sight',    isDueOn({ ...once, due_on: '2026-08-19' }, wed), true)
eq('eight days out is not',     isDueOn({ ...once, due_on: '2026-08-20' }, wed), false)
eq('on the day itself',         isDueOn({ ...once, due_on: '2026-08-12' }, wed), true)
eq('overdue stays on the list', isDueOn({ ...once, due_on: '2026-07-01' }, wed), true)

// ---- filtering the list ----------------------------------------------------
eq(
  'only what is due, in order',
  dueOn([{ id: 'a', ...twice }, { id: 'b', ...daily }, { id: 'c', ...once, due_on: '2026-12-01' }], sat)
    .map((g) => g.id),
  ['b'],
)
eq('an empty list is empty', dueOn([], wed), [])
eq('called with nothing', dueOn(undefined, wed), [])

// ---- targets and outcomes --------------------------------------------------
eq('a one-off wants one',       targetFor(once), 1)
eq('a daily wants its number',  targetFor(daily), 3)
eq('zero is floored to one',    targetFor({ cadence: 'recurring', target_per_cycle: 0 }), 1)
eq('missing is floored to one', targetFor({ cadence: 'recurring' }), 1)

eq('none of three is missed',  outcomeFor(daily, 0), 'missed')
eq('two of three is partial',  outcomeFor(daily, 2), 'partial')
eq('three of three is done',   outcomeFor(daily, 3), 'done')
eq('more than the target is still done', outcomeFor(daily, 5), 'done')
eq('a one-off ticked is done', outcomeFor(once, 1), 'done')
eq('a one-off untouched',      outcomeFor(once, 0), 'missed')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
