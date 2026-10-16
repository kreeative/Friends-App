/**
 * The timed mock exam (section 6, phase 2).
 *
 *   Follows the blueprint: counts, types, time limit, points, chapter
 *   weights. Results by chapter and by Bloom level, and a review of every
 *   miss. Feeds the Mistake log and the plan.
 *
 * Built only from items that passed the quality pipeline and that the app can
 * mark itself (multiple choice, true/false): a mock exam costs no AI call.
 * Chapters weigh what their concepts weigh (the professor's exam signals
 * included), so a chapter she keeps flagging takes more of the exam. Pure.
 */
export const MARKED = new Set(['mcq', 'tf'])
export const DEFAULT_COUNT = 30
export const PER_QUESTION_MIN = 1.5
/* Below this, a mock exam measures nothing: the page says to prepare more. */
export const MIN_EXAM = 5

/** A small seeded random, so a test can pin the draw. */
export function rng(seed = Date.now()) {
  let a = Math.floor(seed) % 2147483647
  if (a <= 0) a += 2147483646
  return () => {
    a = (a * 16807) % 2147483647
    return (a - 1) / 2147483646
  }
}

/** Questions, minutes and types, from the blueprint, then sensible defaults. */
export function examShape(format, available) {
  const f = format ?? {}
  const count = Math.max(1, Math.min(Number(f.count) || DEFAULT_COUNT, available || DEFAULT_COUNT, 60))
  const askedFor = f.count ? Number(f.count) : count
  const minutes = Number(f.minutes)
    ? Math.max(5, Math.round((Number(f.minutes) * count) / Math.max(count, askedFor)))
    : Math.max(5, Math.round(count * PER_QUESTION_MIN))
  return { count, minutes }
}

/**
 * Draw the questions: each chapter gets a share proportional to the weight
 * of its concepts, then the shares are filled at random within the chapter,
 * spread over concepts. Items seen least recently are preferred.
 */
export function pickExam({ items = [], concepts = [], chapters = [], count = DEFAULT_COUNT, seed = Date.now(), lastSeen = new Map() } = {}) {
  const pool = items.filter((i) => MARKED.has(i.type) && (i.quality === 'pass' || i.quality === 'revised') && !i.variant_of)
  if (!pool.length) return []
  const random = rng(seed)
  const weightOf = new Map(concepts.map((c) => [c.id, Math.min(3, Math.max(1, Number(c.weight) || 1))]))
  const chapterWeight = new Map()
  for (const ch of chapters) chapterWeight.set(ch.id, 0)
  for (const c of concepts) if (chapterWeight.has(c.chapter_id)) chapterWeight.set(c.chapter_id, chapterWeight.get(c.chapter_id) + (weightOf.get(c.id) ?? 1))
  const byChapter = new Map()
  for (const i of pool) {
    if (!byChapter.has(i.chapter_id)) byChapter.set(i.chapter_id, [])
    byChapter.get(i.chapter_id).push(i)
  }
  const ids = [...byChapter.keys()]
  const total = ids.reduce((s, id) => s + (chapterWeight.get(id) || 1), 0)
  const want = Math.min(count, pool.length)
  /* Shares by largest remainder, capped by what each chapter has. */
  const raw = ids.map((id) => ({ id, exact: (want * (chapterWeight.get(id) || 1)) / total }))
  const share = new Map(raw.map((r) => [r.id, Math.min(Math.floor(r.exact), byChapter.get(r.id).length)]))
  let left = want - [...share.values()].reduce((a, b) => a + b, 0)
  const order = [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))
  while (left > 0) {
    let moved = false
    for (const r of order) {
      if (left <= 0) break
      if (share.get(r.id) < byChapter.get(r.id).length) {
        share.set(r.id, share.get(r.id) + 1)
        left -= 1
        moved = true
      }
    }
    if (!moved) break
  }
  const picked = []
  for (const id of ids) {
    const list = [...byChapter.get(id)]
      .map((i) => {
        const seen = lastSeen.get(i.id)
        return { i, key: (seen ? Date.parse(seen) || 0 : 0) + random() * 1000 }
      })
      .sort((a, b) => a.key - b.key)
      .map((x) => x.i)
    /* Spread over concepts: one per concept per round. */
    const lanes = new Map()
    for (const i of list) {
      if (!lanes.has(i.concept_id)) lanes.set(i.concept_id, [])
      lanes.get(i.concept_id).push(i)
    }
    const spread = []
    for (let round = 0; spread.length < list.length; round += 1) {
      let any = false
      for (const lane of lanes.values()) if (lane[round]) { spread.push(lane[round]); any = true }
      if (!any) break
    }
    picked.push(...spread.slice(0, share.get(id)))
  }
  /* Shuffled, like the real thing: chapters are not announced. */
  for (let k = picked.length - 1; k > 0; k -= 1) {
    const j = Math.floor(random() * (k + 1))
    ;[picked[k], picked[j]] = [picked[j], picked[k]]
  }
  return picked
}

/**
 * Mark it. answers: { [itemId]: optionIndex }. Unanswered is wrong.
 * Returns the score, by chapter and by Bloom level, and every miss.
 */
export function scoreExam({ items = [], answers = {}, chapters = [] } = {}) {
  const title = new Map(chapters.map((c) => [c.id, c.title]))
  const byChapter = new Map()
  const byBloom = new Map()
  const misses = []
  let score = 0
  for (const i of items) {
    const given = answers[i.id]
    const right = given != null && Number(given) === Number(i.answer?.index)
    if (right) score += 1
    else misses.push({ item: i, given: given ?? null })
    const ch = byChapter.get(i.chapter_id) ?? { chapter_id: i.chapter_id, title: title.get(i.chapter_id) ?? '?', right: 0, total: 0 }
    ch.total += 1
    if (right) ch.right += 1
    byChapter.set(i.chapter_id, ch)
    const level = Math.min(6, Math.max(1, Number(i.bloom) || 3))
    const b = byBloom.get(level) ?? { bloom: level, right: 0, total: 0 }
    b.total += 1
    if (right) b.right += 1
    byBloom.set(level, b)
  }
  const pct = (r) => (r.total ? Math.round((r.right / r.total) * 100) : 0)
  return {
    score,
    total: items.length,
    pct: items.length ? Math.round((score / items.length) * 100) : 0,
    byChapter: [...byChapter.values()].map((r) => ({ ...r, pct: pct(r) })).sort((a, b) => a.pct - b.pct),
    byBloom: [...byBloom.values()].map((r) => ({ ...r, pct: pct(r) })).sort((a, b) => a.bloom - b.bloom),
    misses,
  }
}

/** Seconds left, never negative. */
export const secondsLeft = (startedAt, minutes, now = Date.now()) => Math.max(0, Math.round((Date.parse(startedAt) + minutes * 60000 - now) / 1000))

export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
