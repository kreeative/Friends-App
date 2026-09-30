/**
 * node src/lib/syllabus.test.mjs
 *
 * Le plan de cours en PDF: ce que le normaliseur garde, ce que la
 * comparaison marque comme deja la, ou le planificateur pose l'etude, et
 * ce que le serveur fait d'une reponse de modele, avec un faux client.
 *
 *   "est-ce que tu peux ajouter une option intelligente ou tu peux ajouter
 *    ton PDF de ton syllabus et ca va analyser pour te donner des events,
 *    des rappels de goals et des to-dos a propos de ton calendrier, et te
 *    demander une question de quand tu es disponible, comme ca ca peut
 *    planifier intelligemment comment tu vas etudier"
 *
 *   "comme certaines personnes auront deja ajoute des events, faire
 *    attention de ne pas les repeter"
 *
 * Fuseau fixe AVANT les imports: les dates sont des jours et tout le
 * fichier fait de l'arithmetique de jours.
 */
process.env.TZ = 'America/Toronto'

const {
  DEFAULT_AVAILABILITY,
  MAX_PDF_BYTES,
  PLAN_SCHEMA,
  analyseSyllabus,
  busyOn,
  dedupPlan,
  examRows,
  findGoal,
  goalPayload,
  isoDate,
  normTitle,
  normalisePlan,
  pdfProblem,
  planStudy,
  readClock,
  readWeekday,
  sameTitle,
  sessionRows,
  sessionsWanted,
  stepRows,
  studyRows,
  toBase64,
} = await import('./syllabus.js')
const { fromKey } = await import('./cycle.js')
const api = await import('../../api/syllabus.js')

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

console.log('\nsyllabus')

const TODAY = '2026-09-30'

/* --- lire ce que le modele a rendu ---------------------------------------- */

eq('a real date passes', isoDate('2026-10-05'), '2026-10-05')
eq('a timestamp is cut to its day', isoDate('2026-10-05T14:00:00Z'), '2026-10-05')
eq('the 30th of February is not a date', isoDate('2026-02-30'), null)
eq('nor is a word', isoDate('next week'), null)
eq('nor null', isoDate(null), null)

eq('9h30', readClock('9h30'), '09:30')
eq('9h', readClock('9h'), '09:00')
eq('09:30', readClock('09:30'), '09:30')
eq('9:30 am', readClock('9:30 am'), '09:30')
eq('1pm', readClock('1pm'), '13:00')
eq('12am is midnight', readClock('12am'), '00:00')
eq('12pm is noon', readClock('12pm'), '12:00')
eq('24:00 is not a clock', readClock('24:00'), null)
eq('a year is not a clock', readClock('2026'), null)
eq('noon in words is not read', readClock('midi'), null)
eq('null stays null', readClock(null), null)

eq('an integer weekday', readWeekday(3), 3)
eq('ISO 7 is Sunday', readWeekday(7), 0)
eq('8 is nothing', readWeekday(8), null)
eq('a digit string', readWeekday('5'), 5)
eq('lundi', readWeekday('lundi'), 1)
eq('Mardi with a capital', readWeekday('Mardi'), 2)
eq('mercredi is not mardi', readWeekday('mercredi'), 3)
eq('Thursday', readWeekday('Thursday'), 4)
eq('dimanche', readWeekday('dimanche'), 0)
eq('Sat', readWeekday('Sat'), 6)
eq('a stray word is nothing', readWeekday('room'), null)

{
  const raw = {
    course: '  PSY1001   Intro  ',
    term: { from: '2026-09-08', until: '2026-12-11' },
    sessions: [
      { title: 'Cours magistral', kind: 'lecture', weekdays: [4, 2, 2], start: '9h30', end: '11:00', location: 'B-201' },
      { title: 'Labo', kind: 'lab', weekdays: ['vendredi'], start: '13:00', end: '12:00' },
      { title: 'No day', kind: 'lecture', weekdays: [], start: '13:00', end: '14:00' },
      { title: '', weekdays: [1] },
      { title: 'Own dates', kind: 'tutorial', weekdays: [1], start: '10:00', end: '11:00', from: '2026-10-01', until: '2026-09-01' },
    ],
    deadlines: [
      { title: 'Examen intra', kind: 'exam', due_on: '2026-10-22', at: '9:00', weight: 30.4, steps: [] },
      { title: 'Devoir 1', kind: 'assignment', due_on: '2026-02-30', weight: 10 },
      { title: 'Devoir 2', kind: 'assignment', due_on: '2026-10-05', at: '23:59', weight: '15', steps: ['plan', 'draft', '', 'a', 'b', 'c', 'd', 'e'] },
      { title: 'Old reading', kind: 'reading', due_on: '2026-09-01', weight: 250 },
      { title: 'Odd kind', kind: 'party', due_on: '2026-11-01', weight: -3 },
      { title: 'no date', kind: 'exam' },
    ],
  }
  const plan = normalisePlan(raw, { today: TODAY })
  eq('the course name is collapsed', plan.course, 'PSY1001 Intro')
  eq('the term is kept', plan.term, { from: '2026-09-08', until: '2026-12-11' })
  eq('sessions: no day and no title fall, the rest stay', plan.sessions.map((s) => s.title), ['Cours magistral', 'Labo', 'Own dates'])
  eq('weekdays are unique and sorted', plan.sessions[0].weekdays, [2, 4])
  eq('9h30 is read', [plan.sessions[0].start, plan.sessions[0].end], ['09:30', '11:00'])
  eq('an end before its start drops both times, not the class', [plan.sessions[1].start, plan.sessions[1].end], [null, null])
  eq('a French day name is read', plan.sessions[1].weekdays, [5])
  eq('an unknown kind becomes a lecture', plan.sessions[1].kind, 'lab')
  eq('a session until before its from loses the until', [plan.sessions[2].from, plan.sessions[2].until], ['2026-10-01', null])
  eq('ids are stable and in input order', plan.sessions.map((s) => s.id), ['s1', 's2', 's3'])
  eq('deadlines: the bad date and the undated one fall', plan.deadlines.length, 4)
  eq('and they come out sorted by date', plan.deadlines.map((d) => d.due_on), ['2026-09-01', '2026-10-05', '2026-10-22', '2026-11-01'])
  /* Numerotees sur ce qui est garde, dans l'ordre d'entree, puis triees:
     l'intra est d1, Devoir 2 est d2, la vieille lecture d3, le genre bizarre d4. */
  eq('ids follow the input order of what is kept, not the sort', plan.deadlines.map((d) => d.id), ['d3', 'd2', 'd1', 'd4'])
  const intra = plan.deadlines.find((d) => d.title === 'Examen intra')
  eq('the weight is rounded', intra.weight, 30)
  eq('the time is read', intra.at, '09:00')
  const d2 = plan.deadlines.find((d) => d.title === 'Devoir 2')
  eq('a string weight is a number', d2.weight, 15)
  eq('steps drop the empty one and stop at six', d2.steps, ['plan', 'draft', 'a', 'b', 'c', 'd'])
  eq('a weight over 100 is capped', plan.deadlines.find((d) => d.title === 'Old reading').weight, 100)
  eq('and a past date is flagged', plan.deadlines.find((d) => d.title === 'Old reading').past, true)
  eq('an unknown kind is other, a negative weight is none', [plan.deadlines[3].kind, plan.deadlines[3].weight], ['other', null])
  eq('garbage in is an empty plan out', normalisePlan('nope'), { course: null, term: { from: null, until: null }, sessions: [], deadlines: [] })
  eq('a term that ends before it starts loses the end', normalisePlan({ term: { from: '2026-12-01', until: '2026-09-01' } }).term, { from: '2026-12-01', until: null })
}

ok('the schema requires every field of every object', (() => {
  const walk = (s) => {
    if (s.type === 'object') {
      if (s.additionalProperties !== false) return false
      const keys = Object.keys(s.properties)
      if (JSON.stringify([...keys].sort()) !== JSON.stringify([...s.required].sort())) return false
      return keys.every((k) => walk(s.properties[k]))
    }
    if (s.type === 'array') return walk(s.items)
    if (s.anyOf) return s.anyOf.every(walk)
    return true
  }
  return walk(PLAN_SCHEMA)
})(), 'a strict schema has no optional property and no enum: the values are in the description and re-checked here')

/* --- ne pas repeter ------------------------------------------------------- */

eq('accents and punctuation go', normTitle('  Éxamen  intra !'), 'examen intra')
ok('the same words in another case', sameTitle('Examen Intra', 'examen intra'))
ok('the number tells two homeworks apart', !sameTitle('Devoir 1', 'Devoir 2'))
ok('the weight in brackets does not', sameTitle('Devoir 1', 'Devoir 1 (10 %)'))
ok('devoir 1 is not inside devoir 10', !sameTitle('Devoir 1', 'Devoir 10'))
ok('a course code beside the name still matches', sameTitle('Biochimie', 'BCM1501 Biochimie'))
ok('two different exams do not', !sameTitle('Examen intra', 'Examen final'))
ok('empty never matches', !sameTitle('', 'Devoir'))

{
  const plan = normalisePlan({
    sessions: [
      { title: 'Cours magistral', weekdays: [2, 4], start: '09:30', end: '11:00' },
      { title: 'Labo de chimie', weekdays: [5], start: '13:00', end: '16:00' },
      { title: 'Seminaire', weekdays: [1], start: '10:00', end: '12:00' },
      { title: 'Atelier', weekdays: [3] },
    ],
    deadlines: [
      { title: 'Examen intra', kind: 'exam', due_on: '2026-10-22', at: '09:00' },
      { title: 'Devoir 1', kind: 'assignment', due_on: '2026-10-05' },
      { title: 'Devoir 2', kind: 'assignment', due_on: '2026-11-02' },
      { title: 'Rapport de labo', kind: 'assignment', due_on: '2026-11-20' },
      { title: 'Quiz 3', kind: 'quiz', due_on: '2026-11-25' },
    ],
  }, { today: TODAY })
  const events = [
    /* meme jour, meme heure, autre nom: c'est le meme cours */
    { id: 'e1', title: 'Psycho', weekdays: [2], start_min: 570, end_min: 660, starts_on: '2026-09-08' },
    /* meme nom, un jour commun, autre heure */
    { id: 'e2', title: 'Labo de chimie', weekdays: [5], start_min: 540, end_min: 720, starts_on: '2026-09-08' },
    /* meme nom mais pas de jour commun */
    { id: 'e3', title: 'Seminaire', weekdays: [3], start_min: 600, end_min: 720, starts_on: '2026-09-08' },
    /* un examen deja pose le meme jour a la meme heure, sous un autre nom */
    { id: 'e4', title: 'Intra PSY', category: 'examen', weekdays: [], start_min: 540, end_min: 660, starts_on: '2026-10-22' },
    /* un evenement de meme nom le meme jour */
    { id: 'e5', title: 'Devoir 1', category: 'perso', weekdays: [], starts_on: '2026-10-05' },
    /* meme nom, autre jour: pas un doublon */
    { id: 'e6', title: 'Devoir 2', category: 'perso', weekdays: [], starts_on: '2026-11-03' },
  ]
  const steps = [{ id: 'st1', title: 'Rapport de labo (20 %)', due_on: '2026-11-20' }]
  const goals = [{ id: 'g1', commitment: 'Quiz 3', due_on: '2026-11-25' }]
  const d = dedupPlan(plan, { events, goals, steps })
  eq('same weekday and time is a duplicate whatever the name', d.sessions[0].dup, { kind: 'event', id: 'e1', title: 'Psycho' })
  eq('same name on a shared weekday is a duplicate', d.sessions[1].dup?.id, 'e2')
  eq('same name on another weekday is not', d.sessions[2].dup, null)
  eq('an untimed session with no namesake is not', d.sessions[3].dup, null)
  const by = (title) => d.deadlines.find((x) => x.title === title)
  eq('an exam already on the grid at that hour is a duplicate', by('Examen intra').dup?.id, 'e4')
  eq('a same-day event of the same name is a duplicate', by('Devoir 1').dup?.id, 'e5')
  eq('the same name on the day after is not', by('Devoir 2').dup, null)
  eq('a step of the same name on the day is a duplicate', by('Rapport de labo').dup, { kind: 'step', id: 'st1', title: 'Rapport de labo (20 %)' })
  eq('a goal of the same name on the day is a duplicate', by('Quiz 3').dup?.kind, 'goal')
  eq('nothing to compare with marks nothing', dedupPlan(plan).sessions.every((s) => s.dup === null), true)
  ok('the plan itself is untouched', plan.sessions[0].dup === undefined)
}

/* --- planifier l'etude ---------------------------------------------------- */

eq('an exam wants four', sessionsWanted({ kind: 'exam' }), 4)
eq('a heavy exam wants six', sessionsWanted({ kind: 'exam', weight: 40 }), 6)
eq('a 20 % assignment wants three', sessionsWanted({ kind: 'assignment', weight: 20 }), 3)
eq('a reading wants one', sessionsWanted({ kind: 'reading', weight: 5 }), 1)
eq('never more than six', sessionsWanted({ kind: 'project', weight: 90 }), 6)

{
  const day = fromKey('2026-10-07')
  const busy = [
    { starts_on: '2026-09-08', until_on: '2026-12-11', weekdays: [3], start_min: 1080, end_min: 1140 },
    { starts_on: '2026-10-07', weekdays: [], start_min: 1200, end_min: 1260 },
    { starts_on: '2026-10-07', weekdays: [], start_min: null, end_min: null },
    { starts_on: '2026-10-08', weekdays: [], start_min: 1080, end_min: 1140 },
  ]
  eq('busyOn: the weekly rule and the one-off that day, not the all-day one nor tomorrow',
     busyOn(busy, day), [{ start: 1080, end: 1140 }, { start: 1200, end: 1260 }])
}

{
  const deadlines = [
    { id: 'd1', title: 'Devoir 2', kind: 'assignment', due_on: '2026-10-05', weight: 15 },
    { id: 'd2', title: 'Examen intra', kind: 'exam', due_on: '2026-10-22', weight: 30 },
  ]
  const busy = [{ starts_on: '2026-09-08', until_on: '2026-12-11', weekdays: [1, 3], start_min: 1080, end_min: 1140 }]
  const av = { weekdays: [1, 3, 5], start: '18:00', end: '21:00', minutes: 60, perWeek: 3 }
  const { blocks, unplaced } = planStudy(deadlines, av, { today: TODAY, busy })

  ok('every block is on an allowed weekday', blocks.every((b) => [1, 3, 5].includes(fromKey(b.starts_on).getDay())))
  ok('every block is inside the window', blocks.every((b) => b.start_min >= 1080 && b.end_min <= 1260))
  ok('every block is an hour', blocks.every((b) => b.end_min - b.start_min === 60))
  ok('no block sits on the Monday and Wednesday class', blocks.every((b) => {
    const wd = fromKey(b.starts_on).getDay()
    return !([1, 3].includes(wd) && b.start_min < 1140 && b.end_min > 1080)
  }))
  ok('and none is before today, and each is before its own deadline', blocks.every((b) => b.starts_on >= TODAY && b.starts_on < deadlines.find((d) => d.id === b.deadlineId).due_on))
  ok('blocks for a deadline all fall before it', blocks.filter((b) => b.deadlineId === 'd1').every((b) => b.starts_on < '2026-10-05'))
  eq('one block a day', new Set(blocks.map((b) => b.starts_on)).size, blocks.length)
  {
    const weeks = new Map()
    for (const b of blocks) {
      const d = fromKey(b.starts_on)
      const k = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).toDateString()
      weeks.set(k, (weeks.get(k) ?? 0) + 1)
    }
    ok('never more than three a week', [...weeks.values()].every((n) => n <= 3), JSON.stringify([...weeks]))
  }
  eq('the homework due Monday got the two free evenings left before it', blocks.filter((b) => b.deadlineId === 'd1').map((b) => b.starts_on), ['2026-09-30', '2026-10-02'])
  eq('and says it wanted three', unplaced, [{ deadlineId: 'd1', title: 'Devoir 2', wanted: 3, placed: 2 }])
  eq('the heavy exam got its six', blocks.filter((b) => b.deadlineId === 'd2').length, 6)
  ok('spread across the three weeks, the last one just before the exam',
     blocks.filter((b) => b.deadlineId === 'd2').at(-1).starts_on === '2026-10-21'
       && blocks.filter((b) => b.deadlineId === 'd2')[0].starts_on <= '2026-10-07')
  ok('blocks come out sorted', blocks.every((b, i) => i === 0 || blocks[i - 1].starts_on <= b.starts_on))
  ok('the same input gives the same plan', JSON.stringify(planStudy(deadlines, av, { today: TODAY, busy })) === JSON.stringify({ blocks, unplaced }))

  const none = planStudy(deadlines, { ...av, weekdays: [] }, { today: TODAY })
  eq('no day picked places nothing and says so for each', [none.blocks.length, none.unplaced.length], [0, 2])
  const tight = planStudy(deadlines, { ...av, start: '20:30', end: '21:00' }, { today: TODAY })
  eq('a window shorter than a session places nothing', tight.blocks.length, 0)
  const one = planStudy(deadlines, { ...av, perWeek: 1 }, { today: TODAY, busy })
  ok('one a week is one a week', one.blocks.length <= 4 && one.blocks.length >= 3, String(one.blocks.length))
  const late = planStudy([{ id: 'x', title: 'Demain', kind: 'exam', due_on: '2026-10-01' }], av, { today: TODAY })
  eq('an exam tomorrow gets today and reports the rest', [late.blocks.length, late.unplaced[0].placed], [1, 1])
  eq('defaults are weekday evenings', DEFAULT_AVAILABILITY.weekdays, [1, 2, 3, 4, 5])
}

/* --- ce qui s'ecrit ------------------------------------------------------- */

{
  const rows = sessionRows(
    [
      { title: 'Cours', weekdays: [4, 2], start: '09:30', end: '11:00', location: 'B-201', from: null, until: null },
      { title: 'Labo', weekdays: [5], start: null, end: null, location: null, from: '2026-10-01', until: '2026-09-01' },
    ],
    { userId: 'u1', term: { from: '2026-09-08', until: '2026-12-11' }, today: TODAY },
  )
  eq('a session is a weekly rule on the term', rows[0], {
    user_id: 'u1', title: 'Cours', category: 'cours', location: 'B-201', starts_on: '2026-09-08', until_on: '2026-12-11',
    start_min: 570, end_min: 660, weekdays: [2, 4], colour: 'ev-cours',
  })
  eq('its own start wins, and an until before it is dropped', [rows[1].starts_on, rows[1].until_on], ['2026-10-01', null])
  eq('no times is allowed, both null', [rows[1].start_min, rows[1].end_min], [null, null])
  eq('no term at all falls back to today', sessionRows([{ title: 'x', weekdays: [1], start: null, end: null }], { userId: 'u' })[0].starts_on.length, 10)
}

{
  const rows = examRows(
    [
      { title: 'Examen intra', kind: 'exam', due_on: '2026-10-22', at: '09:00', location: 'A-100' },
      { title: 'Quiz', kind: 'quiz', due_on: '2026-11-25', at: null, location: null },
      { title: 'Devoir', kind: 'assignment', due_on: '2026-10-05', at: '23:59' },
      { title: 'Late', kind: 'exam', due_on: '2026-12-01', at: '23:30' },
    ],
    { userId: 'u1' },
  )
  eq('only exams and quizzes go on the grid', rows.map((r) => r.title), ['Examen intra', 'Quiz', 'Late'])
  eq('an exam is two hours in the exam colour', [rows[0].category, rows[0].start_min, rows[0].end_min, rows[0].colour, rows[0].location], ['examen', 540, 660, 'ev-examen', 'A-100'])
  eq('no time means an all-day entry', [rows[1].start_min, rows[1].end_min], [null, null])
  eq('and it never runs past midnight', rows[2].end_min, 1440)
  eq('a one-off has no weekdays', rows[0].weekdays, [])
}

{
  const rows = studyRows([{ starts_on: '2026-10-02', start_min: 1080, end_min: 1140, title: 'Devoir 2' }], { userId: 'u1', label: (s) => `Etude : ${s}` })
  eq('a study block is an etude entry with the label', rows[0], {
    user_id: 'u1', title: 'Etude : Devoir 2', category: 'etude', location: null, starts_on: '2026-10-02', until_on: null,
    start_min: 1080, end_min: 1140, weekdays: [], colour: 'ev-etude',
  })
}

{
  const g = goalPayload({ userId: 'u1', title: 'PSY1001 : a faire', deadlines: [{ due_on: '2026-11-02' }, { due_on: '2026-10-05' }], today: TODAY })
  eq('the list is a personal once goal due on the last date, with the reminder', [g.kind, g.owner_id, g.cadence, g.due_on, g.remind, g.starts_on, g.commitment], ['personal', 'u1', 'once', '2026-11-02', true, TODAY, 'PSY1001 : a faire'])
  eq('and nothing to prove, it is a list', g.proof_type, 'none')
  eq('no dates leaves no due date', goalPayload({ userId: 'u1', title: 'x', deadlines: [], today: TODAY }).due_on, null)
}

{
  const rows = stepRows(
    [
      { title: 'Examen intra', due_on: '2026-10-22', at: '09:00', weight: 30, steps: [] },
      { title: 'Devoir 2', due_on: '2026-10-05', at: '23:59', weight: 15, steps: ['plan', 'draft'] },
    ],
    { goalId: 'g1', offset: 2 },
  )
  eq('steps are in date order and numbered after the existing ones', rows.map((r) => [r.title, r.position]), [
    ['Devoir 2 (15 %)', 2], ['Devoir 2: plan', 3], ['Devoir 2: draft', 4], ['Examen intra (30 %)', 5],
  ])
  eq('a dated step carries its time in minutes', [rows[0].due_on, rows[0].at_min], ['2026-10-05', 1439])
  eq('a sub-part has no date and so no time, which the constraint requires', [rows[1].due_on, rows[1].at_min], [null, null])
  ok('every row names the goal', rows.every((r) => r.goal_id === 'g1'))
}

eq('the course list is found under its title', findGoal([{ id: 'g1', commitment: 'PSY1001 : a faire', status: 'active' }], 'PSY1001 : a faire')?.id, 'g1')
eq('a finished one is not reused', findGoal([{ id: 'g1', commitment: 'PSY1001 : a faire', status: 'done' }], 'PSY1001 : a faire'), null)
eq('another course is not it', findGoal([{ id: 'g1', commitment: 'BCM1501 : a faire', status: 'active' }], 'PSY1001 : a faire'), null)

/* --- parler au serveur ---------------------------------------------------- */

eq('no file is not a PDF', pdfProblem(null), 'not_pdf')
eq('a PNG is not a PDF', pdfProblem({ name: 'x.png', type: 'image/png', size: 10 }), 'not_pdf')
eq('a .pdf without a type is accepted', pdfProblem({ name: 'plan.PDF', type: '', size: 10 }), null)
eq('over the cap is too big', pdfProblem({ name: 'plan.pdf', type: 'application/pdf', size: MAX_PDF_BYTES + 1 }), 'too_big')
eq('base64 round-trips', Buffer.from(toBase64(new Uint8Array([37, 80, 68, 70, 45, 49])), 'base64').toString('latin1'), '%PDF-1')

{
  const calls = []
  const fakeFetch = (status, body) => async (url, init) => {
    calls.push({ url, init })
    return { ok: status < 400, status, json: async () => body }
  }
  const sb = (token) => ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } })
  const file = new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])], 'plan.pdf', { type: 'application/pdf' })

  const good = await analyseSyllabus(sb('tok'), file, { locale: 'fr', today: TODAY, fetchImpl: fakeFetch(200, { plan: { course: 'X', sessions: [], deadlines: [{ title: 'Quiz', kind: 'quiz', due_on: '2026-10-09' }] }, model: 'm', strict: false }) })
  eq('it POSTs to /api/syllabus with the session token', [calls[0].url, calls[0].init.method, calls[0].init.headers.authorization], ['/api/syllabus', 'POST', 'Bearer tok'])
  const sent = JSON.parse(calls[0].init.body)
  eq('the body is the PDF in base64, the name, the locale and the day', [sent.pdf, sent.name, sent.locale, sent.today], ['JVBERi0xLjQ=', 'plan.pdf', 'fr', TODAY])
  ok('and nothing else, no email, no id', Object.keys(sent).sort().join(',') === 'locale,name,pdf,today')
  eq('the plan comes back normalised', good.plan.deadlines[0].id, 'd1')
  eq('with the strict flag as the server said it', good.strict, false)
  eq('and the detail comes through on a failure', (await analyseSyllabus(sb('t'), file, { fetchImpl: fakeFetch(502, { error: 'model_failed', detail: 'output_config.format: no' }) })).detail, 'output_config.format: no')

  eq('no session is unauthorized before any request', (await analyseSyllabus(sb(null), file, { fetchImpl: fakeFetch(200, {}) })).error, 'unauthorized')
  eq('a wrong file never leaves the browser', (await analyseSyllabus(sb('t'), new File(['x'], 'x.txt', { type: 'text/plain' }), { fetchImpl: fakeFetch(200, {}) })).error, 'not_pdf')
  eq('the server code word wins', (await analyseSyllabus(sb('t'), file, { fetchImpl: fakeFetch(503, { error: 'no_key' }) })).error, 'no_key')
  eq('a bare 413 reads as too big', (await analyseSyllabus(sb('t'), file, { fetchImpl: fakeFetch(413, {}) })).error, 'too_big')
  eq('a bare 504 reads as a timeout', (await analyseSyllabus(sb('t'), file, { fetchImpl: fakeFetch(504, {}) })).error, 'timeout')
  eq('a bare 500 reads as the model failing', (await analyseSyllabus(sb('t'), file, { fetchImpl: fakeFetch(500, {}) })).error, 'model_failed')
  eq('a thrown fetch is the network', (await analyseSyllabus(sb('t'), file, { fetchImpl: async () => { throw new Error('offline') } })).error, 'network')
}

/* --- le serveur, avec un faux modele -------------------------------------- */

{
  const PDF = 'JVBERi0xLjQK'
  const seen = []
  /* Le faux client: `stream()` rend tout de suite, et c'est finalMessage()
     qui tient la reponse ou l'erreur, comme le vrai SDK. `message` peut etre
     une fonction des parametres, pour refuser le premier essai et pas le
     second. */
  const client = (message) => ({
    messages: {
      stream: (params) => {
        seen.push(params)
        return {
          finalMessage: async () => {
            const m = typeof message === 'function' ? message(params) : message
            if (m instanceof Error) throw m
            return m
          },
        }
      },
    },
  })
  const answer = (obj, extra = {}) => ({ stop_reason: 'end_turn', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(obj) }], ...extra })
  const http = (status, message) => {
    const e = new Error(`${status} {"type":"error","error":{"type":"invalid_request_error","message":"${message}"}}`)
    e.status = status
    e.error = { type: 'error', error: { type: 'invalid_request_error', message } }
    return e
  }

  const out = await api.analyse(PDF, { today: TODAY, locale: 'en', client: client(answer({ course: 'X', term: {}, sessions: [], deadlines: [{ title: 'Quiz 1', kind: 'quiz', due_on: '2026-10-01' }] })) })
  eq('the plan is read from the text block and normalised', out.plan.deadlines[0], { id: 'd1', title: 'Quiz 1', kind: 'quiz', due_on: '2026-10-01', at: null, weight: null, location: null, steps: [], past: false })
  eq('and the strict format was used, with no note', [out.strict, out.note], [true, null])
  const p = seen[0]
  eq('the default model', p.model, api.MODEL)
  ok('the plain request shape: no fallbacks, no beta header, no thinking block', !('fallbacks' in p) && !('betas' in p) && !('thinking' in p))
  eq('the PDF is the first block of the user turn, as a document', [p.messages[0].role, p.messages[0].content[0].type, p.messages[0].content[0].source.media_type, p.messages[0].content[0].source.data], ['user', 'document', 'application/pdf', PDF])
  eq('the output is schema-bound', p.output_config.format.type, 'json_schema')
  eq('with the effort set', p.output_config.effort, 'medium')
  ok('the consigne names today and the weekday numbering', p.system.includes(TODAY) && p.system.includes('0 = Sunday') && p.system.includes('English'))
  ok('and tells it not to invent', /Do not invent/.test(p.system))
  ok('no email anywhere in the request', !JSON.stringify(p).includes('@'))

  const parsed = await api.analyse(PDF, { today: TODAY, client: client({ stop_reason: 'end_turn', model: 'm', content: [], parsed_output: { course: 'P', sessions: [], deadlines: [] } }) })
  eq('parsed_output is used when the SDK gives it', parsed.plan.course, 'P')

  /* Le 400 sur le format strict: un deuxieme essai sans lui, lu entre les accolades. */
  seen.length = 0
  const loose = await api.analyse(PDF, { today: TODAY, client: client((params) => (params.output_config?.format
    ? http(400, 'output_config.format: this combination is not supported')
    : { stop_reason: 'end_turn', model: 'claude-opus-5-5', content: [{ type: 'text', text: 'Here you go:\n```json\n{"course":"L","sessions":[],"deadlines":[{"title":"Quiz","kind":"quiz","due_on":"2026-10-09"}]}\n```' }] })) })
  eq('a 400 on the strict format retries once without it', seen.length, 2)
  ok('the second request has no format, and asks for the JSON alone', !seen[1].output_config?.format && seen[1].output_config?.effort === 'medium' && /JSON object only/.test(seen[1].system))
  eq('the loose answer is read between its braces, prose and fence ignored', [loose.plan.course, loose.plan.deadlines.length, loose.strict], ['L', 1, false])
  eq('and the note says what the API refused', loose.note, 'output_config.format: this combination is not supported')
  let thrown = null
  try {
    await api.analyse(PDF, { today: TODAY, client: client(http(500, 'overloaded')) })
  } catch (e) {
    thrown = e
  }
  eq('any other status is rethrown for the handler to name', thrown?.status, 500)

  eq('a refusal is a code word', (await api.analyse(PDF, { today: TODAY, client: client({ stop_reason: 'refusal', content: [] }) })).error, 'refused')
  eq('a truncated answer is a failure, not half a plan', (await api.analyse(PDF, { today: TODAY, client: client({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"sessions":[' }] }) })).error, 'model_failed')
  eq('text that is not JSON is a failure with a detail', (await api.analyse(PDF, { today: TODAY, client: client({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure! Here is' }] }) })).detail, 'no JSON in the answer')
  eq('a model override is honoured', (await (async () => { const c = client(answer({})); await api.analyse(PDF, { today: TODAY, client: c, model: 'claude-sonnet-5-5' }); return seen.at(-1).model })()), 'claude-sonnet-5-5')

  /* Le premier vrai PDF: une cle hors de tout espace de travail. */
  const ws = http(400, 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.')
  eq('a key without a workspace is its own code word, a setup problem, not a model failure', [api.failureOf(ws).status, api.failureOf(ws).error], [503, 'no_workspace'])
  ok('and carries the API sentence', /anthropic-workspace-id/.test(api.failureOf(ws).detail))
  eq('another 400 is the model failing, with the sentence', [api.failureOf(http(400, 'max_tokens: too large')).status, api.failureOf(http(400, 'max_tokens: too large')).error], [502, 'model_failed'])
  eq('a bad key is no_key', api.failureOf(http(401, 'invalid x-api-key')).error, 'no_key')
  eq('too many requests is busy', api.failureOf(http(429, 'rate limited')).error, 'busy')
  eq('an unknown model says so', api.failureOf(http(404, 'model: not found')).detail, 'model not available: model: not found')
  eq('anything else is the model failing', api.failureOf(http(529, 'overloaded')).error, 'model_failed')
  const both = client(() => ws)
  let twice = null
  try {
    await api.analyse(PDF, { today: TODAY, client: both })
  } catch (e) {
    twice = e
  }
  ok('the workspace 400 hits both attempts and comes out for the handler to name', twice?.status === 400 && /workspace/.test(api.apiMessage(twice)))
  ok('the client sends the workspace header only when there is a workspace', (() => {
    const withWs = api.makeClient({ apiKey: 'sk-test', workspace: 'wrkspc_01' })
    const without = api.makeClient({ apiKey: 'sk-test' })
    const h = (c) => c?._options?.defaultHeaders ?? c?.defaultHeaders ?? {}
    return h(withWs)['anthropic-workspace-id'] === 'wrkspc_01' && !h(without)['anthropic-workspace-id']
  })(), 'the SDK keeps constructor options on the client')

  eq('apiMessage reads the structured API message', api.apiMessage(http(400, 'messages.0.content.0: unexpected field')), 'messages.0.content.0: unexpected field')
  eq('and falls back to the error message', api.apiMessage(new Error('socket hang up')), 'socket hang up')
  eq('and to nothing for nothing', api.apiMessage(undefined), '')
  ok('anything that looks like base64 is cut out', api.apiMessage(new Error(`bad data ${'JVBERi0x'.repeat(20)} here`)) === 'bad data [base64] here')
  eq('and it never exceeds 300 characters', api.apiMessage(new Error('word '.repeat(200))).length, 300)

  eq('a PDF header passes', api.pdfBytesProblem(PDF), null)
  eq('other bytes are not a PDF', api.pdfBytesProblem(Buffer.from('hello world!').toString('base64')), 'not_pdf')
  eq('a short string is not a PDF', api.pdfBytesProblem('JVBE'), 'not_pdf')
  eq('nothing is not a PDF', api.pdfBytesProblem(undefined), 'not_pdf')
  eq('too much base64 is too big', api.pdfBytesProblem('J'.repeat(Math.ceil((MAX_PDF_BYTES * 4) / 3) + 8)), 'too_big')

  /* Le handler jusqu'a la porte, sans reseau. */
  const res = () => ({ code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } })
  const saved = { ...process.env }
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.ANTHROPIC_API_KEY
  let r = res()
  await api.default({ method: 'GET', headers: {} }, r)
  eq('GET is refused', [r.code, r.headers.Allow], [405, 'POST'])
  r = res()
  await api.default({ method: 'POST', headers: {}, body: {} }, r)
  eq('no Supabase keys is a setup error', [r.code, r.body.error], [503, 'setup'])
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-value'
  r = res()
  await api.default({ method: 'POST', headers: {}, body: {} }, r)
  eq('no Anthropic key is said by name', [r.code, r.body.error, r.body.missing], [503, 'no_key', ['ANTHROPIC_API_KEY']])
  ok('and no secret value is in that answer', !JSON.stringify(r.body).includes('service-role-test-value'))
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-value'
  r = res()
  await api.default({ method: 'POST', headers: {}, body: { pdf: PDF } }, r)
  eq('no token is 401 before the PDF is even looked at', [r.code, r.body.error], [401, 'unauthorized'])
  ok('and the key value is nowhere in it', !JSON.stringify(r.body).includes('sk-ant-test-value'))
  process.env = saved
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
