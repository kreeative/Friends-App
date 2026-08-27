/**
 * node src/lib/projectLines.test.mjs
 *
 * The invariant that carries this feature is that the Payer chips can never
 * overpay a line. Somebody tapping "tout" and somebody else having tapped
 * "moitie" a second earlier must land on exactly zero left, at every amount,
 * including the odd ones where a half does not divide.
 *
 * That is checked over every remainder from 1 to a few thousand cents rather
 * than at a handful of chosen numbers, because the failure is a rounding
 * failure and rounding failures hide in the cases nobody writes down.
 */
import {
  lineState,
  openCount,
  paidOnLine,
  plannedLeft,
  plannedTotal,
  quickAmounts,
  sortLines,
  unplanned,
} from './projectLines.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const L1 = 'l1111111-0000-0000-0000-000000000001'
const L2 = 'l2222222-0000-0000-0000-000000000002'
const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'

const line = (id, cents, created_at = '2026-01-01') => ({ id, amount_cents: cents, created_at })
const paid = (lineId, cents, by = A) => ({ id: `e-${Math.random()}`, line_id: lineId, amount_cents: cents, paid_by: by })

/* --- what has been put down ---------------------------------------------- */

{
  const entries = [paid(L1, 400), paid(L1, 100), paid(L2, 900), { amount_cents: 50, paid_by: A }]
  ok('sums only its own line', paidOnLine(L1, entries) === 500, String(paidOnLine(L1, entries)))
  ok('the other line is its own', paidOnLine(L2, entries) === 900)
  ok('an entry with no line counts toward neither',
     paidOnLine(L1, entries) + paidOnLine(L2, entries) === 1400)
  ok('no line id is zero, not everything', paidOnLine(null, entries) === 0)
  ok('no entries is zero', paidOnLine(L1) === 0)
}

/* --- where a line stands -------------------------------------------------- */

{
  const s = lineState(line(L1, 80000), [])
  ok('untouched: nothing paid', s.paid === 0)
  ok('untouched: all of it left', s.left === 80000)
  ok('untouched: not settled', s.settled === false)
  ok('untouched: not started either', s.started === false)
  ok('untouched: the bar is at zero', s.pct === 0)
}
{
  const s = lineState(line(L1, 80000), [paid(L1, 40000)])
  ok('half paid: half left', s.left === 40000, String(s.left))
  ok('half paid: the bar is at 50', s.pct === 50, String(s.pct))
  ok('half paid: started but not settled', s.started === true && s.settled === false)
}
{
  const s = lineState(line(L1, 80000), [paid(L1, 40000), paid(L1, 40000, B)])
  ok('two halves settle it', s.settled === true)
  ok('and nothing is left', s.left === 0)
  ok('and nothing is over', s.over === 0)
}
{
  /* The bill came in at 810 against a plan of 800. Settled, not "unpaid
     because it missed the number", or the Payer button never goes away. */
  const s = lineState(line(L1, 80000), [paid(L1, 81000)])
  ok('overpaid is settled', s.settled === true)
  ok('overpaid never owes negative money', s.left === 0, String(s.left))
  ok('and the overshoot is reported separately', s.over === 1000, String(s.over))
  ok('the bar stops at 100 rather than running past it', s.pct === 100, String(s.pct))
}
{
  /* Zero is not a plan. A bar that reads full because nobody set an amount is
     worse than no bar, which is the same rule projectProgress follows. */
  const s = lineState(line(L1, 0), [])
  ok('a zero line has no percentage', s.pct === null)
  ok('and is not settled by being empty', s.settled === false)
}
{
  ok('a missing line is not a crash', lineState(undefined, []).total === 0)
  ok('a negative amount is floored at zero', lineState(line(L1, -500), []).total === 0)
}

/* --- the chips can never overpay ------------------------------------------ */

{
  let worst = null
  for (let left = 1; left <= 4000; left += 1) {
    const q = quickAmounts(left)
    const all = q.find((x) => x.key === 'all')
    const half = q.find((x) => x.key === 'half')

    if (!all || all.cents !== left) { worst = `all !== left at ${left}`; break }
    if (half && half.cents * 2 > left) { worst = `two halves overpay at ${left}`; break }
    if (half && half.cents <= 0) { worst = `a half of nothing at ${left}`; break }

    /* The real sequence: somebody takes the half, somebody else takes what is
       then left. It has to land on exactly zero. */
    if (half) {
      const after = left - half.cents
      const next = quickAmounts(after).find((x) => x.key === 'all')
      if (!next || after - next.cents !== 0) { worst = `half then all misses zero at ${left}`; break }
    }
  }
  ok('half then all always lands on exactly zero, 1 to 4000 cents', worst === null, worst ?? '')
}
{
  ok('one cent left offers only the whole cent',
     quickAmounts(1).length === 1 && quickAmounts(1)[0].key === 'all')
  ok('nothing left offers nothing', quickAmounts(0).length === 0)
  ok('negative offers nothing', quickAmounts(-40).length === 0)
  ok('an odd amount floors the half',
     quickAmounts(401).find((x) => x.key === 'half').cents === 200)
}

/* --- the order the list is useful in -------------------------------------- */

{
  const lines = [
    line('c', 100, '2026-01-03'),
    line('a', 100, '2026-01-01'),
    line('b', 100, '2026-01-02'),
  ]
  const entries = [paid('a', 100)]
  const out = sortLines(lines, entries).map((x) => x.line.id)
  ok('settled sinks to the bottom', out[2] === 'a', out.join())
  ok('and the rest stay oldest first', out[0] === 'b' && out[1] === 'c', out.join())
}
{
  /* Two added in the same second must not swap places between renders. */
  const same = [line('z', 100, '2026-01-01'), line('y', 100, '2026-01-01')]
  const one = sortLines(same, []).map((x) => x.line.id).join()
  const two = sortLines([...same].reverse(), []).map((x) => x.line.id).join()
  ok('the same second is broken by id, stably', one === two && one === 'y,z', `${one} vs ${two}`)
}
{
  ok('no lines sorts to nothing', sortLines().length === 0)
  ok('and carries the state alongside each line',
     sortLines([line(L1, 500)], [paid(L1, 200)])[0].state.left === 300)
}

/* --- the whole plan ------------------------------------------------------- */

{
  const lines = [line(L1, 80000), line(L2, 20000)]
  const entries = [paid(L1, 80000), paid(L2, 5000)]
  ok('the plan totals both lines', plannedTotal(lines) === 100000)
  ok('and what is left is only the unpaid part', plannedLeft(lines, entries) === 15000,
     String(plannedLeft(lines, entries)))
  ok('one line is still open', openCount(lines, entries) === 1, String(openCount(lines, entries)))
  ok('an overpaid line does not reduce what other lines owe',
     plannedLeft(lines, [paid(L1, 90000)]) === 20000,
     String(plannedLeft(lines, [paid(L1, 90000)])))
}
{
  ok('an empty plan totals zero', plannedTotal() === 0 && plannedLeft() === 0)
  ok('and has nothing open', openCount() === 0)
}

/* --- payments the plan never knew about ----------------------------------- */

{
  const entries = [paid(L1, 400), { id: 'x', amount_cents: 900, paid_by: B }]
  const out = unplanned(entries)
  ok('an entry with no line is unplanned', out.length === 1 && out[0].id === 'x')
  ok('and one with a line is not', !out.some((e) => e.line_id === L1))
  ok('no entries is an empty list', unplanned().length === 0)
}

console.log(`\nprojectLines\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
