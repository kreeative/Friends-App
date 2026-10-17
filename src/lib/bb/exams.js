/**
 * The exams of a course: the midterm (the intra) and the final, sometimes a
 * second midterm. "Ya le final exam mais ya aussi le mid term" (Kee): one
 * date per course was not how a term works.
 *
 * Stored in bb_courses.exams (migration 82), a list of
 *   { id, kind: 'midterm' | 'final', at: ISO date or null,
 *     scope: 'all' | 'since' | 'chapters' | null, chapters: [chapter id],
 *     format: { count, minutes } }
 * `at` null is "I don't know yet". `scope` is what the exam covers: the
 * whole course, 'since' (a final on what came after the midterms), the
 * chapters picked, or null when the student has not said yet (the course
 * page then asks, once there are chapters to pick). A course from before
 * has exam_at and nothing else: it reads as one exam of kind 'exam', the
 * way it always showed.
 *
 * Pure, for `npm test` and for the server (api/_bb reads it too).
 */
import { dayKey, daysUntil } from './days.js'

export const EXAM_KINDS = ['midterm', 'final']
export const SCOPES = ['all', 'since', 'chapters']
export const MAX_EXAMS = 6
const ORDER = { midterm: 0, exam: 1, final: 2 }

const iso = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const positive = (v) => (Number(v) > 0 ? Math.round(Number(v)) : null)

/* One row, cleaned: what is stored and what is read are the same shape. */
function clean(e, i = 0) {
  const chapters = Array.isArray(e.chapters) ? [...new Set(e.chapters.map(String))] : []
  let scope = SCOPES.includes(e.scope) ? e.scope : null
  if (scope === 'since' && e.kind !== 'final') scope = null
  if (scope === 'chapters' && !chapters.length) scope = null
  return {
    id: String(e.id ?? `e${i}`),
    kind: e.kind,
    at: iso(e.at),
    scope,
    chapters: scope === 'chapters' ? chapters : [],
    format: { count: positive(e.format?.count), minutes: positive(e.format?.minutes) },
  }
}

/** A fresh exam row. */
export function newExam(kind, fields = {}) {
  return { id: Math.random().toString(36).slice(2, 10), kind, at: null, scope: null, chapters: [], format: {}, ...fields }
}

/**
 * The exams of a course in date order, the undated ones last (a midterm
 * before a final), each midterm numbered when there are two: n is 1, 2...
 */
export function examsOf(course) {
  const raw = Array.isArray(course?.exams) ? course.exams : []
  let list = raw.filter((e) => e && EXAM_KINDS.includes(e.kind)).slice(0, MAX_EXAMS).map(clean)
  if (!list.length && iso(course?.exam_at)) list = [{ id: 'exam', kind: 'exam', at: iso(course.exam_at), scope: null, chapters: [], format: {}, legacy: true }]
  list.sort((a, b) => (a.at && b.at ? Date.parse(a.at) - Date.parse(b.at) : a.at ? -1 : b.at ? 1 : ORDER[a.kind] - ORDER[b.kind]))
  const midterms = list.filter((e) => e.kind === 'midterm')
  return list.map((e) => ({ ...e, n: e.kind === 'midterm' && midterms.length > 1 ? midterms.indexOf(e) + 1 : null }))
}

/** The next exam on the calendar, today included, or null. */
export function nextExam(course, now = new Date()) {
  return examsOf(course).find((e) => e.at && daysUntil(e.at, now) >= 0) ?? null
}

/** The exams still to come: dated today or later, or without a date yet. */
export function comingExams(course, now = new Date()) {
  return examsOf(course).filter((e) => !e.at || daysUntil(e.at, now) >= 0)
}

/**
 * The exam a countdown shows: the next one; else one still without a date
 * (the final after the midterm has passed); else the last one, passed.
 */
export function shownExam(course, now = new Date()) {
  const list = examsOf(course)
  return list.find((e) => e.at && daysUntil(e.at, now) >= 0) ?? list.find((e) => !e.at) ?? list.filter((e) => e.at).at(-1) ?? null
}

/** The countdown of one exam: an i18n key, the days, and the exam (null when there is none). */
export function chipFor(exam, now = new Date()) {
  if (!exam) return { key: 'bb.exam.none', n: null, exam: null }
  if (!exam.at) return { key: 'bb.exam.undated', n: null, exam }
  const n = daysUntil(exam.at, now)
  if (n < 0) return { key: 'bb.exam.past', n: null, exam }
  if (n === 0) return { key: 'bb.exam.today', n: 0, exam }
  return { key: 'bb.exam.in', n, exam }
}

/** The countdown of a course: its shown exam's. */
export function examChip(course, now = new Date()) {
  return chipFor(shownExam(course, now), now)
}

/** Is the course still worked on, on that date: an exam ahead, or one without a date yet, or none at all. */
export function stillAhead(course, date = new Date()) {
  const list = examsOf(course)
  if (!list.length) return true
  return list.some((e) => !e.at || daysUntil(e.at, date) >= 1)
}

/**
 * The chapters an exam covers, as a Set of ids, or null for all of them:
 * the ones picked; for a final "after the midterm", every chapter the
 * earlier exams did not pick; otherwise null.
 */
export function scopeOf(exam, course, chapters = []) {
  if (!exam) return null
  const known = new Set(chapters.map((c) => c.id))
  if (exam.scope === 'chapters') {
    const own = exam.chapters.filter((id) => known.has(id))
    return own.length ? new Set(own) : null
  }
  if (exam.scope === 'since') {
    const list = examsOf(course)
    const at = list.findIndex((e) => e.id === exam.id)
    const taken = new Set(list.slice(0, Math.max(0, at)).flatMap((e) => (e.scope === 'chapters' ? e.chapters : [])))
    if (!taken.size) return null
    const rest = chapters.filter((c) => !taken.has(c.id)).map((c) => c.id)
    return rest.length ? new Set(rest) : null
  }
  return null
}

/** The exam whose chapters the course page should ask for: the first midterm to come whose scope was never said. */
export function examToAsk(course, now = new Date()) {
  return comingExams(course, now).find((e) => e.kind === 'midterm' && e.scope == null) ?? null
}

/** Days until the next exam that covers this chapter, for the recall target; null when none is dated. */
export function daysToExamOf(course, chapterId, chapters = [], now = new Date()) {
  for (const e of examsOf(course)) {
    if (!e.at || daysUntil(e.at, now) < 0) continue
    const scope = scopeOf(e, course, chapters)
    if (!scope || scope.has(chapterId)) return daysUntil(e.at, now)
  }
  return null
}

/**
 * One exam's format: the course's, as typed then as read in the files
 * (the blueprint), then this exam's own length, which the student gave for
 * it alone (a final is often longer than the midterm).
 */
export function examFormat(course, blueprint, exam) {
  const base = { ...(course?.exam_format ?? {}), ...(blueprint?.data ?? {}) }
  const own = exam?.format ?? {}
  return { ...base, ...(positive(own.count) ? { count: positive(own.count) } : {}), ...(positive(own.minutes) ? { minutes: positive(own.minutes) } : {}) }
}

/**
 * What to write for a list of exams: the list, and exam_at for what still
 * reads one date (an app opened before this version, and the database until
 * migration 82 has run): the next exam, else the last one.
 */
export function examColumns(list, now = new Date()) {
  const exams = (list ?? []).filter((e) => e && EXAM_KINDS.includes(e.kind)).slice(0, MAX_EXAMS).map(clean)
  const shown = nextExam({ exams }, now) ?? examsOf({ exams }).filter((e) => e.at).at(-1) ?? null
  return { exams, exam_at: shown?.at ?? null }
}

/**
 * For the coach: one sentence per exam, with its date and its chapters by
 * title, so it can tell the midterm from the final.
 */
export function examsLine(course, chapters = [], now = new Date()) {
  const list = examsOf(course)
  if (!list.length) return null
  const title = new Map(chapters.map((c) => [c.id, c.title]))
  return list
    .map((e) => {
      const name = e.kind === 'midterm' ? `midterm${e.n ? ` ${e.n}` : ''}` : e.kind === 'final' ? 'final exam' : 'exam'
      const when = e.at ? `on ${e.at.slice(0, 10)}${daysUntil(e.at, now) < 0 ? ' (passed)' : ''}` : 'date not given yet'
      const scope = scopeOf(e, course, chapters)
      const what = scope
        ? `covers: ${[...scope].map((id) => title.get(id)).filter(Boolean).join('; ')}`
        : e.scope === 'since'
          ? 'covers what came after the midterm'
          : e.scope == null && e.kind === 'midterm'
            ? 'chapters not given yet'
            : 'covers the whole course'
      return `${name} ${when}, ${what}`
    })
    .join('. ')
}

/* Lower case, no accents, words only: "Chimie organique (CHM-101)" is
   "chimie organique chm 101". */
const words = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/* Does a calendar title name the course, by its code or its name, as whole words? */
function names(title, course) {
  const line = ` ${words(title)} `
  return [course?.code, course?.name].some((n) => {
    const w = words(n)
    return w.length >= 3 && line.includes(` ${w} `)
  })
}

/**
 * The exams, as rows in calendar_event's shape, for the calendar on Today
 * (src/components/WeekStrip.jsx with `study`). "Hakilo should have the home
 * page with the calendar and the things to do today" (Kee): a student's
 * calendar without the exams would be missing the dates that matter most.
 *
 * Drawn from the course, never written to calendar_event: copied there, an
 * exam would have two places to be changed and one would go stale. At its
 * hour, for its length when the student gave one (its own, else the
 * course's), else the hour alone.
 *
 * One the calendar already has is left out, the way the syllabus import
 * writes it: an 'examen' row on the same day, at the same hour or naming the
 * course. `title(course, exam)` is the page's words ("Intra · Chimie").
 * Local days and hours, read in the browser.
 */
export function examEvents(courses, { title = (course) => course?.name ?? '', events = [] } = {}) {
  const out = []
  for (const course of courses ?? []) {
    for (const exam of examsOf(course)) {
      if (!exam.at) continue
      const at = new Date(exam.at)
      const day = dayKey(at)
      const start = at.getHours() * 60 + at.getMinutes()
      const known = (events ?? []).some(
        (e) => e?.category === 'examen' && String(e.starts_on ?? '').slice(0, 10) === day && (e.start_min === start || names(e.title, course)),
      )
      if (known) continue
      const { minutes } = examFormat(course, null, exam)
      out.push({
        id: `bb-exam:${course.id}:${exam.id}`,
        title: String(title(course, exam) ?? '').slice(0, 120),
        category: 'examen',
        location: null,
        starts_on: day,
        until_on: null,
        start_min: start,
        end_min: minutes ? Math.min(1440, start + minutes) : null,
        weekdays: [],
      })
    }
  }
  return out
}
