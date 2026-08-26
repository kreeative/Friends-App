/**
 * Shared project budgets: what a trip cost, who paid it, and who owes whom.
 *
 * All of it pure and all of it in integer cents, for the reason recorded in
 * 19_budget.sql: binary floating point cannot hold 0.10, and money that
 * drifts is money nobody trusts. Nothing here touches the database or the
 * personal budget.
 *
 * THE CENT THAT GOES MISSING
 *
 * Three people splitting a 100 cent taxi owe 33.333 each. Every naive
 * implementation rounds that to 33 and produces a ledger where the shares sum
 * to 99 and one cent has evaporated, or rounds up and invents one. On a
 * fortnight in Greece the error is not one cent, it is one cent per line, and
 * it shows up as a settle-up that does not balance.
 *
 * So `owed` allocates by largest remainder: give everybody the floor of their
 * exact share, then hand the leftover cents out one at a time to whoever was
 * robbed hardest by the flooring. The shares then sum to the total by
 * construction, at every input, which is the property the tests assert
 * directly rather than by example.
 *
 * Ties are broken by user id so the same inputs always produce the same
 * answer. An allocation that moves a cent between two people depending on
 * hash ordering is a bug report waiting to happen.
 */

/** Total of every entry, in cents. */
export function totalSpent(entries = []) {
  return (entries ?? []).reduce((n, e) => n + (e.amount_cents ?? 0), 0)
}

/** What each person actually paid out, keyed by user id. */
export function paidByPerson(entries = [], members = []) {
  const out = new Map((members ?? []).map((m) => [m.user_id, 0]))
  for (const e of entries ?? []) {
    if (!e?.paid_by) continue
    out.set(e.paid_by, (out.get(e.paid_by) ?? 0) + (e.amount_cents ?? 0))
  }
  return out
}

/** Sum of the share weights. Zero when nobody carries any of the cost. */
export function totalShares(members = []) {
  return (members ?? []).reduce((n, m) => n + Math.max(0, m.share ?? 1), 0)
}

/**
 * What each person owes of `total`, by share weight, summing to exactly
 * `total`.
 *
 * Returns a Map of user id to cents. When no member carries any weight, or
 * there are no members, everybody owes nothing: the alternative is dividing
 * by zero and calling the result a debt.
 */
export function owedByPerson(members = [], total = 0) {
  const list = members ?? []
  const out = new Map(list.map((m) => [m.user_id, 0]))
  const weights = totalShares(list)
  if (weights <= 0 || total <= 0) return out

  /* Floor first, and keep the remainder each person lost, scaled by the
     denominator so it stays an integer and the comparison stays exact. */
  const rows = list.map((m) => {
    const w = Math.max(0, m.share ?? 1)
    const exact = total * w
    return { id: m.user_id, base: Math.floor(exact / weights), rem: exact % weights }
  })

  let handed = rows.reduce((n, r) => n + r.base, 0)
  let left = total - handed

  /* Largest remainder first; user id breaks ties so the result is stable. */
  const order = [...rows].sort((a, b) => (b.rem - a.rem) || String(a.id).localeCompare(String(b.id)))
  for (let i = 0; left > 0 && i < order.length; i += 1, left -= 1) order[i].base += 1

  /* More leftover cents than people is impossible with largest remainder,
     but if it ever happened the loop above would silently drop them, so the
     shares would stop summing to the total. Spread any residue rather than
     lose it. */
  for (let i = 0; left > 0; i = (i + 1) % order.length, left -= 1) order[i].base += 1

  for (const r of rows) out.set(r.id, r.base)
  return out
}

/**
 * Paid minus owed, per person.
 *
 * Positive means the project owes them: they are out of pocket. Negative
 * means they owe the project. The balances sum to zero, which is the
 * invariant that makes settle-up possible at all.
 */
export function balances(members = [], entries = []) {
  const total = totalSpent(entries)
  const paid = paidByPerson(entries, members)
  const owed = owedByPerson(members, total)
  return (members ?? []).map((m) => ({
    user_id: m.user_id,
    paid: paid.get(m.user_id) ?? 0,
    owed: owed.get(m.user_id) ?? 0,
    net: (paid.get(m.user_id) ?? 0) - (owed.get(m.user_id) ?? 0),
  }))
}

/**
 * The shortest set of payments that squares everybody up.
 *
 * Greedy: repeatedly send money from whoever owes the most to whoever is owed
 * the most. That is not provably the minimum number of transfers in every
 * case (the general problem is NP-hard) but it is at most n-1, which is the
 * bound that matters, and it never produces a transfer that overshoots.
 *
 * The alternative people expect, everybody pays the one person who fronted
 * things, is worse: it is also n-1 transfers and it forces the money through
 * somebody who did not ask to be the bank.
 */
export function settleUp(members = [], entries = []) {
  const eps = 0
  const owe = balances(members, entries)
    .filter((b) => b.net < eps)
    .map((b) => ({ id: b.user_id, amount: -b.net }))
    .sort((a, b) => (b.amount - a.amount) || String(a.id).localeCompare(String(b.id)))
  const due = balances(members, entries)
    .filter((b) => b.net > eps)
    .map((b) => ({ id: b.user_id, amount: b.net }))
    .sort((a, b) => (b.amount - a.amount) || String(a.id).localeCompare(String(b.id)))

  const out = []
  let i = 0
  let j = 0
  while (i < owe.length && j < due.length) {
    const amount = Math.min(owe[i].amount, due[j].amount)
    if (amount > 0) out.push({ from: owe[i].id, to: due[j].id, amount_cents: amount })
    owe[i].amount -= amount
    due[j].amount -= amount
    if (owe[i].amount === 0) i += 1
    if (due[j].amount === 0) j += 1
  }
  return out
}

/**
 * How the project is tracking against what it was meant to cost.
 *
 * `target` of 0 means no target was set, which is not the same as a target of
 * zero, so `pct` is null rather than a number in that case. A progress bar
 * that reads 100% because nobody set a budget is worse than no bar.
 */
export function projectProgress({ entries = [], target_cents = 0 } = {}) {
  const spent = totalSpent(entries)
  const has = (target_cents ?? 0) > 0
  return {
    spent,
    target: target_cents ?? 0,
    left: has ? (target_cents - spent) : 0,
    over: has ? Math.max(0, spent - target_cents) : 0,
    pct: has ? Math.min(100, Math.round((spent / target_cents) * 100)) : null,
    funded: has,
  }
}

/** Spend per category, biggest first. Categories here are free text. */
export function byCategory(entries = []) {
  const m = new Map()
  for (const e of entries ?? []) {
    const k = (e.category ?? '').trim() || 'autre'
    m.set(k, (m.get(k) ?? 0) + (e.amount_cents ?? 0))
  }
  return [...m.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => (b.cents - a.cents) || a.category.localeCompare(b.category))
}
