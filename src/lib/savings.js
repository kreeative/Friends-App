/**
 * What is left at the end of a month, and where it goes.
 *
 * "Avec le surplus, c'est a dire l'argent qui te reste apres avoir fait les
 * depenses, va dans l'epargne." That is one sentence and three decisions, and
 * the decisions are the part worth being certain about, so they live here as
 * pure functions rather than inside a component.
 *
 * WHAT COUNTS AS A SURPLUS.
 *
 * Logged income minus logged spending, over one closed period, floored at zero.
 * Nothing else.
 *
 * Two richer definitions were considered and both were rejected for the same
 * reason: they guess. Using the plan's monthly income when no pay was logged
 * would credit somebody with money that may never have arrived. Subtracting
 * fixed charges on top would double-count every charge that was also logged as
 * a transaction, which is most of them. A surplus is a claim that real money
 * is spare, and a claim like that has to be built out of rows somebody actually
 * entered or it should not be made at all. When no income was logged for a
 * month, the answer here is zero and the screen says why.
 *
 * WHY ONLY CLOSED PERIODS CAN BE SWEPT.
 *
 * A month still running has no surplus, it has a balance, and the difference
 * matters: moving it to savings on the 12th is moving money you are still going
 * to need on the 20th. The current period is shown, always, and it is not
 * offered.
 *
 * Everything is in cents, integers throughout, and every date is an ISO
 * 'YYYY-MM-DD' string rather than a Date, so nothing here can be shifted by an
 * hour of timezone.
 */
/* With the extension, unlike most imports in this tree. Vite resolves either
   way; the test runner is plain Node, which does not, and the period arithmetic
   is far too easy to get wrong to be worth duplicating here to avoid it. */
import { periodBounds } from './budget.js'

const p2 = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const day10 = (v) => String(v ?? '').slice(0, 10)

/** ISO strings compare correctly as strings, which is the whole reason for them. */
const inRange = (v, start, end) => {
  const d = day10(v)
  return Boolean(d) && d >= start && d < end
}

const sum = (rows) => rows.reduce((n, r) => n + (Number(r.amount_cents) || 0), 0)

/**
 * Every period from the first thing that ever happened up to the current one.
 *
 * Bounded at 600 iterations. The loop's exit depends on date arithmetic and on
 * `entries` that come from the network, and a single row with a year of 1970 or
 * 9999 would otherwise spin the main thread forever. Fifty years of months is
 * more history than this app can have and the cap costs nothing.
 */
export function periodsFrom({ entries = [], startDay = 1, today = new Date() }) {
  const d = Math.min(Math.max(Math.trunc(startDay) || 1, 1), 28)
  const now = periodBounds(today, d)
  const todayISO = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const first = entries
    .map((e) => day10(e.happened_on))
    .filter(Boolean)
    .sort()[0]

  let cursor = now.start
  if (first) {
    const [y, m, dd] = first.split('-').map(Number)
    if (y && m && dd) cursor = periodBounds(new Date(y, m - 1, dd), d).start
  }

  const out = []
  for (let i = 0; i < 600; i++) {
    if (iso(cursor) > iso(now.start)) break
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, d)
    out.push({ key: iso(cursor), start: iso(cursor), end: iso(end), closed: iso(end) <= todayISO })
    cursor = end
  }
  return out
}

/** Earned, spent and what that leaves, for one period. */
export function periodResult({ entries = [], start, end }) {
  const rows = entries.filter((e) => !e.excluded && inRange(e.happened_on, start, end))
  const earned = sum(rows.filter((e) => e.kind === 'income'))
  const spent = sum(rows.filter((e) => e.kind === 'expense'))
  return { earned, spent, surplus: Math.max(0, earned - spent) }
}

/**
 * Every period with its result, newest first.
 *
 * Newest first because that is the order somebody reads their own history in,
 * and because the row most likely to be acted on is the one that just closed.
 */
export function history({ entries = [], startDay = 1, today = new Date() }) {
  return periodsFrom({ entries, startDay, today })
    .map((p) => ({ ...p, ...periodResult({ entries, start: p.start, end: p.end }) }))
    .reverse()
}

/** The periods already swept, so nothing is offered twice. */
export function sweptKeys(savings = []) {
  return new Set(
    savings.filter((s) => s.source === 'surplus').map((s) => day10(s.period_start)).filter(Boolean),
  )
}

/**
 * What can be moved to savings right now.
 *
 * Closed, with something in it, and not already swept. Oldest first: if three
 * months went by without anybody opening the app, the honest order to clear
 * them in is the order they happened.
 */
export function pendingSweeps({ history: rows = [], savings = [] }) {
  const done = sweptKeys(savings)
  return rows
    .filter((r) => r.closed && r.surplus > 0 && !done.has(r.key))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
}

/** Everything ever put aside. */
export function savedTotal(savings = []) {
  return sum(savings)
}

/** Put aside in one period. */
export function savedIn(savings = [], start, end) {
  return sum(savings.filter((s) => inRange(s.happened_on, start, end)))
}

const median = (nums) => {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/**
 * Three months of the way you actually live.
 *
 * The median of closed months rather than the mean, because one move, one
 * flight or one dental bill drags a mean far enough to make the target useless,
 * and the whole point of the number is that it should be reachable.
 *
 * Two closed months is the minimum. Below that there is no distribution to take
 * a middle of, so it falls back to what the plan says a month costs, which is an
 * estimate and is treated as one by the screen that shows it.
 */
export function cushionTarget({ history: rows = [], months = 3, fallbackMonthly = 0 }) {
  const closed = rows.filter((r) => r.closed && r.spent > 0).map((r) => r.spent)
  const monthly = closed.length >= 2 ? median(closed) : Math.max(0, fallbackMonthly)
  return { monthly, target: monthly * months, months, measured: closed.length >= 2 }
}

/**
 * How much of what came in was kept, as a percentage.
 *
 * Null rather than zero when nothing came in. Zero is an answer, and "we do not
 * know" is not zero: showing 0 % to somebody who has simply never logged a
 * paycheque tells them they saved nothing, which is a different and possibly
 * false statement. Everything downstream has to handle the null, which is the
 * point.
 */
export function savingsRate({ saved = 0, earned = 0 }) {
  if (!(earned > 0)) return null
  return (saved / earned) * 100
}

/**
 * The rate over the last N closed months, which is what a comparison wants.
 *
 * A lifetime rate is dominated by whatever was happening a year ago. Twelve
 * months is the window the published national figures use, so this matches it
 * rather than inventing its own.
 */
export function recentRate({ history: rows = [], savings = [], months = 12 }) {
  const closed = rows.filter((r) => r.closed).slice(0, months)
  if (!closed.length) return { rate: null, earned: 0, saved: 0, months: 0 }
  const earned = closed.reduce((n, r) => n + r.earned, 0)
  const saved = closed.reduce((n, r) => n + savedIn(savings, r.start, r.end), 0)
  return { rate: savingsRate({ saved, earned }), earned, saved, months: closed.length }
}
