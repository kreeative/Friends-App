/**
 * The shape of a month, as a grid.
 *
 * Pure and importless, like budget.js and txn.js, so `npm test` can run it
 * under plain node. Calendar arithmetic is the kind of thing that looks
 * obviously right and is wrong twice a year, and none of it is worth
 * discovering from a screenshot.
 *
 * EVERY DATE HERE IS A LOCAL DATE.
 *
 * Constructed with `new Date(year, month, day)` and stepped by changing the day
 * component, never by adding 86400000 to a timestamp. Adding a fixed number of
 * milliseconds is wrong on the two days a year a clock shifts: it lands at
 * 23:00 the previous day or 01:00 the next, and a calendar built that way
 * repeats or skips a date depending on which way the shift went. The Date
 * constructor normalises day 0 and day 32 into the neighbouring month
 * correctly, and it does it in the person's own timezone, which is the only
 * timezone a calendar means anything in.
 *
 * WEEKS START ON SUNDAY.
 *
 * Matching weekOf in time.js, which matches DAYS, which matches how groups
 * store checkin_dow. One convention across the app, so a Wednesday is column
 * four everywhere and no screen has to say which end it counts from.
 */

/** Seven days a week, six weeks a grid. See ROWS. */
export const COLS = 7

/**
 * Always six rows, never five.
 *
 * A month needs six rows when it starts late enough in the week: a 31 day
 * month beginning on a Friday spans six. Most months need five, and a grid
 * that renders five rows in June and six in August changes height when you
 * page between them, which on a card that expands and collapses means the
 * expansion lands somewhere different depending on the month. A fixed six is
 * one trailing row of greyed-out dates in exchange for a calendar that does
 * not move under the reader.
 */
export const ROWS = 6

/** Local midnight, so day arithmetic below is exact. */
function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** A local calendar day as YYYY-MM-DD. The same key dayKey() in time.js makes. */
export function key(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The first of the month `on` falls in. */
export function monthStart(on = new Date()) {
  return new Date(on.getFullYear(), on.getMonth(), 1)
}

/** `n` months from `on`, at the first. Negative goes back. */
export function addMonths(on, n) {
  return new Date(on.getFullYear(), on.getMonth() + n, 1)
}

/** Do these two land in the same month of the same year? */
export function sameMonth(a, b) {
  return Boolean(a && b) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * The 42 cells of a month, Sunday first, oldest first.
 *
 * Starts on the Sunday on or before the 1st, so the leading cells are the tail
 * of the previous month and the trailing cells are the head of the next. They
 * are real dates rather than blanks: a calendar with holes at both ends is
 * harder to read than one that shows the neighbouring days greyed, and the
 * caller can ask sameMonth() which is which.
 */
export function monthGrid(on = new Date()) {
  const first = monthStart(on)
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())

  return Array.from(
    { length: ROWS * COLS },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  )
}

/** The same 42 cells, split into six rows of seven. */
export function monthRows(on = new Date()) {
  const flat = monthGrid(on)
  return Array.from({ length: ROWS }, (_, r) => flat.slice(r * COLS, r * COLS + COLS))
}

/**
 * Which row of this month's grid a given day sits in, or -1 if it is not in it.
 *
 * This is what lets the calendar collapse to a single week without keeping a
 * separate week track: the grid stays rendered and the container clips to one
 * row, translated to the row the selected day is in.
 *
 * Compared on the key rather than on the Date, because two Date objects for
 * the same day are never `===` and comparing timestamps means remembering to
 * strip the clock from both sides every time.
 */
export function rowOfDay(on, day) {
  if (!day) return -1
  const want = key(midnight(day))
  const flat = monthGrid(on)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (key(flat[r * COLS + c]) === want) return r
    }
  }
  return -1
}

/**
 * The months the calendar can page through, oldest first.
 *
 * Bounded rather than open ended: rendering every month since the account
 * opened would grow the track forever on exactly the accounts that use the app
 * most, and each month is 42 buttons.
 *
 * One month forward, not none. A track that refuses to move in one direction
 * reads as broken, and next month is a real answer: those are the days you
 * have coming.
 */
export const MONTHS_BACK = 11
export const MONTHS_FORWARD = 1

export function monthsAround(on = new Date(), back = MONTHS_BACK, forward = MONTHS_FORWARD) {
  const first = monthStart(on)
  return Array.from({ length: back + 1 + forward }, (_, i) => addMonths(first, i - back))
}

/** Where today sits in the list monthsAround returns. */
export const CURRENT_MONTH = MONTHS_BACK

/**
 * The first and last day the calendar can show, for one read covering all of it.
 *
 * The strip used to fetch eight weeks. A calendar that pages a year back needs
 * a wider net, and it has to be one net: a fetch per swipe means an empty grid
 * for a moment every time somebody flicks back through a month, which is the
 * gesture the whole control exists for.
 */
export function calendarRange(months) {
  const list = months?.length ? months : monthsAround()
  const flat = monthGrid(list[0])
  const tail = monthGrid(list[list.length - 1])
  return { from: flat[0], to: tail[tail.length - 1] }
}
