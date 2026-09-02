/**
 * node src/lib/agenda.test.mjs
 *
 * Expanding stored recurrence rules into the blocks a grid draws.
 *
 * The cases worth having are the ones where a naive expander is wrong rather
 * than slow: an open-ended weekly rule that would expand forever, a rule whose
 * first day is before the range being drawn, one whose end date falls inside
 * the range, and the day-of-week numbering, which is off by one in every
 * implementation that mixes Monday-first display with getDay().
 */
import { addDays, dayKey, fromKey } from './cycle.js'
import {
  CATEGORIES,
  CATEGORY_COLOUR,
  agendaFor,
  blockStyle,
  clockOf,
  dayBounds,
  minutesOf,
  occurrencesOf,
} from './agenda.js'

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
  ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nagenda')

/* --- clocks -------------------------------------------------------------- */

eq('minutes to a clock', clockOf(570), '09:30')
eq('midnight', clockOf(0), '00:00')
eq('the last minute of the day', clockOf(1439), '23:59')
eq('null stays null', clockOf(null), null)
eq('a clock to minutes', minutesOf('09:30'), 570)
eq('a single-digit hour', minutesOf('9:30'), 570)
eq('midnight back', minutesOf('00:00'), 0)
eq('an impossible hour is refused', minutesOf('25:00'), null)
eq('an impossible minute is refused', minutesOf('10:75'), null)
eq('nonsense is refused', minutesOf('lunch'), null)
eq('empty is refused', minutesOf(''), null)

/* --- a one-off ----------------------------------------------------------- */

const once = { id: 'a', title: 'Examen', starts_on: '2026-09-15', weekdays: [] }
eq('a one-off inside the range appears', occurrencesOf(once, fromKey('2026-09-01'), fromKey('2026-09-30')).length, 1)
eq('and on the right day', dayKey(occurrencesOf(once, fromKey('2026-09-01'), fromKey('2026-09-30'))[0]), '2026-09-15')
eq('outside the range it does not', occurrencesOf(once, fromKey('2026-10-01'), fromKey('2026-10-31')).length, 0)
eq('the range is inclusive at the start', occurrencesOf(once, fromKey('2026-09-15'), fromKey('2026-09-20')).length, 1)
eq('and at the end', occurrencesOf(once, fromKey('2026-09-10'), fromKey('2026-09-15')).length, 1)

/* --- weekly -------------------------------------------------------------- */

/* 1 September 2026 is a Tuesday. weekdays uses getDay(), so Tuesday is 2 and
   Thursday is 4. September 2026 has five Tuesdays and four Thursdays. */
const course = {
  id: 'b',
  title: 'Biochimie',
  category: 'cours',
  starts_on: '2026-09-01',
  start_min: 600,
  end_min: 720,
  weekdays: [2, 4],
}
const sept = occurrencesOf(course, fromKey('2026-09-01'), fromKey('2026-09-30'))
eq('a twice-weekly course lands nine times in September', sept.length, 9)
eq('the first is the 1st, a Tuesday', dayKey(sept[0]), '2026-09-01')
eq('the second is the 3rd, a Thursday', dayKey(sept[1]), '2026-09-03')
ok('every occurrence is a Tuesday or a Thursday', sept.every((d) => d.getDay() === 2 || d.getDay() === 4))

/* --- the bounds that stop it running away -------------------------------- */

eq(
  'nothing is generated before the rule begins',
  occurrencesOf(course, fromKey('2026-08-01'), fromKey('2026-08-31')).length,
  0,
)

const ended = { ...course, until_on: '2026-09-10' }
const upTo = occurrencesOf(ended, fromKey('2026-09-01'), fromKey('2026-09-30'))
eq('an end date stops it', upTo.length, 4)
eq('and the last one is on or before that date', dayKey(upTo[upTo.length - 1]), '2026-09-10')

eq(
  'a range entirely after the end date is empty',
  occurrencesOf(ended, fromKey('2026-10-01'), fromKey('2026-10-31')).length,
  0,
)

/* An open-ended weekly rule asked for one week must produce one week, not
   every Tuesday until the heat death of the universe. */
const oneWeek = occurrencesOf(course, fromKey('2027-03-01'), fromKey('2027-03-07'))
ok('an open-ended rule is bounded by the range asked for', oneWeek.length <= 2, String(oneWeek.length))

eq('a backwards range is empty', occurrencesOf(course, fromKey('2026-09-30'), fromKey('2026-09-01')).length, 0)
eq('a rule with no valid start is empty', occurrencesOf({ id: 'x', starts_on: 'nope' }, fromKey('2026-09-01'), fromKey('2026-09-30')).length, 0)
/**
 * A weekday outside 0 to 6 cannot come from the form and is refused by the
 * check constraint in migration 51. If one arrives anyway, the expander drops
 * it, finds no valid days left, and falls back to drawing the row once on its
 * start date.
 *
 * That is deliberate and it is the better of the two failures: an event
 * somebody created that appears once is recoverable, and one that vanishes
 * entirely looks like data loss. This assertion pins the fallback so that
 * "invalid recurrence" never quietly becomes "no event".
 */
eq(
  'a corrupt weekday falls back to drawing it once rather than losing it',
  occurrencesOf({ ...course, weekdays: [9] }, fromKey('2026-09-01'), fromKey('2026-09-30')).length,
  1,
)

/* --- the day map --------------------------------------------------------- */

const exam = { id: 'c', title: 'Partiel', category: 'examen', starts_on: '2026-09-03', start_min: 480, end_min: 600, weekdays: [] }
const allDay = { id: 'd', title: 'Ferie', category: 'perso', starts_on: '2026-09-03', weekdays: [] }
const map = agendaFor([course, exam, allDay], fromKey('2026-09-01'), fromKey('2026-09-30'))

ok('the map is keyed by day', map.has('2026-09-03'))
eq('a day with three things has three', map.get('2026-09-03').length, 3)
eq('the all-day entry sorts first', map.get('2026-09-03')[0].title, 'Ferie')
eq('then the 08:00', map.get('2026-09-03')[1].title, 'Partiel')
eq('then the 10:00', map.get('2026-09-03')[2].title, 'Biochimie')

eq('each occurrence has its own id', map.get('2026-09-01')[0].occurrenceId, 'b:2026-09-01')
ok(
  'and two occurrences of one rule do not collide',
  map.get('2026-09-01')[0].occurrenceId !== map.get('2026-09-03').find((e) => e.id === 'b').occurrenceId,
)

eq('a category paints its default colour', map.get('2026-09-01')[0].colour, CATEGORY_COLOUR.cours)
eq(
  'and an explicit colour on the row wins',
  agendaFor([{ ...course, colour: 'yellow' }], fromKey('2026-09-01'), fromKey('2026-09-02')).get('2026-09-01')[0].colour,
  'yellow',
)

eq('no events is an empty map', agendaFor([], fromKey('2026-09-01'), fromKey('2026-09-30')).size, 0)
eq('null events is an empty map', agendaFor(null, fromKey('2026-09-01'), fromKey('2026-09-30')).size, 0)

/* --- positioning --------------------------------------------------------- */

const s = blockStyle({ start_min: 600, end_min: 720 }, 7 * 60, 23 * 60)
eq('10:00 on a 07:00 to 23:00 grid is three sixteenths down', s.top, '18.750%')
eq('and two hours of sixteen is an eighth tall', s.height, '12.500%')

const early = blockStyle({ start_min: 300, end_min: 420 }, 7 * 60, 23 * 60)
eq('something before the grid starts is clipped to the top', early.top, '0.000%')

const tiny = blockStyle({ start_min: 600, end_min: 610 }, 7 * 60, 23 * 60)
ok('a ten-minute block still has room for a word', Number.parseFloat(tiny.height) >= 2.2)

/* --- fitting the grid to the day ---------------------------------------- */

const normal = dayBounds([{ start_min: 600, end_min: 720 }])
eq('an ordinary day keeps the default start', normal.from, 7 * 60)
eq('and the default end', normal.to, 23 * 60)

const earlyStart = dayBounds([{ start_min: 5 * 60, end_min: 6 * 60 }])
eq('an early lecture pulls the grid up', earlyStart.from, 4 * 60)

const lateNight = dayBounds([{ start_min: 22 * 60, end_min: 23 * 60 + 30 }])
eq('a late one pushes it down', lateNight.to, 1440)

eq('nothing at all is the default', dayBounds([]).from, 7 * 60)
eq('and never wider than the day', dayBounds([{ start_min: 0, end_min: 1440 }]).from, 0)

/* --- the categories the database allows --------------------------------- */

eq('the four categories match the check constraint', CATEGORIES, ['cours', 'examen', 'etude', 'perso'])
ok('and every one has a colour', CATEGORIES.every((c) => CATEGORY_COLOUR[c]))

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
