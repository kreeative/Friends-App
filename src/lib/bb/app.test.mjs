/**
 * node src/lib/bb/app.test.mjs
 *
 * Beauty & Brain, the rules the app applies with no server and no model:
 * what one answer writes (FSRS, the answer, the mistake log), the days (the
 * countdown, the streak, the week's plan), which files are accepted, how the
 * coach's citations are read back, and the two languages of the interface.
 */
import { answerRows, RESOLVE_STREAK } from './answer.js'
import { daysUntil, examLabel, studyStreak, sessionsToday, dayKey } from './days.js'
import { planDays } from './planner.js'
import { MAX_BYTES, formatOf, kindFor, refuse } from './formats.js'
import { SHORT, citeOf, citedIds, hasCites, shortId, shortMap, splitRich, stripCites } from './cite.js'
import { dictationNote, dictationSupport, heard, speechLang, withSpeech } from './dictation.js'
import { EXAM_KINDS, SCOPES, comingExams, daysToExamOf, examChip, examColumns, examFormat, examToAsk, examsLine, examsOf, nextExam, scopeOf, stillAhead } from './exams.js'
import { buildSession } from './sampler.js'
import { BB_STRINGS } from '../../bb/strings.js'
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

console.log('\nbeauty & brain, the app')

/* --- one answer ---------------------------------------------------------- */
const NOW = new Date('2026-10-16T14:00:00')
const later = (days) => new Date(NOW.getTime() + days * 86400000)
const mcq = { id: 'i1', course_id: 'c1', concept_id: 'k1', type: 'mcq', bloom: 3, options: [{ text: 'a', why: 'trap A' }, { text: 'b', why: 'right' }, { text: 'c', why: 'trap C' }], answer: { index: 1 } }
const card = { id: 'f1', course_id: 'c1', concept_id: 'k2', type: 'flash', bloom: 1, answer: { text: 'def' } }

{
  const r = answerRows({ item: mcq, choice: 1, confidence: 'sure', now: NOW, mode: 'new' })
  eq('right and sure is Good', r.rating, 3)
  ok('and right', r.correct === true)
  eq('a first answer schedules the item', r.schedule.item_id, 'i1')
  ok('into review, days ahead', r.schedule.state === 'review' && Date.parse(r.schedule.due) > NOW.getTime() + 86400000)
  ok('nothing goes in the mistake log', r.mistake === null)
  eq('the answer row keeps the confidence and the Bloom level', [r.answer.confidence, r.answer.bloom, r.answer.correct], ['sure', 3, true])
  ok('and no interval leaks into the schedule row', !('interval' in r.schedule))
}
{
  const r = answerRows({ item: mcq, choice: 0, confidence: 'sure', now: NOW, mode: 'due' })
  eq('wrong is Again', r.rating, 1)
  ok('wrong and sure is flagged', r.sureWrong === true && r.mistake.confident === true)
  eq('the misconception is the trap of the chosen option', r.mistake.misconception, 'trap A')
  eq('the streak starts at zero', r.mistake.right_streak, 0)
  ok('due again within the day', Date.parse(r.schedule.due) - NOW.getTime() <= 15 * 60000)
}
{
  const r = answerRows({ item: mcq, choice: 1, confidence: 'guess', now: NOW, mode: 'new' })
  eq('right but guessed is Hard', r.rating, 2)
  ok('a lucky guess goes in the log too (low confidence)', r.mistake !== null && r.mistake.confident === false)
}
{
  const r = answerRows({ item: mcq, choice: 0, confidence: 'sure', now: NOW, mode: 'pretest' })
  ok('a pretest guess never enters the mistake log', r.mistake === null)
  ok('and is never counted "sure and wrong"', r.sureWrong === false)
  ok('but it is still an answer with a schedule', r.answer.mode === 'pretest' && r.schedule.reps === 1)
}
{
  /* Three right answers on three different days resolve a mistake. */
  let m = { item_id: 'i1', concept_id: 'k1', misconception: 'trap A', confident: true, right_streak: 0, last_right_on: null, resolved_at: null }
  const day = (d) => dayKey(later(d))
  let r = answerRows({ item: mcq, choice: 1, confidence: 'sure', mistake: m, now: later(1), mode: 'mistake' })
  eq('a right answer moves the streak to 1', r.mistake.right_streak, 1)
  m = { ...m, ...r.mistake }
  r = answerRows({ item: mcq, choice: 1, confidence: 'sure', mistake: m, now: new Date(later(1).getTime() + 3600000), mode: 'mistake' })
  eq('a second right answer the same day does not move it', r.mistake.right_streak, 1)
  m = { ...m, ...r.mistake }
  r = answerRows({ item: mcq, choice: 1, confidence: 'sure', mistake: m, now: later(3), mode: 'mistake' })
  eq('another day: 2', r.mistake.right_streak, 2)
  ok('not resolved yet', r.mistake.resolved_at === null)
  m = { ...m, ...r.mistake }
  r = answerRows({ item: mcq, choice: 1, confidence: 'sure', mistake: m, now: later(6), mode: 'mistake' })
  eq(`resolved at ${RESOLVE_STREAK} right on ${RESOLVE_STREAK} different days`, [r.mistake.right_streak, Boolean(r.mistake.resolved_at)], [3, true])
  eq('the day kept is local', r.mistake.last_right_on, day(6))
  ok('the flag stays on the row until then', m.confident === true)
  const wrong = answerRows({ item: mcq, choice: 2, confidence: 'unsure', mistake: { ...m, right_streak: 2 }, now: later(4), mode: 'mistake' })
  eq('a wrong answer resets the streak', wrong.mistake.right_streak, 0)
  eq('and names the new trap', wrong.mistake.misconception, 'trap C')
  ok('and an earlier "sure and wrong" stays flagged', wrong.mistake.confident === true)
}
{
  const again = answerRows({ item: card, rating: 1, now: NOW, mode: 'due' })
  ok('a flashcard rated Again is a mistake', again.correct === false && again.mistake !== null)
  ok('but never "sure and wrong" (no confidence on a card)', again.mistake.confident === false)
  const good = answerRows({ item: card, rating: 3, now: NOW, mode: 'new' })
  ok('Good on a card is right, no log', good.correct === true && good.mistake === null)
  const easy = answerRows({ item: card, rating: 4, now: NOW, mode: 'new' })
  ok('Easy schedules further than Good', Date.parse(easy.schedule.due) > Date.parse(good.schedule.due))
  const prev = { state: 'review', stability: 10, difficulty: 5, reps: 3, lapses: 0, last_review: later(-10).toISOString(), due: NOW.toISOString() }
  const lapse = answerRows({ item: card, card: prev, rating: 1, now: NOW, mode: 'due' })
  eq('forgetting a review card counts a lapse', [lapse.schedule.state, lapse.schedule.lapses], ['relearning', 1])
}

/* --- days ------------------------------------------------------------------- */
eq('no date, no countdown', daysUntil(null, NOW), null)
eq('tomorrow is 1', daysUntil(later(1), NOW), 1)
eq('tonight is 0', daysUntil(new Date('2026-10-16T23:00:00'), NOW), 0)
eq('the label says today', examLabel(new Date('2026-10-16T23:00:00'), NOW).key, 'bb.exam.today')
eq('and past for yesterday', examLabel(later(-1), NOW).key, 'bb.exam.past')
eq('and counts otherwise', examLabel(later(9), NOW), { key: 'bb.exam.in', n: 9 })
{
  const s = (d, answered = 5) => ({ started_at: later(d).toISOString(), answered })
  eq('three days in a row, today included', studyStreak([s(-2), s(-1), s(0)], NOW), 3)
  eq('today not studied yet does not break it', studyStreak([s(-2), s(-1)], NOW), 2)
  eq('a gap does', studyStreak([s(-3), s(-1)], NOW), 1)
  eq('an empty session does not count', studyStreak([s(-1, 0)], NOW), 0)
  eq('sessions today', sessionsToday([s(0), s(0), s(-1)], NOW), 2)
}
{
  const courses = [
    { id: 'a', exam_at: later(4).toISOString() },
    { id: 'b', exam_at: later(20).toISOString() },
  ]
  const plan = planDays({ courses, weeklyHours: 6, now: NOW, days: 7 })
  eq('seven days', plan.length, 7)
  const sundays = plan.filter((d) => new Date(`${d.date}T12:00:00`).getDay() === 0)
  ok('one rest day a week, on Sunday', sundays.length === 1 && sundays[0].rest)
  const eve = plan.find((d) => d.items.some((i) => i.kind === 'eve'))
  ok('the eve of an exam is a light review of that course only', eve && eve.items.length === 1 && eve.items[0].course_id === 'a' && eve.items[0].minutes <= 20)
  const day1 = plan[0]
  ok('the closer exam gets more of the day', day1.items.find((i) => i.course_id === 'a').minutes > day1.items.find((i) => i.course_id === 'b').minutes)
  const after = plan.filter((d) => d.date > dayKey(later(4)))
  ok('a course whose exam has passed is no longer planned', after.every((d) => d.items.every((i) => i.course_id !== 'a')))
  const monday = planDays({ courses: [{ id: 'm', exam_at: later(3).toISOString() }], now: NOW, days: 7 })
  ok('no rest on the Sunday before a Monday exam: it is the eve', monday.filter((d) => new Date(`${d.date}T12:00:00`).getDay() === 0).every((d) => !d.rest && d.items[0]?.kind === 'eve'))
  ok('minutes are rounded to 5, at least 10', plan.flatMap((d) => d.items).every((i) => i.minutes % 5 === 0 && i.minutes >= 10))
}

/* --- files --------------------------------------------------------------------- */
eq('a PDF by name or type', [formatOf('a.PDF'), formatOf('x', 'application/pdf')], ['pdf', 'pdf'])
eq('PowerPoint and Word', [formatOf('a.pptx'), formatOf('a.docx')], ['pptx', 'docx'])
eq('subtitles and text', [formatOf('l.vtt'), formatOf('l.srt'), formatOf('n.txt')], ['captions', 'captions', 'text'])
eq('an iPhone photo is refused before upload', refuse({ name: 'IMG_1.HEIC', size: 10 }), 'heic')
eq('an old .ppt too', refuse({ name: 'cours.ppt', size: 10 }), 'legacy')
eq('a file over the limit', refuse({ name: 'big.pdf', size: MAX_BYTES + 1 }), 'too_big')
eq('a normal PDF goes', refuse({ name: 'cours.pdf', size: 1000 }), null)
eq('a past exam is guessed from its name', [kindFor('Examen final 2024.pdf'), kindFor('Midterm practice.pdf')], ['exam', 'exam'])
eq('slides by default, a photo for an image', [kindFor('Cours 3.pptx'), kindFor('IMG_22.jpg')], ['slides', 'photo'])
eq('a transcript from subtitles', kindFor('lecture 7.vtt'), 'transcript')

/* --- coach citations ------------------------------------------------------------------- */
eq('short ids are eight hex digits', shortId('3F9C1D2A-0000-4000-8000-000000000000'), '3f9c1d2a')
eq('the constant says so', SHORT, 8)
{
  const anchors = [
    { id: 'aaaaaaaa-1111-4000-8000-000000000000', label: 'diapo 6' },
    { id: 'bbbbbbbb-2222-4000-8000-000000000000', label: 'diapo 9' },
    { id: 'aaaaaaaa-3333-4000-8000-000000000000', label: 'a collision' },
  ]
  const map = shortMap(anchors)
  eq('on a collision the first anchor wins', map.get('aaaaaaaa').label, 'diapo 6')
  const text = 'Contre le gradient [aaaaaaaa], avec ATP [bbbbbbbb] et encore [aaaaaaaa]. Inconnu [cccccccc].'
  eq('cited anchors, in order, once each, known only', citedIds(text, map), [anchors[0].id, anchors[1].id])
  ok('a text with ids has citations', hasCites(text) && !hasCites('rien ici [abc]'))
  eq('a card keeps the words, not the ids', stripCites(text), 'Contre le gradient, avec ATP et encore. Inconnu.')
  eq('a line is cut around ids and bold', splitRich('Le **transport** [aaaaaaaa] actif'), ['Le ', '**transport**', ' ', '[aaaaaaaa]', ' actif'])
  eq('one id is read back, a six-digit one is not', [citeOf('[aaaaaaaa]'), citeOf('[aaaaaa]')], ['aaaaaaaa', null])
}

/* --- the midterm and the final ------------------------------------------------------------------- */
{
  const at = (d) => later(d).toISOString()
  const chapters = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `ch${n}`, title: `Chapitre ${n}`, position: n }))
  const course = {
    id: 'bio',
    exam_at: at(9),
    exam_format: { types: ['mcq'], count: 40, minutes: 90 },
    exams: [
      { id: 'f', kind: 'final', at: at(60), scope: 'since', format: { count: 80, minutes: 180 } },
      { id: 'm', kind: 'midterm', at: at(9), scope: 'chapters', chapters: ['ch1', 'ch2', 'ch3'] },
    ],
  }
  const list = examsOf(course)
  eq('the exams in date order, the midterm first', list.map((e) => e.kind), ['midterm', 'final'])
  eq('the next one is the midterm', nextExam(course, NOW)?.id, 'm')
  eq('and the day after it, the final', nextExam(course, later(10))?.id, 'f')
  eq('the countdown names it', [examChip(course, NOW).key, examChip(course, NOW).n, examChip(course, NOW).exam.kind], ['bb.exam.in', 9, 'midterm'])
  eq('on the day', examChip(course, later(9)).key, 'bb.exam.today')
  eq('once both are past, the last one, passed', [examChip(course, later(61)).key, examChip(course, later(61)).exam.kind], ['bb.exam.past', 'final'])
  const undated = { exams: [{ id: 'm', kind: 'midterm', at: at(-2) }, { id: 'f', kind: 'final', at: null }] }
  eq('a final without a date wins over a midterm that is past', [examChip(undated, NOW).key, examChip(undated, NOW).exam.kind], ['bb.exam.undated', 'final'])
  ok('and the course is still worked on', stillAhead(undated, NOW))
  ok('a course whose only exam has passed is not', !stillAhead({ exams: [{ id: 'm', kind: 'final', at: at(-2) }] }, NOW))
  ok('a course with no exam at all still is', stillAhead({}, NOW))

  eq('a course from before: one exam, as it showed', examsOf({ exam_at: at(5) }).map((e) => [e.kind, e.legacy]), [['exam', true]])
  eq('no date at all, no exam', examsOf({}), [])
  eq('two midterms are numbered', examsOf({ exams: [{ id: 'b', kind: 'midterm', at: at(30) }, { id: 'a', kind: 'midterm', at: at(10) }] }).map((e) => [e.id, e.n]), [['a', 1], ['b', 2]])
  eq('one midterm is not', examsOf(course)[0].n, null)
  eq('a stray kind is dropped', examsOf({ exams: [{ id: 'x', kind: 'quiz', at: at(3) }] }), [])

  eq('the midterm covers its chapters', [...scopeOf(list[0], course, chapters)], ['ch1', 'ch2', 'ch3'])
  eq('the final "after the midterm" covers the rest', [...scopeOf(list[1], course, chapters)], ['ch4', 'ch5', 'ch6'])
  const cumulative = { exams: [{ id: 'm', kind: 'midterm', at: at(9), scope: 'chapters', chapters: ['ch1'] }, { id: 'f', kind: 'final', at: at(60), scope: 'all' }] }
  eq('a cumulative final covers everything', scopeOf(examsOf(cumulative)[1], cumulative, chapters), null)
  const blind = { exams: [{ id: 'm', kind: 'midterm', at: at(9) }, { id: 'f', kind: 'final', at: at(60), scope: 'since' }] }
  eq('"after the midterm" with the midterm chapters not said yet: everything, rather than nothing', scopeOf(examsOf(blind)[1], blind, chapters), null)
  eq('a chapter deleted since is ignored', [...scopeOf(examsOf({ exams: [{ id: 'm', kind: 'midterm', scope: 'chapters', chapters: ['ch1', 'gone'] }] })[0], course, chapters)], ['ch1'])
  eq('the course page asks for the midterm chapters until they are said', [examToAsk(blind, NOW)?.id, examToAsk(course, NOW), examToAsk(cumulative, NOW)], ['m', null, null])
  eq('and not once the midterm has passed', examToAsk(blind, later(10)), null)
  eq('the exams to come: dated ahead, or without a date', comingExams(undated, NOW).map((e) => e.id), ['f'])
  eq('"after the midterm" is for a final only', examsOf({ exams: [{ id: 'm', kind: 'midterm', scope: 'since' }] })[0].scope, null)
  eq('"chapters" with none picked is not said yet', examsOf({ exams: [{ id: 'm', kind: 'midterm', scope: 'chapters', chapters: [] }] })[0].scope, null)

  eq('recall is aimed at the midterm for a midterm chapter', daysToExamOf(course, 'ch2', chapters, NOW), 9)
  eq('and at the final for a later one', daysToExamOf(course, 'ch5', chapters, NOW), 60)
  eq('after the midterm, at the final for every chapter it covers', daysToExamOf(course, 'ch5', chapters, later(20)), 40)

  eq('each exam its own length, the course its types', [examFormat(course, null, list[0]), examFormat(course, null, list[1])].map((f) => [f.types, f.count, f.minutes]), [[['mcq'], 40, 90], [['mcq'], 80, 180]])
  eq('the files still say the types', examFormat(course, { data: { types: ['mcq', 'short'] } }, list[1]).types, ['mcq', 'short'])

  const cols = examColumns(course.exams, NOW)
  eq('written: the list, and exam_at for what reads one date (the next exam)', [cols.exams.length, cols.exam_at], [2, at(9)])
  eq('a midterm cannot be "after the midterm"', examColumns([{ id: 'm', kind: 'midterm', scope: 'since' }], NOW).exams[0].scope, null)
  eq('lengths are whole numbers or nothing', examColumns([{ id: 'm', kind: 'midterm', format: { count: '40', minutes: 'x' } }], NOW).exams[0].format, { count: 40, minutes: null })

  const line = examsLine(course, chapters, NOW)
  ok('the coach is told both exams, with their chapters', /midterm on .*covers: Chapitre 1; Chapitre 2; Chapitre 3/.test(line) && /final exam on .*covers: Chapitre 4; Chapitre 5; Chapitre 6/.test(line), line)

  /* The plan: a mock exam and an eve before each exam. */
  const plan = planDays({ courses: [{ ...course, exams: [{ id: 'm', kind: 'midterm', at: at(4) }, { id: 'f', kind: 'final', at: at(11), format: { minutes: 180 } }] }], weeklyHours: 6, now: NOW, days: 14 })
  const eves = plan.filter((d) => d.items.some((i) => i.kind === 'eve')).map((d) => d.items[0].exam.kind)
  eq('an eve before the midterm and one before the final', eves, ['midterm', 'final'])
  const mocks = plan.flatMap((d) => d.items.filter((i) => i.kind === 'mock'))
  ok('mock exams for both, each as long as its own exam', mocks.some((m) => m.exam.kind === 'midterm' && m.minutes === 90) && mocks.some((m) => m.exam.kind === 'final' && m.minutes === 180), JSON.stringify(mocks))
  eq('each exam day says which exam', plan.filter((d) => d.exams.length).map((d) => d.exams[0].kind), ['midterm', 'final'])
  ok('the course is studied again the day after the midterm', plan.find((d) => d.date === dayKey(later(5))).items.some((i) => i.kind === 'study'))

  /* A session before the midterm: its chapters first. */
  const items = [
    { id: 'old6', type: 'mcq', concept_id: 'k6', chapter_id: 'ch6', quality: 'pass' },
    { id: 'old2', type: 'mcq', concept_id: 'k2', chapter_id: 'ch2', quality: 'pass' },
    { id: 'new1', type: 'mcq', concept_id: 'k1', chapter_id: 'ch1', quality: 'pass' },
    { id: 'new5', type: 'mcq', concept_id: 'k5', chapter_id: 'ch5', quality: 'pass' },
  ]
  const schedule = [
    { item_id: 'old6', due: later(-5).toISOString(), state: 'review' },
    { item_id: 'old2', due: later(-1).toISOString(), state: 'review' },
  ]
  const plain = buildSession({ minutes: 15, items, schedule, chapters, now: NOW })
  const focused = buildSession({ minutes: 15, items, schedule, chapters, now: NOW, focus: new Set(['ch1', 'ch2', 'ch3']) })
  const firstDue = (s) => s.items.filter((x) => x.reason === 'due').map((x) => x.id)[0]
  eq('without a scope, the most overdue review first', firstDue(plain), 'old6')
  eq('before the midterm, its review first', firstDue(focused), 'old2')
  ok('and the other chapter is still reviewed', focused.items.some((x) => x.id === 'old6'))
  const firstNew = (s) => s.items.filter((x) => x.reason === 'new' || x.reason === 'pretest').map((x) => x.id)
  ok('new questions from the midterm chapters come first', firstNew(focused)[0] === 'new1', JSON.stringify(firstNew(focused)))
}

/* --- dictation ------------------------------------------------------------------- */
{
  class Rec {}
  const UA = {
    chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
    tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_41.2.0 JsSdk/2.0 NetType/WIFI',
  }
  const win = ({ ua, api = 'webkitSpeechRecognition', standalone = false, platform = '', touch = 0 }) => ({
    ...(api ? { [api]: Rec } : {}),
    navigator: { userAgent: ua, standalone: standalone || undefined, platform, maxTouchPoints: touch },
    matchMedia: () => ({ matches: standalone }),
  })
  eq('no speech API, no mic (Firefox)', dictationSupport(win({ ua: UA.chrome, api: null })), null)
  eq('no window, no mic', dictationSupport(undefined), null)
  const desk = dictationSupport(win({ ua: UA.chrome }))
  ok('Chrome on a computer listens until the second tap', desk?.Recognition === Rec && desk.continuous === true)
  ok('the unprefixed API is taken too', dictationSupport(win({ ua: UA.chrome, api: 'SpeechRecognition' }))?.Recognition === Rec)
  eq('Chrome on Android, one sentence at a time (it repeats words otherwise)', dictationSupport(win({ ua: UA.android }))?.continuous, false)
  eq('Safari on an iPhone, one sentence at a time', dictationSupport(win({ ua: UA.iphone }))?.continuous, false)
  eq('an app on the iPhone home screen has the API and nothing happens: no mic', dictationSupport(win({ ua: UA.iphone, standalone: true })), null)
  eq('nor on an iPad home screen, which says it is a Mac', dictationSupport(win({ ua: UA.ipad, standalone: true, platform: 'MacIntel', touch: 5 })), null)
  ok('a real Mac is not taken for an iPad', dictationSupport(win({ ua: UA.ipad, platform: 'MacIntel', touch: 0 }))?.continuous === true)
  eq('nor inside TikTok', dictationSupport(win({ ua: UA.tiktok })), null)

  eq('the phone variant of the app language', speechLang('fr', 'fr-CA'), 'fr-CA')
  eq('an unknown variant listens in fr-FR', speechLang('fr', 'fr-SN'), 'fr-FR')
  eq('the app language wins over the phone', speechLang('en', 'fr-FR'), 'en-US')
  eq('and in English', speechLang('en', 'en-GB'), 'en-GB')
  eq('no phone language at all', speechLang('fr', undefined), 'fr-FR')

  const said = (...parts) => parts.map((p) => [{ transcript: p }])
  eq('what was heard, finished and still coming', heard(said('Pourquoi', ' la demande baisse')), 'Pourquoi la demande baisse')
  eq('nothing heard yet', heard(said()), '')
  eq('a question that opens with the voice takes a capital', withSpeech('', 'pourquoi la demande baisse'), 'Pourquoi la demande baisse')
  eq('said after what was typed, one space between', withSpeech('Dans le chapitre 2,', 'pourquoi'), 'Dans le chapitre 2, pourquoi')
  eq('never two spaces', withSpeech('Dans le chapitre 2, ', 'pourquoi'), 'Dans le chapitre 2, pourquoi')
  eq('silence leaves the box as it was', withSpeech('Ma question', '  '), 'Ma question')
  eq('a blocked mic says how to allow it', dictationNote('not-allowed'), 'denied')
  eq('no network, says so', dictationNote('network'), 'offline')
  eq('a service that refuses points to the keyboard mic', dictationNote('service-not-allowed'), 'off')
  eq('silence and a cancel say nothing', [dictationNote('no-speech'), dictationNote('aborted')], [null, null])
}

/* --- the ask box and the bars ------------------------------------------------------------------- */
{
  const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
  const box = read('bb/Composer.jsx')
  ok('the course and the ways to answer are in the menu of the "+"', /aria-haspopup="menu"/.test(box) && /role="menuitemradio"/.test(box) && /data-hook="bb-compose-more"/.test(box))
  ok('no row of four mode icons left beside the box', !/role="group" aria-label=\{t\('bb\.coach\.modes'\)\}/.test(box))
  ok('the way picked is a chip with a cross', /data-hook="bb-compose-mode"/.test(box) && /bb\.compose\.clear_mode/.test(box))
  ok('the mic is drawn only where dictation works', /voice\.ready && \(/.test(box) && /dictationSupport\(\)/.test(box))
  const shell = read('bb/BBShell.jsx')
  const bar = shell.slice(shell.indexOf('function TabBar'), shell.indexOf('export default function BBShell'))
  ok('four places in the tab bar, no profile', /TABS\.slice\(0, 4\)/.test(bar) && !/Avatar/.test(bar))
  const bars = shell.slice(shell.indexOf('function TopBar'), shell.indexOf('export default function BBShell'))
  ok('no Rich & Friends mark in the bars', !/<Mark\b/.test(bars))
  ok('Rich & Friends is in the footer of the pages', /data-hook="bb-footer"[\s\S]{0,300}<Mark\b[\s\S]{0,80}bb\.by/.test(shell))
}

/* --- the two languages ------------------------------------------------------------------- */
{
  const fr = BB_STRINGS.fr
  const en = BB_STRINGS.en
  const missing = [...Object.keys(fr).filter((k) => !(k in en)), ...Object.keys(en).filter((k) => !(k in fr))]
  eq('French and English have the same keys', missing, [])
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  const mismatched = Object.keys(fr).filter((k) => k in en && vars(fr[k]) !== vars(en[k]))
  eq('and the same placeholders', mismatched, [])
  const dashes = Object.entries({ ...fr, ...Object.fromEntries(Object.entries(en).map(([k, v]) => [`en:${k}`, v])) }).filter(([, v]) => /[\u2013\u2014]/.test(v)).map(([k]) => k)
  eq('no em or en dash anywhere (CLAUDE.md)', dashes, [])
  const loose = Object.entries(fr).filter(([, v]) => / [?!:;]/.test(v)).map(([k]) => k)
  eq('French puts a narrow no-break space before ? ! : ;, never a plain one', loose, [])
  const straight = Object.entries(fr).filter(([, v]) => /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(v)).map(([k]) => k)
  eq('and curly apostrophes', straight, [])
  ok('every plural has its two forms', Object.keys(fr).filter((k) => k.endsWith('_one')).every((k) => `${k.slice(0, -4)}_other` in fr))
  /* Keys built from a value, which the same-keys check cannot see: a missing one shows as "bb.ex.scope.chapters". */
  eq('a name for every scope of an exam', SCOPES.filter((k) => !(`bb.ex.scope.${k}` in fr) || !(`bb.ex.scope.${k}` in en)), [])
  eq('and for every kind', [...EXAM_KINDS, 'exam'].filter((k) => !(`bb.ex.${k}` in fr) || !(`bb.ex.${k}` in en)), [])
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
