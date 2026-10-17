import { busyOn } from '../syllabus.js'
import { CATEGORY_COLOUR } from '../agenda.js'
import { daysUntil, dayKey } from './days.js'

/**
 * The study plan, written into the Rich & Friends calendar (section 6,
 * phase 2).
 *
 *   Built from the exam date, blueprint, mastery and the student's available
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
 * courses: [{ id, name, code, exam_at, exam_format }]
 * Returns [{ date, items: [{ kind: 'study'|'mock'|'eve', course_id, minutes }], rest, exams }]:
 * `exams` names the courses whose exam is that day, so the day says so
 * instead of reading "rest".
 */
export function planDays({ courses = [], weeklyHours = 5, now = new Date(), days = HORIZON } = {}) {
  const perDay = (Math.min(80, Math.max(1, Number(weeklyHours) || 5)) * 60) / 6
  const today = midnight(now)
  const mocks = new Map()
  for (const c of courses) {
    if (!c.exam_at || daysUntil(c.exam_at, today) < 1) continue
    for (const d of mockDays(c.exam_at, today)) {
      if (!mocks.has(d)) mocks.set(d, [])
      mocks.get(d).push(c)
    }
  }
  const out = []
  for (let k = 0; k < days; k += 1) {
    const date = addDays(today, k)
    const key = dayKey(date)
    const ahead = courses.filter((c) => {
      const n = daysUntil(c.exam_at, date)
      return n == null || n >= 1
    })
    const eve = ahead.find((c) => daysUntil(c.exam_at, date) === 1)
    const mockToday = mocks.get(key) ?? []
    const mondayExam = courses.some((c) => c.exam_at && dayKey(c.exam_at) === dayKey(addDays(date, 1)))
    const exams = courses.filter((c) => c.exam_at && dayKey(c.exam_at) === key).map((c) => c.id)
    if (!ahead.length) {
      out.push({ date: key, items: [], rest: true, exams })
      continue
    }
    if (eve) {
      out.push({ date: key, items: [{ kind: 'eve', course_id: eve.id, minutes: round5(Math.min(perDay, 20)) }], rest: false, exams })
      continue
    }
    if (date.getDay() === 0 && !mockToday.length && !mondayExam) {
      out.push({ date: key, items: [], rest: true, exams })
      continue
    }
    const items = mockToday.map((c) => ({ kind: 'mock', course_id: c.id, minutes: Math.min(180, Number(c.exam_format?.minutes) || MOCK_MINUTES) }))
    const study = ahead.filter((c) => !mockToday.some((m) => m.id === c.id))
    if (study.length) {
      const weights = study.map((c) => {
        const n = daysUntil(c.exam_at, date)
        return n == null ? 0.5 : 1 / Math.max(1, n) + 0.1
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
