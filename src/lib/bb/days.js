/**
 * Days: the exam countdown, the study streak, and the week's plan.
 *
 * Local calendar days throughout, because "exam in 3 days" is read on the
 * student's own calendar, not in UTC. Pure, tested in bb.test.mjs.
 */
export const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const midnight = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Whole calendar days from today to the exam; null without a date. */
export function daysUntil(examAt, now = new Date()) {
  if (!examAt) return null
  return Math.round((midnight(examAt) - midnight(now)) / 86400000)
}

/** The i18n key and count for an exam chip. */
export function examLabel(examAt, now = new Date()) {
  const n = daysUntil(examAt, now)
  if (n == null) return { key: 'bb.exam.none', n: null }
  if (n < 0) return { key: 'bb.exam.past', n: null }
  if (n === 0) return { key: 'bb.exam.today', n: 0 }
  return { key: 'bb.exam.in', n }
}

/**
 * Consecutive study days up to today. A day counts when a session on it got
 * at least one answer. Today not studied yet does not break the streak:
 * it still counts from yesterday, so the morning does not read "0".
 */
export function studyStreak(sessions, now = new Date()) {
  const days = new Set((sessions ?? []).filter((s) => (s.answered ?? 0) > 0).map((s) => dayKey(s.started_at)))
  const cursor = midnight(now)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days.has(dayKey(cursor))) {
    n += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

export function sessionsToday(sessions, now = new Date()) {
  const today = dayKey(now)
  return (sessions ?? []).filter((s) => (s.answered ?? 0) > 0 && dayKey(s.started_at) === today).length
}

const round5 = (n) => Math.max(10, Math.round(n / 5) * 5)

/**
 * The next `days` days: which courses to study and for how long.
 *
 *   - weekly hours (default 5) spread over six study days; one rest day a
 *     week, Sunday, unless an exam falls on the Monday after it;
 *   - each day's minutes shared between the courses whose exam is still
 *     ahead, the closer exam getting more;
 *   - the eve of an exam is a light review of that course only ("sleep
 *     before the exam", section 1);
 *   - the last 10 days before an exam are marked `final`.
 *
 * courses: [{ id, name, exam_at }]. Returns [{ date, rest, eve, items: [{ course_id, minutes, final }] }].
 */
export function weekPlan({ courses = [], weeklyHours = 5, now = new Date(), days = 7 } = {}) {
  const perDay = (Math.min(80, Math.max(1, Number(weeklyHours) || 5)) * 60) / 6
  const out = []
  for (let k = 0; k < days; k += 1) {
    const date = midnight(now)
    date.setDate(date.getDate() + k)
    const ahead = courses
      .map((c) => ({ c, until: daysUntil(c.exam_at, date) }))
      .filter((x) => x.until == null || x.until >= 1)
    const eve = ahead.find((x) => x.until === 1)
    const monday = new Date(date)
    monday.setDate(monday.getDate() + 1)
    const examMonday = courses.some((c) => c.exam_at && dayKey(c.exam_at) === dayKey(monday))
    const rest = date.getDay() === 0 && !eve && !examMonday
    if (rest || !ahead.length) {
      out.push({ date: dayKey(date), rest: rest || !ahead.length, eve: false, items: [] })
      continue
    }
    if (eve) {
      out.push({ date: dayKey(date), rest: false, eve: true, items: [{ course_id: eve.c.id, minutes: round5(Math.min(perDay, 20)), final: true }] })
      continue
    }
    const weights = ahead.map((x) => (x.until == null ? 0.5 : 1 / Math.max(1, x.until) + 0.1))
    const total = weights.reduce((a, b) => a + b, 0)
    out.push({
      date: dayKey(date),
      rest: false,
      eve: false,
      items: ahead.map((x, i) => ({ course_id: x.c.id, minutes: round5((perDay * weights[i]) / total), final: x.until != null && x.until <= 10 })),
    })
  }
  return out
}
