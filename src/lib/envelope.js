/**
 * Zero-based allocation: giving every dollar that arrived a job.
 *
 * The screen has answered "how much can I spend today" by dividing what is
 * free by the days remaining. That is an allowance, and an allowance answers a
 * question about pace. It cannot answer the question this file exists for:
 * which of the things I meant to pay for have I already spent, and which have I
 * not.
 *
 * So money that arrives lands in one pool, and the pool is handed out across
 * the six categories until nothing is left unassigned. After that every spend
 * is measured against the envelope it came out of rather than against the month
 * as a whole, which is the difference between "I have 400 left" and "I have 400
 * left and 380 of it is next week's rent".
 *
 * WHAT ALLOCATION IS MEASURED AGAINST, AND WHY IT IS THE SIX CATEGORIES.
 *
 * Because that is what spending is filed under. A transaction carries a
 * category, so spent-against-allocated is arithmetic; a transaction carries no
 * link to a named fixed charge, so an envelope called "Téléphone" could be
 * given money and could never be shown as spent. Envelopes have to be the thing
 * the ledger already knows about or the bars are decoration.
 *
 * EVERYTHING HERE IS ABOUT REAL MONEY.
 *
 * The pool is what has been LOGGED as income this period, not what the setup
 * form estimates. Migration 35 and the work around it separated those two for
 * exactly this reason, and this builds on that side of the line: an envelope
 * funded by an estimate is a promise, not a budget.
 *
 * Pure and importless, so every case below is tested under plain node.
 */

/** The six, in the order they are drawn. Kept in step with budget.js. */
export const ENVELOPE_CATEGORIES = ['food', 'transport', 'home', 'fun', 'health', 'other']

const cents = (v) => {
  const n = Math.trunc(Number(v) || 0)
  return Number.isFinite(n) ? n : 0
}

/** A date column compared as a calendar date rather than as an instant. */
const dateKey = (value) => (value ? String(value).slice(0, 10) : null)

/**
 * The allocations for one period, as a plain object keyed by category.
 *
 * Rows for other periods are dropped rather than summed. An envelope is a
 * statement about one month, and carrying August's rent allocation into
 * September would fund it twice from money that arrived once.
 *
 * Negative and unknown categories are dropped on the way in. The column has a
 * check constraint, so neither should exist, and a render is the wrong place to
 * discover that it does.
 */
export function allocationsFor(rows, periodStart) {
  const list = Array.isArray(rows) ? rows : []
  const want = dateKey(periodStart)
  const out = {}
  for (const key of ENVELOPE_CATEGORIES) out[key] = 0

  for (const row of list) {
    if (!row || !ENVELOPE_CATEGORIES.includes(row.category)) continue
    if (want && dateKey(row.period_start) !== want) continue
    const n = cents(row.amount_cents)
    if (n > 0) out[row.category] = n
  }
  return out
}

/**
 * What every envelope holds, added up.
 *
 * Null-guarded rather than relying on the default parameter, which only fires
 * for `undefined`. `totalAllocated(null)` threw, and null is exactly what a
 * fetch that has not landed yet hands to a render.
 */
export function totalAllocated(allocations) {
  const a = allocations ?? {}
  return ENVELOPE_CATEGORIES.reduce((sum, key) => sum + cents(a[key]), 0)
}

/**
 * One envelope: what went in, what has come out, and what that leaves.
 *
 * `over` is a separate number from `remaining` rather than remaining being
 * allowed to go negative, because the two are different sentences on the card:
 * "50 $ restant" and "46 $ de plus". Deriving one from the sign of the other
 * would work and would put a minus sign in front of a number the label already
 * says is an excess.
 *
 * `pct` is capped at 100 so the bar cannot draw past its own track, and the
 * overspend is carried by colour and by the words instead. A bar that renders
 * at 140% is a bar that has stopped being a bar.
 */
export function envelopeFor(input) {
  const { allocated = 0, spent = 0 } = input ?? {}
  const a = Math.max(0, cents(allocated))
  const s = Math.max(0, cents(spent))
  const over = Math.max(0, s - a)

  return {
    allocated: a,
    spent: s,
    remaining: Math.max(0, a - s),
    over,
    /* Nothing allocated and nothing spent is an empty bar, not a full one.
       0/0 is the case that makes a naive ratio render as NaN or as 100%. */
    pct: a > 0 ? Math.min(100, Math.round((s / a) * 100)) : s > 0 ? 100 : 0,
    /* Funded at all. An envelope nobody has put anything in is not "0% spent",
       it is not in use, and the card says so rather than drawing a bar. */
    funded: a > 0,
  }
}

/**
 * Every envelope, in drawing order.
 *
 * `spentByCategory` is passed in rather than computed from entries here,
 * because summarise already walks the period once and building the same map a
 * second time is one more place for the two to disagree about what counts.
 * Anything not in the six lands in `other`, matching how the breakdown on the
 * money screen already files an unrecognised category.
 */
export function envelopes(input) {
  const { allocations, spentByCategory } = input ?? {}
  const a = allocations ?? {}
  const s = spentByCategory ?? {}
  return ENVELOPE_CATEGORIES.map((key) => ({
    key,
    ...envelopeFor({ allocated: a[key], spent: s[key] }),
  }))
}

/**
 * The pool at the top: money that has arrived and has not been given a job.
 *
 * Can go NEGATIVE, and that is the point rather than a case to clamp away.
 * Allocating more than arrived is the mistake zero-based budgeting exists to
 * surface, and a pool that stops at zero hides it: somebody would hand out
 * three thousand dollars against two thousand of income and the screen would
 * say they were finished.
 */
export function toAllocate(input) {
  const { earned = 0, allocations } = input ?? {}
  return cents(earned) - totalAllocated(allocations)
}

/**
 * The headline bar: what is left of real income after real spending.
 *
 * Deliberately NOT income minus allocations. Allocating is a plan for money you
 * still have; the question this bar answers is how much is still there, and a
 * dollar sitting in the rent envelope is still in your account until the rent
 * goes out.
 *
 * `pct` is how much of the income has been spent, so the bar fills as the month
 * runs down. Capped at 100 for the same reason as an envelope's.
 */
export function spendable(input) {
  const { earned = 0, spent = 0 } = input ?? {}
  const e = Math.max(0, cents(earned))
  const s = Math.max(0, cents(spent))
  return {
    earned: e,
    spent: s,
    left: e - s,
    over: Math.max(0, s - e),
    pct: e > 0 ? Math.min(100, Math.round((s / e) * 100)) : s > 0 ? 100 : 0,
    /* Nothing has come in yet. The bar is drawn empty and the card says why,
       rather than showing a full red bar at the sight of the first coffee. */
    funded: e > 0,
  }
}
