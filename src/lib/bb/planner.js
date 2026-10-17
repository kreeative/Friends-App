import { busyOn } from '../syllabus.js'
import { CATEGORY_COLOUR } from '../agenda.js'
import { daysUntil, dayKey } from './days.js'
import { examFormat, examsOf, stillAhead } from './exams.js'

/**
 * The study plan, written into the Rich & Friends calendar (section 6,
 * phase 2).
 *
 *   Built from the exam dates, blueprint, mastery and the student's available
 *   hours. Every day mixes new material, due reviews and mock exams: at least
 *   two, the last 3 to 5 days before. One rest day a week. Re-plans when a
 *   day is missed. Written into the calendar, reusing planStudy and
 *   sessionRows.
 *
 * planDays() decides WHAT each day holds; placeDays() finds WHEN, around what
 * is already on the calendar (busyOn from the syllabus planner, so a block
 * never lands on a class); eventRows() writes calendar_event rows the same
 * shape studyRows() does. missed() says which planned days passed without a
 * session. All pure.
 */
export const HORIZON = 14
export const MOCK_MINUTES = 45

const midnight = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const round5 = (n) => Math.max(10, Math.round(n / 5) * 5)

/** The mock exam days of one exam: two inside the last 3 to 5 days, when there is room. */
export function mockDays(examAt, today) {
  const exam = midnight(examAt)
  const from = midnight(today)
  const window = [5, 4, 3].map((k) => addDays(exam, -k)).filter((d) => d >= from)
  if (window.length >= 2) return [window[0], window.at(-1)].map(dayKey)
  if (window.length === 1) return [dayKey(window[0])]
  const late = addDays(exam, -2)
  return late >= from ? [dayKey(late)] : []
}

/**
 * courses: [{ id, name, code, exams, exam_at, exam_format }]
 * Returns [{ date, items: [{ kind: 'study'|'mock'|'eve', course_id, minutes, exam }], rest, exams }].
 *
 * Every exam of a course counts, the midterm as much as the final
 * (src/lib/bb/exams.js): two mock exams before each, the eve before each,
 * and on any day the course is weighted by its NEXT exam, so the days before
 * the midterm lean on it and the final takes over once it is past. `exams`
 * lists the exams held that day ({ course_id, kind, n }), so the day says
 * which one instead of reading "rest"; a mock exam and an eve carry the exam
 * they prepare in `exam`.
 */
export function planDays({ courses = [], weeklyHours = 5, now = new Date(), days = HORIZON } = {}) {
  const perDay = (Math.min(80, Math.max(1, Number(weeklyHours) || 5)) * 60) / 6
  const today = midnight(now)
  const dated = new Map(courses.map((c) => [c.id, examsOf(c).filter((e) => e.at)]))
  /* The exam a course works towards on a date: its first one that day or after. */
  const nextOn = (c, date) => dated.get(c.id).find((e) => daysUntil(e.at, date) >= 0) ?? null
  const tag = (e) => ({ kind: e.kind, n: e.n })
  const mocks = new Map()
  for (const c of courses) {
    for (const e of dated.get(c.id)) {
      if (daysUntil(e.at, today) < 1) continue
      for (const d of mockDays(e.at, today)) {
        if (!mocks.has(d)) mocks.set(d, [])
        mocks.get(d).push({ course: c, exam: e })
      }
    }
  }
  const out = []
  for (let k = 0; k < days; k += 1) {
    const date = addDays(today, k)
    const key = dayKey(date)
    const tomorrow = dayKey(addDays(date, 1))
    const ahead = courses.filter((c) => {
      const e = nextOn(c, date)
      return e ? daysUntil(e.at, date) >= 1 : stillAhead(c, date)
    })
    const eveOf = (c) => {
      const e = nextOn(c, date)
      return e && daysUntil(e.at, date) === 1 ? e : null
    }
    const eve = ahead.find((c) => eveOf(c))
    const mockToday = mocks.get(key) ?? []
    const mondayExam = courses.some((c) => dated.get(c.id).some((e) => dayKey(e.at) === tomorrow))
    const exams = courses.flatMap((c) => dated.get(c.id).filter((e) => dayKey(e.at) === key).map((e) => ({ course_id: c.id, ...tag(e) })))
    if (!ahead.length) {
      out.push({ date: key, items: [], rest: true, exams })
      continue
    }
    if (eve) {
      out.push({ date: key, items: [{ kind: 'eve', course_id: eve.id, minutes: round5(Math.min(perDay, 20)), exam: tag(eveOf(eve)) }], rest: false, exams })
      continue
    }
    if (date.getDay() === 0 && !mockToday.length && !mondayExam) {
      out.push({ date: key, items: [], rest: true, exams })
      continue
    }
    const items = mockToday.map(({ course, exam }) => ({ kind: 'mock', course_id: course.id, minutes: Math.min(180, Number(examFormat(course, null, exam).minutes) || MOCK_MINUTES), exam: tag(exam) }))
    const study = ahead.filter((c) => !mockToday.some((m) => m.course.id === c.id))
    if (study.length) {
      const weights = study.map((c) => {
        const e = nextOn(c, date)
        return e ? 1 / Math.max(1, daysUntil(e.at, date)) + 0.1 : 0.5
      })
      const total = weights.reduce((a, b) => a + b, 0)
      const budget = mockToday.length ? perDay / 2 : perDay
      study.forEach((c, i) => items.push({ kind: 'study', course_id: c.id, minutes: round5((budget * weights[i]) / total) }))
    }
    out.push({ date: key, items, rest: false, exams })
  }
  return out
}

/* The first free start, by quarter hour, inside the window. */
function freeSlot(taken, from, to, minutes) {
  for (let s = from; s + minutes <= to; s += 15) {
    const e = s + minutes
    if (!taken.some((b) => s < b.end && e > b.start)) return s
  }
  return null
}

/**
 * Times for every item, around the calendar: busy is every calendar_event
 * with a time (recurring ones included, through busyOn). The window is the
 * student's usual study hours. An item with no room is returned in
 * `unplaced`, so the page can say so instead of hiding it.
 */
export function placeDays(plan, { busy = [], startMin = 18 * 60, endMin = 22 * 60 } = {}) {
  const placed = []
  const unplaced = []
  for (const day of plan) {
    const date = new Date(`${day.date}T12:00:00`)
    const taken = busyOn(busy, date)
    for (const item of day.items) {
      const minutes = Math.max(10, Math.min(item.minutes, endMin - startMin))
      const slot = freeSlot(taken, startMin, endMin, minutes)
      if (slot == null) {
        unplaced.push({ ...item, date: day.date })
        continue
      }
      taken.push({ start: slot, end: slot + minutes })
      placed.push({ ...item, date: day.date, start_min: slot, end_min: slot + minutes })
    }
  }
  return { placed, unplaced }
}

/** calendar_event rows, the shape studyRows() writes. `title(item)` is the page's sentence. */
export function eventRows(placed, { userId, title }) {
  return placed.map((p) => ({
    user_id: userId,
    title: String(title(p)).slice(0, 120),
    category: 'etude',
    location: null,
    starts_on: p.date,
    until_on: null,
    start_min: p.start_min,
    end_min: p.end_min,
    weekdays: [],
    colour: CATEGORY_COLOUR.etude,
  }))
}

/**
 * Planned days that went by without the work: a study or eve day with no
 * session that answered something for that course on that date, a mock day
 * with no finished mock exam. Today is never missed yet.
 */
export function missed(planRows, { sessions = [], exams = [], now = new Date() } = {}) {
  const today = dayKey(now)
  const studied = new Set(sessions.filter((s) => (s.answered ?? 0) > 0).map((s) => `${s.course_id}:${dayKey(s.started_at)}`))
  const mocked = new Set(exams.filter((e) => e.ended_at).map((e) => `${e.course_id}:${dayKey(e.started_at)}`))
  return planRows.filter((r) => {
    if (r.kind === 'rest' || r.done_at || r.on_date >= today) return false
    const key = `${r.course_id}:${r.on_date}`
    return r.kind === 'mock' ? !mocked.has(key) : !studied.has(key)
  })
}
