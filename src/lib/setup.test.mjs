/**
 * node src/lib/setup.test.mjs
 *
 * Four predicates and a patch builder, and the interesting half of this file is
 * about the three values that are not a boolean: undefined, null, and a real
 * answer. Every bug this can have looks the same in review and different to a
 * person: a form nobody can get past, or a period tracker appearing on the
 * phone of somebody who said they were a man.
 */
import {
  GENDERS,
  canFinish,
  cleanName,
  cycleForGender,
  cycleOn,
  needsSetup,
  setupPatch,
} from './setup.js'

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

console.log('\nsetup')

/* --- the answers offered ------------------------------------------------ */
eq('three answers', GENDERS.length, 3)
eq('no duplicates', new Set(GENDERS).size, GENDERS.length)
ok('other is offered last', GENDERS[GENDERS.length - 1] === 'other')

/* --- needsSetup: the three states of one column ------------------------- */
eq('asked and not answered', needsSetup({ setup_done_at: null }), true)
eq('answered', needsSetup({ setup_done_at: '2026-09-05T10:00:00Z' }), false)

/* THE ONE THAT MATTERS. A bundle can be deployed before its SQL is run, and
   this app is deployed from a tablet where those are two separate acts on two
   different days. With `!profile.setup_done_at` here, the day between them
   would put a form in front of every single person who signed in, including
   accounts years old, and the form would then fail to save to a column that
   does not exist. */
eq('a database without migration 56', needsSetup({ display_name: 'Ann' }), false)
eq('no profile yet', needsSetup(null), false)
eq('no argument', needsSetup(), false)
eq('an empty string is not null', needsSetup({ setup_done_at: '' }), false)

/* --- cycleForGender ----------------------------------------------------- */
eq('a woman gets the tracker', cycleForGender('woman'), true)
eq('a man does not', cycleForGender('man'), false)
/* Not false because the answer is worth less. False because the app has no
   business deciding what "other" meant, and the switch on the profile is the
   only honest answer to a question that cannot be inferred. */
eq('other is not decided for them', cycleForGender('other'), false)
eq('unanswered', cycleForGender(null), false)
eq('nonsense', cycleForGender('lady'), false)

/* --- cycleOn: what the rest of the app reads ---------------------------- */
eq('switched off', cycleOn({ cycle_on: false }), false)
eq('switched on', cycleOn({ cycle_on: true }), true)
/* Both unknowns mean yes. An account written before the column existed has the
   feature today and must keep it; a profile still in flight must not blink the
   cycle out of the calendar on every load. */
eq('a database without migration 56', cycleOn({ display_name: 'Ann' }), true)
eq('profile still loading', cycleOn(null), true)
eq('no argument', cycleOn(), true)

/* The switch is what is read, never the gender. A man who turned it on keeps
   it; a woman who turned it off stays rid of it. */
eq('a man who turned it on', cycleOn({ gender: 'man', cycle_on: true }), true)
eq('a woman who turned it off', cycleOn({ gender: 'woman', cycle_on: false }), false)

/* --- the name ----------------------------------------------------------- */
eq('trimmed', cleanName('  Anne-Kelly  '), 'Anne-Kelly')
eq('nothing', cleanName(''), '')
eq('spaces are nothing', cleanName('   '), '')
eq('null', cleanName(null), '')
eq('undefined', cleanName(undefined), '')
eq('capped', cleanName('a'.repeat(200)).length, 60)

eq('a name finishes the form', canFinish(' Ann '), true)
eq('spaces do not', canFinish('   '), false)
eq('nothing does not', canFinish(''), false)
/* display_name is `not null` in the schema, so the button and the write have
   to agree about what counts. Testing them against the same trim is the point:
   an enabled button on a value the database refuses is the failure. */
eq('and what is checked is what is saved', cleanName(' Ann '), 'Ann')

/* --- setupPatch --------------------------------------------------------- */
{
  const now = new Date('2026-09-05T12:00:00.000Z')
  const p = setupPatch(
    { name: '  Kee ', theme: 'sea', locale: 'en', pronouns: 'she/her', gender: 'woman' },
    now,
  )
  eq('the name is the trimmed one', p.display_name, 'Kee')
  eq('the theme travels to the account', p.theme, 'sea')
  eq('so does the language, for the emails', p.locale, 'en')
  eq('the pronouns as written', p.pronouns, 'she/her')
  eq('the answer', p.gender, 'woman')
  eq('and the tracker follows it', p.cycle_on, true)
  eq('stamped', p.setup_done_at, '2026-09-05T12:00:00.000Z')
}

{
  const p = setupPatch({ name: 'Sam', gender: 'man' })
  eq('a man saves the tracker off', p.cycle_on, false)
  /* null rather than '': the app tests these columns for absence everywhere,
     and an empty string is a value a column keeps. */
  eq('unanswered pronouns are absent', p.pronouns, null)
  eq('an unset theme is absent', p.theme, null)
}

{
  const p = setupPatch({ name: 'Sam', pronouns: '', gender: 'other' })
  eq('an empty pronoun box is absent too', p.pronouns, null)
  eq('other saves the tracker off, and the profile can turn it on', p.cycle_on, false)
}

/* Every key the patch writes has to exist in the database. This is the list
   migration 56 adds plus three columns that were already there; if a name here
   drifts, the write fails at runtime with PGRST204 and the setup screen becomes
   a dead end on the first screen of the product. */
{
  const keys = Object.keys(setupPatch({ name: 'A', gender: 'woman' })).sort().join(',')
  eq(
    'the patch writes exactly the columns that exist',
    keys,
    'cycle_on,display_name,gender,locale,pronouns,setup_done_at,theme',
  )
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
