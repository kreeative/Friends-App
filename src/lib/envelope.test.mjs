/**
 * node src/lib/envelope.test.mjs
 *
 * The assertions that matter are the ones about a pool going negative and a
 * bar refusing to. Those two pull in opposite directions on purpose: an
 * over-allocated pool is the mistake this whole model exists to surface, and
 * an over-drawn bar is a bar that has stopped being a bar.
 */
import {
  ENVELOPE_CATEGORIES,
  allocationsFor,
  envelopeFor,
  envelopes,
  spendable,
  toAllocate,
  totalAllocated,
} from './envelope.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nenvelope')

const AUG = '2026-08-01'
const JUL = '2026-07-01'
const row = (category, amount_cents, period_start = AUG) => ({ category, amount_cents, period_start })

/* --- the six ------------------------------------------------------------ */
eq('six categories', ENVELOPE_CATEGORIES.length, 6)
ok('and they are the ones spending is filed under',
   ['food', 'transport', 'home', 'fun', 'health', 'other'].every((k) => ENVELOPE_CATEGORIES.includes(k)))

/* --- allocationsFor ----------------------------------------------------- */
{
  const a = allocationsFor([row('home', 120000), row('food', 40000)], AUG)
  eq('what was allocated is there', [a.home, a.food], [120000, 40000])
  eq('and the rest are zero, not missing', [a.fun, a.health, a.other, a.transport], [0, 0, 0, 0])
  ok('every category has a key', ENVELOPE_CATEGORIES.every((k) => k in a))
}
{
  /* THE ONE THAT MATTERS FOR ROLLING OVER. Last month's envelope must not fund
     this month, or money that arrived once would be handed out twice. */
  const a = allocationsFor([row('home', 120000, AUG), row('fun', 99999, JUL)], AUG)
  eq('this period is kept', a.home, 120000)
  eq('another period is dropped', a.fun, 0)
}
{
  const a = allocationsFor([row('wibble', 5000), row('home', 1000)], AUG)
  eq('an unknown category is dropped', Object.keys(a).length, 6)
  eq('and the good one survives', a.home, 1000)
}
{
  const a = allocationsFor([row('home', -5000), row('food', 0)], AUG)
  eq('a negative allocation is refused', a.home, 0)
  eq('and a zero is just a zero', a.food, 0)
}
{
  eq('no rows is all zeros', totalAllocated(allocationsFor([], AUG)), 0)
  eq('junk rows do not throw', totalAllocated(allocationsFor([null, undefined, {}, 42], AUG)), 0)
  /* No period asked for means take them all, which is what a caller with one
     period's rows already filtered will pass. */
  eq('a missing period takes everything', allocationsFor([row('home', 500, JUL)]).home, 500)
}

eq('total adds up', totalAllocated({ home: 120000, food: 40000 }), 160000)
eq('an empty set totals nothing', totalAllocated({}), 0)
eq('junk totals nothing', totalAllocated(null), 0)

/* --- one envelope ------------------------------------------------------- */
{
  const e = envelopeFor({ allocated: 20000, spent: 15000 })
  eq('what is left', e.remaining, 5000)
  eq('nothing over', e.over, 0)
  eq('three quarters through', e.pct, 75)
  ok('and it is funded', e.funded)
}
{
  /* "46 $ de plus", the red case. remaining stays at zero and `over` carries
     the excess, because they are two different sentences on the card. */
  const e = envelopeFor({ allocated: 20000, spent: 24600 })
  eq('nothing remaining', e.remaining, 0)
  eq('and 46 over', e.over, 4600)
  eq('the bar is full, not 123%', e.pct, 100)
}
{
  const e = envelopeFor({ allocated: 20000, spent: 20000 })
  eq('exactly spent leaves nothing', e.remaining, 0)
  eq('and nothing over', e.over, 0)
  eq('with a full bar', e.pct, 100)
}
{
  const e = envelopeFor({ allocated: 0, spent: 0 })
  eq('an empty envelope draws nothing', e.pct, 0)
  ok('and is not funded', !e.funded)
}
{
  /* Spending out of an envelope nobody funded. The bar has nothing to measure
     against, so it reads as full and entirely over. */
  const e = envelopeFor({ allocated: 0, spent: 5000 })
  eq('all of it is over', e.over, 5000)
  eq('the bar is full', e.pct, 100)
  ok('and it is still not funded', !e.funded)
}
{
  const e = envelopeFor({})
  eq('nothing at all is zero everywhere', [e.allocated, e.spent, e.remaining, e.over, e.pct], [0, 0, 0, 0, 0])
  eq('undefined is zero too', envelopeFor().allocated, 0)
}
{
  const e = envelopeFor({ allocated: -500, spent: -500 })
  eq('negatives are floored, not propagated', [e.allocated, e.spent], [0, 0])
}

/* --- the whole set ------------------------------------------------------ */
{
  const list = envelopes({
    allocations: { home: 120000, food: 40000 },
    spentByCategory: { home: 130000, food: 12000 },
  })
  eq('six of them, always', list.length, 6)
  eq('in drawing order', list.map((e) => e.key), ENVELOPE_CATEGORIES)
  eq('home is over', list.find((e) => e.key === 'home').over, 10000)
  eq('food has room', list.find((e) => e.key === 'food').remaining, 28000)
  eq('an untouched one is empty', list.find((e) => e.key === 'fun').pct, 0)
  eq('nothing at all still returns six', envelopes().length, 6)
}

/* --- the pool ----------------------------------------------------------- */
eq('3000 in, 1600 out, 1400 to place', toAllocate({ earned: 300000, allocations: { home: 120000, food: 40000 } }), 140000)
eq('all of it placed is zero', toAllocate({ earned: 160000, allocations: { home: 120000, food: 40000 } }), 0)
{
  /* NEGATIVE ON PURPOSE. Handing out more than arrived is the mistake this
     model exists to catch, and a pool clamped at zero would say the job was
     finished. */
  const over = toAllocate({ earned: 100000, allocations: { home: 120000 } })
  eq('over-allocating goes negative', over, -20000)
  ok('and it is visibly negative, not clamped', over < 0)
}
eq('nothing earned and nothing placed', toAllocate({}), 0)
eq('nothing earned but money placed is negative', toAllocate({ allocations: { home: 5000 } }), -5000)

/* --- the headline bar --------------------------------------------------- */
{
  const s = spendable({ earned: 300000, spent: 239900 })
  eq('what is left to spend', s.left, 60100)
  eq('and how far through', s.pct, 80)
  eq('nothing over', s.over, 0)
  ok('funded', s.funded)
}
{
  const s = spendable({ earned: 100000, spent: 130000 })
  eq('spending past income goes negative', s.left, -30000)
  eq('and names the excess', s.over, 30000)
  eq('with the bar full rather than 130%', s.pct, 100)
}
{
  const s = spendable({ earned: 0, spent: 0 })
  eq('nothing logged is an empty bar', s.pct, 0)
  ok('and not funded', !s.funded)
  eq('with nothing left', s.left, 0)
}
{
  /* A coffee before any salary. The bar cannot be a fraction of nothing, so it
     reads as full, but `funded` is what the card uses to explain why. */
  const s = spendable({ earned: 0, spent: 500 })
  eq('the bar is full', s.pct, 100)
  ok('but the card knows there is no income yet', !s.funded)
  eq('and it is 5 over', s.over, 500)
}
eq('nothing at all does not throw', spendable().left, 0)

/* The headline is income minus SPENDING, never minus allocations: a dollar in
   the rent envelope is still in the account until the rent goes out. */
{
  const s = spendable({ earned: 300000, spent: 0 })
  eq('allocating everything does not empty the bar', s.left, 300000)
  eq('and the bar is untouched', s.pct, 0)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
