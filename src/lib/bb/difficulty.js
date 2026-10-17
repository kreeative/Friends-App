/**
 * Desirable difficulty (section 3, technique 10).
 *
 *   Per concept, difficulty climbs with mastery: recall, application,
 *   analysis, evaluation. It drops one step after two misses. It never goes
 *   past the top level of the confirmed blueprint.
 *
 * The level is a Bloom level. A concept starts at application (3): pure
 * recall is the flashcards' job. Two right answers at the current level or
 * above, on two different days, move it up one; two misses in a row move it
 * down one, never below 2. Pretest guesses do not count either way.
 *
 * Pure, with the day passed in, tested in app.test.mjs.
 */
export const START = 3
export const FLOOR = 2
export const CEILING = 5

const localDay = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * reviews: one concept's answers, any order ({ created_at, correct, bloom, mode }).
 * cap: the highest Bloom level the real exam asks (blueprint), if known.
 */
export function targetBloom(reviews, { cap = CEILING, dayOf = localDay } = {}) {
  const top = Math.max(FLOOR, Math.min(CEILING, Number(cap) || CEILING))
  let level = Math.min(START, top)
  let wins = new Set()
  let misses = 0
  const sorted = [...(reviews ?? [])].filter((r) => r?.created_at && r.mode !== 'pretest').sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  for (const r of sorted) {
    if (r.correct) {
      misses = 0
      if ((r.bloom ?? 0) >= level) wins.add(dayOf(r.created_at))
      if (wins.size >= 2 && level < top) {
        level += 1
        wins = new Set()
      }
    } else if (r.correct === false) {
      misses += 1
      if (misses >= 2) {
        level = Math.max(FLOOR, level - 1)
        misses = 0
        wins = new Set()
      }
    }
  }
  return level
}

/** Levels for every concept at once, from all of a course's answers. */
export function targetsByConcept(reviews, opts) {
  const by = new Map()
  for (const r of reviews ?? []) {
    if (!r.concept_id) continue
    if (!by.has(r.concept_id)) by.set(r.concept_id, [])
    by.get(r.concept_id).push(r)
  }
  const out = new Map()
  for (const [k, rows] of by) out.set(k, targetBloom(rows, opts))
  return out
}

/** The top Bloom level the exam format allows: a recall-only exam caps at 2. */
export function capFromFormat(format) {
  const f = format ?? {}
  if (Number.isInteger(f.max_bloom)) return f.max_bloom
  const types = f.types ?? []
  if (types.length && types.every((t) => t === 'tf')) return 3
  return CEILING
}
