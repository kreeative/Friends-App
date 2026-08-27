/**
 * What you actually spent, period by period, so two months can be compared.
 *
 * "Compare tes depenses reelles mois par mois." That sentence has been on a
 * card in this app promising a screen that did not exist. This is the
 * arithmetic behind the screen, kept here as pure functions for the same
 * reason savings.js is: it is the part that can be wrong without looking
 * wrong, so it is the part that gets tested.
 *
 * SPENDING ONLY, NEVER INCOME.
 *
 * The card says depenses. A month where a bonus landed is not a month you
 * spent more in, and netting the two would hide exactly the month worth
 * looking at. Income is in the savings history and in the rank card; it is
 * not in this one.
 *
 * PERIODS, NOT CALENDAR MONTHS.
 *
 * budget_plan.period_start_day is configurable and this app's month is payday
 * to payday everywhere else on the screen. A calendar month here would
 * disagree with the headline, the envelopes and the sweep, and "mois" would
 * mean two different spans on two cards of the same page.
 *
 * THE RUNNING PERIOD IS SHOWN AND NEVER COMPARED.
 *
 * On the sixth of the month you have six days of spending. Setting that
 * against a full previous month produces "down 78 %", which is arithmetically
 * correct, completely meaningless, and the single most likely thing for
 * somebody to screenshot. So the current period carries `closed: false` and
 * gets no delta at all; savings.js refuses to sweep an open period for the
 * same reason.
 *
 * Cents, integers throughout. Every date is an ISO 'YYYY-MM-DD' string rather
 * than a Date, so nothing here can be moved by an hour of timezone.
 */
import { history as periodHistory } from './savings.js'
import { ENVELOPE_CATEGORIES } from './envelope.js'

const day10 = (v) => String(v ?? '').slice(0, 10)

/** How many periods a comparison will look back over, at most. */
export const WINDOW = 12

/**
 * Every period with what was spent in it, newest first, and per category.
 *
 * Built on savings.history so there is exactly one definition of where a
 * period starts in this codebase. Two would drift, and the one that drifted
 * would be the one nobody was looking at.
 */
export function spendHistory({ entries = [], startDay = 1, today = new Date(), limit = WINDOW } = {}) {
  const rows = periodHistory({ entries, startDay, today })

  return rows.slice(0, Math.max(0, limit)).map((p) => {
    const byCategory = {}
    for (const k of ENVELOPE_CATEGORIES) byCategory[k] = 0

    let spent = 0
    for (const e of entries) {
      if (e.excluded || e.kind !== 'expense') continue
      const d = day10(e.happened_on)
      if (!d || d < p.start || d >= p.end) continue
      const cents = Number(e.amount_cents) || 0
      if (cents <= 0) continue
      spent += cents
      /* An unknown or missing category files under `other`, exactly as the
         ledger and the envelopes do. Dropping it instead would make the
         category rows add up to less than the total on the same screen. */
      const key = ENVELOPE_CATEGORIES.includes(e.category) ? e.category : 'other'
      byCategory[key] += cents
    }

    return { key: p.key, start: p.start, end: p.end, closed: p.closed, spent, byCategory }
  })
}

/** What one row of spendHistory spent, for `category` or for everything. */
export function amountIn(row, category = 'all') {
  if (!row) return 0
  return category === 'all' ? row.spent : (row.byCategory?.[category] ?? 0)
}

/**
 * Each period against the one before it.
 *
 * `delta` is cents, `pct` is a whole percent of the older figure, and both are
 * null when there is nothing honest to compare against:
 *
 *   the period is still running          you are comparing part of a month
 *   there is no older period             the oldest row has nothing behind it
 *   the older period is itself open      cannot happen with newest-first rows,
 *                                        but the guard costs nothing
 *   the older period spent nothing       every increase from zero is infinite
 *
 * That last one is the one that matters. A first month with one coffee in it
 * turns the next month into "+4300 %", which says nothing about the spending
 * and everything about the denominator. `delta` still carries the cents, so
 * the screen can say "300,00 $ de plus" where it cannot honestly say a
 * percentage.
 */
export function compareMonths(rows = [], category = 'all') {
  return rows.map((row, i) => {
    const prev = rows[i + 1]
    const now = amountIn(row, category)
    const was = amountIn(prev, category)

    if (!row.closed || !prev || !prev.closed) {
      return { ...row, amount: now, previous: prev ? was : null, delta: null, pct: null }
    }

    const delta = now - was
    const pct = was > 0 ? Math.round((delta / was) * 100) : null
    return { ...row, amount: now, previous: was, delta, pct }
  })
}

/**
 * The biggest figure in a set of rows, for scaling bars against.
 *
 * Zero when everything is zero, and the caller must handle that rather than
 * dividing by it. A bar chart whose rows are all zero should draw no bars, not
 * six full ones.
 */
export function peak(rows = [], category = 'all') {
  return rows.reduce((n, r) => Math.max(n, amountIn(r, category)), 0)
}

/**
 * The mean of the CLOSED periods, which is the only fair thing to average.
 *
 * Including the running period drags the average down by however far through
 * the month you happen to be, so a screen that opened on the 2nd would report
 * a different "typical month" than the same screen on the 28th with no
 * transaction logged in between.
 */
export function typicalMonth(rows = [], category = 'all') {
  const closed = rows.filter((r) => r.closed)
  if (!closed.length) return 0
  return Math.round(closed.reduce((n, r) => n + amountIn(r, category), 0) / closed.length)
}

/**
 * Which categories are worth offering as a filter.
 *
 * Only the ones that have something in them somewhere in the window. A picker
 * with six options where four return an empty chart is a picker that wastes
 * four taps, which is the argument the transaction history already makes about
 * its own category filter.
 */
export function categoriesIn(rows = []) {
  return ENVELOPE_CATEGORIES.filter((k) => rows.some((r) => (r.byCategory?.[k] ?? 0) > 0))
}
