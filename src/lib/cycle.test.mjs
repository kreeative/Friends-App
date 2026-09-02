/**
 * node src/lib/cycle.test.mjs
 *
 * The arithmetic behind the cycle tracker.
 *
 * Everything here is pinned to fixed dates and an injected "today", because a
 * test that passes in August and fails in March is worse than no test: the
 * failure arrives months later attached to whatever was being changed at the
 * time.
 *
 * The cases that matter most are the ones where the naive implementation is
 * wrong rather than merely imprecise: counting ovulation forwards from the
 * last period instead of backwards from the next, parsing a date string as
 * UTC and losing a day west of Greenwich, and averaging in a gap that is
 * really two entries for one period.
 */
import {
  DEFAULT_CYCLE,
  LUTEAL_DAYS,
  MAX_CYCLE,
  MIN_CYCLE,
  addDays,
  cleanStarts,
  dayKey,
  daysBetween,
  estimate,
  fromKey,
  gapsOf,
  phaseOn,
  predict,
  remindOn,
} from './cycle.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) =>
  ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\ncycle')

/* --- dates, which is where a day gets lost ------------------------------- */

eq('a key round-trips', dayKey(fromKey('2026-08-01')), '2026-08-01')
eq('the first of the month stays the first', fromKey('2026-08-01').getDate(), 1)
eq('and stays in August', fromKey('2026-08-01').getMonth(), 7)
ok('a nonsense string is null', fromKey('not a date') === null)
ok('undefined is null', fromKey(undefined) === null)

/* The bug this guards: `new Date('2026-08-01')` is UTC midnight, which in any
   negative offset displays as 31 July. Every prediction below would be a day
   early for the whole of the Americas. */
eq('a date string is not read as UTC', fromKey('2026-01-01').getDate(), 1)

eq('days between two dates', daysBetween(fromKey('2026-08-01'), fromKey('2026-08-29')), 28)
eq('backwards is negative', daysBetween(fromKey('2026-08-29'), fromKey('2026-08-01')), -28)
eq('the same day is zero', daysBetween(fromKey('2026-08-01'), fromKey('2026-08-01')), 0)
eq('across a month boundary', daysBetween(fromKey('2026-01-28'), fromKey('2026-02-04')), 7)
eq('across a leap day', daysBetween(fromKey('2028-02-28'), fromKey('2028-03-01')), 2)
eq('across a non-leap February', daysBetween(fromKey('2026-02-28'), fromKey('2026-03-01')), 1)
eq('addDays crosses a month', dayKey(addDays(fromKey('2026-08-30'), 5)), '2026-09-04')
eq('addDays backwards', dayKey(addDays(fromKey('2026-09-02'), -5)), '2026-08-28')

/* --- cleaning what comes out of the database ---------------------------- */

eq('rows are accepted', cleanStarts([{ started_on: '2026-08-01' }]).length, 1)
eq('so are plain strings', cleanStarts(['2026-08-01']).length, 1)
eq('the same day twice is once', cleanStarts(['2026-08-01', '2026-08-01']).length, 1)
eq('they come back oldest first', dayKey(cleanStarts(['2026-08-01', '2026-07-04'])[0]), '2026-07-04')
eq('rubbish is dropped, not thrown', cleanStarts(['nope', '2026-08-01']).length, 1)
eq('nothing is an empty list', cleanStarts(null).length, 0)

/* --- the gaps, and the ones that must not count ------------------------- */

eq('two starts make one gap', gapsOf(cleanStarts(['2026-07-04', '2026-08-01'])).length, 1)
eq('and it is the right length', gapsOf(cleanStarts(['2026-07-04', '2026-08-01']))[0], 28)

/* Somebody logging the start and then a heavy day two days later. Averaged in,
   it drags a 28-day estimate down to 15. */
eq(
  'a gap under the minimum is not a cycle',
  gapsOf(cleanStarts(['2026-08-01', '2026-08-03'])).length,
  0,
)
/* A period that went unrecorded. Averaged in, the app tells somebody their
   cycle is eight weeks. */
eq(
  'a gap over the maximum is a missed entry, not a cycle',
  gapsOf(cleanStarts(['2026-06-01', '2026-08-01'])).length,
  0,
)
eq('the boundary is inclusive at the bottom', gapsOf([fromKey('2026-08-01'), addDays(fromKey('2026-08-01'), MIN_CYCLE)]).length, 1)
eq('and at the top', gapsOf([fromKey('2026-08-01'), addDays(fromKey('2026-08-01'), MAX_CYCLE)]).length, 1)

/* --- the estimate ------------------------------------------------------- */

const noData = estimate([])
eq('with nothing recorded the length is the default', noData.length, DEFAULT_CYCLE)
eq('and it says it is a default', noData.source, 'default')
eq('with no confidence at all', noData.confidence, 'none')

const stated = estimate(['2026-08-01'], 30)
eq('a stated average is used when there is no history', stated.length, 30)
eq('and it says where it came from', stated.source, 'stated')
eq('but the confidence is low', stated.confidence, 'low')

/* Four recorded periods, gaps of 28, 28, 28. The measurements are better than
   the recollection at this point and must win. */
const regular = estimate(['2026-05-10', '2026-06-07', '2026-07-05', '2026-08-02'], 35)
eq('with a real history the measurements beat the stated figure', regular.length, 28)
eq('and it says so', regular.source, 'measured')
eq('three consistent gaps is good confidence', regular.confidence, 'good')
eq('and no spread', regular.spread, 0)

/* The same number of gaps, but they disagree: 26, 34, 27. */
const erratic = estimate(['2026-05-01', '2026-05-27', '2026-06-30', '2026-07-27'])
eq('a wide spread is reported', erratic.spread, 8)
eq('and downgrades the confidence', erratic.confidence, 'fair')

const twoGaps = estimate(['2026-06-07', '2026-07-05', '2026-08-02'])
eq('two gaps is still only low confidence', twoGaps.confidence, 'low')

/* --- the prediction ----------------------------------------------------- */

ok('nothing recorded predicts nothing', predict([]) === null)

const today = fromKey('2026-08-10')
const p = predict(['2026-05-10', '2026-06-07', '2026-07-05', '2026-08-02'], null, today)

eq('the next start is one cycle after the last', dayKey(p.nextStart), '2026-08-30')

/**
 * The one that matters. Ovulation is 14 days BEFORE the next period, not 14
 * days after the last one. On a 28-day cycle those coincide, which is exactly
 * why the mistake survives; the erratic case below is where they separate.
 */
eq('ovulation is counted back from the next period', dayKey(p.ovulation), '2026-08-16')
eq('the fertile window opens five days before that', dayKey(p.fertileFrom), '2026-08-11')
eq('and closes on the day itself', dayKey(p.fertileTo), '2026-08-16')
eq('the run-up starts five days before the period', dayKey(p.pmsFrom), '2026-08-25')
eq('and ends the day before it', dayKey(p.pmsTo), '2026-08-29')
eq('the cycle day is counted from the last recorded start', p.dayOfCycle, 9)

/* A 34-day cycle. Counting ovulation forwards from the last period would put
   it on day 14, the 4th; counting back from the next start puts it on the
   24th. Twenty days apart, and the forwards answer is wrong. */
const long = predict(
  [fromKey('2026-04-14'), fromKey('2026-05-18'), fromKey('2026-06-21'), fromKey('2026-07-25')],
  null,
  fromKey('2026-08-01'),
)
eq('a long cycle is measured, not assumed', long.length, 34)
eq('and ovulation moves with it', dayKey(long.ovulation), dayKey(addDays(long.nextStart, -LUTEAL_DAYS)))
ok('which is not day 14 of the cycle', dayKey(long.ovulation) !== '2026-08-07')

/* --- somebody who stopped opening the app ------------------------------- */

const stale = predict(['2026-05-10', '2026-06-07', '2026-07-05'], null, fromKey('2026-10-01'))
ok('a stale last entry does not predict a date in the past', daysBetween(fromKey('2026-10-01'), stale.nextStart) >= 0)
ok('and it says how many went unrecorded', stale.missed >= 2, String(stale.missed))

/* --- the window widens rather than narrowing ---------------------------- */

const tight = predict(['2026-05-10', '2026-06-07', '2026-07-05', '2026-08-02'], null, today)
const loose = predict(['2026-05-01', '2026-05-27', '2026-06-30', '2026-07-27'], null, today)
ok('a consistent history draws a narrow window', tight.window === 1, String(tight.window))
ok('an erratic one draws a wider one', loose.window > tight.window, `${loose.window} vs ${tight.window}`)

/* --- what a single day is ----------------------------------------------- */

const starts = ['2026-05-10', '2026-06-07', '2026-07-05', '2026-08-02']
const pp = predict(starts, null, today)

eq('the first day of a recorded period', phaseOn('2026-08-02', starts, pp), 'period')
eq('the last day of it', phaseOn('2026-08-06', starts, pp), 'period')
eq('the day after is not', phaseOn('2026-08-07', starts, pp) !== 'period', true)
eq('a fertile day', phaseOn('2026-08-14', starts, pp), 'fertile')
eq('a day in the run-up', phaseOn('2026-08-26', starts, pp), 'pms')
eq('the predicted start', phaseOn('2026-08-30', starts, pp), 'predicted')
eq('an ordinary day is nothing', phaseOn('2026-08-20', starts, pp), null)

/* A recorded day inside what the estimate thinks is something else must still
   read as recorded. The fact outranks the guess. */
eq(
  'a recorded period beats a prediction about the same day',
  phaseOn('2026-08-02', starts, { ...pp, nextStart: fromKey('2026-08-02'), window: 2 }),
  'period',
)

/* --- the reminder ------------------------------------------------------- */

eq('fires on the day it is due', remindOn(pp, 2, fromKey('2026-08-28')) !== null, true)
eq('and names how far ahead', remindOn(pp, 2, fromKey('2026-08-28')).ahead, 2)
ok('not the day before that', remindOn(pp, 2, fromKey('2026-08-27')) === null)
ok('nor the day after', remindOn(pp, 2, fromKey('2026-08-29')) === null)
ok('and never without a prediction', remindOn(null, 2, today) === null)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
