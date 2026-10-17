/**
 * node src/lib/bb/phase2.test.mjs
 *
 * Beauty & Brain, phases 2 and 3: the rules of the mock exam, the
 * calibration lines, the plan written into the calendar, desirable
 * difficulty, the variations of a mistake, the retention raised before the
 * exam, the Rich & Friends check-in, and what the server checks in code
 * before it stores a case, a mark, a visual or a question.
 *
 * No network and no model: the one place a model answers (the verifier of
 * the question pipeline) is a fake client returning a fixed message.
 */
import { DEFAULT_COUNT, MARKED, clock, examShape, pickExam, rng, scoreExam, secondsLeft } from './exam.js'
import { MIN_SURE, calibrationByChapter, weeklyLine } from './calib.js'
import { HORIZON, eventRows, missed, mockDays, placeDays, planDays } from './planner.js'
import { CEILING, FLOOR, START, capFromFormat, targetBloom, targetsByConcept } from './difficulty.js'
import { buildSession } from './sampler.js'
import { answerRows } from './answer.js'
import { BOOSTED_RETENTION, FINAL_DAYS, RETENTION, retentionFor, review } from './fsrs.js'
import { STUDY_DAYS, sessionCounts, studyGoal, tickRow } from './checkin.js'
import { ROUTE_BUCKET } from './plans.js'
import { shortId } from './cite.js'
import { caseFrom, citeKeys, gradeFrom } from '../../../api/_bb/cases.js'
import { visualsFrom } from '../../../api/_bb/visual.js'
import { itemRow, shape, vet } from '../../../api/_bb/pipeline.js'
import { removeTree } from '../../../api/_bb/remove.js'
import { keyMap } from '../../../api/_bb/common.js'
import { bbPreviewHtml } from '../../../api/_bb/preview.js'
import { readFileSync } from 'node:fs'

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

console.log('\nbeauty & brain, phases 2 and 3')

/* A Friday, like the other test files. */
const NOW = new Date('2026-10-16T14:00:00')
const later = (days) => new Date(NOW.getTime() + days * 86400000)
const iso = (d, h = 12) => {
  const x = later(d)
  x.setHours(h, 0, 0, 0)
  return x.toISOString()
}

/* --- the mock exam ------------------------------------------------------------- */
{
  const chapters = [
    { id: 'ch1', title: 'Cellules' },
    { id: 'ch2', title: 'Osmose' },
  ]
  /* ch1 weighs 2 (two weight-1 concepts), ch2 weighs 6 (two weight-3 concepts): ch2 gets three quarters. */
  const concepts = [
    { id: 'k1', chapter_id: 'ch1', weight: 1 },
    { id: 'k2', chapter_id: 'ch1', weight: 1 },
    { id: 'k3', chapter_id: 'ch2', weight: 3 },
    { id: 'k4', chapter_id: 'ch2', weight: 3 },
  ]
  const items = []
  for (const c of concepts) for (let n = 0; n < 10; n += 1) items.push({ id: `${c.id}-${n}`, chapter_id: c.chapter_id, concept_id: c.id, type: 'mcq', bloom: 3 + (n % 2), quality: 'pass', answer: { index: 0 }, options: [{}, {}, {}, {}] })
  items.push({ id: 'flash', chapter_id: 'ch1', concept_id: 'k1', type: 'flash', quality: 'pass' })
  items.push({ id: 'quar', chapter_id: 'ch1', concept_id: 'k1', type: 'mcq', quality: 'quarantine' })
  items.push({ id: 'var', chapter_id: 'ch2', concept_id: 'k3', type: 'mcq', quality: 'pass', variant_of: 'k3-0' })

  const picked = pickExam({ items, concepts, chapters, count: 20, seed: 7 })
  eq('twenty questions', picked.length, 20)
  ok('only questions the app marks itself, verified, never a variation', picked.every((i) => MARKED.has(i.type) && i.quality === 'pass' && !i.variant_of))
  eq('chapters weigh what their concepts weigh', [picked.filter((i) => i.chapter_id === 'ch1').length, picked.filter((i) => i.chapter_id === 'ch2').length], [5, 15])
  const k3 = picked.filter((i) => i.concept_id === 'k3').length
  const k4 = picked.filter((i) => i.concept_id === 'k4').length
  ok('spread over the concepts of a chapter', Math.abs(k3 - k4) <= 1)
  eq('the same seed draws the same exam', pickExam({ items, concepts, chapters, count: 20, seed: 7 }).map((i) => i.id), picked.map((i) => i.id))
  ok('another seed, another order', pickExam({ items, concepts, chapters, count: 20, seed: 8 }).map((i) => i.id).join() !== picked.map((i) => i.id).join())
  const recent = new Map(items.filter((i) => i.concept_id === 'k1').map((i, n) => [i.id, n < 8 ? NOW.toISOString() : null]))
  const fresh = pickExam({ items, concepts, chapters, count: 4, seed: 3, lastSeen: recent })
  const k1picked = fresh.filter((i) => i.concept_id === 'k1')
  ok('what was seen least recently comes first', k1picked.every((i) => !recent.get(i.id)))
  eq('more questions asked than exist: all of them, once', new Set(pickExam({ items, concepts, chapters, count: 500, seed: 1 }).map((i) => i.id)).size, 40)
  eq('nothing to pick: an empty exam', pickExam({ items: [], concepts, chapters }), [])

  eq('the blueprint sets the length', examShape({ count: 40, minutes: 90 }, 100), { count: 40, minutes: 90 })
  eq('fewer questions than the real exam: the time shrinks with them', examShape({ count: 40, minutes: 90 }, 20), { count: 20, minutes: 45 })
  eq('no blueprint: 30 questions, a minute and a half each', examShape(null, 100), { count: DEFAULT_COUNT, minutes: 45 })
  ok('never more than 60 questions', examShape({ count: 200 }, 500).count === 60)

  const exam = [
    { id: 'q1', chapter_id: 'ch1', bloom: 2, answer: { index: 1 } },
    { id: 'q2', chapter_id: 'ch1', bloom: 4, answer: { index: 0 } },
    { id: 'q3', chapter_id: 'ch2', bloom: 4, answer: { index: 2 } },
    { id: 'q4', chapter_id: 'ch2', bloom: 4, answer: { index: 3 } },
  ]
  const r = scoreExam({ items: exam, answers: { q1: 1, q2: 3, q3: 2 }, chapters })
  eq('the score', [r.score, r.total, r.pct], [2, 4, 50])
  eq('a blank is wrong', r.misses.map((m) => [m.item.id, m.given]), [['q2', 3], ['q4', null]])
  eq('by chapter, weakest first', r.byChapter.map((c) => [c.title, c.right, c.total, c.pct]), [['Cellules', 1, 2, 50], ['Osmose', 1, 2, 50]])
  eq('by Bloom level, in order', r.byBloom.map((b) => [b.bloom, b.right, b.total]), [[2, 1, 1], [4, 1, 3]])
  eq('an option index stored as text still marks', scoreExam({ items: exam.slice(0, 1), answers: { q1: '1' } }).score, 1)

  eq('the clock counts down', secondsLeft('2026-10-16T14:00:00.000Z', 30, Date.parse('2026-10-16T14:10:00.000Z')), 1200)
  eq('and stops at zero', secondsLeft('2026-10-16T14:00:00.000Z', 30, Date.parse('2026-10-16T15:00:00.000Z')), 0)
  eq('minutes and seconds', [clock(1200), clock(65), clock(0)], ['20:00', '1:05', '0:00'])
  const a = rng(42)
  const b = rng(42)
  eq('the seeded random repeats', [a(), a(), a()], [b(), b(), b()])
}

/* --- calibration ------------------------------------------------------------------ */
{
  const concepts = [
    { id: 'k1', chapter_id: 'ch1', name: 'Osmose' },
    { id: 'k2', chapter_id: 'ch1', name: 'Diffusion' },
    { id: 'k3', chapter_id: 'ch2', name: 'Mitose' },
  ]
  const chapters = [
    { id: 'ch1', course_id: 'c1', title: 'Chapitre 5' },
    { id: 'ch2', course_id: 'c1', title: 'Chapitre 6' },
  ]
  const twins = [{ a_concept: 'k1', b_concept: 'k2' }]
  const r = (concept_id, correct, confidence = 'sure', d = -1, mode = 'due') => ({ concept_id, correct, confidence, created_at: iso(d), mode })

  const by = calibrationByChapter([r('k1', true), r('k1', true), r('k2', false), r('k3', true), r('k3', false, 'unsure'), r('k1', false, 'sure', -1, 'pretest')], concepts)
  eq('sure answers per chapter, right ones, and the share', by.get('ch1'), { sure: 3, right: 2, pct: 67 })
  eq('too few "sure" answers to say anything: no number', by.get('ch2'), { sure: 1, right: 1, pct: null })
  ok(`the bar is ${MIN_SURE} sure answers`, MIN_SURE === 3)

  const week = weeklyLine({ reviews: [r('k1', false), r('k2', false), r('k1', false), r('k3', false), r('k1', false, 'sure', -9)], concepts, chapters, twins, now: NOW })
  eq('the week: where the sure-and-wrong gather', [week.total, week.n, week.chapter, week.course_id], [4, 3, 'Chapitre 5', 'c1'])
  eq('and the twin pair they all fall on', week.pair, ['Osmose', 'Diffusion'])
  eq('no pair when they do not', weeklyLine({ reviews: [r('k3', false)], concepts, chapters, twins, now: NOW }).pair, null)
  eq('a week with none says nothing', weeklyLine({ reviews: [r('k1', true), r('k1', false, 'unsure')], concepts, chapters, twins, now: NOW }), null)
  eq('a pretest guess never counts', weeklyLine({ reviews: [r('k1', false, 'sure', -1, 'pretest')], concepts, chapters, twins, now: NOW }), null)
}

/* --- the plan ------------------------------------------------------------------------- */
{
  /* Exam on Thursday 29 October: mock days on the 24th and the 26th (5 and 3 days before). */
  const exam = new Date('2026-10-29T09:00:00')
  eq('two mock exams, 5 and 3 days before', mockDays(exam, NOW), ['2026-10-24', '2026-10-26'])
  eq('3 days out, there is room for one', mockDays(new Date('2026-10-19T09:00:00'), NOW), ['2026-10-16'])
  eq('2 days out, one the day after tomorrow at the latest', mockDays(new Date('2026-10-18T09:00:00'), NOW), ['2026-10-16'])
  eq('tomorrow: no mock exam, the eve is a light review', mockDays(new Date('2026-10-17T09:00:00'), NOW), [])

  const courses = [{ id: 'bio', exam_at: exam.toISOString(), exam_format: { minutes: 60 } }]
  const plan = planDays({ courses, weeklyHours: 6, now: NOW })
  eq(`${HORIZON} days`, plan.length, HORIZON)
  const kinds = (date) => plan.find((d) => d.date === date)?.items.map((i) => i.kind)
  eq('a mock exam on each mock day, as long as the real one', plan.find((d) => d.date === '2026-10-24').items.find((i) => i.kind === 'mock')?.minutes, 60)
  eq('the eve is a light review only', kinds('2026-10-28'), ['eve'])
  ok('the Sunday before is a rest day', plan.find((d) => d.date === '2026-10-18').rest)
  const wed = planDays({ courses: [{ id: 'w', exam_at: '2026-10-28T09:00:00' }], weeklyHours: 6, now: NOW })
  const sunday = wed.find((d) => d.date === '2026-10-25')
  ok('a Sunday that holds a mock exam is not a rest day', !sunday.rest && sunday.items.some((i) => i.kind === 'mock'))
  ok('nothing after the exam', plan.filter((d) => d.date >= '2026-10-29').every((d) => !d.items.length))
  eq('the exam day says so', plan.find((d) => d.date === '2026-10-29').exams, ['bio'])
  ok('and no other day does', plan.filter((d) => d.date !== '2026-10-29').every((d) => !d.exams.length))

  const busy = [
    /* A class every weekday, 18:00 to 19:00. */
    { starts_on: '2026-10-01', weekdays: [1, 2, 3, 4, 5], until_on: null, start_min: 18 * 60, end_min: 19 * 60 },
    /* A one-off that fills Saturday evening. */
    { starts_on: '2026-10-17', weekdays: [], until_on: null, start_min: 18 * 60, end_min: 22 * 60 },
  ]
  const { placed, unplaced } = placeDays(plan, { busy, startMin: 18 * 60, endMin: 22 * 60 })
  ok('nothing lands on a class', placed.every((p) => new Date(`${p.date}T12:00:00`).getDay() === 0 || new Date(`${p.date}T12:00:00`).getDay() === 6 || p.start_min >= 19 * 60))
  ok('a full evening is said, not hidden', unplaced.some((p) => p.date === '2026-10-17'))
  ok('within the study hours', placed.every((p) => p.start_min >= 18 * 60 && p.end_min <= 22 * 60))
  const sameDay = placed.filter((p) => p.date === '2026-10-24')
  ok('two blocks on one day never overlap', sameDay.every((a, i) => sameDay.every((b, j) => i === j || a.end_min <= b.start_min || b.end_min <= a.start_min)))

  const rows = eventRows(placed, { userId: 'u1', title: (p) => `${p.kind} · Biologie` })
  ok('calendar rows the shape the syllabus planner writes', rows.every((r) => r.user_id === 'u1' && r.category === 'etude' && r.colour === 'ev-etude' && Array.isArray(r.weekdays) && r.weekdays.length === 0 && r.until_on === null))
  ok('one-offs, on the planned day', rows.every((r, i) => r.starts_on === placed[i].date && r.start_min === placed[i].start_min))
  ok('titles fit the column', eventRows([{ ...placed[0] }], { userId: 'u', title: () => 'x'.repeat(300) })[0].title.length === 120)

  const planRows = [
    { id: 1, kind: 'study', course_id: 'bio', on_date: '2026-10-13' },
    { id: 2, kind: 'study', course_id: 'bio', on_date: '2026-10-14' },
    { id: 3, kind: 'mock', course_id: 'bio', on_date: '2026-10-15' },
    { id: 4, kind: 'rest', course_id: null, on_date: '2026-10-11' },
    { id: 5, kind: 'study', course_id: 'bio', on_date: '2026-10-16' },
  ]
  const late = missed(planRows, {
    sessions: [
      { course_id: 'bio', started_at: '2026-10-13T20:00:00', answered: 12 },
      { course_id: 'bio', started_at: '2026-10-14T20:00:00', answered: 0 },
    ],
    exams: [{ course_id: 'bio', started_at: '2026-10-15T19:00:00', ended_at: null }],
    now: NOW,
  })
  eq('missed: no answer that day, an unfinished mock exam; never a rest day, never today', late.map((r) => r.id), [2, 3])
}

/* --- desirable difficulty ------------------------------------------------------------------ */
{
  const r = (d, correct, bloom = 3, mode = 'due') => ({ created_at: iso(d), correct, bloom, mode })
  eq('a concept starts at application', targetBloom([]), START)
  eq('two right on two days at the level: one step up', targetBloom([r(-3, true), r(-2, true)]), START + 1)
  eq('two right on the same day: not yet', targetBloom([r(-2, true), r(-2, true)]), START)
  eq('two misses in a row: one step down', targetBloom([r(-3, false), r(-2, false)]), START - 1)
  eq('never below the floor', targetBloom([r(-6, false), r(-5, false), r(-4, false), r(-3, false), r(-2, false), r(-1, false)]), FLOOR)
  eq('a pretest guess does not count', targetBloom([r(-3, false, 3, 'pretest'), r(-2, false, 3, 'pretest')]), START)
  const climb = [r(-9, true, 3), r(-8, true, 3), r(-7, true, 4), r(-6, true, 4), r(-5, true, 5), r(-4, true, 5), r(-3, true, 6), r(-2, true, 6)]
  eq('never past the top', targetBloom(climb), CEILING)
  eq('nor past what the real exam asks', targetBloom(climb, { cap: 4 }), 4)
  const m = targetsByConcept([{ ...r(-3, true), concept_id: 'a' }, { ...r(-2, true), concept_id: 'a' }, { ...r(-2, false), concept_id: 'b' }])
  eq('by concept', [m.get('a'), m.get('b')], [4, 3])
  eq('a true/false exam caps at 3', capFromFormat({ types: ['tf'] }), 3)
  eq('a stated top level wins', capFromFormat({ max_bloom: 2, types: ['mcq'] }), 2)
  eq('otherwise the ceiling', capFromFormat(null), CEILING)

  const items = [
    { id: 'low', concept_id: 'k', chapter_id: 'c', type: 'mcq', bloom: 2, quality: 'pass' },
    { id: 'high', concept_id: 'k', chapter_id: 'c', type: 'mcq', bloom: 5, quality: 'pass' },
    { id: 'mid', concept_id: 'k', chapter_id: 'c', type: 'mcq', bloom: 4, quality: 'pass' },
  ]
  const seen = [{ item_id: 'seen', due: later(5).toISOString() }]
  const plan = buildSession({ minutes: 25, items: [...items, { id: 'seen', concept_id: 'k', chapter_id: 'c', type: 'mcq', bloom: 3, quality: 'pass' }], schedule: seen, concepts: [{ id: 'k', chapter_id: 'c', weight: 1 }], chapters: [{ id: 'c', position: 0 }], targets: new Map([['k', 4]]), now: NOW })
  eq('new questions nearest the level reached come first', plan.items.filter((e) => e.reason === 'new').map((e) => e.id).slice(0, 2), ['mid', 'high'])
}

/* --- variations of a mistake --------------------------------------------------------------- */
{
  const base = { course_id: 'c', concept_id: 'k', chapter_id: 'ch', type: 'mcq', bloom: 3, quality: 'pass', options: [{ text: 'a', why: 'piège' }, { text: 'b', why: 'juste' }], answer: { index: 1 } }
  const orig = { ...base, id: 'orig' }
  const v1 = { ...base, id: 'v1', variant_of: 'orig' }
  const v2 = { ...base, id: 'v2', variant_of: 'orig' }
  const schedule = [
    { item_id: 'orig', due: later(5).toISOString() },
    { item_id: 'v1', due: later(5).toISOString() },
  ]
  const mistakes = [{ item_id: 'orig', confident: true, resolved_at: null }]
  const plan = buildSession({ minutes: 10, items: [orig, v1, v2], schedule, mistakes, concepts: [{ id: 'k', chapter_id: 'ch' }], chapters: [{ id: 'ch', position: 0 }], now: NOW })
  eq('a mistake comes back as a variation not seen yet', [plan.items[0].id, plan.items[0].reason], ['v2', 'confident_wrong'])
  ok('a variation is never a new question of its own', plan.items.filter((e) => e.reason === 'new' || e.reason === 'pretest').every((e) => !['v1', 'v2'].includes(e.id)))
  const none = buildSession({ minutes: 10, items: [orig, { ...v2 }], schedule: [...schedule, { item_id: 'v2', due: later(5).toISOString() }], mistakes, concepts: [], chapters: [{ id: 'ch', position: 0 }], now: NOW })
  eq('every variation seen: the original again', none.items[0]?.id, 'orig')

  const wrong = answerRows({ item: v2, choice: 0, confidence: 'sure', now: NOW, mode: 'confident_wrong' })
  eq('answering a variation logs the mistake under the original', wrong.mistake.item_id, 'orig')
  eq('while its own schedule is its own', wrong.schedule.item_id, 'v2')
  const right = answerRows({ item: v2, choice: 1, confidence: 'sure', now: NOW, mistake: { item_id: 'orig', right_streak: 2, last_right_on: '2026-10-14', confident: true }, mode: 'mistake' })
  ok('and a right answer on a variation moves the streak towards resolving it', right.mistake.item_id === 'orig' && right.mistake.resolved_at)
}

/* --- retention before the exam ---------------------------------------------------------------- */
{
  eq('what the professor flagged, in the last ten days: 95%', retentionFor({ weight: 3, daysLeft: 6 }), BOOSTED_RETENTION)
  eq('earlier: 90%', retentionFor({ weight: 3, daysLeft: FINAL_DAYS + 1 }), RETENTION)
  eq('a concept she did not flag: 90%', retentionFor({ weight: 2, daysLeft: 3 }), RETENTION)
  eq('no exam date: 90%', retentionFor({ weight: 3, daysLeft: null }), RETENTION)
  const card = { state: 'review', stability: 20, difficulty: 5, reps: 3, lapses: 0, last_review: later(-20).toISOString() }
  ok('a higher target brings the card back sooner', review(card, 3, NOW, { retention: 0.95 }).interval < review(card, 3, NOW).interval)
  const item = { id: 'x', course_id: 'c', concept_id: 'k', type: 'mcq', bloom: 3, options: [{}, {}], answer: { index: 0 } }
  ok('and answerRows passes it on', answerRows({ item, choice: 0, confidence: 'sure', card, now: NOW, retention: 0.95 }).interval < answerRows({ item, choice: 0, confidence: 'sure', card, now: NOW }).interval)
}

/* --- the Rich & Friends check-in ---------------------------------------------------------------- */
{
  const g = studyGoal({ userId: 'u1', title: 'Étudier avec Nerd', today: '2026-10-16' })
  eq('a personal goal, no group, owned', [g.group_id, g.kind, g.owner_id], [null, 'personal', 'u1'])
  eq('once a day, Monday to Saturday: Sunday is the plan’s rest day', [g.cadence, g.target_per_cycle, g.active_days], ['recurring', 1, STUDY_DAYS])
  eq('no proof to attach: the session is the proof', g.proof_type, 'none')
  eq('starting today, with no end and no reminder', [g.starts_on, g.ends_on, g.remind], ['2026-10-16', null, false])
  eq('the tick is the local day, even late at night', tickRow({ goalId: 'g', userId: 'u1', now: new Date('2026-10-16T23:30:00') }), { goal_id: 'g', user_id: 'u1', on_date: '2026-10-16', count_done: 1 })
  eq('a session with answers counts, an empty one does not', [sessionCounts([{ mode: 'pretest' }]), sessionCounts([])], [true, false])
}

/* --- what the server checks before storing: cases -------------------------------------------------- */
{
  const anchors = keyMap([{ id: '11111111-aaaa-4000-8000-000000000000' }, { id: '22222222-bbbb-4000-8000-000000000000' }], 'A')
  eq('[A1] becomes the chip of its excerpt, an unknown key goes', citeKeys('Le transport [A1], la pompe [A9].', anchors), `Le transport [${shortId('11111111-aaaa-4000-8000-000000000000')}], la pompe .`)
  const body = 'Une entreprise de cosmétiques veut lancer un sérum. '.repeat(6)
  const good = {
    title: 'Le sérum',
    body,
    exhibits: [{ title: 'Ventes', columns: ['Mois', 'Unités'], rows: [['Janvier', '120', 'extra'], ['Février']] }],
    questions: [{ prompt: 'Que recommandes-tu ?', points: 10 }],
    rubric: [
      { criterion: 'Notions', points: 4, looks_for: 'Nomme la segmentation', anchors: ['A1'] },
      { criterion: 'Preuves', points: 3, looks_for: 'Cite le tableau', anchors: ['A2', 'A7'] },
      { criterion: 'Liens', points: 2, looks_for: 'Relie les chapitres', anchors: ['A1'] },
      { criterion: 'Inventé', points: 1, looks_for: 'Rien', anchors: ['A8'] },
    ],
    model_answer: 'Segmenter [A1] puis positionner [A2].',
    anchors: ['A1', 'A2', 'A5'],
    outside_note: 'La marque est inventée.',
  }
  const c = caseFrom(good, anchors)
  ok('a good case is kept', c.ok)
  eq('a rubric line that cites nothing real is dropped', c.row.rubric.map((r) => r.criterion), ['Notions', 'Preuves', 'Liens'])
  eq('and its anchors are ids, the unknown ones gone', c.row.rubric[1].anchor_ids, ['22222222-bbbb-4000-8000-000000000000'])
  eq('a table row has as many cells as columns', c.row.exhibits[0].rows, [['Janvier', '120'], ['Février', '']])
  ok('the model answer cites chips', c.row.model_answer.includes(`[${shortId('11111111-aaaa-4000-8000-000000000000')}]`) && !c.row.model_answer.includes('[A1]'))
  eq('every anchor the case uses, real ones only', c.row.anchor_ids.length, 2)
  const thin = caseFrom({ ...good, rubric: good.rubric.slice(0, 2) }, anchors)
  ok('fewer than three real rubric lines: refused', !thin.ok && thin.problems.includes('rubric'))
  ok('a case with no story: refused', !caseFrom({ ...good, body: 'Court.' }, anchors).ok)

  const rubric = c.row.rubric
  const answer = 'Je segmente le marché par âge. Ensuite je regarde les ventes de janvier.'
  const g = gradeFrom(
    {
      criteria: [
        { index: 0, points: 9, quote: 'Je segmente le marché par âge', why: 'Bien.' },
        { index: 1, points: 1.3, quote: 'une phrase que je n’ai jamais écrite', why: 'Peu.' },
        { index: 7, points: 3, quote: '', why: 'Hors grille.' },
      ],
      improvements: [{ rubric_index: 1, text: 'Cite les chiffres.', anchor: 'A2' }, { rubric_index: 9, text: 'Hors grille.', anchor: 'A9' }, { rubric_index: 2, text: '' }],
      summary: 'Bon début.',
    },
    { rubric, answer, anchors },
  )
  eq('points never above what the line is worth', g.criteria[0].points, 4)
  eq('rounded to the half point', g.criteria[1].points, 1.5)
  eq('a quote is shown only if the student wrote it', [g.criteria[0].quote, g.criteria[1].quote], ['Je segmente le marché par âge', ''])
  eq('a line the grader skipped gets nothing, said plainly', [g.criteria[2].points, g.criteria[2].criterion], [0, 'Liens'])
  eq('the total and what it is out of', [g.points, g.out_of], [5.5, 9])
  eq('improvements tied to a real line and a real excerpt', g.improvements.map((m) => [m.rubric_index, m.anchor_id]), [[1, '22222222-bbbb-4000-8000-000000000000'], [null, null]])
}

/* --- visuals --------------------------------------------------------------------------------- */
{
  const anchors = keyMap([{ id: 'a-1' }, { id: 'a-2' }], 'A')
  const node = (label, more = {}) => ({ label, detail: '', cells: [], when: null, parent: null, x: null, y: null, anchor: 'A1', ...more })
  const out = visualsFrom(
    {
      visuals: [
        { kind: 'steps', title: 'La mitose', columns: [], nodes: [node('Prophase'), node('Métaphase', { anchor: 'A2' }), node('Sans source', { anchor: 'A9' })] },
        { kind: 'table', title: 'Osmose ou diffusion', columns: ['', 'Quoi', 'Membrane'], nodes: [node('Osmose', { cells: ['eau', 'oui', 'trop'] }), node('Diffusion', { cells: ['soluté'] })] },
        { kind: 'tree', title: 'Classement', columns: [], nodes: [node('Vivant'), node('Animal', { parent: 0 }), node('Végétal', { parent: 0 })] },
        { kind: 'pie', title: 'Inconnu', columns: [], nodes: [node('a'), node('b')] },
      ],
    },
    anchors,
  )
  eq('a kind the app cannot draw is dropped', out.map((v) => v.kind), ['steps', 'table', 'tree'])
  eq('a node with no real excerpt is dropped', out[0].data.nodes.map((n) => n.label), ['Prophase', 'Métaphase'])
  eq('and every node keeps the id of its excerpt', out[0].anchor_ids, ['a-1', 'a-2'])
  eq('table rows have one cell per column after the first', out[1].data.nodes.map((n) => n.cells), [['eau', 'oui'], ['soluté', '']])
  eq('a tree keeps its parents', out[2].data.nodes.map((n) => n.parent), [null, 0, 0])
  const bad = (nodes, kind = 'tree', columns = []) => visualsFrom({ visuals: [{ kind, title: 'x', columns, nodes }] }, anchors).length
  eq('a tree with two roots is refused', bad([node('a'), node('b'), node('c', { parent: 0 })]), 0)
  eq('a tree with a cycle is refused', bad([node('a'), node('b', { parent: 2 }), node('c', { parent: 1 })]), 0)
  eq('a tree with an unsupported node is refused whole', bad([node('a'), node('b', { parent: 0 }), node('c', { parent: 0, anchor: null })]), 0)
  eq('a 2x2 needs its four axis labels', bad([node('a', { x: 0, y: 1 })], 'matrix', ['bas', 'haut', 'bas']), 0)
  eq('and keeps what sits in a quadrant', visualsFrom({ visuals: [{ kind: 'matrix', title: 'x', columns: ['peu', 'beaucoup', 'lent', 'rapide'], nodes: [node('a', { x: 1, y: 0 }), node('b')] }] }, anchors)[0].data.nodes.map((n) => [n.x, n.y]), [[1, 0]])
  eq('a timeline needs its dates', bad([node('a', { when: '1953' }), node('b')], 'timeline'), 0)
}

/* --- the question pipeline, with a fake verifier ----------------------------------------------- */
{
  const anchorRows = [{ id: 'an-1', label: 'diapo 3', excerpt: 'L’osmose est le passage de l’eau.' }]
  const anchors = keyMap(anchorRows, 'A')
  const item = (stem, key = 1, more = {}) => ({
    concept: 'K1',
    type: 'mcq',
    bloom: 3,
    stem,
    options: [0, 1, 2, 3].map((n) => ({ text: `Option ${n} ${stem.slice(0, 6)}`, why: `Parce que ${n}`, anchor: 'A1', outside: false })),
    key,
    explanation: 'Voir la diapo.',
    anchors: ['A1'],
    ...more,
  })
  const raw = [
    item('Une cellule est plongée dans de l’eau salée, que se passe-t-il ?'),
    item('Un globule rouge est placé dans de l’eau pure, que se passe-t-il ?'),
    item('Une plante fane au soleil de midi, pourquoi exactement ?'),
    item('Question sans source réelle pour la tester', 1, { anchors: ['A9'] }),
    item('Une cellule est plongée dans de l’eau salée, que se passe-t-il ?'),
  ]
  let sent = null
  const fake = (verdicts) => ({
    messages: {
      stream: (req) => {
        sent = req
        return { finalMessage: async () => ({ stop_reason: 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 }, parsed_output: { verdicts } }) }
      },
    },
  })
  const fixed = item('Un globule rouge est placé dans de l’eau pure : que devient-il ?', 2)
  const out = await vet(fake([
    { index: 0, solved: 1, verdict: 'pass', reasons: 'ok', fixed: null },
    { index: 1, solved: 0, verdict: 'fix', reasons: 'clé ambiguë', fixed },
    { index: 2, solved: 3, verdict: 'pass', reasons: 'ok', fixed: null },
  ]), { raw, anchors, anchorRows, concepts: new Set(['K1']) })
  eq('the code checks go first: an unknown excerpt and a duplicate never reach the verifier', JSON.parse(sent.messages[0].content[0].text.split('ITEMS:\n')[1]).length, 3)
  ok('the verifier is given the excerpts only', sent.messages[0].content[0].text.startsWith('EXCERPTS:\n[A1] (diapo 3)'))
  eq('pass, fixed and kept as revised, and "pass" on a guess rejected', out.kept.map((k) => [k.quality, k.item.key]), [['pass', 1], ['revised', 2]])
  eq('everything else counted as rejected', out.rejected, 3)
  const row = itemRow(out.kept[1], { userId: 'u', courseId: 'c', chapterId: 'ch', conceptId: 'k', anchors, variantOf: 'orig' })
  eq('a variation is stored with the original it comes from', [row.variant_of, row.quality, row.anchor_ids, row.answer], ['orig', 'revised', ['an-1'], { index: 2 }])
  ok('and a plain question has no variant_of at all', !('variant_of' in itemRow(out.kept[0], { userId: 'u', courseId: 'c', chapterId: 'ch', conceptId: 'k', anchors })))
  const empty = await vet(fake([]), { raw: [item('x')], anchors, anchorRows, concepts: new Set(['K1']) })
  eq('nothing left after the code checks: no model call', [empty.kept.length, empty.ver], [0, null])
  eq('shape() reads what the model returned, whatever it is', shape({ type: 'weird', bloom: 9, key: '2' }).type + shape({ bloom: 9 }).bloom + shape({ key: '2' }).key, 'mcq62')
}

/* --- deleting the account takes the files ------------------------------------------------------- */
{
  const files = new Set()
  for (let c = 0; c < 2; c += 1) for (let f = 0; f < 140; f += 1) files.add(`u1/course${c}/f${f}.pdf`)
  files.add('u1/loose.txt')
  files.add('u2/course/x.pdf')
  const bucket = {
    async list(prefix, { limit }) {
      const seen = new Map()
      for (const p of files) {
        if (!p.startsWith(`${prefix}/`)) continue
        const [head, ...more] = p.slice(prefix.length + 1).split('/')
        if (!seen.has(head)) seen.set(head, more.length ? { name: head, id: null } : { name: head, id: 'x' })
      }
      return { data: [...seen.values()].slice(0, limit), error: null }
    },
    async remove(paths) {
      for (const p of paths) files.delete(p)
      return { error: null }
    },
  }
  const n = await removeTree({ storage: { from: () => bucket } }, 'u1')
  eq('every file under the account, folders and pages of 100 included', n, 281)
  eq('and nobody else’s', [...files], ['u2/course/x.pdf'])
}

/* --- the routes, the allowances, the TikTok page -------------------------------------------------- */
{
  const src = readFileSync(new URL('../../../api/bb/[action].js', import.meta.url), 'utf8')
  for (const r of ['case', 'grade', 'vary', 'visual', 'purge']) ok(`/api/bb/${r} is routed`, new RegExp(`\\b${r}\\b`).test(src.slice(src.indexOf('const ROUTES'))))
  eq('what the new routes spend', [ROUTE_BUCKET.vary, ROUTE_BUCKET.case, ROUTE_BUCKET.visual, ROUTE_BUCKET.grade], ['generate', 'generate', 'generate', 'grade'])
  ok('the TikTok page has its own link card', bbPreviewHtml({ page: 'go', locale: 'fr' }).includes('<link rel="canonical" href="https://richandfriends.xyz/nerd/go" />'))
  const rewrites = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url))).rewrites
  const at = (s) => rewrites.findIndex((r) => r.source === s)
  ok('crawlers of /nerd/go get it, before the catch-all', at('/nerd/go') >= 0 && at('/nerd/go') < at('/((?!api/).*)'))
  /* The in-app browsers of TikTok and Instagram put those names in their
     user agent: matching them would serve the card to real people. */
  ok('never the in-app browsers', rewrites.every((r) => !/TikTok|Instagram|musical_ly|Bytedance/i.test(r.has?.[0]?.value ?? '')))
}

/* --- the migration ---------------------------------------------------------------------------------- */
{
  const sql = readFileSync(new URL('../../../supabase/81_bb_phase2.sql', import.meta.url), 'utf8')
  ok('plain ASCII, for the clipboard (CLAUDE.md)', /^[\x00-\x7F]*$/.test(sql))
  for (const t of ['bb_exams', 'bb_cases', 'bb_case_attempts', 'bb_plan_days', 'bb_visuals', 'bb_squad_share']) ok(`${t} is in the row level security loop`, sql.includes(`'${t}'`))
  ok('the squad board is a definer function with a fixed search path', /security definer\s+set search_path = public/.test(sql))
  ok('which reads no score, answer or mistake', !/bb_reviews|bb_mistakes|bb_exams e|score/.test(sql.slice(sql.indexOf('create or replace function public.bb_squad_effort'), sql.indexOf('revoke all on function'))))
  ok('both ways: the caller must share too', /join bb_squad_share mine/.test(sql))
  ok('anon may not run it', sql.includes('revoke all on function public.bb_squad_effort(uuid) from anon'))
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
