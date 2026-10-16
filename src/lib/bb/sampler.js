/**
 * Today's session: what to ask, in what order (section 6 of the build prompt).
 *
 * In priority order, until the minutes are spent:
 *   1. "confident but wrong" mistakes, first, always;
 *   2. due reviews, most overdue and highest exam signal first;
 *   3. the other open mistakes;
 *   4. a pretest of the next chapter (5 items, "guessing first helps");
 *   5. new items, a few at a time.
 *
 * Then INTERLEAVED: chapters mixed, never the same concept twice in a row,
 * because practice sets that mix chapters make the student recognise which
 * concept applies (section 3, technique 3). Blocked practice only for the
 * pretest of a brand-new chapter, which stays together.
 *
 * Pure: everything comes in as plain rows, a list of { id, reason } goes out.
 */

/** Rough seconds per item, by type, to fit a session into its minutes. */
export const SECONDS = { mcq: 60, tf: 30, flash: 20, cloze: 25, short: 90 }
export const PRETEST_SIZE = 5
export const NEW_PER_SESSION = { 10: 5, 15: 8, 25: 12 }

const secondsOf = (item) => SECONDS[item?.type] ?? 45

/**
 * @param minutes   10, 15 or 25
 * @param items     [{ id, type, concept_id, chapter_id, quality }]
 * @param schedule  [{ item_id, due, state }]  (absent = never seen)
 * @param mistakes  [{ item_id, confident, resolved_at }]
 * @param concepts  [{ id, weight }]
 * @param chapters  [{ id, position }]
 * @param now       Date
 */
export function buildSession({ minutes = 15, items = [], schedule = [], mistakes = [], concepts = [], chapters = [], now = new Date() } = {}) {
  const budget = Math.max(5, Number(minutes) || 15) * 60
  const usable = items.filter((i) => i.quality === 'pass' || i.quality === 'revised' || i.quality == null)
  const byId = new Map(usable.map((i) => [i.id, i]))
  const weight = new Map(concepts.map((c) => [c.id, Math.min(3, Math.max(1, Number(c.weight) || 1))]))
  const sched = new Map(schedule.map((s) => [s.item_id, s]))
  const open = mistakes.filter((m) => !m.resolved_at && byId.has(m.item_id))

  const picked = []
  const taken = new Set()
  let spent = 0
  const take = (item, reason) => {
    if (!item || taken.has(item.id)) return false
    const cost = secondsOf(item)
    if (spent + cost > budget && picked.length > 0) return false
    taken.add(item.id)
    picked.push({ id: item.id, reason, concept_id: item.concept_id, chapter_id: item.chapter_id })
    spent += cost
    return true
  }

  // 1. Confident but wrong.
  for (const m of open.filter((m) => m.confident)) take(byId.get(m.item_id), 'confident_wrong')

  // 2. Due reviews.
  const due = usable
    .filter((i) => sched.has(i.id) && new Date(sched.get(i.id).due) <= now)
    .map((i) => ({ i, overdue: (now - new Date(sched.get(i.id).due)) / 86400000, w: weight.get(i.concept_id) ?? 1 }))
    .sort((a, b) => b.overdue * (1 + b.w) - a.overdue * (1 + a.w))
  for (const { i } of due) take(i, 'due')

  // 3. Other open mistakes.
  for (const m of open.filter((m) => !m.confident)) take(byId.get(m.item_id), 'mistake')

  // 4. Pretest of the next chapter: the first chapter, by position, that has
  //    items and none of them seen yet. On a brand-new course that is
  //    chapter 1, which is what the first session opens with (section 9).
  const seenChapter = new Set(usable.filter((i) => sched.has(i.id)).map((i) => i.chapter_id))
  const order = [...chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const next = order.find((c) => !seenChapter.has(c.id) && usable.some((i) => i.chapter_id === c.id))
  const pretest = []
  if (next) {
    const pool = usable.filter((i) => i.chapter_id === next.id && !sched.has(i.id) && i.type !== 'flash')
    for (const i of spreadByConcept(pool).slice(0, PRETEST_SIZE)) if (take(i, 'pretest')) pretest.push(i.id)
  }

  // 5. New items: the earliest chapters first, a few per session, spread
  //    across concepts and weighted by signal.
  const cap = NEW_PER_SESSION[minutes] ?? Math.round(minutes / 2)
  const chapterRank = new Map(order.map((c, n) => [c.id, n]))
  const fresh = usable
    .filter((i) => !sched.has(i.id) && !taken.has(i.id))
    .sort((a, b) => (chapterRank.get(a.chapter_id) ?? 99) - (chapterRank.get(b.chapter_id) ?? 99) || (weight.get(b.concept_id) ?? 1) - (weight.get(a.concept_id) ?? 1))
  let added = 0
  for (const i of spreadByConcept(fresh)) {
    if (added >= cap) break
    if (take(i, 'new')) added += 1
  }

  return { items: interleave(picked, new Set(pretest)), seconds: spent }
}

/** One item per concept in turn, so five new items are five concepts. */
export function spreadByConcept(items) {
  const groups = new Map()
  for (const i of items) {
    const k = i.concept_id ?? i.id
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(i)
  }
  const lanes = [...groups.values()]
  const out = []
  for (let round = 0; out.length < items.length; round++) {
    let any = false
    for (const lane of lanes) if (lane[round]) { out.push(lane[round]); any = true }
    if (!any) break
  }
  return out
}

/**
 * Mix chapters and never put the same concept twice in a row. The pretest
 * stays in one block, at the point it would have come.
 */
export function interleave(picked, pretestIds = new Set()) {
  const block = picked.filter((p) => pretestIds.has(p.id))
  const rest = picked.filter((p) => !pretestIds.has(p.id))
  const out = []
  const pool = [...rest]
  while (pool.length) {
    const last = out.at(-1)
    let k = pool.findIndex((p) => p.concept_id !== last?.concept_id && p.chapter_id !== last?.chapter_id)
    if (k < 0) k = pool.findIndex((p) => p.concept_id !== last?.concept_id)
    if (k < 0) k = 0
    out.push(pool.splice(k, 1)[0])
  }
  if (!block.length) return out
  /* The pretest after the first third: warm up on what you know, then guess. */
  const at = Math.min(out.length, Math.ceil(out.length / 3))
  return [...out.slice(0, at), ...block, ...out.slice(at)]
}

/** Was a session's practice mixed or blocked? For the mixed-vs-blocked measure. */
export function isMixed(sequence) {
  const chapters = new Set((sequence ?? []).map((s) => s.chapter_id).filter(Boolean))
  return chapters.size > 1
}
