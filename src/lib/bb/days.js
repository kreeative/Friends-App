/**
 * Days: the exam countdown and the study streak. The plan itself is
 * src/lib/bb/planner.js.
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
