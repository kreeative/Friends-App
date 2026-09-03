/**
 * node src/lib/dayMarks.test.mjs
 *
 * What the dashboard's mini calendar puts under a date, and what it lists when
 * you tap it.
 *
 * The cases worth having are the ones where a join goes wrong quietly: a day
 * with four classes drawing four identical dots, a goal appearing twice
 * because it arrived by both routes, and a dot with nothing behind it.
 */
import { addDays, dayKey, fromKey } from './cycle.js'
import { agendaFor } from './agenda.js'
import { MARK_KINDS, countsFor, itemsFor, marksFor } from './dayMarks.js'

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

console.log('\nday marks')

/* 3 September 2026 is a Thursday. */
const THU = fromKey('2026-09-03')
const KEY = '2026-09-03'

const course = {
  id: 'e1', title: 'Cours de Finance', category: 'cours',
  starts_on: '2026-09-01', start_min: 600, end_min: 720, weekdays: [4],
}
const exam = {
  id: 'e2', title: 'Partiel', category: 'examen',
  starts_on: '2026-09-03', start_min: 480, end_min: 600, weekdays: [],
}
const ferie = { id: 'e3', title: 'Ferie', category: 'perso', starts_on: '2026-09-03', weekdays: [] }

const agenda = agendaFor([course, exam, ferie], THU, THU)

/* --- what a day holds ---------------------------------------------------- */

const items = itemsFor(THU, { agenda })
eq('three things on the day', items.length, 3)
eq('the all-day entry sorts first, as it does on the grid', items[0].title, 'Ferie')
eq('then the 08:00', items[1].title, 'Partiel')
eq('then the 10:00', items[2].title, 'Cours de Finance')

eq('a timed entry carries its range', items[2].detail, '10:00 - 12:00')
eq('an all-day one carries none', items[0].detail, null)
eq('and the room comes through', itemsFor(THU, { agenda: agendaFor([{ ...course, location: 'B-204' }], THU, THU) })[0].location, 'B-204')

/* --- the dots ------------------------------------------------------------ */

eq('four classes are still one dot', marksFor(THU, { agenda }), ['event'])
eq('and the count is where the number lives', countsFor(THU, { agenda }).event, 3)

const goalsByDay = { [KEY]: [{ id: 'g1', commitment: 'Rendre le memoire' }] }
eq('a goal adds its own dot', marksFor(THU, { agenda, goalsByDay }), ['event', 'goal'])

const phaseOf = (k) => (k === KEY ? 'period' : null)
eq('so does the cycle', marksFor(THU, { agenda, goalsByDay, phaseOf }), ['event', 'goal', 'cycle'])

const logged = (k) => k === KEY
eq(
  'and logged goes last, because it is the past tense',
  marksFor(THU, { agenda, goalsByDay, phaseOf, logged }),
  ['event', 'goal', 'cycle', 'logged'],
)
eq('the order is the declared one', marksFor(THU, { agenda, goalsByDay, phaseOf, logged }), MARK_KINDS)

/* --- nothing at all ------------------------------------------------------ */

const FRI = addDays(THU, 1)
eq('an empty day has no dots', marksFor(FRI, { agenda, goalsByDay, phaseOf, logged }), [])
eq('and nothing to list', itemsFor(FRI, { agenda }).length, 0)
eq('a day with no context at all is empty rather than an error', itemsFor(THU, {}).length, 0)
eq('and so is a missing day', itemsFor(null, { agenda }).length, 0)

/* --- the duplicate that would not look like a bug ------------------------ */

/**
 * The calendar page feeds goals THROUGH agendaFor, so they arrive as agenda
 * entries carrying goalId. The dashboard reads them separately. If both
 * happen, the goal must still appear once: twice on its own due date is the
 * kind of duplicate nobody reports and everybody sees.
 */
const goalAsEvent = {
  id: 'goal:g1', goalId: 'g1', title: 'Rendre le memoire', category: 'objectif',
  starts_on: '2026-09-03', weekdays: [],
}
const both = agendaFor([goalAsEvent], THU, THU)
eq('a goal arriving by the agenda is a goal, not an event', itemsFor(THU, { agenda: both })[0].kind, 'goal')
/* The dashboard's own row carries the goal's id, `g1`. The agenda entry
   carries occurrenceId `goal:g1:2026-09-03` and goalId `g1`, so the dedup has
   to compare goalId and not the row id. Comparing row ids was the first
   version and it listed the goal twice. */
eq(
  'and arriving by both routes still lists once',
  itemsFor(THU, { agenda: both, goalsByDay: { [KEY]: [{ id: 'g1', commitment: 'Rendre le memoire' }] } }).length,
  1,
)
eq(
  'a different goal on the same day is not swallowed by the dedup',
  itemsFor(THU, { agenda: both, goalsByDay: { [KEY]: [{ id: 'g2', commitment: 'Autre chose' }] } }).length,
  2,
)

/* --- the cycle row ------------------------------------------------------- */

const cycleOnly = itemsFor(THU, { phaseOf })
eq('a cycle day on its own still lists', cycleOnly.length, 1)
eq('and says which phase, so the copy can differ', cycleOnly[0].phase, 'period')
eq('it has no title of its own', cycleOnly[0].title, null)
eq('a phase of null is not a row', itemsFor(THU, { phaseOf: () => null }).length, 0)

/* --- a key rather than a Date -------------------------------------------- */

eq('a day key works as well as a Date', itemsFor(KEY, { agenda }).length, 3)
eq('and produces the same dots', marksFor(KEY, { agenda }), marksFor(THU, { agenda }))
eq('the key of the fixture is the one being asserted on', dayKey(THU), KEY)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
