import { dailySeries, periodBounds, summarise } from './budget.js'
let pass = 0, fail = 0
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// ---- period boundaries -----------------------------------------------------
let p = periodBounds(new Date(2026, 7, 20), 15)          // 20 Aug, payday 15th
eq('after payday: starts this month', iso(p.start), '2026-08-15')
eq('after payday: ends next month',   iso(p.end),   '2026-09-15')
eq('after payday: days left',         p.daysLeft,   26)

p = periodBounds(new Date(2026, 7, 3), 15)               // 3 Aug, payday 15th
eq('before payday: starts last month', iso(p.start), '2026-07-15')
eq('before payday: ends this month',   iso(p.end),   '2026-08-15')

p = periodBounds(new Date(2026, 0, 5), 28)               // 5 Jan, payday 28th
eq('january rolls back a year', iso(p.start), '2025-12-28')
eq('january period ends',       iso(p.end),   '2026-01-28')

p = periodBounds(new Date(2026, 11, 30), 28)             // 30 Dec, payday 28th
eq('december rolls forward a year', iso(p.end), '2027-01-28')

p = periodBounds(new Date(2027, 1, 28), 28)              // 28 Feb non-leap
eq('feb 28 start',        iso(p.start), '2027-02-28')
eq('feb 28 end is march', iso(p.end),   '2027-03-28')
eq('feb 28 days left',    p.daysLeft,   28)

p = periodBounds(new Date(2028, 1, 29), 28)              // 29 Feb, leap year
eq('leap day sits in feb period', iso(p.start), '2028-02-28')
eq('leap day days left',          p.daysLeft,   28)      // 29 Feb -> 28 Mar

p = periodBounds(new Date(2026, 7, 14), 15)              // day before payday
eq('last day of period: daysLeft is 1', p.daysLeft, 1)

// ---- the headline number ---------------------------------------------------
const plan = { monthly_income_cents: 320000, savings_target_cents: 40000, period_start_day: 1, currency: 'CAD' }
const fixed = [ { amount_cents: 140000, active: true }, { amount_cents: 6500, active: true },
                { amount_cents: 2200, active: false } ]   // paused one must not count

let s = summarise({ plan, fixed, entries: [], today: new Date(2026, 7, 1) })  // 1 Aug, 31 days
eq('committed excludes paused', s.committed, 146500)
eq('the PLAN still says what it always said', s.plannedPool, 320000 - 146500 - 40000)
eq('and what it implies per day', s.plannedPerDay, Math.floor(133500 / 31))

// THE BUG. Saving the setup form used to make `left` 133500 on a day when no
// salary had arrived and no rent had gone out. Actual money starts at zero.
eq('a fresh setup has a balance of nothing', s.balance, 0)
eq('because nothing has been earned', s.earned, 0)
eq('or spent', s.spent, 0)
eq('and nothing has been logged', s.logged, false)
eq('so it is not "overspent" either', s.overspent, false)
eq('the fixed charges are all still due', s.fixedDue, 146500)
eq('and none are paid', s.fixedPaid, 0)

s = summarise({ plan, fixed, today: new Date(2026, 7, 16),
  entries: [
    { kind: 'expense', amount_cents: 4300, category: 'food',  happened_on: '2026-08-02' },
    { kind: 'expense', amount_cents: 1250, category: 'fun',   happened_on: '2026-08-10' },
    { kind: 'income',  amount_cents: 20000, category: null,   happened_on: '2026-08-11' },
    { kind: 'expense', amount_cents: 99999, category: 'home', happened_on: '2026-07-30' }, // last period
    { kind: 'expense', amount_cents: 88888, category: 'home', happened_on: '2026-09-02' }, // next period
  ] })
eq('spend outside the period is excluded', s.spent, 5550)
eq('logged income is counted as earned',   s.earned, 20000)
eq('balance = earned - spent',             s.balance, 20000 - 5550)
eq('available holds back what is still due', s.available, 20000 - 5550 - 146500)
eq('and something has been logged',        s.logged, true)
eq('entries in period', s.entries.length, 3)
eq('categories ranked, empties dropped', s.byCategory.map(c => c.key), ['food', 'fun'])

// ---- the states that matter ------------------------------------------------
s = summarise({ plan: { ...plan, monthly_income_cents: 150000 }, fixed, today: new Date(2026, 7, 5) })
eq('overcommitted when fixed+savings > income', s.overcommitted, true)
eq('overcommitted is a fact about the plan', s.plannedPool < 0, true)
// Knowable the moment the form is saved, so it does NOT wait for a transaction.
eq('and it does not need anything logged', s.logged, false)

s = summarise({ plan, fixed, today: new Date(2026, 7, 20),
  entries: [{ kind: 'expense', amount_cents: 200000, happened_on: '2026-08-03' }] })
eq('overspent flagged', s.overspent, true)
eq('overcommitted not confused with overspent', s.overcommitted, false)
eq('perDay goes negative rather than pretending', s.perDay < 0, true)

eq('no plan is not ready', summarise({ plan: null }).ready, false)
eq('zero income is not ready', summarise({ plan: { monthly_income_cents: 0 } }).ready, false)
eq('never divides by zero', Number.isFinite(summarise({ plan, fixed, today: new Date(2026,7,31) }).perDay), true)


// ---- the sparkline series --------------------------------------------------
{
  const per = periodBounds(new Date(2026, 7, 5), 1)          // 1 Aug period, today the 5th
  const ent = [
    { kind: 'expense', amount_cents: 1000, happened_on: '2026-08-01' },
    { kind: 'expense', amount_cents:  500, happened_on: '2026-08-03' },
    { kind: 'income',  amount_cents: 9999, happened_on: '2026-08-03' },  // wrong kind
    { kind: 'expense', amount_cents:  250, happened_on: '2026-08-05' },
    { kind: 'expense', amount_cents: 7777, happened_on: '2026-08-20' },  // the future
  ]
  const ser = dailySeries({ entries: ent, period: per })
  eq('series runs start..today',      ser.length, 5)
  eq('series is cumulative',          ser, [1000, 1000, 1500, 1500, 1750])
  eq('series ignores other kinds',    ser[4], 1750)
  eq('series ignores future entries', Math.max(...ser), 1750)

  const day1 = dailySeries({ entries: [], period: periodBounds(new Date(2026, 7, 1), 1) })
  eq('a single day still draws a line', day1.length, 2)

  const inc = dailySeries({ entries: ent, period: per, kind: 'income' })
  eq('series can follow income too', inc[4], 9999)
}

// ---- entries marked as not counting ------------------------------------------
// A refund, a transfer between your own pockets, an expense being paid back.
// All worth a record; none of them should move what is left this period.
{
  const plan = { monthly_income_cents: 300000, savings_target_cents: 0, period_start_day: 1 }
  const today = new Date(2026, 6, 15)
  const day = '2026-07-10'

  const plain = summarise({ plan, fixed: [], today, entries: [
    { kind: 'expense', amount_cents: 5000, category: 'food', happened_on: day },
  ]})
  const withRefund = summarise({ plan, fixed: [], today, entries: [
    { kind: 'expense', amount_cents: 5000, category: 'food', happened_on: day },
    { kind: 'expense', amount_cents: 90000, category: 'other', happened_on: day, excluded: true },
  ]})

  eq('an excluded expense does not spend', withRefund.spent, plain.spent)
  eq('nor does it move what is left',      withRefund.available, plain.available)
  eq('and it stays out of the breakdown',  withRefund.byCategory.length, plain.byCategory.length)

  const withIncome = summarise({ plan, fixed: [], today, entries: [
    { kind: 'income', amount_cents: 90000, happened_on: day, excluded: true },
  ]})
  eq('an excluded income does not add', withIncome.balance, 0)

  // The curve has to agree with the total sitting above it.
  const period = periodBounds(today, 1)
  const curve = dailySeries({ period, kind: 'expense', entries: [
    { kind: 'expense', amount_cents: 5000, happened_on: day },
    { kind: 'expense', amount_cents: 90000, happened_on: day, excluded: true },
  ]})
  eq('the curve excludes it too', curve[curve.length - 1], 5000)

  // Absent means counting: every row written before migration 29 has no flag.
  const legacy = summarise({ plan, fixed: [], today, entries: [
    { kind: 'expense', amount_cents: 5000, category: 'food', happened_on: day },
  ]})
  eq('a row with no flag still counts', legacy.spent, 5000)
}

// ---- planned vs actual, which is the whole point of this rewrite ----------
{
  const plan = { monthly_income_cents: 200000, savings_target_cents: 0, period_start_day: 1 }
  const rent = { id: 'r', label: 'Rent', amount_cents: 50000, active: true }
  const today = new Date(2026, 7, 15)                       // 15 Aug, 17 days left

  // 1. Thirty seconds after finishing setup.
  const fresh = summarise({ plan, fixed: [rent], entries: [], today })
  eq('setup alone puts no cash in hand', fresh.balance, 0)
  eq('the plan is still readable beside it', fresh.plannedPool, 150000)
  eq('and the plan is untouched by there being no transactions', fresh.plannedPerDay, Math.floor(150000 / 31))
  eq('rent is planned, not paid', fresh.fixedDue, 50000)

  // 2. The salary lands and is logged.
  const paid = summarise({ plan, fixed: [rent], today, entries: [
    { kind: 'income', amount_cents: 200000, happened_on: '2026-08-01' },
  ]})
  eq('now there is real money', paid.balance, 200000)
  eq('but rent is still owed out of it', paid.available, 150000)
  eq('and the day rate comes off the real figure', paid.perDay, Math.floor(150000 / 17))

  // 3. Rent is marked paid. It stops being held back.
  const rentPaid = summarise({
    plan, today,
    fixed: [{ ...rent, last_paid_on: '2026-08-02' }],
    entries: [{ kind: 'income', amount_cents: 200000, happened_on: '2026-08-01' }],
  })
  eq('a paid charge is counted paid', rentPaid.fixedPaid, 50000)
  eq('and stops being due', rentPaid.fixedDue, 0)
  eq('so nothing is held back any more', rentPaid.available, 200000)

  // 4. Paid, AND logged as a transaction. It must not come off twice: it is
  //    out of fixedDue and out through spent, which is one subtraction each of
  //    two different things, not two of the same.
  const both = summarise({
    plan, today,
    fixed: [{ ...rent, last_paid_on: '2026-08-02' }],
    entries: [
      { kind: 'income', amount_cents: 200000, happened_on: '2026-08-01' },
      { kind: 'expense', amount_cents: 50000, category: 'home', happened_on: '2026-08-02' },
    ],
  })
  eq('the money really left', both.balance, 150000)
  eq('and it is not withheld a second time', both.available, 150000)

  // 5. Last month's date does not count as this month's payment. This is what
  //    makes the whole set come due again with no job to run and no flag to
  //    reset.
  const stale = summarise({
    plan, today,
    fixed: [{ ...rent, last_paid_on: '2026-07-02' }],
    entries: [],
  })
  eq('a payment from last period does not carry over', stale.fixedPaid, 0)
  eq('so the charge is due again', stale.fixedDue, 50000)

  // 6. A paused charge is neither due nor payable.
  const paused = summarise({
    plan, today,
    fixed: [{ ...rent, active: false, last_paid_on: '2026-08-02' }],
    entries: [],
  })
  eq('a paused charge is not committed', paused.committed, 0)
  eq('nor due', paused.fixedDue, 0)
  eq('nor counted as paid', paused.fixedPaid, 0)

  // 7. fixedDue never goes negative, however the numbers are edited.
  const over = summarise({
    plan, today,
    fixed: [{ ...rent, last_paid_on: '2026-08-02' }, { id: 'x', amount_cents: 1, active: false }],
    entries: [],
  })
  eq('fixedDue has a floor of zero', over.fixedDue >= 0, true)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
