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
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addDays, dayKey, fromKey } from './cycle.js'
import {
  CATEGORIES,
  CATEGORY_COLOUR,
  LAYERS,
  LAYER_COLOUR,
  agendaFor,
  blockStyle,
  clockOf,
  dayBounds,
  layerOf,
  minutesOf,
  occurrencesOf,
  timetableRows,
  visibleEvents,
  weekdayName,
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
  agendaFor([{ ...course, colour: 'cat-4' }], fromKey('2026-09-01'), fromKey('2026-09-02')).get('2026-09-01')[0].colour,
  'cat-4',
)

/**
 * Every default must be a token tailwind.config.js actually declares.
 *
 * 'blue' and 'violet' were used here and are not tokens in this project, so
 * the chips painted transparent. Read straight out of the config so the two
 * cannot drift: an invented name fails here rather than in a screenshot
 * somebody has to squint at.
 */
const cfg = readFileSync(new URL('../../tailwind.config.js', import.meta.url), 'utf8')
const declared = new Set([
  ...[...cfg.matchAll(/^\s{8}'?([a-z0-9-]+)'?:\s*c\(/gm)].map((m) => m[1]),
  ...[...cfg.matchAll(/(\d)'?:\s*c\('cat-\1'\)/g)].map((m) => `cat-${m[1]}`),
])
/**
 * 'quiet' is the one allowed value that is NOT a token, and it is not an
 * oversight in either direction.
 *
 * It is in the check constraint on `colour`, and SWATCH renders it as
 * `bg-ink/[0.06]`: the sentinel for "no colour of its own", which is what the
 * health category wants. A token would have to be a real hue. So the rule is
 * "a declared token, or this one name", and stating it that way is what stops
 * the next invented colour slipping through on the same excuse.
 */
const NOT_A_TOKEN = new Set(['quiet'])
for (const [cat, colour] of Object.entries(CATEGORY_COLOUR)) {
  ok(
    `${cat} paints in a token that exists, or in quiet (${colour})`,
    declared.has(colour) || NOT_A_TOKEN.has(colour),
    [...declared].join(', '),
  )
}

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

eq('the seven categories match the check constraint', CATEGORIES,
   ['cours', 'examen', 'etude', 'travail', 'evenement', 'perso', 'sante'])
/**
 * The allowed colours, READ OUT OF THE MIGRATION rather than copied into here.
 *
 * This list was a literal for one round and it went stale the moment the
 * palette widened: the constraint in 53 and the array in this file were two
 * copies of one fact, and a test that asserts a copy against itself proves
 * nothing about the database. Parsing the SQL means the failure this catches
 * is the one that matters, a client assigning a colour postgres will reject.
 *
 * The check is `colour in ('a', 'b', ...)`, so the quoted strings inside the
 * last such clause are the answer. If somebody restructures the constraint the
 * match fails loudly rather than silently allowing everything, which is what
 * the length assertion below is for.
 */
const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', '53_event_colour_palette.sql'),
  'utf8',
)
const clause = sql.match(/add constraint calendar_event_colour_check\s*\n?\s*check \(colour in \(([\s\S]*?)\)\)/)
ok('the colour constraint is where this test thinks it is', Boolean(clause))
const ALLOWED_COLOURS = [...(clause?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
ok('and it lists a palette rather than nothing', ALLOWED_COLOURS.length >= 7, String(ALLOWED_COLOURS.length))
ok('every category paints in a colour the constraint allows',
   CATEGORIES.every((c) => ALLOWED_COLOURS.includes(CATEGORY_COLOUR[c])),
   CATEGORIES.map((c) => `${c}:${CATEGORY_COLOUR[c]}`).join(' '))
/* The reverse direction. A colour the database accepts that Tailwind cannot
   build paints transparent, which is the failure the note in Calendar.jsx
   records: chips that looked plausible in a screenshot and measured 1:1
   against the tile behind them. */
const TOKENS = new Set(['accent', 'green', 'quiet', 'ink', 'negative',
                        'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'])
ok('and every colour the constraint allows is a token that exists',
   ALLOWED_COLOURS.every((c) => TOKENS.has(c)),
   ALLOWED_COLOURS.filter((c) => !TOKENS.has(c)).join(' '))
ok('and no two share one, so the grid can be read',
   new Set(CATEGORIES.map((c) => CATEGORY_COLOUR[c])).size === CATEGORIES.length)
/**
 * THE RAMP IS ONE RAMP PER THEME, NOT SIX INDEPENDENT HUES.
 *
 * cat-1 to cat-6 are six steps of one gradient: pink to yellow in sun, navy to
 * light blue in sea. Adjacent steps of the sea ramp measured 7.6 apart in
 * CIE76 on the painted pixels, and anything under about 10 reads as one
 * colour. Four picks from six always leaves an adjacent pair, so the rule is
 * three picks with a gap of at least two between them.
 *
 * This is the assertion that catches somebody adding an eighth category by
 * reaching for the next free step, which looks obviously correct and puts two
 * indistinguishable chips on the sea theme's grid.
 */
const steps = CATEGORIES
  .map((c) => /^cat-([1-6])$/.exec(CATEGORY_COLOUR[c]))
  .filter(Boolean)
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b)
ok('at most three steps of the ramp are spent', steps.length <= 3, steps.join(','))
ok('and no two of them are adjacent',
   steps.every((n, i) => i === 0 || n - steps[i - 1] >= 2),
   steps.join(','))
eq('work, parties and appointments are all on the personal layer',
   ['travail', 'evenement', 'sante'].map((c) => layerOf({ category: c })), ['perso', 'perso', 'perso'])
ok('and every one has a colour', CATEGORIES.every((c) => CATEGORY_COLOUR[c]))

/* --- skipping one occurrence of a rule ---------------------------------- */

/**
 * "Delete only this one" on a weekly class has no other honest implementation.
 * Deleting the row removes the term; setting until_on to the day before
 * removes the rest of it too; splitting the rule makes one class into two that
 * drift apart. So the rule stays whole and records the days it skips.
 */
const withSkip = { ...course, excluded_on: ['2026-09-03'] }
const kept = occurrencesOf(withSkip, fromKey('2026-09-01'), fromKey('2026-09-30')).map(dayKey)
eq('the excluded day is gone', kept.includes('2026-09-03'), false)
eq('and only that day', kept.length, sept.length - 1)
eq('the first Tuesday is untouched', kept[0], '2026-09-01')
eq('and so is the rest of the term', kept[kept.length - 1], '2026-09-29')

eq('two exclusions remove two days',
   occurrencesOf({ ...course, excluded_on: ['2026-09-01', '2026-09-03'] }, fromKey('2026-09-01'), fromKey('2026-09-30')).length,
   sept.length - 2)
eq('an exclusion for a day the rule never lands on changes nothing',
   occurrencesOf({ ...course, excluded_on: ['2026-09-02'] }, fromKey('2026-09-01'), fromKey('2026-09-30')).length,
   sept.length)
eq('an empty list changes nothing', occurrencesOf({ ...course, excluded_on: [] }, fromKey('2026-09-01'), fromKey('2026-09-30')).length, sept.length)
eq('and neither does a missing one', occurrencesOf(course, fromKey('2026-09-01'), fromKey('2026-09-30')).length, sept.length)
eq('a non-array is ignored rather than thrown on',
   occurrencesOf({ ...course, excluded_on: 'nope' }, fromKey('2026-09-01'), fromKey('2026-09-30')).length,
   sept.length)

/* A one-off has exactly one occurrence, so skipping it skips all of it. That
   is the right answer: "only this one" and "the whole series" are the same
   choice when the series is one day long, which is why the dialog does not
   offer it. */
eq('excluding a one-off leaves nothing', occurrencesOf({ ...once, excluded_on: ['2026-09-15'] }, fromKey('2026-09-01'), fromKey('2026-09-30')).length, 0)
eq('and excluding a different day leaves it alone', occurrencesOf({ ...once, excluded_on: ['2026-09-14'] }, fromKey('2026-09-01'), fromKey('2026-09-30')).length, 1)

/* --- the layers the filter toolbar toggles ------------------------------ */

eq('four layers, as asked for', LAYERS, ['scolaire', 'perso', 'objectifs', 'cycle'])
ok('and every one has a dot colour', LAYERS.every((l) => LAYER_COLOUR[l]))

/* The grouping, which is the whole reason layers and categories are separate
   lists. Three school categories collapse to one toggle and keep their own
   colours on the grid. */
eq('a class is school', layerOf({ category: 'cours' }), 'scolaire')
eq('so is an exam', layerOf({ category: 'examen' }), 'scolaire')
eq('so is a revision block', layerOf({ category: 'etude' }), 'scolaire')
eq('personal is its own layer', layerOf({ category: 'perso' }), 'perso')

/* A row written by a later version of the app, or by hand. It has to stay
   visible: an event nobody can see and nobody can delete is worse than one
   filed under the wrong heading. */
eq('an unknown category is still drawn', layerOf({ category: 'quidditch' }), 'perso')
eq('and so is one with no category at all', layerOf({}), 'perso')

const mixed = [
  { id: 'a', category: 'cours' },
  { id: 'b', category: 'examen' },
  { id: 'c', category: 'perso' },
]
eq('no filter means everything', visibleEvents(mixed, null).length, 3)
eq('hiding school takes both of its categories', visibleEvents(mixed, new Set(['scolaire'])).map((e) => e.id), ['c'])
eq('hiding personal leaves the timetable', visibleEvents(mixed, new Set(['perso'])).map((e) => e.id), ['a', 'b'])
eq('hiding both leaves nothing', visibleEvents(mixed, new Set(['scolaire', 'perso'])).length, 0)

/* Toggling "cycle" off is about the overlay and has no business hiding a
   lecture. Toggling "objectifs" off hides the synthetic goal rows and nothing
   else, which is the pair of assertions below. */
eq('hiding the cycle hides no events', visibleEvents(mixed, new Set(['cycle'])).length, 3)
eq('hiding goals hides no timetable events', visibleEvents(mixed, new Set(['objectifs'])).length, 3)

/* A goal read out of the goals table and given a synthetic category so it can
   go through the same expander. It is not in CATEGORIES and the database would
   refuse it, which is the point: it is drawn here and edited elsewhere. */
const withGoal = [...mixed, { id: 'g', category: 'objectif', goalId: 'g1' }]
ok('the goal category is not a database category', !CATEGORIES.includes('objectif'))
eq('a goal is on the goals layer', layerOf({ category: 'objectif' }), 'objectifs')
eq('hiding goals takes the goal out', visibleEvents(withGoal, new Set(['objectifs'])).map((e) => e.id), ['a', 'b', 'c'])
eq('and hiding school leaves the goal', visibleEvents(withGoal, new Set(['scolaire'])).map((e) => e.id), ['c', 'g'])

/* Anything Set-like works, and a caller that passes nonsense gets everything
   rather than an exception on a page that is mid-render. */
eq('a bad filter is not a filter', visibleEvents(mixed, { nope: true }).length, 3)
eq('and neither is undefined', visibleEvents(mixed).length, 3)

/* --- the name behind a one-letter chip ----------------------------------- */

/* The reason this exists: two of the seven French initials are the same
   letter, so the visible text cannot be the accessible name. */
eq('day 0 is Sunday', weekdayName(0, 'en-GB'), 'Sunday')
eq('day 1 is Monday', weekdayName(1, 'en-GB'), 'Monday')
eq('day 6 is Saturday', weekdayName(6, 'en-GB'), 'Saturday')
eq('and in French', weekdayName(2, 'fr-FR'), 'mardi')
ok(
  'the two chips that share a letter do not share a name',
  weekdayName(2, 'fr-FR') !== weekdayName(3, 'fr-FR'),
  `${weekdayName(2, 'fr-FR')} vs ${weekdayName(3, 'fr-FR')}`,
)
/* Built in UTC on purpose. Constructing the date locally and formatting it
   locally is the classic way this lands a day out west of Greenwich. */
ok('every day has a distinct name', new Set([0, 1, 2, 3, 4, 5, 6].map((d) => weekdayName(d, 'fr-FR'))).size === 7)

/* --- a term entered in one go ------------------------------------------- */

const TERM = { userId: 'u1', startsOn: '2026-09-07', untilOn: '2026-12-18' }
const cls = (over = {}) => ({ title: 'Biochimie', start: '10:00', end: '12:00', weekdays: [2], ...over })

const built = timetableRows([cls(), cls({ title: 'Physio', weekdays: [1, 3], start: '14:00', end: '15:30' })], TERM)
eq('two classes make two rows', built.rows.length, 2)
eq('the term start goes on every one', built.rows.map((r) => r.starts_on), ['2026-09-07', '2026-09-07'])
eq('and so does the end', built.rows[0].until_on, '2026-12-18')
eq('times are stored as minutes', [built.rows[0].start_min, built.rows[0].end_min], [600, 720])
eq('the owner is set, because RLS checks it', built.rows[0].user_id, 'u1')
eq('the colour comes from the category', built.rows[0].colour, CATEGORY_COLOUR.cours)

/* The wizard opens with empty rows and offers more. Refusing to save because
   the last two were never filled in is the most annoying thing this shape of
   form can do. */
eq('blank rows are skipped, not rejected', timetableRows([cls(), { title: '  ' }, {}], TERM).rows.length, 1)
eq('but all-blank is an error rather than an empty insert', timetableRows([{}, {}], TERM).error, 'empty')

/* A row that is filled in but wrong takes the whole batch down, and says which
   one. A partial save leaves somebody with four of six classes and no way to
   tell which two are missing. */
eq('a half-filled time is refused', timetableRows([cls(), cls({ title: 'Anat', end: '' })], TERM).error, 'times')
eq('and names the row', timetableRows([cls(), cls({ title: 'Anat', end: '' })], TERM).at, 'Anat')
eq('backwards times are refused', timetableRows([cls({ start: '12:00', end: '10:00' })], TERM).error, 'order')
eq('a class with no day is refused', timetableRows([cls({ weekdays: [] })], TERM).error, 'days')
eq('a term ending before it starts is refused', timetableRows([cls()], { ...TERM, untilOn: '2026-09-01' }).error, 'until')

/* Tapping Tuesday twice means Tuesday once. This would not error: occurrencesOf
   builds a Set from the array, so the day draws correctly and the stored row is
   quietly wrong forever. */
eq('duplicate days are collapsed', timetableRows([cls({ weekdays: [2, 2, 4, 2] })], TERM).rows[0].weekdays, [2, 4])
eq('and days are sorted', timetableRows([cls({ weekdays: [5, 1, 3] })], TERM).rows[0].weekdays, [1, 3, 5])
eq('a day outside the week is dropped', timetableRows([cls({ weekdays: [2, 9] })], TERM).rows[0].weekdays, [2])

/* The category has to be one the check constraint knows, whatever arrives. */
eq('an unknown category falls back to a class', timetableRows([cls({ category: 'quidditch' })], TERM).rows[0].category, 'cours')
eq('and a known one is kept', timetableRows([cls({ category: 'examen' })], TERM).rows[0].category, 'examen')

/* Both times empty is an all-day entry, which the constraint allows. The
   wizard does not invent a stricter rule than the schema. */
const untimed = timetableRows([cls({ start: '', end: '' })], TERM)
eq('an all-day class is allowed', untimed.rows.length, 1)
eq('with no times at all', [untimed.rows[0].start_min, untimed.rows[0].end_min], [null, null])

/* Length caps, so a paste of something long is truncated here rather than
   rejected by the constraint after the whole batch is assembled. */
eq('a long title is cut to the column width', timetableRows([cls({ title: 'x'.repeat(200) })], TERM).rows[0].title.length, 120)
eq('an empty room is null, not an empty string', timetableRows([cls({ location: '   ' })], TERM).rows[0].location, null)

/* No end date is a rule that runs until it is deleted, which is what somebody
   entering a weekly habit expects. */
eq('an open-ended term is allowed', timetableRows([cls()], { ...TERM, untilOn: '' }).rows[0].until_on, null)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
