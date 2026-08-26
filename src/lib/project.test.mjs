/**
 * node src/lib/project.test.mjs
 *
 * The assertions that matter are the invariants, not the examples. Two of
 * them carry the whole feature:
 *
 *   1. the shares always sum to the total, at every input
 *   2. the balances always sum to zero
 *
 * If either breaks, a settle-up appears that does not settle, and a person
 * pays a cent they do not owe or keeps one they do. Both are checked against
 * a few hundred randomised inputs rather than a handful of chosen ones,
 * because the failures here are remainder failures and remainder failures
 * hide in exactly the cases nobody thinks to write down.
 */
import {
  balances,
  byCategory,
  owedByPerson,
  paidByPerson,
  projectProgress,
  settleUp,
  totalShares,
  totalSpent,
} from './project.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'
const C = 'cccccccc-0000-0000-0000-000000000003'
const M3 = [{ user_id: A, share: 1 }, { user_id: B, share: 1 }, { user_id: C, share: 1 }]
const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0)

/* --- the missing cent ---------------------------------------------------- */

{
  /* 100 cents three ways is 33.333 each. Naive flooring gives 99. */
  const owed = owedByPerson(M3, 100)
  ok('three ways: the shares still sum to the total', sum(owed) === 100, String(sum(owed)))
  const vals = [...owed.values()].sort()
  ok('three ways: nobody is off by more than a cent', vals[2] - vals[0] <= 1, vals.join(','))
  ok('three ways: it is 34/33/33', vals.join(',') === '33,33,34', vals.join(','))
}

{
  /* Weights, not equal shares: Tino counts for three. */
  const m = [{ user_id: A, share: 3 }, { user_id: B, share: 1 }]
  const owed = owedByPerson(m, 100)
  ok('weighted: sums to the total', sum(owed) === 100)
  ok('weighted: 3:1 is 75/25', owed.get(A) === 75 && owed.get(B) === 25, `${owed.get(A)}/${owed.get(B)}`)
}

{
  /* A zero weight is a real case: in the project, owing none of it. */
  const m = [{ user_id: A, share: 1 }, { user_id: B, share: 0 }]
  const owed = owedByPerson(m, 999)
  ok('zero weight owes nothing', owed.get(B) === 0)
  ok('and the other carries all of it', owed.get(A) === 999)
}

{
  ok('nobody carrying weight owes nothing rather than NaN',
     sum(owedByPerson([{ user_id: A, share: 0 }], 500)) === 0)
  ok('no members at all is not a division by zero',
     sum(owedByPerson([], 500)) === 0)
  ok('a total of zero owes zero', sum(owedByPerson(M3, 0)) === 0)
}

{
  /* Stability: the same input must not move a cent between runs. */
  const a = [...owedByPerson(M3, 100).entries()].map(([k, v]) => `${k}:${v}`).join()
  const b = [...owedByPerson([...M3].reverse(), 100).entries()].sort().map(([k, v]) => `${k}:${v}`).join()
  const a2 = [...owedByPerson(M3, 100).entries()].sort().map(([k, v]) => `${k}:${v}`).join()
  ok('the allocation is stable across member order', a2 === b, `${a2} vs ${b}`)
  ok('and stable across repeated calls', a === [...owedByPerson(M3, 100).entries()].map(([k, v]) => `${k}:${v}`).join())
}

/* --- the scenario that was asked for ------------------------------------- */

{
  /* "Tino paye la maison, Leo paye la voiture." Anna pays nothing. */
  const entries = [
    { paid_by: B, amount_cents: 180000, category: 'logement' },
    { paid_by: C, amount_cents: 60000, category: 'transport' },
  ]
  ok('the trip cost 2400', totalSpent(entries) === 240000)

  const paid = paidByPerson(entries, M3)
  ok('Tino paid 1800', paid.get(B) === 180000)
  ok('Leo paid 600', paid.get(C) === 60000)
  ok('Anna paid nothing', paid.get(A) === 0)

  const bal = balances(M3, entries)
  const net = Object.fromEntries(bal.map((b) => [b.user_id, b.net]))
  ok('everybody owes 800', bal.every((b) => b.owed === 80000), bal.map((b) => b.owed).join())
  ok('Anna is 800 down', net[A] === -80000, String(net[A]))
  ok('Tino is 1000 up', net[B] === 100000, String(net[B]))
  ok('Leo is 200 down', net[C] === -20000, String(net[C]))
  ok('the balances sum to zero', bal.reduce((n, b) => n + b.net, 0) === 0)

  const s = settleUp(M3, entries)
  ok('two transfers settle three people', s.length === 2, String(s.length))
  ok('everything flows to Tino', s.every((x) => x.to === B), JSON.stringify(s))
  ok('and they add up to what he is owed',
     s.reduce((n, x) => n + x.amount_cents, 0) === 100000)
  ok('nobody sends more than they owe',
     s.every((x) => x.amount_cents <= -net[x.from]))
}

{
  /* Nobody owes anybody when everyone paid their share. */
  const entries = [
    { paid_by: A, amount_cents: 5000 },
    { paid_by: B, amount_cents: 5000 },
    { paid_by: C, amount_cents: 5000 },
  ]
  ok('a square project needs no transfers', settleUp(M3, entries).length === 0)
  ok('an empty project needs no transfers', settleUp(M3, []).length === 0)
}

/* --- the invariants, against randomised input ---------------------------- */

{
  /* A tiny deterministic PRNG, so a failure is reproducible. */
  let seed = 20260826
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed % n
  }

  let sharesBad = 0
  let zeroBad = 0
  let overshoot = 0
  let tooMany = 0

  for (let run = 0; run < 400; run += 1) {
    const n = 1 + rnd(6)
    const members = Array.from({ length: n }, (_, i) => ({
      user_id: `${String.fromCharCode(97 + i).repeat(8)}-0000-0000-0000-00000000000${i}`,
      share: rnd(4),
    }))
    const entries = Array.from({ length: rnd(9) }, () => ({
      paid_by: members[rnd(n)].user_id,
      amount_cents: 1 + rnd(500000),
    }))

    const total = totalSpent(entries)
    const owed = owedByPerson(members, total)
    /* Shares sum to the total whenever anybody carries weight at all. */
    if (totalShares(members) > 0 && sum(owed) !== total) sharesBad += 1

    const bal = balances(members, entries)
    if (totalShares(members) > 0 && bal.reduce((a, b) => a + b.net, 0) !== 0) zeroBad += 1

    const s = settleUp(members, entries)
    if (s.length > Math.max(0, n - 1)) tooMany += 1
    /* Nobody receives more than they were owed, nobody sends more than owed. */
    const net = Object.fromEntries(bal.map((b) => [b.user_id, b.net]))
    const sent = {}
    const got = {}
    for (const x of s) {
      sent[x.from] = (sent[x.from] ?? 0) + x.amount_cents
      got[x.to] = (got[x.to] ?? 0) + x.amount_cents
    }
    for (const k of Object.keys(sent)) if (sent[k] > -net[k]) overshoot += 1
    for (const k of Object.keys(got)) if (got[k] > net[k]) overshoot += 1
  }

  ok('400 random projects: shares always sum to the total', sharesBad === 0, `${sharesBad} bad`)
  ok('400 random projects: balances always sum to zero', zeroBad === 0, `${zeroBad} bad`)
  ok('400 random projects: no transfer overshoots', overshoot === 0, `${overshoot} bad`)
  ok('400 random projects: at most n-1 transfers', tooMany === 0, `${tooMany} bad`)
}

/* --- progress and categories --------------------------------------------- */

{
  const p = projectProgress({ entries: [{ amount_cents: 25000 }], target_cents: 100000 })
  ok('progress: a quarter spent', p.pct === 25 && p.spent === 25000)
  ok('progress: three quarters left', p.left === 75000)
  ok('progress: nothing over', p.over === 0)

  const over = projectProgress({ entries: [{ amount_cents: 150000 }], target_cents: 100000 })
  ok('progress: the bar stops at 100', over.pct === 100, String(over.pct))
  ok('progress: but the overspend is named', over.over === 50000)
  ok('progress: and left goes negative rather than clamping', over.left === -50000)

  const none = projectProgress({ entries: [{ amount_cents: 900 }], target_cents: 0 })
  ok('no target set is null, not 100%', none.pct === null)
  ok('and it says so', none.funded === false)
  ok('an empty project is still readable', projectProgress().spent === 0)
}

{
  const cats = byCategory([
    { category: 'logement', amount_cents: 500 },
    { category: 'resto', amount_cents: 900 },
    { category: 'logement', amount_cents: 100 },
    { category: '  ', amount_cents: 50 },
    { amount_cents: 25 },
  ])
  ok('categories are totalled', cats.find((c) => c.category === 'logement').cents === 600)
  ok('biggest first', cats[0].category === 'resto', cats[0].category)
  ok('blank and missing both fall to autre',
     cats.find((c) => c.category === 'autre').cents === 75)
}

/* --- defensive ----------------------------------------------------------- */

{
  ok('undefined entries total zero', totalSpent() === 0)
  ok('null entries total zero', totalSpent(null) === 0)
  ok('an entry from a non-member still counts toward the total',
     totalSpent([{ paid_by: 'ghost', amount_cents: 100 }]) === 100)
  const paid = paidByPerson([{ paid_by: 'ghost', amount_cents: 100 }], M3)
  ok('and shows up under whoever paid it', paid.get('ghost') === 100)
  ok('while the members all read zero', [A, B, C].every((k) => paid.get(k) === 0))
  ok('a missing share defaults to one', totalShares([{ user_id: A }]) === 1)
}

console.log(`\nproject\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
