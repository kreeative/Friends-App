/**
 * Calibration, by chapter and by week (section 3, technique 9).
 *
 *   Keep a calibration score per chapter. "Confident but wrong" items are
 *   marked with an icon and a word, never by colour alone. A weekly line:
 *   "Sure and wrong 4 times in Ch 5, all on [twin pair]."
 *
 * Pure: answers, concepts, chapters and twins in, numbers and names out. The
 * sentence itself is built by the page, in the student's language.
 */
export const MIN_SURE = 3

/** For each chapter: answers given "sure", how many were right, the share. */
export function calibrationByChapter(reviews, concepts) {
  const chapterOf = new Map((concepts ?? []).map((c) => [c.id, c.chapter_id]))
  const out = new Map()
  for (const r of reviews ?? []) {
    if (r.confidence !== 'sure' || r.mode === 'pretest') continue
    const ch = chapterOf.get(r.concept_id)
    if (!ch) continue
    const row = out.get(ch) ?? { sure: 0, right: 0, pct: null }
    row.sure += 1
    if (r.correct) row.right += 1
    out.set(ch, row)
  }
  for (const row of out.values()) row.pct = row.sure >= MIN_SURE ? Math.round((row.right / row.sure) * 100) : null
  return out
}

/**
 * The week's "sure and wrong", gathered where they cluster: the chapter with
 * the most, and the twin pair they all fall on when they do.
 * Returns null when the week had none.
 */
export function weeklyLine({ reviews = [], concepts = [], chapters = [], twins = [], now = new Date() } = {}) {
  const since = now.getTime() - 7 * 86400000
  const wrong = reviews.filter((r) => r.confidence === 'sure' && r.correct === false && r.mode !== 'pretest' && Date.parse(r.created_at) >= since)
  if (!wrong.length) return null
  const concept = new Map(concepts.map((c) => [c.id, c]))
  const count = new Map()
  for (const r of wrong) {
    const ch = concept.get(r.concept_id)?.chapter_id ?? null
    count.set(ch, (count.get(ch) ?? 0) + 1)
  }
  const [chapterId, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
  const inChapter = wrong.filter((r) => (concept.get(r.concept_id)?.chapter_id ?? null) === chapterId)
  const ids = new Set(inChapter.map((r) => r.concept_id))
  const pair = twins.find((t) => [...ids].every((id) => id === t.a_concept || id === t.b_concept))
  const chapter = chapters.find((c) => c.id === chapterId) ?? null
  return {
    total: wrong.length,
    n,
    chapter: chapter?.title ?? null,
    course_id: chapter?.course_id ?? null,
    pair: pair ? [concept.get(pair.a_concept)?.name, concept.get(pair.b_concept)?.name].filter(Boolean) : null,
  }
}
