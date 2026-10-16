/**
 * How the coach cites the course (section 7, citations).
 *
 * Each excerpt in the coach's context carries a short id: the first eight hex
 * digits of its uuid, "[3f9c1d2a]". The model writes that id after a claim;
 * the app turns each id that belongs to the course into a chip. Eight digits
 * rather than six: with six, two excerpts of a 500-excerpt course share an
 * id about once in 130 courses, and a chip would open the wrong slide. With
 * eight it is about once in 34,000.
 *
 * Shared by the server (api/_bb/coach.js, which writes the ids into the
 * context) and the app (src/bb/pages/Coach.jsx, which reads them back), so
 * the two cannot disagree on the format. Pure.
 */
export const SHORT = 8

export const shortId = (uuid) => String(uuid ?? '').replace(/-/g, '').slice(0, SHORT).toLowerCase()

const ONE = new RegExp(`^\\[([0-9a-f]{${SHORT}})\\]$`)
const ANY = () => new RegExp(`\\[([0-9a-f]{${SHORT}})\\]`, 'g')

/** Is this piece of text exactly one citation? Returns the short id or null. */
export function citeOf(part) {
  const m = String(part).match(ONE)
  return m ? m[1] : null
}

/** The text cut around citations and **bold**, for rendering. */
export function splitRich(line) {
  return String(line).split(new RegExp(`(\\[[0-9a-f]{${SHORT}}\\]|\\*\\*[^*]+\\*\\*)`, 'g')).filter((p) => p !== '')
}

/** The anchors a text cites, in order, once each, known ones only. */
export function citedIds(text, byShort) {
  const out = []
  for (const m of String(text ?? '').matchAll(ANY())) {
    const id = byShort.get(m[1])?.id
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

export const hasCites = (text) => ANY().test(String(text ?? ''))

/** The text without its citations, for a flashcard. */
export const stripCites = (text) => String(text ?? '').replace(new RegExp(`\\s*\\[[0-9a-f]{${SHORT}}\\]`, 'g'), '').trim()

/**
 * The map from short id to anchor. When two anchors share a short id the
 * first one wins on both sides (the server lists anchors in the same order
 * and skips the later one), so a chip never opens a different excerpt from
 * the one the model was shown.
 */
export function shortMap(anchors) {
  const map = new Map()
  for (const a of anchors ?? []) {
    const k = shortId(a.id)
    if (!map.has(k)) map.set(k, a)
  }
  return map
}
