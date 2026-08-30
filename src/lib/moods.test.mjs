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
  MOOD_IDS,
  cleanMoods,
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
/* NOT A COUNT. This said 15, and it failed the day two moods were added,
   which is a test reporting a correct app as broken. The number was never the
   property worth guarding: what matters is that the cap is the whole catalogue
   however big that is, and that everything in it is well formed. Same lesson
   as the probe that asserted "six modules" and broke on a seventh lesson. */
ok('there is a catalogue at all', MOODS.length > 0)
eq('and the cap is all of it', MAX_MOODS, MOODS.length)
ok('every id is unique', new Set(MOOD_IDS).size === MOODS.length)
/* The bands are gone. Nothing carries a `group` any more, and a leftover one
   on a single entry would be a heading waiting to come back. */
ok('nothing carries a band any more', MOODS.every((m) => !('group' in m)))
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

/* The three added with multi-select, and the twelve that must survive it:
   every one of these ids may already be sitting in somebody's database. */
for (const id of ['excited', 'joyful', 'grateful', 'energized', 'sensitive', 'confused',
                  'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty']) {
  ok(`the original ${id} still exists`, MOOD_IDS.includes(id))
}
for (const id of ['serene', 'neutral', 'nostalgic', 'sad', 'discouraged']) {
  ok(`${id} was added`, MOOD_IDS.includes(id))
  ok(`and ${id} can be drawn`, moodById(id) !== null)
}

/* WHERE the two newest sit, which is not cosmetic.
   cleanMoods sorts by catalogue order, so position decides which face is drawn
   first and which one primaryMood hands to the group board. Put at the end of
   the file, `sad` would sort after `guilty`, and a day tagged sad and stressed
   would show the group the stressed face. */
ok('sad and discouraged sit in the second half of the run',
   MOOD_IDS.indexOf('sad') > MOOD_IDS.length / 2 &&
   MOOD_IDS.indexOf('discouraged') > MOOD_IDS.length / 2,
   `sad ${MOOD_IDS.indexOf('sad')}, discouraged ${MOOD_IDS.indexOf('discouraged')} of ${MOOD_IDS.length}`)
eq('and a hard day picks the earlier of two hard faces',
   primaryMood(['sad', 'discouraged']), 'discouraged')

/* --- the gradient -------------------------------------------------------- */

/**
 * ONE RUN, BRIGHTEST TO HARDEST.
 *
 * This is not decoration. cleanMoods sorts by catalogue position, so the order
 * decides which badge is drawn first and which id primaryMood puts in
 * daily_mood.mood, and that column is the single face the group board and the
 * week strip draw for a whole day.
 *
 * The assertions below are about the SHAPE of the run rather than its exact
 * sequence: pinning all seventeen ids in order would fail on any future
 * insertion, which is the mistake the count assertions above already made
 * once. What has to stay true is that it starts bright, ends hard, and never
 * puts a hard face ahead of a bright one.
 */
const at = (id) => MOOD_IDS.indexOf(id)

eq('it opens on the brightest thing in the set', MOOD_IDS[0], 'joyful')
ok('and ends somewhere hard', ['guilty', 'hurt', 'sad'].includes(MOOD_IDS[MOOD_IDS.length - 1]),
   MOOD_IDS[MOOD_IDS.length - 1])

/* Pairs that must never swap. Each one is a claim somebody could get wrong by
   dropping a new mood at the end of the file, which is the easy edit. */
for (const [brighter, harder] of [
  ['joyful', 'neutral'],
  ['energized', 'bored'],
  ['grateful', 'sad'],
  ['serene', 'stressed'],
  ['neutral', 'angry'],
  ['nostalgic', 'discouraged'],
  ['sensitive', 'hurt'],
  ['bored', 'guilty'],
]) {
  ok(`${brighter} comes before ${harder}`, at(brighter) < at(harder),
     `${at(brighter)} vs ${at(harder)}`)
}

/* The consequence, stated as behaviour rather than as indices: pick one of
   each and the brighter one is what the group sees. */
eq('a bright day beside a hard one shows the bright face',
   primaryMood(['guilty', 'joyful']), 'joyful')
eq('and that holds for the two newest', primaryMood(['sad', 'serene']), 'serene')

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
  eq('every one can be on at once', list.length, MOODS.length)
  for (const id of MOOD_IDS) list = toggleMood(list, id)
  eq('and all of them off again', list, [])
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
