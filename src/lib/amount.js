/**
 * How big a money figure is allowed to be printed.
 *
 * WHY A FUNCTION AND NOT `truncate`.
 *
 * "$22,222,000.00" in text-hero is 14 characters at 3.5rem, which is about
 * 430px of type inside a card 342px wide on a 390px phone. It does not wrap,
 * because a formatted amount has no space to break at, so it spills past the
 * card's edge.
 *
 * Truncating it would be worse than spilling. "$22,222,00…" is a DIFFERENT
 * AMOUNT, off by a factor of a hundred, and a reader has no way to know the
 * end was cut rather than the number being that size. An amount is the one
 * string in this app that must never be shortened; it can only be set smaller.
 *
 * So the size steps down as the string grows, and the whole figure always
 * fits. The steps are the app's own scale rather than arbitrary pixel values,
 * so a shrunk hero still lands on a size the rest of the page uses.
 *
 * WHY CHARACTER COUNT AND NOT A MEASUREMENT.
 *
 * Measuring the painted width needs a layout pass, a ref and a resize
 * observer, and it reflows the number after paint, which is visible. The digits
 * are tabular here (every money surface sets font-variant-numeric), so a
 * character is a fixed width and counting them predicts the painted width
 * exactly. The thresholds below were read off the painted result at 390px, the
 * narrowest phone this app supports.
 *
 * Pure and importless, so `npm test` runs it under plain node.
 */

/** The scale, widest first. Each step is a real size from tailwind.config.js. */
const HERO_STEPS = [
  { max: 9, cls: 'text-hero' },     /* $1,234.56   */
  { max: 12, cls: 'text-metric' },  /* $123,456.78 */
  { max: 15, cls: 'text-h1' },      /* $22,222,000.00 */
  { max: Infinity, cls: 'text-h2' },
]

const H2_STEPS = [
  { max: 12, cls: 'text-h2' },
  { max: 16, cls: 'text-body' },
  { max: Infinity, cls: 'text-small' },
]

/**
 * The class for a figure printed at hero size.
 *
 * Counts what is actually painted, so the currency mark, the separators and
 * the decimals all count: "1000" and "$1,000.00" are four characters and nine,
 * and only one of them is the string on screen.
 */
export function heroClass(text) {
  const n = String(text ?? '').length
  return HERO_STEPS.find((s) => n <= s.max).cls
}

/** The same, for the smaller figures on a project card. */
export function cardClass(text) {
  const n = String(text ?? '').length
  return H2_STEPS.find((s) => n <= s.max).cls
}
