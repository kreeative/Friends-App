/**
 * Mastery, defined once and used everywhere (section 3 of the build prompt).
 *
 *   A concept is mastered when it was answered correctly at Application level
 *   or above (Bloom 3+) on 3 different days, the last of those days at least
 *   7 days after the first, with no "confident but wrong" in between.
 *
 *   Chapter mastery is the share of mastered concepts, weighted by their exam
 *   signal weight (1 to 3). The screen always shows the number beside the bar.
 *
 * Days are local calendar days, passed in as a function so a test can pin a
 * time zone. Pure.
 */

export const MASTERY_DAYS = 3
export const MASTERY_SPAN = 7
export const MASTERY_BLOOM = 3

const localDay = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const daysApart = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)

/**
 * reviews: [{ created_at, correct, bloom, confidence }] for ONE concept.
 * Returns { mastered, days, firstDay, lastDay, blockedBy }.
 */
export function conceptMastery(reviews, { dayOf = localDay } = {}) {
  const sorted = [...(reviews ?? [])].filter((r) => r?.created_at).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const good = sorted.filter((r) => r.correct && (r.bloom ?? 0) >= MASTERY_BLOOM)
  const days = [...new Set(good.map((r) => dayOf(r.created_at)))]
  if (days.length < MASTERY_DAYS) return { mastered: false, days: days.length, firstDay: days[0] ?? null, lastDay: days.at(-1) ?? null, blockedBy: null }

  /* Any window of qualifying days counts: try every first day, newest windows
     last, so a recent run wins over an old one. A confident-but-wrong
     between the first and the last day of a window breaks that window. */
  for (let i = days.length - MASTERY_DAYS; i >= 0; i--) {
    const first = days[i]
    for (let j = days.length - 1; j >= i + MASTERY_DAYS - 1; j--) {
      const last = days[j]
      if (daysApart(first, last) < MASTERY_SPAN) continue
      const between = sorted.filter((r) => {
        const d = dayOf(r.created_at)
        return d >= first && d <= last
      })
      const blocked = between.find((r) => !r.correct && r.confidence === 'sure')
      if (blocked) continue
      const inside = days.filter((x) => x >= first && x <= last).length
      if (inside >= MASTERY_DAYS) return { mastered: true, days: days.length, firstDay: first, lastDay: last, blockedBy: null }
    }
  }
  const blocker = sorted.find((r) => !r.correct && r.confidence === 'sure') ?? null
  return { mastered: false, days: days.length, firstDay: days[0], lastDay: days.at(-1), blockedBy: blocker ? dayOf(blocker.created_at) : null }
}

/**
 * concepts: [{ id, weight }], reviewsByConcept: { [id]: reviews[] }.
 * Returns { mastered, total, pct } with pct weighted by exam signal.
 */
export function chapterMastery(concepts, reviewsByConcept, opts) {
  let num = 0
  let den = 0
  let mastered = 0
  for (const c of concepts ?? []) {
    const w = Math.min(3, Math.max(1, Number(c.weight) || 1))
    den += w
    if (conceptMastery(reviewsByConcept?.[c.id] ?? [], opts).mastered) {
      num += w
      mastered += 1
    }
  }
  return { mastered, total: (concepts ?? []).length, pct: den ? Math.round((num / den) * 100) : 0 }
}

/**
 * Calibration: of the answers given "sure", how many were right. And the
 * confident-but-wrong count, which is what the course home shows.
 */
export function calibration(reviews) {
  const sure = (reviews ?? []).filter((r) => r.confidence === 'sure')
  const right = sure.filter((r) => r.correct).length
  return {
    sure: sure.length,
    sureRight: right,
    pct: sure.length ? Math.round((right / sure.length) * 100) : null,
    confidentWrong: sure.length - right,
  }
}
