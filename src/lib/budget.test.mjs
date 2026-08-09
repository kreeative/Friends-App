import { periodBounds, summarise } from './budget.js'
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
eq('pool = income - fixed - savings', s.pool, 320000 - 146500 - 40000)
eq('nothing spent yet, left = pool', s.left, 133500)
eq('perDay on day one', s.perDay, Math.floor(133500 / 31))

s = summarise({ plan, fixed, today: new Date(2026, 7, 16),
  entries: [
    { kind: 'expense', amount_cents: 4300, category: 'food',  happened_on: '2026-08-02' },
    { kind: 'expense', amount_cents: 1250, category: 'fun',   happened_on: '2026-08-10' },
    { kind: 'income',  amount_cents: 20000, category: null,   happened_on: '2026-08-11' },
    { kind: 'expense', amount_cents: 99999, category: 'home', happened_on: '2026-07-30' }, // last period
    { kind: 'expense', amount_cents: 88888, category: 'home', happened_on: '2026-09-02' }, // next period
  ] })
eq('spend outside the period is excluded', s.spent, 5550)
eq('unplanned income adds to the pool',    s.extra, 20000)
eq('left = pool + extra - spent',          s.left, 133500 + 20000 - 5550)
eq('entries in period', s.entries.length, 3)
eq('categories ranked, empties dropped', s.byCategory.map(c => c.key), ['food', 'fun'])

// ---- the states that matter ------------------------------------------------
s = summarise({ plan: { ...plan, monthly_income_cents: 150000 }, fixed, today: new Date(2026, 7, 5) })
eq('overcommitted when fixed+savings > income', s.overcommitted, true)
eq('overcommitted pool is negative', s.pool < 0, true)

s = summarise({ plan, fixed, today: new Date(2026, 7, 20),
  entries: [{ kind: 'expense', amount_cents: 200000, happened_on: '2026-08-03' }] })
eq('overspent flagged', s.overspent, true)
eq('overcommitted not confused with overspent', s.overcommitted, false)
eq('perDay goes negative rather than pretending', s.perDay < 0, true)

eq('no plan is not ready', summarise({ plan: null }).ready, false)
eq('zero income is not ready', summarise({ plan: { monthly_income_cents: 0 } }).ready, false)
eq('never divides by zero', Number.isFinite(summarise({ plan, fixed, today: new Date(2026,7,31) }).perDay), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
