/**
 * node src/lib/emotions.test.mjs
 *
 * The assertions that matter are the ones about a transaction carrying two
 * feelings. Its full amount lands under both, so the totals deliberately do
 * not sum to the month's spending, and anybody reading this later needs to
 * know that is the intent rather than a bug to be tidied up.
 */
import {
  DEFAULT_EMOTIONS,
  EMOTIONS,
  EMOTION_GROUPS,
  EMOTION_IDS,
  MAX_EMOTIONS,
  cleanEmotions,
  emojiOf,
  emotionTotals,
  filterByEmotion,
  inGroup,
  isEmotion,
  toggleEmotion,
} from './emotions.js'

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

console.log('\nemotions')

/* --- the palette -------------------------------------------------------- */
eq('thirteen feelings', EMOTIONS.length, 13)
ok('every id is unique', new Set(EMOTION_IDS).size === EMOTIONS.length)
ok('every one has an emoji', EMOTIONS.every((e) => typeof e.emoji === 'string' && e.emoji.length > 0))
ok('every one is in a known band', EMOTIONS.every((e) => EMOTION_GROUPS.includes(e.group)))
ok('ids are language-independent', EMOTION_IDS.every((id) => /^[a-z]+$/.test(id)))
eq('three bands', EMOTION_GROUPS.length, 3)
eq('everyday holds three', inGroup('everyday').map((e) => e.id), ['neutral', 'unsure', 'routine'])
eq('positive holds five', inGroup('positive').length, 5)
eq('strain holds five', inGroup('strain').length, 5)
eq('an unknown band is empty, not a throw', inGroup('nope'), [])
eq('the bands account for everyone', EMOTION_GROUPS.reduce((n, g) => n + inGroup(g).length, 0), EMOTIONS.length)
eq('the cap is the whole palette', MAX_EMOTIONS, 13)

eq('neutral is the default', DEFAULT_EMOTIONS, ['neutral'])
ok('and the default is a real one', DEFAULT_EMOTIONS.every(isEmotion))

ok('isEmotion knows its own', isEmotion('impulse'))
ok('and refuses anything else', !isEmotion('wibble') && !isEmotion('') && !isEmotion(null))
eq('emoji lookup', emojiOf('stress'), '😬')
eq('an unknown id has no emoji rather than throwing', emojiOf('wibble'), '')
eq('null has no emoji', emojiOf(null), '')

/* --- cleanEmotions ------------------------------------------------------ */
eq('a good list survives', cleanEmotions(['impulse', 'stress']), ['impulse', 'stress'])
eq('order is the palette, not the tap order', cleanEmotions(['stress', 'neutral']), ['neutral', 'stress'])
eq('unknown ids are dropped', cleanEmotions(['impulse', 'wibble']), ['impulse'])
eq('duplicates collapse', cleanEmotions(['gift', 'gift', 'gift']), ['gift'])
eq('null is empty', cleanEmotions(null), [])
eq('a string is empty, not split into letters', cleanEmotions('impulse'), [])
eq('an object is empty', cleanEmotions({ 0: 'gift' }), [])
eq('nested junk is dropped', cleanEmotions([null, 42, {}, ['gift'], 'gift']), ['gift'])

/* --- toggleEmotion ------------------------------------------------------ */
eq('tapping an unselected one adds it', toggleEmotion([], 'gift'), ['gift'])
eq('tapping it again removes it', toggleEmotion(['gift'], 'gift'), [])
eq('adding keeps palette order', toggleEmotion(['stress'], 'neutral'), ['neutral', 'stress'])
eq('removing leaves the rest', toggleEmotion(['neutral', 'gift', 'stress'], 'gift'), ['neutral', 'stress'])
eq('an unknown id changes nothing', toggleEmotion(['gift'], 'wibble'), ['gift'])
eq('toggling on a null list still works', toggleEmotion(null, 'gift'), ['gift'])
eq('and cleans as it goes', toggleEmotion(['wibble', 'gift'], 'stress'), ['gift', 'stress'])
{
  // Every one on, then every one off again.
  let list = []
  for (const id of EMOTION_IDS) list = toggleEmotion(list, id)
  eq('all thirteen can be on at once', list.length, 13)
  for (const id of EMOTION_IDS) list = toggleEmotion(list, id)
  eq('and all thirteen off again', list, [])
}

/* --- emotionTotals ------------------------------------------------------ */
const spend = (cents, emotions, extra = {}) => ({
  kind: 'expense', amount_cents: cents, emotions, excluded: false, ...extra,
})

{
  const rows = [spend(4000, ['stress']), spend(1500, ['stress']), spend(9000, ['gift'])]
  const totals = emotionTotals(rows)
  eq('two feelings appear', totals.length, 2)
  eq('sorted by spend, biggest first', totals.map((t) => t.id), ['gift', 'stress'])
  eq('gift totals', totals[0].cents, 9000)
  eq('stress totals', totals[1].cents, 5500)
  eq('and counts the transactions', totals[1].count, 2)
  eq('with the emoji ready to draw', totals[0].emoji, '🎁')
}
{
  /* The important one. Forty dollars spent while stressed AND impulsive is
     forty dollars of each, not twenty. The totals do not sum to the month. */
  const totals = emotionTotals([spend(4000, ['impulse', 'stress'])])
  eq('a two-feeling spend lands whole under both', totals.map((t) => t.cents), [4000, 4000])
  eq('and is counted once under each', totals.map((t) => t.count), [1, 1])
  ok('so the totals exceed the spend, on purpose', totals.reduce((n, t) => n + t.cents, 0) === 8000)
}
{
  const rows = [spend(4000, ['stress']), { kind: 'income', amount_cents: 500000, emotions: ['celebration'] }]
  const totals = emotionTotals(rows)
  eq('income is not spending', totals.map((t) => t.id), ['stress'])
}
{
  const rows = [spend(4000, ['stress']), spend(9999, ['stress'], { excluded: true })]
  eq('an excluded row stays out, like every other total', emotionTotals(rows)[0].cents, 4000)
}
{
  eq('untagged rows produce nothing', emotionTotals([spend(4000, [])]), [])
  eq('rows with no emotions column produce nothing', emotionTotals([{ kind: 'expense', amount_cents: 40 }]), [])
  eq('nothing at all is empty', emotionTotals([]), [])
  eq('junk rows do not throw', emotionTotals([null, undefined, {}, spend(100, ['gift'])]).length, 1)
}
{
  eq('a zero amount is not a spend', emotionTotals([spend(0, ['gift'])]), [])
  eq('a negative amount is refused', emotionTotals([spend(-500, ['gift'])]), [])
  eq('a string amount is read', emotionTotals([spend('4000', ['gift'])])[0].cents, 4000)
}
{
  const rows = [spend(1000, ['gift']), spend(1000, ['stress'])]
  eq('an exact tie breaks by id, so the order is stable', emotionTotals(rows).map((t) => t.id), ['gift', 'stress'])
}

/* --- filterByEmotion ---------------------------------------------------- */
{
  const rows = [spend(1, ['gift']), spend(2, ['stress', 'gift']), spend(3, ['neutral'])]
  eq('filtering finds every row carrying it', filterByEmotion(rows, 'gift').length, 2)
  eq('including one where it is not first', filterByEmotion(rows, 'stress').length, 1)
  eq('no filter is everything', filterByEmotion(rows, null).length, 3)
  eq('an unknown filter is everything, not nothing', filterByEmotion(rows, 'wibble').length, 3)
  eq('a filter nobody used is empty', filterByEmotion(rows, 'tired').length, 0)
  eq('filtering nothing is nothing', filterByEmotion([], 'gift'), [])
}
{
  const rows = [{ kind: 'expense', amount_cents: 5, emotions: null }]
  eq('a null emotions column filters out cleanly', filterByEmotion(rows, 'gift'), [])
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
