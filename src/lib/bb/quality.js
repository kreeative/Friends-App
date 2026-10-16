/**
 * The code checks every generated item passes before a student sees it
 * (section 5 of the build prompt), and the small text helpers they need.
 *
 *   - the schema basics;
 *   - anchors that exist in the course's source map (grounding rule 1);
 *   - no near-duplicate stems (normalised);
 *   - four distinct options and a key in range;
 *   - no "Not in your slides" content as a key.
 *
 * Pure, for npm test, and imported by the server (api/_bb) and the app.
 */

export const TYPES = ['mcq', 'tf', 'flash', 'cloze', 'short']

/** Lowercase, no accents, no punctuation, single spaces. */
export function normalise(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'or', 'which', 'what', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'est', 'en', 'que', 'qui', 'quel', 'quelle', 'd', 'l'])

/** Word set without the little words, for comparing stems. */
export function words(text) {
  return new Set(normalise(text).split(' ').filter((w) => w && !STOP.has(w)))
}

/** Jaccard similarity of two stems' word sets, 0 to 1. */
export function similarity(a, b) {
  const A = words(a)
  const B = words(b)
  if (!A.size && !B.size) return 1
  let inter = 0
  for (const w of A) if (B.has(w)) inter += 1
  return inter / (A.size + B.size - inter)
}

export const DUPLICATE_AT = 0.8

export const nearDuplicate = (a, b, at = DUPLICATE_AT) => similarity(a, b) >= at

/**
 * Check one item. `anchors` is the set of anchor ids (or keys) the course
 * has; `existing` the stems already in the bank.
 * Returns { ok, problems: [...codes] }.
 */
export function checkItem(item, { anchors = new Set(), existing = [] } = {}) {
  const problems = []
  if (!item || typeof item !== 'object') return { ok: false, problems: ['not_an_item'] }
  if (!TYPES.includes(item.type)) problems.push('type')
  const stem = String(item.stem ?? '').trim()
  if (stem.length < 8) problems.push('stem_short')
  if (stem.length > 2000) problems.push('stem_long')
  const bloom = Number(item.bloom)
  if (!(bloom >= 1 && bloom <= 6)) problems.push('bloom')

  const ids = Array.isArray(item.anchors) ? item.anchors : []
  if (ids.length === 0) problems.push('no_anchor')
  if (ids.some((a) => !anchors.has(a))) problems.push('unknown_anchor')

  if (item.type === 'mcq' || item.type === 'tf') {
    const opts = Array.isArray(item.options) ? item.options : []
    const want = item.type === 'mcq' ? 4 : 2
    if (opts.length !== want) problems.push('option_count')
    const texts = opts.map((o) => normalise(o?.text))
    if (texts.some((t) => !t)) problems.push('option_empty')
    if (new Set(texts).size !== texts.length) problems.push('option_duplicate')
    const key = Number(item.key)
    if (!Number.isInteger(key) || key < 0 || key >= opts.length) problems.push('key_range')
    else if (opts[key]?.outside) problems.push('key_outside')
    if (opts.some((o) => !String(o?.why ?? '').trim())) problems.push('why_missing')
    if (opts.some((o) => /\b(all|none) of the above\b|\b(toutes|aucune) (les reponses|des reponses) ci dessus\b/i.test(normalise(o?.text)))) problems.push('above')
    for (const o of opts) if (o?.anchor && !anchors.has(o.anchor)) problems.push('unknown_option_anchor')
  } else {
    if (!String(item.answer ?? '').trim()) problems.push('answer_missing')
    if (item.outside) problems.push('key_outside')
  }

  if (existing.some((s) => nearDuplicate(s, stem))) problems.push('duplicate')
  return { ok: problems.length === 0, problems: [...new Set(problems)] }
}

/** The share of items whose anchors all exist: the "95% valid anchors" bar of Phase 1. */
export function anchorValidity(items, anchors) {
  const all = (items ?? []).filter(Boolean)
  if (!all.length) return 1
  const ok = all.filter((i) => (i.anchors ?? []).length > 0 && i.anchors.every((a) => anchors.has(a))).length
  return ok / all.length
}

/**
 * How an anchor reads on a chip: the file's short name and the place.
 * "Cours 7 · slide 6", "Guide · p. 4", "Cours 7 · 14:32".
 */
export function anchorChip(anchor, materialName) {
  const name = String(materialName ?? '')
    .replace(/\.(pdf|pptx?|docx?|txt|vtt|srt|png|jpe?g|heic|webp)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  const short = name.length > 22 ? `${name.slice(0, 21).trimEnd()}…` : name
  const where = String(anchor?.label ?? '').trim()
  return short && where ? `${short} · ${where}` : short || where || '?'
}

/** Loose comparison for a typed flashcard answer: right, close, or wrong. */
export function typedMatch(given, expected) {
  const g = normalise(given)
  const e = normalise(expected)
  if (!g) return 'wrong'
  if (g === e) return 'right'
  const s = similarity(given, expected)
  if (s >= 0.7) return 'right'
  if (s >= 0.4 || (e.length > 3 && (e.includes(g) || g.includes(e)))) return 'close'
  return 'wrong'
}
