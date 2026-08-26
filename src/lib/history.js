/**
 * The full transaction history: filtered, and grouped into days.
 *
 * Pure, and no imports, so `npm test` runs it under plain node with no
 * bundler and no environment. Nothing here reads the clock: today is passed
 * in. A function that calls Date.now() cannot be tested for what it does on
 * the first of January, which is exactly the day it will be wrong.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE LOG PANE
 *
 * That pane shows `recent`, which is filtered to the CURRENT PERIOD and then
 * cut to twenty rows. Both of those are right for a summary and wrong for a
 * history: "what did I spend in June" is not answerable from it at all. This
 * works on the raw entry list, across periods.
 */

/** Dates as they are stored: 'YYYY-MM-DD', comparable as strings. */
const dayOf = (e) => String(e?.happened_on ?? '').slice(0, 10)

/**
 * Shift an ISO day by a number of days, through local time.
 *
 * Built from the parts rather than by subtracting milliseconds. A day is not
 * always 86400 seconds long: on the days either side of a DST change,
 * arithmetic on the timestamp lands an hour into the wrong date, and the
 * label reads "yesterday" for something that happened today.
 */
export function shiftDay(iso, days) {
  const [y, m, d] = String(iso ?? '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d + days)
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

/**
 * What a day heading should say.
 *
 * Returns a KEY rather than a word, because the words are translated and this
 * file has no access to the dictionary. The caller turns 'today' into
 * "Aujourd'hui" and 'date' into a formatted date.
 */
export function dayHeading(day, todayISO) {
  if (!day) return { key: 'date', day }
  if (day === todayISO) return { key: 'today', day }
  if (day === shiftDay(todayISO, -1)) return { key: 'yesterday', day }
  return { key: 'date', day }
}

export const KINDS = ['all', 'income', 'expense']

/**
 * Narrow the list.
 *
 * `kind` and `category` are independent: filtering to income AND a category
 * would always be empty, because income rows carry no category, so choosing a
 * category implies expenses and says so by returning nothing for income.
 *
 * `query` matches the note and the category, case-insensitively, with accents
 * folded. Somebody looking for "epicerie" should find "Épicerie": requiring
 * the accent means the search only works for people who already know how the
 * row was typed.
 */
const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function filterHistory(entries = [], { kind = 'all', category = 'all', query = '' } = {}) {
  const q = fold(query).trim()
  return (entries ?? []).filter((e) => {
    if (!e) return false
    if (kind !== 'all' && e.kind !== kind) return false
    if (category !== 'all' && (e.category ?? null) !== category) return false
    if (q && !fold(`${e.note ?? ''} ${e.category ?? ''}`).includes(q)) return false
    return true
  })
}

/**
 * Days, newest first, each with its rows newest first.
 *
 * Sorted here rather than trusted from the query. The list arrives ordered by
 * the database, but it is also edited optimistically in the client, and a row
 * appended after an edit would otherwise sit at the bottom of the wrong day.
 *
 * `net` is income less spending for that day, EXCLUDING rows marked excluded,
 * because a day heading that disagreed with the totals elsewhere on the
 * screen would be worse than no heading at all.
 */
export function groupByDay(entries = []) {
  const byDay = new Map()
  for (const e of entries ?? []) {
    const d = dayOf(e)
    if (!d) continue
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d).push(e)
  }

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, rows]) => ({
      day,
      entries: rows.slice().sort((a, b) => {
        /* Same day, so order by when the row was created, newest first, and
           fall back to the id so the order is at least stable. */
        const ta = String(a.created_at ?? '')
        const tb = String(b.created_at ?? '')
        if (ta !== tb) return ta < tb ? 1 : -1
        return String(b.id ?? '').localeCompare(String(a.id ?? ''))
      }),
      net: rows.reduce((n, e) => {
        if (e.excluded) return n
        const amt = e.amount_cents ?? 0
        return e.kind === 'income' ? n + amt : n - amt
      }, 0),
    }))
}

/** Every category present in the list, so the filter offers only real ones. */
export function categoriesIn(entries = []) {
  const seen = new Set()
  for (const e of entries ?? []) {
    if (e?.kind === 'expense' && e.category) seen.add(e.category)
  }
  return [...seen].sort()
}

/** How many rows a filter would show, for the empty state to be specific. */
export function countHistory(entries = [], filters) {
  return filterHistory(entries, filters).length
}
