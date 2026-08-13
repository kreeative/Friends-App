/**
 * The pure half of the journal: what an entry is, and how it previews.
 *
 * Separate from journal.js because that file imports the Supabase client and
 * therefore cannot be run by node, and these are exactly the rules worth
 * having a test for. Same split as completion.js against the pages that use
 * it.
 */

/**
 * How much of an entry a grid card shows.
 *
 * WHY THIS IS NOT line-clamp.
 *
 * It was, and the cards read "…la marche du matin… / avant que". Tailwind's
 * line-clamp is `display:-webkit-box` plus `-webkit-line-clamp`, and inside
 * these cards Chromium blockified the paragraph to `flow-root`: it still drew
 * the ellipsis on the fifth line and then painted a sixth one underneath it,
 * half cut off by the card. Nudging the height or the padding would have made
 * the cards that exist look right and broken again at another font size.
 *
 * A character budget cannot do that. It is the same on every engine, it can be
 * tested without a browser, and it also fixes something line-clamp never
 * could: an entry written with blank lines between paragraphs rendered a card
 * that was mostly empty space, because the newlines were real. Here the
 * whitespace collapses, so the preview is a hundred and twenty characters of
 * writing rather than a hundred and twenty characters of layout.
 *
 * THE BUDGET IS SET BY THE NARROWEST CARD, ON PURPOSE.
 *
 * Two cards wide on a 390px phone leaves each preview about 115px of text at
 * 14px, which is roughly twelve characters a line and six lines in the square.
 * Seventy characters fills that and no more. A three-column desktop card fits
 * nearly twice as much and therefore looks a little airy, which is the right
 * way round to be wrong: an underfilled card is a polaroid, an overfilled one
 * is a bug.
 */
export const SNIPPET_MAX = 70

/**
 * The first line or so of an entry.
 *
 * Broken at a word rather than mid-word when there is a space to break at
 * near the end, because "reconnaissa…" reads as a rendering fault and
 * "reconnaissante…" reads as a preview. If the last word is long enough that
 * cutting at it would lose a quarter of the budget, it takes the hard cut
 * instead: one unbroken 40-character string must not shrink the card's text
 * to nothing.
 */
export function snippet(body, max = SNIPPET_MAX) {
  const clean = String(body ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean

  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const at = space > max * 0.75 ? space : max
  return `${clean.slice(0, at).trimEnd()}…`
}

/**
 * Did the preview lose anything?
 *
 * Drives the fade at the bottom of a card. Only entries that genuinely
 * continue get it: an entry that happens to fill the square exactly is
 * complete, and fading its last line would tell the reader there is more to
 * come when there is not.
 */
export function wasTrimmed(body, max = SNIPPET_MAX) {
  return String(body ?? '').replace(/\s+/g, ' ').trim().length > max
}

/** Is there anything drawn? Mirrors isBlank in ink.js without importing it. */
function drawn(ink) {
  return Boolean(ink && Array.isArray(ink.strokes) && ink.strokes.length > 0)
}

/** Would this save as an entry at all, or is the form still empty? */
export function isEmptyEntry({ body, ink } = {}) {
  return !String(body ?? '').trim() && !drawn(ink)
}

/**
 * Which of the two an entry is.
 *
 * `mode` is the tab somebody was last on, and it only decides between the two
 * when both halves have something in them. A page that was drawn and given a
 * typed title is handwriting with a title; one that was typed and never drawn
 * on is writing whatever tab is showing when Save is pressed.
 *
 * The grid uses this to choose between a thumbnail and a snippet, which is the
 * only thing it changes: both columns are stored either way, so switching tabs
 * never throws the other one away.
 */
export function entryKind({ body, ink, mode = 'text' } = {}) {
  const hasText = Boolean(String(body ?? '').trim())
  if (!drawn(ink)) return 'text'
  if (!hasText) return 'ink'
  return mode === 'ink' ? 'ink' : 'text'
}

/** Has this entry been changed since it was written? Drives the "edited" note. */
export function wasEdited(entry) {
  if (!entry?.created_at || !entry?.updated_at) return false
  /* Second resolution. The insert trigger and the row's own default run
     microseconds apart, so an exact string comparison called every fresh entry
     edited. */
  return Math.abs(new Date(entry.updated_at) - new Date(entry.created_at)) > 1000
}
