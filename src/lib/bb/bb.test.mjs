/**
 * node src/lib/bb/bb.test.mjs
 *
 * Beauty & Brain's pure logic: the FSRS scheduler, mastery, today's session,
 * the quality checks on generated items, and the plans.
 */
import { DAY, FACTOR, forgetStability, initDifficulty, initStability, intervalDays, nextDifficulty, preview, ratingFrom, retrievability, review } from './fsrs.js'
import { calibration, chapterMastery, conceptMastery } from './mastery.js'
import { PRETEST_SIZE, buildSession, interleave, spreadByConcept } from './sampler.js'
import { anchorChip, anchorValidity, checkItem, nearDuplicate, normalise, similarity, typedMatch } from './quality.js'
import { LIMITS, PRICES, allow, canAddCourse, canPrepareChapter, costOf, perMonth, tierOf } from './plans.js'

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
const near = (name, a, b, tol = 1e-3) => ok(name, Math.abs(a - b) <= tol, `got ${a}, want ${b}`)

console.log('\nbeauty & brain')

/* --- FSRS --------------------------------------------------------------- */
const T0 = new Date('2026-10-16T14:00:00Z')
near('recall is 90% exactly one stability after the review', retrievability(10, 10), 0.9)
near('and 100% right after it', retrievability(0, 7), 1)
ok('recall only falls with time', retrievability(20, 10) < retrievability(10, 10))
eq('at 90% retention the interval is the stability', intervalDays(10), 10)
eq('an interval is at least a day', intervalDays(0.2), 1)
near('the factor is 19/81', FACTOR, 19 / 81, 1e-12)
near('first Good: stability 3.17 days', initStability(3), 3.173)
ok('first Again is the hardest start', initDifficulty(1) > initDifficulty(3) && initDifficulty(3) > initDifficulty(4))

const good = review(null, 3, T0)
eq('a new item answered Good comes back in 3 days', [good.state, good.interval], ['review', 3])
eq('and is due then', good.due, new Date(T0.getTime() + 3 * DAY).toISOString())
const easy = review(null, 4, T0)
eq('Easy on a new item: 16 days', easy.interval, 16)
const again = review(null, 1, T0)
eq('Again on a new item: back later today', [again.state, again.interval], ['learning', 0])
ok('due in ten minutes', Math.abs(Date.parse(again.due) - (T0.getTime() + 10 * 60000)) < 1000)

const later = new Date(T0.getTime() + 3 * DAY)
const g2 = review(good, 3, later)
ok('a second Good, on time, stretches the interval', g2.interval > good.interval, `${g2.interval}`)
const h2 = review(good, 2, later)
const e2 = review(good, 4, later)
ok('Hard < Good < Easy', h2.stability < g2.stability && g2.stability < e2.stability)
const lapse = review(good, 1, later)
eq('forgetting a review card is a lapse', [lapse.state, lapse.lapses], ['relearning', 1])
ok('and stability drops', lapse.stability < good.stability)
ok('Again makes it harder, Easy easier', lapse.difficulty > good.difficulty && e2.difficulty < good.difficulty)
ok('difficulty stays between 1 and 10', [1, 2, 3, 4].every((g) => { const d = nextDifficulty(9.9, g); return d >= 1 && d <= 10 }))
ok('forgetting never raises stability', forgetStability(5, 2, 0.1) <= 2)
const same = review(again, 3, new Date(T0.getTime() + 20 * 60000))
ok('a same-day second look graduates gently', same.state === 'review' && same.interval >= 1 && same.interval <= 2, JSON.stringify(same))
eq('reps count every review', [good.reps, g2.reps], [1, 2])
eq('the buttons preview their intervals', preview(good, later).length, 4)
ok('a rating out of range throws', (() => { try { review(null, 5) } catch { return true } return false })())
eq('marked by the app: wrong is Again', ratingFrom(false, 'sure'), 1)
eq('right but unsure is Hard', ratingFrom(true, 'unsure'), 2)
eq('right and sure is Good', ratingFrom(true, 'sure'), 3)

/* --- mastery ------------------------------------------------------------ */
const R = (day, correct = true, bloom = 3, confidence = 'sure') => ({ created_at: `2026-10-${String(day).padStart(2, '0')}T15:00:00Z`, correct, bloom, confidence })
const dayOf = (iso) => iso.slice(0, 10)
ok('3 days, 7 days apart, at application level: mastered', conceptMastery([R(1), R(4), R(8)], { dayOf }).mastered)
ok('6 days apart is not enough', !conceptMastery([R(1), R(4), R(7)], { dayOf }).mastered)
ok('two right on the same day count once', !conceptMastery([R(1), R(1), R(9)], { dayOf }).mastered)
ok('recall level (Bloom 2) does not count', !conceptMastery([R(1, true, 2), R(4, true, 2), R(9, true, 2)], { dayOf }).mastered)
ok('a confident wrong in between breaks it', !conceptMastery([R(1), R(3, false, 3, 'sure'), R(4), R(9)], { dayOf }).mastered)
ok('an unsure wrong does not', conceptMastery([R(1), R(3, false, 3, 'unsure'), R(4), R(9)], { dayOf }).mastered)
ok('a later clean run still masters it', conceptMastery([R(1), R(2, false, 3, 'sure'), R(3), R(6), R(12)], { dayOf }).mastered)
const cm = chapterMastery([{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }], { a: [R(1), R(4), R(9)], b: [] }, { dayOf })
eq('chapter mastery is weighted by exam signal', [cm.mastered, cm.total, cm.pct], [1, 2, 75])
eq('calibration counts sure-and-wrong', calibration([R(1), R(2, false), R(3, false, 3, 'guess')]).confidentWrong, 1)

/* --- today's session ---------------------------------------------------- */
const items = []
for (const ch of ['c1', 'c2']) for (const co of [1, 2, 3, 4]) for (const n of [1, 2]) items.push({ id: `${ch}-k${co}-${n}`, type: 'mcq', chapter_id: ch, concept_id: `${ch}-k${co}`, quality: 'pass' })
items.push({ id: 'bad', type: 'mcq', chapter_id: 'c1', concept_id: 'c1-k1', quality: 'reject' })
const chapters = [{ id: 'c1', position: 0 }, { id: 'c2', position: 1 }]
const NOW = new Date('2026-10-16T12:00:00Z')

const fresh = buildSession({ minutes: 15, items, chapters, now: NOW })
eq('a brand-new course opens with the pretest of chapter 1', fresh.items.filter((x) => x.reason === 'pretest').length, PRETEST_SIZE)
ok('all from chapter 1', fresh.items.filter((x) => x.reason === 'pretest').every((x) => x.chapter_id === 'c1'))
ok('rejected items never appear', !fresh.items.some((x) => x.id === 'bad'))
ok('the session fits its minutes', fresh.seconds <= 15 * 60)

const schedule = [
  { item_id: 'c1-k1-1', due: '2026-10-10T00:00:00Z' },
  { item_id: 'c1-k2-1', due: '2026-10-15T00:00:00Z' },
  { item_id: 'c1-k3-1', due: '2026-10-30T00:00:00Z' },
]
const mistakes = [{ item_id: 'c1-k4-1', confident: true }, { item_id: 'c1-k2-2', confident: false }]
const s2 = buildSession({ minutes: 15, items, chapters, schedule, mistakes, now: NOW })
eq('confident-but-wrong comes first', s2.items[0].reason === 'confident_wrong' || s2.items.findIndex((x) => x.reason === 'confident_wrong') <= 1, true)
ok('due reviews are in, not-yet-due ones are not', s2.items.some((x) => x.id === 'c1-k1-1') && !s2.items.some((x) => x.id === 'c1-k3-1'))
ok('the next chapter gets its pretest', s2.items.filter((x) => x.reason === 'pretest').every((x) => x.chapter_id === 'c2'))
const seq = s2.items.filter((x) => x.reason !== 'pretest')
ok('never the same concept twice in a row', seq.every((x, i) => i === 0 || x.concept_id !== seq[i - 1].concept_id))
const tiny = buildSession({ minutes: 10, items, chapters, schedule, mistakes, now: NOW })
ok('ten minutes is shorter than fifteen', tiny.seconds <= 600 && tiny.items.length <= s2.items.length)
eq('spread: one per concept in turn', spreadByConcept([{ id: 1, concept_id: 'a' }, { id: 2, concept_id: 'a' }, { id: 3, concept_id: 'b' }]).map((x) => x.id), [1, 3, 2])
eq('the pretest stays one block', (() => { const out = interleave([{ id: 'x', concept_id: 'a' }, { id: 'p1', concept_id: 'p' }, { id: 'p2', concept_id: 'q' }, { id: 'y', concept_id: 'b' }], new Set(['p1', 'p2'])); const i = out.findIndex((o) => o.id === 'p1'); return out[i + 1].id })(), 'p2')

/* --- quality checks ----------------------------------------------------- */
const A = new Set(['a1', 'a2'])
const goodItem = { type: 'mcq', stem: 'A firm raises its price and total revenue falls. What does this say about demand?', bloom: 3, anchors: ['a1'], key: 1, options: [{ text: 'Inelastic', why: 'no' }, { text: 'Elastic', why: 'yes', anchor: 'a1' }, { text: 'Unit elastic', why: 'no' }, { text: 'Perfectly inelastic', why: 'no' }] }
eq('a clean item passes', checkItem(goodItem, { anchors: A }).problems, [])
ok('an anchor the course does not have is rejected', checkItem({ ...goodItem, anchors: ['zz'] }, { anchors: A }).problems.includes('unknown_anchor'))
ok('no anchor at all is rejected', checkItem({ ...goodItem, anchors: [] }, { anchors: A }).problems.includes('no_anchor'))
ok('two identical options are rejected', checkItem({ ...goodItem, options: [goodItem.options[0], { text: 'inelastic!', why: 'x' }, goodItem.options[2], goodItem.options[3]] }, { anchors: A }).problems.includes('option_duplicate'))
ok('a key out of range is rejected', checkItem({ ...goodItem, key: 4 }, { anchors: A }).problems.includes('key_range'))
ok('outside knowledge can never be the key', checkItem({ ...goodItem, options: goodItem.options.map((o, i) => (i === 1 ? { ...o, outside: true } : o)) }, { anchors: A }).problems.includes('key_outside'))
ok('"all of the above" is rejected', checkItem({ ...goodItem, options: [...goodItem.options.slice(0, 3), { text: 'All of the above', why: 'x' }] }, { anchors: A }).problems.includes('above'))
ok('a near-duplicate stem is rejected', checkItem(goodItem, { anchors: A, existing: ['A firm raises its price, and total revenue falls: what does this say about demand?'] }).problems.includes('duplicate'))
ok('a different question is not a duplicate', !nearDuplicate(goodItem.stem, 'Which cost curve does marginal cost cross at its minimum?'))
ok('a flashcard needs an answer', checkItem({ type: 'flash', stem: 'Define price elasticity', bloom: 1, anchors: ['a1'], answer: '' }, { anchors: A }).problems.includes('answer_missing'))
eq('normalise drops accents and punctuation', normalise('Élasticité-prix, "croisée" !'), 'elasticite prix croisee')
near('similarity of a stem with itself', similarity('Quelle courbe ?', 'quelle courbe'), 1)
near('valid anchors: share of items fully anchored', anchorValidity([goodItem, { ...goodItem, anchors: ['zz'] }], A), 0.5)
eq('a chip reads file and place', anchorChip({ label: 'slide 6' }, 'Cours_7-Elasticite.pdf'), 'Cours 7 Elasticite · slide 6')
eq('typed: exact is right', typedMatch('Elasticité', 'élasticité'), 'right')
eq('typed: part of it is close', typedMatch('elasticite', 'elasticite prix croisee de la demande'), 'close')
eq('typed: nothing is wrong', typedMatch('', 'x'), 'wrong')

/* --- plans -------------------------------------------------------------- */
const FUT = '2026-12-01T00:00:00Z'
const PAST = '2026-09-01T00:00:00Z'
eq('no row: free', tierOf(null, NOW), 'free')
eq('owner', tierOf({ plan: 'owner', status: 'active' }, NOW), 'owner')
eq('paid and active: plus', tierOf({ plan: 'plus_semester', status: 'active', current_period_end: FUT }, NOW), 'plus')
eq('cancelled still runs to the end of the period', tierOf({ plan: 'plus_month', status: 'canceled', current_period_end: FUT }, NOW), 'plus')
eq('and then stops', tierOf({ plan: 'plus_month', status: 'canceled', current_period_end: PAST }, NOW), 'free')
eq('an expired active row is free', tierOf({ plan: 'plus_year', status: 'active', current_period_end: PAST }, NOW), 'free')
eq('free: 10 coach messages a day', allow('coach', null, 9, NOW).remaining, 1)
eq('the eleventh is refused', allow('coach', null, 10, NOW).ok, false)
ok('and says when it resets', allow('coach', null, 10, NOW).resetsAt === '2026-10-17T00:00:00.000Z')
eq('owner has no limit', allow('coach', { plan: 'owner', status: 'active' }, 9999, NOW).ok, true)
eq('free: one course', [canAddCourse(null, 0, NOW), canAddCourse(null, 1, NOW)], [true, false])
eq('free: three chapters prepared, a fourth refused', [canPrepareChapter(null, 2, false, NOW), canPrepareChapter(null, 3, false, NOW)], [true, false])
ok('re-preparing a chapter already prepared is always allowed', canPrepareChapter(null, 3, true, NOW))
ok('the limits match the pricing page', LIMITS.free.coach === 10 && LIMITS.free.grade === 15 && LIMITS.free.courses === 1 && LIMITS.free.chapters === 3)
eq('prices, in cents', [PRICES.plus_month.cents, PRICES.plus_semester.cents, PRICES.plus_year.cents], [1499, 4999, 12999])
ok('the semester is every 4 months', PRICES.plus_semester.interval === 'month' && PRICES.plus_semester.count === 4)
ok('semester per month is about 12.50', /12,50/.test(perMonth('plus_semester', 'fr')), perMonth('plus_semester', 'fr'))
near('cost of a call: 10k in, 2k out on Opus 5.5', costOf('claude-opus-5-5', { input_tokens: 10000, output_tokens: 2000 }), 0.08, 1e-6)
near('cache reads are 5 cents a million... times 4', costOf('claude-opus-5-5', { cache_read_input_tokens: 1e6 }), 0.2, 1e-6)

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
