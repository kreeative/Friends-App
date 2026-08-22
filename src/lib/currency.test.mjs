import { CURRENCIES, FALLBACK, currencySymbol, detectCurrency, formatCurrency, minorDigits, splitAmount } from './currency.js'
let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}
/* Intl output uses non-breaking and narrow-no-break spaces between the number
   and the symbol. Comparing on those is comparing the ICU version, not the
   behaviour, so they are normalised to a plain space. */
const norm = (s) => s.replace(/[   ]/g, ' ')

// ---- detection -------------------------------------------------------------
eq('canada', detectCurrency(['en-CA']), 'CAD')
eq('quebec', detectCurrency(['fr-CA']), 'CAD')
eq('france', detectCurrency(['fr-FR']), 'EUR')
eq('ivory coast', detectCurrency(['fr-CI']), 'XOF')
eq('senegal', detectCurrency(['wo-SN', 'fr-SN']), 'XOF')
eq('cameroon is not the same franc', detectCurrency(['fr-CM']), 'XAF')
eq('united kingdom', detectCurrency(['en-GB']), 'GBP')
eq('united states', detectCurrency(['en-US']), 'USD')
eq('morocco', detectCurrency(['ar-MA']), 'MAD')

// A bare language still has a region implied in it, which is the whole reason
// maximize is in there.
eq('bare fr resolves to france', detectCurrency(['fr']), 'EUR')
eq('bare en resolves to the states', detectCurrency(['en']), 'USD')

// Order matters: the first preference that lands on a currency we offer wins.
eq('first usable preference wins', detectCurrency(['fr-CI', 'fr-FR']), 'XOF')
eq('skips what we do not offer', detectCurrency(['ja-JP', 'fr-CI']), 'XOF')

eq('nothing known falls back', detectCurrency(['ja-JP']), FALLBACK)
eq('junk falls back', detectCurrency(['not a tag', '']), FALLBACK)
eq('no preferences at all', detectCurrency([]), FALLBACK)
eq('called with nothing', detectCurrency(), FALLBACK)

// ---- how many decimals -----------------------------------------------------
eq('dollars have two', minorDigits('CAD'), 2)
eq('euros have two', minorDigits('EUR'), 2)
eq('cfa francs have none', minorDigits('XOF'), 0)
eq('central african francs have none', minorDigits('XAF'), 0)
eq('unknown code is assumed decimal', minorDigits('ZZZ'), 2)
eq('no code is the fallback', minorDigits(null), 2)

// ---- formatting ------------------------------------------------------------
// The number is the contract; the symbol and its placement belong to Intl and
// move between ICU versions, so these assert the parts that must not drift.
eq('canadian, read in canada', norm(formatCurrency(50000, 'CAD', ['en-CA'])), '$500.00')
eq('canadian, read in britain', norm(formatCurrency(50000, 'CAD', ['en-GB'])), 'CA$500.00')
eq('euros, read in france', norm(formatCurrency(50000, 'EUR', ['fr-FR'])), '500,00 €')

/* The one that matters. The stored value is still 500 * 100, and a currency
   with no minor unit must not print two zeros after it. */
const cfa = norm(formatCurrency(50000, 'XOF', ['fr-CI']))
eq('cfa has the round number', cfa.includes('500'), true)
eq('cfa has no decimals', /500[.,]00/.test(cfa), false)

// Sub-unit amounts in a currency that has no sub-unit round, they do not leak.
const odd = norm(formatCurrency(50037, 'XOF', ['fr-CI']))
eq('cfa rounds rather than showing a fraction', /[.,]/.test(odd.replace(/\s/g, '')), false)

eq('zero is a real amount', norm(formatCurrency(0, 'CAD', ['en-CA'])), '$0.00')
eq('missing amount is zero', norm(formatCurrency(null, 'CAD', ['en-CA'])), '$0.00')
eq('missing code is the fallback', formatCurrency(50000, null, ['en-CA']), formatCurrency(50000, FALLBACK, ['en-CA']))
eq('an unknown code still shows the number', formatCurrency(50000, 'ZZZ', ['en-CA']).includes('500'), true)

// ---- the symbol beside a field ---------------------------------------------
// Compared against what formatCurrency does with the same inputs rather than
// against a literal, so the assertions are about the two agreeing and not about
// which ICU version the machine happens to ship.
const sideOf = (code, tags) => {
  const s = currencySymbol(code, tags)
  const full = norm(formatCurrency(100, code, tags))
  return { s, full }
}

{
  const { s, full } = sideOf('CAD', ['en-CA'])
  eq('en-CA symbol', s.symbol, '$')
  eq('en-CA puts it in front', s.before, true)
  eq('en-CA agrees with the formatter', full.startsWith(s.symbol), true)
}
{
  const { s, full } = sideOf('CAD', ['fr-CA'])
  eq('fr-CA puts it after', s.before, false)
  eq('fr-CA agrees with the formatter', full.trimEnd().endsWith(s.symbol), true)
}
{
  const { s } = sideOf('EUR', ['fr-FR'])
  eq('euro in france trails', s.before, false)
  eq('euro symbol', s.symbol, '€')
}
{
  const { s } = sideOf('EUR', ['en-CA'])
  eq('euro read in canada leads', s.before, true)
}

eq('an unknown code falls back to the code itself', currencySymbol('ZZZ', ['en-CA']).symbol.length > 0, true)
eq('no code is the fallback currency', currencySymbol(null, ['en-CA']).symbol, currencySymbol(FALLBACK, ['en-CA']).symbol)
eq('no locale still answers', currencySymbol('CAD', []).symbol.length > 0, true)
eq('every offered code has a symbol', CURRENCIES.every((c) => currencySymbol(c, ['fr-CA']).symbol.length > 0), true)

// ---- the list --------------------------------------------------------------
eq('the fallback is offered in the picker', CURRENCIES.includes(FALLBACK), true)
eq('every offered code formats', CURRENCIES.every((c) => formatCurrency(100, c, ['en-CA']).length > 0), true)
eq('no duplicates in the picker', CURRENCIES.length, new Set(CURRENCIES).size)




/* --- splitAmount ---------------------------------------------------------- */
{
  const j = (c, code, tags) => { const s = splitAmount(c, code, tags); return [s.head, s.cents] }

  eq('en-CA cuts before the point', j(1524500, 'CAD', ['en-CA']), ['$15,245', '.00'])
  eq('fr-CA cuts before the comma', j(1524500, 'CAD', ['fr-CA'])[1], ',00')
  /* And the symbol that trails the decimals in French is its own part, not
     lost and not swept into the small type. */
  eq('fr-CA keeps the trailing symbol', splitAmount(1524500, 'CAD', ['fr-CA']).suffix.trim(), '$')
  /* head + tail must always rebuild exactly what formatCurrency produced,
     across locales that put the symbol and the separators in different
     places. Reported as the list of mismatches so a failure names them. */
  eq('the two halves rebuild the original', (() => {
    const bad = []
    for (const tag of ['en-CA', 'fr-CA', 'en-GB', 'de-DE']) {
      for (const c of [0, 5, 1234, 1524500, -990]) {
        const s = splitAmount(c, 'CAD', [tag])
        if (s.head + s.cents + s.suffix !== formatCurrency(c, 'CAD', [tag])) bad.push(`${tag}:${c}`)
      }
    }
    return bad
  })(), [])

  /* A currency with no minor unit has nothing to tuck away, and must not have
     its thousands separator mistaken for a decimal one. */
  eq('XOF has no cents part at all', j(1200000, 'XOF', ['fr-CA'])[1], '')
  eq('and XOF head is the entire string',
     splitAmount(1200000, 'XOF', ['fr-CA']).head, formatCurrency(1200000, 'XOF', ['fr-CA']))

  /* The trap: a thousands separator looks the same as a decimal one, so a
     naive first-match split would cut "15,245.00" at the comma. */
  eq('thousands separators are not mistaken for decimals',
     j(1524500, 'CAD', ['en-CA'])[0], '$15,245')
  eq('nor in the other direction', j(1524500, 'CAD', ['de-DE'])[1], ',00')
}


console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)