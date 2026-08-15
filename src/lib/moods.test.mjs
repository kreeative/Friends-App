/**
 * node src/lib/moods.test.mjs
 *
 * The assertions that matter are the ones about `primaryMood`. daily_mood.mood
 * is `not null` and has been read as a single value by the week strip and the
 * group board since migration 12, so the array has to keep feeding it a
 * sensible answer or those two screens go blank for anybody who picks more
 * than one face.
 */
import {
  MAX_MOODS,
  MOODS,
  MOOD_GROUPS,
  MOOD_IDS,
  cleanMoods,
  inMoodGroup,
  moodById,
  primaryMood,
  toggleMood,
} from './moods.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nmoods')

/* --- the catalogue ------------------------------------------------------ */
eq('fifteen moods', MOODS.length, 15)
eq('and the cap is all of them', MAX_MOODS, 15)
ok('every id is unique', new Set(MOOD_IDS).size === MOODS.length)
ok('every one is in a known band', MOODS.every((m) => MOOD_GROUPS.includes(m.group)))
ok('every one has a colour', MOODS.every((m) => /^#[0-9A-F]{6}$/i.test(m.color)))
/* Closed, and starting from a move. Not a length: the triangle is a perfectly
   good fourteen characters and an arbitrary floor failed it. */
ok(
  'every one has a closed shape',
  MOODS.every((m) => typeof m.path === 'string' && /^M/.test(m.path) && /Z$/i.test(m.path.trim())),
)
ok('every one has a face', MOODS.every((m) => m.eyes && m.mouth))
ok('the colours are distinct', new Set(MOODS.map((m) => m.color)).size === MOODS.length)
ok('and so are the shapes', new Set(MOODS.map((m) => m.path)).size === MOODS.length)
eq('the bands account for everyone', MOOD_GROUPS.reduce((n, g) => n + inMoodGroup(g).length, 0), MOODS.length)
eq('an unknown band is empty, not a throw', inMoodGroup('nope'), [])

/* The three added with multi-select, and the twelve that must survive it:
   every one of these ids may already be sitting in somebody's database. */
for (const id of ['excited', 'joyful', 'grateful', 'energized', 'sensitive', 'confused',
                  'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty']) {
  ok(`the original ${id} still exists`, MOOD_IDS.includes(id))
}
for (const id of ['serene', 'neutral', 'nostalgic']) {
  ok(`${id} was added`, MOOD_IDS.includes(id))
  ok(`and ${id} can be drawn`, moodById(id) !== null)
}

/* The bands as they were asked for. */
eq('positive', inMoodGroup('positive').map((m) => m.id), ['joyful', 'grateful', 'energized', 'serene'])
eq('neutral and mixed', inMoodGroup('neutral').map((m) => m.id), ['excited', 'sensitive', 'neutral', 'nostalgic'])
ok('challenging holds the rest', inMoodGroup('hard').length === 7)

eq('an unknown id has no mood', moodById('wibble'), null)
eq('null has no mood', moodById(null), null)

/* --- cleanMoods --------------------------------------------------------- */
eq('a good list survives', cleanMoods(['joyful', 'stressed']), ['joyful', 'stressed'])
eq('order is the catalogue, not the tap order', cleanMoods(['stressed', 'joyful']), ['joyful', 'stressed'])
/* And the catalogue runs good -> middle -> hard, so a mixed day draws the
   kinder face first and hands that one to the group board. */
eq('a mixed day leads with the better half', cleanMoods(['stressed', 'serene']), ['serene', 'stressed'])
eq('and the primary follows', primaryMood(['stressed', 'serene']), 'serene')
eq('unknown ids are dropped', cleanMoods(['joyful', 'wibble']), ['joyful'])
eq('duplicates collapse', cleanMoods(['joyful', 'joyful']), ['joyful'])
eq('null is empty', cleanMoods(null), [])
eq('an object is empty', cleanMoods({ 0: 'joyful' }), [])
eq('junk inside is dropped', cleanMoods([null, 42, {}, 'joyful']), ['joyful'])

/* A single string is what every row written before this migration holds, and
   what daily_mood.mood still holds today. It has to read as a list of one. */
eq('a bare string is read as one mood', cleanMoods('joyful'), ['joyful'])
eq('and a bare unknown string is empty', cleanMoods('wibble'), [])
eq('an empty string is empty', cleanMoods(''), [])

/* --- toggleMood --------------------------------------------------------- */
eq('tapping an unselected one adds it', toggleMood([], 'joyful'), ['joyful'])
eq('tapping it again removes it', toggleMood(['joyful'], 'joyful'), [])
eq('two at once, which is the whole request', toggleMood(['joyful'], 'excited'), ['joyful', 'excited'])
eq('removing leaves the rest', toggleMood(['joyful', 'excited', 'stressed'], 'excited'), ['joyful', 'stressed'])
eq('an unknown id changes nothing', toggleMood(['joyful'], 'wibble'), ['joyful'])
eq('toggling on null works', toggleMood(null, 'joyful'), ['joyful'])
eq('and cleans as it goes', toggleMood(['wibble', 'joyful'], 'stressed'), ['joyful', 'stressed'])
{
  let list = []
  for (const id of MOOD_IDS) list = toggleMood(list, id)
  eq('all fifteen can be on at once', list.length, 15)
  for (const id of MOOD_IDS) list = toggleMood(list, id)
  eq('and all fifteen off again', list, [])
}

/* --- primaryMood, which keeps the not-null column fed -------------------- */
eq('one mood is its own primary', primaryMood(['joyful']), 'joyful')
eq('several take the first in catalogue order', primaryMood(['stressed', 'joyful']), 'joyful')
eq('which is the most positive of them', primaryMood(['guilty', 'nostalgic', 'energized']), 'energized')
eq('whichever order they were tapped in', primaryMood(['joyful', 'stressed']), 'joyful')
eq('nothing selected is null', primaryMood([]), null)
eq('null is null', primaryMood(null), null)
eq('junk is null', primaryMood(['wibble']), null)
eq('a bare string works too', primaryMood('joyful'), 'joyful')
ok(
  'the primary is always one the badge can draw',
  MOOD_IDS.every((id) => moodById(primaryMood([id])) !== null),
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
