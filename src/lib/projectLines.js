/**
 * What a shared project still has to pay.
 *
 * A LINE is a plan: "Airbnb, 800 $". An ENTRY is a fact: "Kee paid 400 $".
 * Entries can point at a line, and the gap between the two is what this file
 * computes. Pure, importless and in integer cents, for the same reason
 * project.js is: binary floating point cannot hold 0.10.
 *
 * NOTHING HERE TOUCHES WHO OWES WHOM.
 *
 * That arithmetic lives in project.js and reads entries only. A line is a
 * to-do, so a line being wrong makes the list wrong and cannot make anybody's
 * balance wrong. Keeping the two files apart is what guarantees it: this one
 * never computes a share and that one never reads a line.
 */

/** What has been put down against one line, in cents. */
export function paidOnLine(lineId, entries = []) {
  if (!lineId) return 0
  return (entries ?? []).reduce(
    (n, e) => (e?.line_id === lineId ? n + (e.amount_cents ?? 0) : n),
    0,
  )
}

/**
 * Where one line stands.
 *
 * `left` never goes below zero, because a line that was overpaid does not owe
 * negative money; the overshoot is reported separately as `over` so the screen
 * can say so rather than showing a bar that has run backwards.
 *
 * `settled` is paid >= total rather than paid === total. A bill that came in
 * at 810 against a plan of 800 is settled, and calling it unpaid because it
 * missed the number exactly would leave a Payer button on something nobody
 * owes anything on.
 */
export function lineState(line, entries = []) {
  const total = Math.max(0, line?.amount_cents ?? 0)
  const paid = paidOnLine(line?.id, entries)
  const left = Math.max(0, total - paid)
  return {
    total,
    paid,
    left,
    over: Math.max(0, paid - total),
    /* Null when there is nothing to be a percentage OF. A bar that reads full
       because the plan says zero is worse than no bar. Same rule as
       projectProgress. */
    pct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : null,
    settled: total > 0 && paid >= total,
    started: paid > 0,
  }
}

/**
 * The list, in the order it is useful in.
 *
 * Unsettled first, because the list exists to be worked through. Settled lines
 * stay rather than disappearing: "did we already pay the deposit" is a
 * question people ask, and a list that answers it only by omission answers it
 * badly.
 *
 * Within each half, oldest first, and id breaks the tie so two lines added in
 * the same second do not swap places between renders.
 */
export function sortLines(lines = [], entries = []) {
  return [...(lines ?? [])]
    .map((line) => ({ line, state: lineState(line, entries) }))
    .sort((a, z) => {
      if (a.state.settled !== z.state.settled) return a.state.settled ? 1 : -1
      const t = String(a.line.created_at ?? '').localeCompare(String(z.line.created_at ?? ''))
      return t || String(a.line.id).localeCompare(String(z.line.id))
    })
}

/** What the plan adds up to, whether or not any of it has been paid. */
export function plannedTotal(lines = []) {
  return (lines ?? []).reduce((n, l) => n + Math.max(0, l?.amount_cents ?? 0), 0)
}

/** What is still owed across the whole plan. */
export function plannedLeft(lines = [], entries = []) {
  return (lines ?? []).reduce((n, l) => n + lineState(l, entries).left, 0)
}

/** How many lines are still waiting on somebody. */
export function openCount(lines = [], entries = []) {
  return (lines ?? []).filter((l) => !lineState(l, entries).settled).length
}

/**
 * The two amounts the Payer sheet offers as one tap.
 *
 * "Le full montant, half etc." Both are computed off what is LEFT, not off the
 * line total, and that is the whole subtlety. After one person covers half of
 * an 800, the next person's "tout" has to mean the remaining 400. Reading
 * "half" as half the total instead would offer them 400 as the half and 800 as
 * the whole, and the second of those overpays the line by 400.
 *
 * Half floors rather than rounds, so two halves can never add up to more than
 * the remainder. On an odd 401 that is 200 and then 201, which is what the
 * "tout" chip offers next and is the only way to land exactly on zero.
 *
 * Half is dropped when it would be zero. A button offering to pay nothing is
 * not a smaller option, it is a button that does nothing.
 */
export function quickAmounts(left = 0) {
  const all = Math.max(0, Math.floor(left))
  if (all <= 0) return []
  const half = Math.floor(all / 2)
  return half > 0 ? [{ key: 'all', cents: all }, { key: 'half', cents: half }] : [{ key: 'all', cents: all }]
}

/**
 * Payments that were never part of the plan.
 *
 * Not a category of mistake. "Ajouter une depense" with no line is the fastest
 * way to record the dinner you just paid for, and it stays that way; these are
 * simply the entries the plan cannot account for, which the screen shows so
 * the two halves of the project add up in front of somebody.
 */
export function unplanned(entries = []) {
  return (entries ?? []).filter((e) => !e?.line_id)
}
