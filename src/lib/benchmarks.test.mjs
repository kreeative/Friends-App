/**
 * The comparison, and the ways it could claim more than it knows.
 *
 * Most of these are about refusal: no figure for a country, no rate for the
 * reader, a difference too small to be a difference. A benchmark that always
 * has an answer is a benchmark that is making some of them up.
 */
import {
  AGE_BANDS, ageBandOf, benchmarkFor, compareRate, compareShares, COUNTRIES,
  detectCountry, otherBasisFor, SAVING_RATE, SAVING_RATE_BY_AGE, sharesOf,
  SNAPSHOT, spendOver, SPEND_SHARE,
} from './benchmarks.js'

let pass = 0
const fails = []
const ok = (what, cond, got) => {
  if (cond) pass++
  else fails.push(`${what}${got === undefined ? '' : `  got: ${got}`}`)
}
const eq = (what, a, b) => ok(what, a === b, `${a} !== ${b}`)

/* ---------------------------------------------------------- the table --- */
{
  ok('every row names its source', SAVING_RATE.every((r) => r.source && r.source.length > 8))
  ok('every row names the period it covers', SAVING_RATE.every((r) => r.period))
  ok('every rate is a whole number', SAVING_RATE.every((r) => Number.isInteger(r.rate)))
  ok('and a plausible one', SAVING_RATE.every((r) => r.rate >= 0 && r.rate <= 60))
  ok('the snapshot is dated', /^\d{4}-\d{2}$/.test(SNAPSHOT), SNAPSHOT)
  eq('no duplicate countries', new Set(COUNTRIES).size, COUNTRIES.length)
  /* The rule the file's own note commits to. A row for a country with no
     published household saving rate is the failure mode this guards. */
  ok('no row for a country with no published figure on this basis',
    !COUNTRIES.includes('CI') && !COUNTRIES.includes('SN'))
}
{
  const ca = SPEND_SHARE.CA
  eq('the Canadian shares add to a hundred',
    Object.values(ca.shares).reduce((n, v) => n + v, 0), 100)
  ok('and it names its source and year', Boolean(ca.source && ca.period))
  eq('only the country the survey exists for', Object.keys(SPEND_SHARE).length, 1)
}

/* ------------------------------------------------------- benchmarkFor --- */
{
  eq('a known country returns its rate', benchmarkFor('CA').rate, 6)
  eq('and says the figure is the country one', benchmarkFor('CA').scope, 'country')
  eq('an unknown one returns null', benchmarkFor('CI'), null)
  eq('so does nothing at all', benchmarkFor(undefined), null)
}
{
  const r = benchmarkFor('CA', 'u35')
  eq('a band returns the band figure', r.rate, 5)
  eq('and says so', r.scope, 'age')
  eq('naming the band', r.band, 'u35')
  eq('with its own source', r.source.includes('groupe d’âge'), true)
}
{
  eq('a band nobody has data for falls back to the country',
    benchmarkFor('FR', 'u35').scope, 'country')
  eq('and so does a band that is not a band', benchmarkFor('CA', 'nonsense').scope, 'country')
}

/* ------------------------------------------------------------ by age --- */
{
  const t = SAVING_RATE_BY_AGE.CA
  eq('five bands', Object.keys(t.rates).length, 5)
  eq('one per declared band', AGE_BANDS.every((b) => t.rates[b] != null), true)
  ok('every one is a whole number', Object.values(t.rates).every(Number.isInteger))
  ok('it names its source and period', Boolean(t.source && t.period))
  /* The shape is the part that is not in doubt: saving rises through working
     life and goes negative after 65, because that is when a household spends
     what it put aside. A table where 65+ is the highest is a transcription
     error, not a finding. */
  ok('saving peaks in the middle of working life',
    t.rates['35_44'] > t.rates.u35 && t.rates['45_54'] > t.rates.u35)
  ok('and turns negative in retirement', t.rates['65p'] < 0, String(t.rates['65p']))
  eq('only Canada has a by-age table', Object.keys(SAVING_RATE_BY_AGE).length, 1)
}

/* ---------------------------------------------------------- ageBandOf --- */
{
  const on = (y, m, d) => new Date(y, m - 1, d)
  eq('a twenty-something', ageBandOf('2000-01-01', on(2026, 6, 1)), 'u35')
  eq('exactly 35 leaves the first band', ageBandOf('1991-06-01', on(2026, 6, 1)), '35_44')
  eq('the day before does not', ageBandOf('1991-06-02', on(2026, 6, 1)), 'u35')
  eq('mid forties', ageBandOf('1980-01-01', on(2026, 6, 1)), '45_54')
  eq('late fifties', ageBandOf('1968-01-01', on(2026, 6, 1)), '55_64')
  eq('and retirement', ageBandOf('1950-01-01', on(2026, 6, 1)), '65p')
  eq('exactly 65 is in the last band', ageBandOf('1961-06-01', on(2026, 6, 1)), '65p')
}
{
  const on = (y, m, d) => new Date(y, m - 1, d)
  /* The birthday has not happened yet this year, so the age is one less. Same
     month-then-day comparison daysUntilBirthday uses, and the same reason: a
     date subtraction gets this wrong by a day around the boundary. */
  eq('a birthday later this month has not happened', ageBandOf('1991-06-15', on(2026, 6, 1)), 'u35')
  eq('on the day itself it has', ageBandOf('1991-06-01', on(2026, 6, 1)), '35_44')
  eq('and the day after', ageBandOf('1991-05-31', on(2026, 6, 1)), '35_44')
}
{
  eq('no birthday on file is no band', ageBandOf(null), null)
  eq('nor is a blank', ageBandOf(''), null)
  eq('nor is rubbish', ageBandOf('not-a-date'), null)
  eq('nor is a year nobody was born in', ageBandOf('1650-01-01', new Date(2026, 0, 1)), null)
  eq('a full timestamp still parses', ageBandOf('2000-01-01T00:00:00Z', new Date(2026, 5, 1)), 'u35')
}

/* -------------------------------------------------------- otherBasis --- */
{
  const ci = otherBasisFor('CI')
  ok('Cote d Ivoire has a figure', Boolean(ci))
  eq('on a DIFFERENT basis', ci.basis, 'gross-national')
  ok('and it says which, in its source', /nationale brute|% du PIB/.test(ci.source), ci.source)
  /* The whole point of the split: it must never become a rank. */
  eq('it is not in the rate table', SAVING_RATE.some((r) => r.code === 'CI'), false)
  eq('so it cannot be benchmarked against', benchmarkFor('CI'), null)
  eq('and comparing gives no standing', compareRate(12, 'CI').standing, null)
  eq('a country with no other-basis figure returns null', otherBasisFor('CA'), null)
}

/* ------------------------------------------------------ detectCountry --- */
{
  eq('a full tag resolves', detectCountry(['fr-CA']), 'CA')
  eq('a bare language maximizes', detectCountry(['fr']), 'FR')
  eq('the first tag with an answer wins', detectCountry(['fr-CI', 'fr-CA']), 'CA')
  eq('a euro-area member falls through to the aggregate', detectCountry(['de-DE']), 'EA')
  eq('somewhere with no figure returns null rather than a default', detectCountry(['fr-CI']), null)
  eq('no tags is null too', detectCountry([]), null)
  eq('and rubbish does not throw', detectCountry(['%%%']), null)
}

/* -------------------------------------------------------- compareRate --- */
{
  const r = compareRate(20, 'CA')
  eq('well above the published rate', r.standing, 'above')
  eq('by the difference', r.delta, 14)
}
{
  eq('well below', compareRate(1, 'FR').standing, 'below')
  eq('inside the band is near, not above', compareRate(7, 'CA').standing, 'near')
  eq('and the band is symmetric', compareRate(5, 'CA').standing, 'near')
  eq('exactly two points out is still near', compareRate(8, 'CA').standing, 'near')
  eq('just past it is not', compareRate(8.5, 'CA').standing, 'above')
}
{
  eq('no rate for the reader means no standing', compareRate(null, 'CA').standing, null)
  eq('no figure for the country means no standing either', compareRate(12, 'CI').standing, null)
  eq('NaN is not a rate', compareRate(NaN, 'CA').standing, null)
  eq('and the benchmark still comes back so the screen can say what is missing',
    compareRate(null, 'CA').benchmark.code, 'CA')
}

/* ----------------------------------------------------------- sharesOf --- */
{
  const s = sharesOf([{ key: 'food', cents: 5000 }, { key: 'home', cents: 5000 }])
  eq('an even split is fifty fifty', s[0].share, 50)
  eq('both of them', s[1].share, 50)
}
{
  /* Thirds. Floor alone gives 33+33+33 = 99, and a table that sums to 99 is the
     thing largest remainder is here to prevent. */
  const s = sharesOf([
    { key: 'food', cents: 1000 }, { key: 'home', cents: 1000 }, { key: 'fun', cents: 1000 },
  ])
  eq('thirds still add to a hundred', s.reduce((n, r) => n + r.share, 0), 100)
}
{
  const rows = [
    { key: 'food', cents: 3337 }, { key: 'home', cents: 3337 },
    { key: 'fun', cents: 3326 }, { key: 'health', cents: 1 },
  ]
  eq('and so does an awkward one', sharesOf(rows).reduce((n, r) => n + r.share, 0), 100)
}
{
  eq('nothing spent is no table, not a divide by zero', sharesOf([]).length, 0)
  eq('and neither is a set of zeroes', sharesOf([{ key: 'food', cents: 0 }]).length, 0)
}
{
  /* Deterministic: the same input twice must give the same table, or the tie
     break is reading uninitialised order from somewhere. */
  const rows = [{ key: 'food', cents: 1 }, { key: 'home', cents: 1 }, { key: 'fun', cents: 1 }]
  eq('ties break the same way every time',
    JSON.stringify(sharesOf(rows)), JSON.stringify(sharesOf(rows)))
}

/* ------------------------------------------------------ compareShares --- */
{
  const c = compareShares([
    { key: 'home', cents: 50000 }, { key: 'food', cents: 30000 }, { key: 'transport', cents: 20000 },
  ], 'CA')
  eq('three rows', c.rows.length, 3)
  eq('largest first', c.rows[0].key, 'home')
  eq('my share', c.rows[0].mine, 50)
  eq('against theirs', c.rows[0].theirs, 30)
  eq('and the gap', c.rows[0].delta, 20)
  ok('carrying the source through', Boolean(c.source && c.period))
}
{
  eq('a country with no survey has no table', compareShares([{ key: 'food', cents: 1 }], 'FR'), null)
  eq('and nothing spent has none either', compareShares([], 'CA'), null)
}
{
  /* A category the reader has not spent in must not appear as a zero: an empty
     row invites the reader to read a 0 % that was never measured. */
  const c = compareShares([{ key: 'food', cents: 100 }], 'CA')
  eq('only categories with real spending', c.rows.length, 1)
  eq('and it is the one', c.rows[0].key, 'food')
}

/* ---------------------------------------------------------- spendOver --- */
{
  const rows = [
    { kind: 'expense', category: 'food', amount_cents: 100, happened_on: '2026-03-04' },
    { kind: 'expense', category: 'food', amount_cents: 50, happened_on: '2026-04-04' },
    { kind: 'expense', category: 'home', amount_cents: 900, happened_on: '2026-03-20' },
    { kind: 'income', category: null, amount_cents: 9999, happened_on: '2026-03-01' },
    { kind: 'expense', category: 'fun', amount_cents: 700, happened_on: '2026-03-08', excluded: true },
    { kind: 'expense', category: null, amount_cents: 25, happened_on: '2026-03-09' },
  ]
  const out = spendOver(rows, '2026-03-01', '2026-04-01')
  const by = Object.fromEntries(out.map((r) => [r.key, r.cents]))
  eq('inside the window only', by.food, 100)
  eq('summed per category', by.home, 900)
  eq('income is not spending', by.income, undefined)
  eq('excluded rows are left out', by.fun, undefined)
  eq('an uncategorised expense lands in other', by.other, 25)
  eq('and nothing else appears', out.length, 3)
}
{
  eq('the end of the window is exclusive',
    spendOver([{ kind: 'expense', category: 'food', amount_cents: 5, happened_on: '2026-04-01' }], '2026-03-01', '2026-04-01').length, 0)
  eq('a blank date is skipped rather than counted',
    spendOver([{ kind: 'expense', category: 'food', amount_cents: 5, happened_on: '' }], '2026-03-01', '2026-04-01').length, 0)
  eq('an empty ledger is an empty table', spendOver([], '2026-03-01', '2026-04-01').length, 0)
}
{
  /* The bug this exists for: the shares must come from a window, so a partial
     month cannot be compared against an annual average. */
  const rows = [
    { kind: 'expense', category: 'food', amount_cents: 4500, happened_on: '2026-06-04' },
    { kind: 'expense', category: 'home', amount_cents: 90000, happened_on: '2026-05-05' },
    { kind: 'expense', category: 'food', amount_cents: 40000, happened_on: '2026-05-09' },
  ]
  const partial = compareShares(spendOver(rows, '2026-06-01', '2026-07-01'), 'CA')
  const full = compareShares(spendOver(rows, '2026-05-01', '2026-06-01'), 'CA')
  eq('one partial month is one lopsided row', partial.rows[0].mine, 100)
  eq('a closed month is a real pattern', full.rows[0].key, 'home')
  eq('and it is nowhere near a hundred', full.rows[0].mine, 69)
}

console.log(`\nbenchmarks\n\n  ${pass} passed, ${fails.length} failed\n`)
for (const f of fails) console.log(`  FAIL ${f}`)
process.exit(fails.length ? 1 : 0)
