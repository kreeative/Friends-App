/**
 * Which currency, and how to write it.
 *
 * The budget stored a currency from the day it shipped and never wrote one:
 * budget_plan.currency has sat at its default of CAD for every account, so a
 * person in Abidjan planning in francs was reading their own rent back in
 * Canadian dollars. The column existed, the plumbing did not.
 *
 * Pure, and with no imports, for the same reason budget.js is: this is
 * arithmetic and table lookup, and a function that takes the locale tags as an
 * argument can be tested for a browser in Dakar without one.
 *
 * AMOUNTS DO NOT CHANGE SHAPE.
 *
 * Every amount in the database is an integer with two implied decimals, and it
 * stays that way in every currency. XOF has no minor unit, so 500 francs is
 * stored as 50000 and rendered by Intl as "500 F CFA": the two spare digits go
 * unused rather than the column meaning something different depending on who
 * is looking at it. A column whose scale depends on a setting is a column that
 * silently multiplies somebody's rent by a hundred the day they change it.
 */

/** The fallback, and the answer for anywhere not in the table below. */
export const FALLBACK = 'CAD'

/**
 * What the picker offers.
 *
 * Ten, not two hundred. This app is Canadian and Ivorian with a French and an
 * English side, so the list is the places it is actually used plus the ones
 * people move between. Adding one is a line here; the database accepts any
 * three-letter code on purpose, so it never needs a migration.
 */
export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'XOF', 'XAF', 'MAD', 'NGN', 'GHS', 'CHF']

const SUPPORTED = new Set(CURRENCIES)

/** Region to currency, for the regions this app has any reason to know about. */
const REGION_CURRENCY = {}
const claim = (code, regions) => regions.forEach((r) => (REGION_CURRENCY[r] = code))

claim('CAD', ['CA'])
claim('USD', ['US', 'EC', 'PA', 'SV'])
claim('GBP', ['GB', 'IM', 'JE', 'GG'])
claim('CHF', ['CH', 'LI'])
claim('MAD', ['MA', 'EH'])
claim('NGN', ['NG'])
claim('GHS', ['GH'])
// UEMOA, the West African CFA franc.
claim('XOF', ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'])
// CEMAC, the Central African one. Same face value, different currency.
claim('XAF', ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'])
claim('EUR', [
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA', 'XK',
  // The overseas departments report their own region codes and use the euro.
  'GF', 'GP', 'MQ', 'RE', 'YT', 'PM', 'BL', 'MF',
])

/**
 * The region a locale tag implies, including when it does not say.
 *
 * `maximize` is what makes a bare "fr" usable: it resolves to fr-Latn-FR, so
 * somebody whose browser reports only a language still gets a sensible guess
 * instead of nothing. It is also why this cannot be a regex over the tag.
 */
function regionOf(tag) {
  try {
    const locale = new Intl.Locale(tag)
    return (locale.maximize?.().region ?? locale.region) || null
  } catch {
    return null
  }
}

/**
 * A first guess, from the browser's own preferences.
 *
 * Ordered, so a device set to fr-CI then fr-FR gets francs rather than euros.
 * Anything the list above does not cover falls back rather than offering a
 * currency the picker cannot show.
 *
 * This is a guess and is treated as one: it is written to the profile once, on
 * first sight, and after that the person's own choice is the only thing that
 * decides. Re-detecting on every sign-in would quietly overwrite the setting
 * of anybody who travels.
 */
export function detectCurrency(tags = []) {
  for (const tag of tags) {
    const code = REGION_CURRENCY[regionOf(tag)]
    if (code && SUPPORTED.has(code)) return code
  }
  return FALLBACK
}

/**
 * How many decimal places this currency actually has.
 *
 * Asked of Intl rather than kept in a table, because Intl already knows and a
 * second list is a second thing to get wrong. XOF, XAF and JPY answer 0; most
 * of the rest answer 2.
 *
 * The input fields need this. A plan form that shows "500.00 F CFA" is
 * offering somebody two decimals of a currency that has none.
 */
export function minorDigits(code) {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code || FALLBACK,
    }).resolvedOptions().maximumFractionDigits
  } catch {
    return 2
  }
}

/**
 * What this currency is called, in the reader's language.
 *
 * Asked of Intl rather than kept as a pair of hand-written lists, which would
 * be twenty strings to translate and to keep in step with the array above. It
 * knows that XOF is "West African CFA franc" and "franc CFA (BCEAO)" already.
 *
 * Falls back to the code, which is not a failure: three letters is what a bank
 * app shows and is recognisable on its own.
 */
export function currencyName(code, tag) {
  try {
    return new Intl.DisplayNames([tag].filter(Boolean), { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * The symbol, and which side of the number it belongs on.
 *
 * For the one place an amount is being TYPED rather than read. formatCurrency
 * cannot help there: it returns a finished string, and a finished string is not
 * something you can put a caret in the middle of. So the field holds the bare
 * number the person is typing and the symbol sits beside it as its own element.
 *
 * The side is not decoration. "$12.50" and "12,50 $" are the same money in the
 * two halves of this app's audience, and a symbol nailed to the left is wrong
 * in Montréal in French. Asked of Intl by looking at where the currency part
 * falls relative to the digits, so it stays right for a currency nobody here
 * thought about.
 *
 * @returns {{symbol: string, before: boolean}}
 */
export function currencySymbol(code, tags = []) {
  const currency = code || FALLBACK

  try {
    const parts = new Intl.NumberFormat(tags.filter(Boolean), {
      style: 'currency',
      currency,
    }).formatToParts(1)

    const at = parts.findIndex((p) => p.type === 'currency')
    if (at < 0) return { symbol: currency, before: true }

    return {
      symbol: parts[at].value,
      before: !parts.slice(0, at).some((p) => p.type === 'integer'),
    }
  } catch {
    return { symbol: currency, before: true }
  }
}

/**
 * The whole point: an amount, written the way the reader's device would.
 *
 * The currency is the person's; the formatting is the browser's, and those are
 * two different settings. Five hundred euros is "500,00 €" in Paris and
 * "€500.00" in Toronto, and both are correct for the same money. Intl places
 * the symbol, picks the separators and drops the decimals on a currency that
 * has none, which is the entire reason not to hand-roll any of it.
 *
 * `tags` is navigator.languages, passed in rather than read here so this stays
 * testable. The app's own language toggle is the last resort only: somebody
 * reading in English in Montréal still wants Canadian conventions.
 */
export function formatCurrency(cents, code, tags = []) {
  const currency = code || FALLBACK
  const amount = (cents ?? 0) / 100

  try {
    return new Intl.NumberFormat(tags.filter(Boolean), { style: 'currency', currency }).format(
      amount,
    )
  } catch {
    /* An unknown code, or an engine with no data for it. The number is still
       the answer; the code stands in for a symbol nobody can render. */
    return `${amount.toFixed(minorDigits(currency))} ${currency}`
  }
}
