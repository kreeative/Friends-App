/**
 * A date as a stat, not as a sentence.
 *
 * "17 mai 2026" set beside "7" and "5" reads as a caption that wandered into a
 * row of figures. The two numbers next to it are one glyph tall and bold; the
 * date was lowercase, at less than half their size, and long enough to wrap
 * onto two lines inside a 111px card. Three tiles, one of which looked like a
 * different component.
 *
 * WHAT toUpperCase() ALONE DOES NOT FIX.
 *
 * Intl's short months are not the same shape in the two languages this app
 * speaks, and the differences are exactly the ones that break a row of equal
 * tiles:
 *
 *   fr-FR   janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc.
 *   en-GB   Jan   Feb   Mar  Apr  May Jun  Jul   Aug  Sept  Oct  Nov  Dec
 *
 * Eight of the twelve French months carry a trailing full stop, which
 * uppercases into "JANV." and puts a piece of punctuation in the middle of a
 * row of numbers. English has no stops but makes September four letters while
 * every other month is three.
 *
 * Both are normalised here: the stop goes and the month is capped, so the
 * widest month in either language is four characters and the tile can be sized
 * for a width it will never exceed. That is the whole point of doing this in a
 * function rather than with a CSS text-transform, which would have left the
 * full stops in place.
 *
 * Pure, so every month in both languages is tested without a browser.
 */

/**
 * How many letters of the month survive.
 *
 * FOUR, NOT THREE, AND THREE IS A BUG I WROTE FIRST.
 *
 * Three is the instinct and it is right for English. In French it collides:
 * `juin` cut to three is JUI and `juil.` cut to three is also JUI, so a goal
 * begun in June and one begun in July would report the same month. The
 * conventional French abbreviations keep four letters for exactly this reason.
 *
 * At four, both languages come out unambiguous and no wider than SEPT, which
 * English already produces on its own. The test walks all twelve months in
 * both languages and asserts they are distinct, which is the assertion that
 * would have caught this.
 */
export const MONTH_LETTERS = 4

/**
 * A date column read as a calendar date rather than as an instant.
 *
 * The T00:00:00 is load-bearing. `new Date('2026-05-17')` parses as UTC
 * midnight, which is the 16th at seven in the evening in Montréal, so a goal
 * started on the 17th would report having started on the 16th for everybody
 * west of Greenwich. Adding the time makes it parse in local time instead.
 */
function localDate(value) {
  const day = String(value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = new Date(`${day}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The month, capped, capitals, no full stop.
 *
 * Uppercased before slicing rather than after, because it is not universally
 * true that a character's uppercase form is one character: it holds for both
 * languages here, and doing it in this order means it would keep holding for a
 * third that arrived later.
 */
function monthCaps(date, tag) {
  const raw = new Intl.DateTimeFormat(tag, { month: 'short' }).format(date)
  return raw.toUpperCase().replace(/\./g, '').slice(0, MONTH_LETTERS)
}

/**
 * "17 MAI", or "17 MAI 2025" when the year is not this one.
 *
 * THE YEAR IS DROPPED WHEN IT IS THE CURRENT ONE, and that is the difference
 * between fitting and not. The tile is about 87px of text at 390px wide; "17
 * MAI 2026" at the size the neighbouring figures use does not go in, and the
 * request that started this was that it should stop wrapping. A year nobody
 * needs is the part worth losing: somebody reading "started 17 MAY" on a goal
 * they are looking at today does not need telling which year today is in.
 *
 * It comes back the moment it carries information. A goal begun last year says
 * so, because "17 MAI" on its own would then be a lie by omission.
 *
 * Day first in both languages: en-GB, which this app already uses as its
 * English tag, puts the day first, so the two locales agree without either
 * being forced into the other's order.
 *
 * THE TWO SPACES ARE DIFFERENT CHARACTERS, AND THAT IS THE LAYOUT.
 *
 * Between the day and the month is U+00A0, a non-breaking space, so "17 SEPT"
 * can never be split across two lines. Before the year is an ordinary space,
 * so that is exactly where the string breaks when it has to.
 *
 * It has to more often than you would guess. The tile is three-across and
 * about 95px of text on a 390px screen; measured in Poppins at the weight this
 * is set in, "17 SEPT 2025" is 145px at 18px and 113px even at 14px. No
 * readable size puts a date with a year on one line in a third of a phone. So
 * the year gets its own line on purpose, which reads as a deliberate second
 * line rather than as a month hyphenated in half, and the day and month above
 * it stay together whatever happens.
 */
export function dateCaps(value, tag = 'en-GB', today = new Date()) {
  const d = localDate(value)
  if (!d) return null

  const day = new Intl.DateTimeFormat(tag, { day: 'numeric' }).format(d)
  const month = monthCaps(d, tag)
  const sameYear = d.getFullYear() === today.getFullYear()

  return sameYear ? `${day}\u00a0${month}` : `${day}\u00a0${month} ${d.getFullYear()}`
}

/**
 * The whole date, spelled out, for the tooltip and the accessible name.
 *
 * The tile shows an abbreviation because it has 87px; anybody who wants the
 * unabbreviated date should be able to get it without leaving the screen, and
 * a screen reader should never be made to say "MAI" as if it were an acronym.
 */
export function dateFull(value, tag = 'en-GB') {
  const d = localDate(value)
  if (!d) return null
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
