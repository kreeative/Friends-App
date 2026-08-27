/**
 * What people your own age actually put aside, from a survey rather than from
 * national accounts.
 *
 * WHY THIS IS NOT IN benchmarks.js.
 *
 * That file holds published HOUSEHOLD SAVING RATES: a percentage of disposable
 * income, from national accounts, for a whole country. It says at the top that
 * quoting a real figure which means something different from what the screen
 * implies is worse than having no feature at all, and it means it. This data is
 * a different measure in every respect, so it lives in a different file:
 *
 *   - an ABSOLUTE AMOUNT per month, not a rate. There is no denominator: nobody
 *     was asked what they earn, so no percentage can be computed from it and
 *     none is offered.
 *   - a SAMPLE OF 92 PEOPLE, not a country. Recruited by sharing a link, so it
 *     is a convenience sample and not representative of anything.
 *   - SELF-REPORTED, in free text, in five currencies.
 *
 * It cannot be fed to compareRate() and compareRate() would be wrong to accept
 * it. Nothing here returns a rate and nothing in benchmarks.js imports this.
 *
 * WHY IT IS WORTH HAVING ANYWAY.
 *
 * benchmarks.js is honest that Cote d'Ivoire has no published household saving
 * rate on the national accounts basis, so an Ivorian user gets no peer
 * comparison at all: the screen tells them the statistic does not exist and
 * shows a gross-national figure as information. For a 19-year-old in Abidjan
 * that is true and useless.
 *
 * This is the thing that actually answers their question, and its honesty comes
 * from being labelled as what it is: 92 young people asked in August 2026, most
 * of them 18 to 20, most of them Ivorian. Not a national statistic. Not other
 * users of this app.
 *
 * IT IS NOT OTHER USERS OF THIS APP, AND CANNOT BECOME THEM.
 *
 * 19_budget.sql: "the rest of the app is built to be seen by four other people;
 * this is built to be seen by nobody... That is not a default to be relaxed
 * later, it is the feature." The array below ships inside the bundle. No query
 * leaves the device to produce this comparison, there is no aggregate endpoint,
 * and there is no wire here to widen later.
 *
 * THE ZEROES ARE THE POINT, SO THEY ARE IN THE DISTRIBUTION.
 *
 * 38 of the 92 answered that they save nothing. Dropping them would turn "the
 * median is 44 500" into a sentence about the 54 people who already manage it,
 * which is the opposite of encouraging for somebody who saved 5 000 this month.
 * Kept in, that person is ahead of 44 % of the sample, which is both true and
 * worth telling them.
 */

/** When the survey ran. Shown, so its age is the reader's to judge. */
export const SURVEY = {
  n: 92,
  fielded: '2026-08',
  /* Every claim the UI is allowed to make about who answered. */
  medianAge: 19,
  ageRange: [15, 32],
  share1820: 75,
  shareLocal: 91,
  women: 47,
  men: 45,
  /* Context that is not about the amount, but is about the reader. */
  hasAppPct: 87,
  savesNothingPct: 41,
  hasAmbitionPct: 67,
  difficultyMedian: 6,
  source: 'Sondage Rich & Friends, 92 réponses',
  /* Named so a caller cannot mistake this for benchmarks.js's basis. */
  basis: 'self-reported-monthly-amount',
}

/**
 * Every answer, in XOF per month, sorted, rounded to the nearest hundred.
 *
 * Stored as the whole distribution rather than as quartiles, because with 92
 * points the exact position is cheaper to compute than an interpolation is to
 * justify. Rounded to hundreds because the source was free text full of round
 * numbers: a stored 43 333 would imply a precision nobody typed.
 *
 * The six values that are not round (6 600, 13 100, 32 800, 65 600, 98 400)
 * are euro amounts converted at the peg, and 43 300 is a weekly answer scaled
 * to a month. See the conversion note below.
 */
export const MONTHLY_XOF = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  5000, 5000, 5000, 5000, 5000, 5000, 6600, 10000, 10000, 10000,
  13100, 13100, 13200, 20000, 20000, 20000, 20000, 25000,
  30000, 30000, 30000, 30000, 32800, 32800, 35000, 43300, 44000,
  45000, 45000, 50000, 50000, 50000, 50000, 60000, 65000,
  65600, 65600, 65600, 65600, 75000, 78000, 98400, 98400,
  100000, 100000, 100000, 120000, 125000, 150000,
  200000, 200000, 200000, 1000000, 1000000,
]

/**
 * The currencies this comparison can be made in AT ALL.
 *
 * Not a shortlist of the popular ones. The CFA francs are pegged to the euro by
 * law at exactly 655.957, so converting between these three is arithmetic, not
 * an estimate. Every other currency would need a market rate that is a guess on
 * the day it is written down and wrong by the time somebody reads it, and
 * benchmarks.js is explicit that a figure meaning something other than what the
 * screen implies is worse than no figure. So a user in dollars is told the
 * comparison does not apply rather than shown one built on an invented rate.
 */
export const PEG = 655.957
export const COMPARABLE = { XOF: 1, XAF: 1, EUR: PEG }

/** Is this a currency the sample can be compared against without guessing? */
export function comparableCurrency(code) {
  return Object.prototype.hasOwnProperty.call(COMPARABLE, String(code ?? '').toUpperCase())
}

/**
 * An amount in the user's currency, as XOF.
 *
 * Cents in, XOF out. Every amount in this app is an integer with two implied
 * decimals in every currency (see src/lib/currency.js), including the ones that
 * have no minor unit, so the division by 100 is right for XOF as well as EUR.
 */
export function toXof(cents, code) {
  const k = COMPARABLE[String(code ?? '').toUpperCase()]
  if (k == null || !Number.isFinite(cents)) return null
  return (cents / 100) * k
}

/**
 * Where one month's saving sits in the sample.
 *
 * `beats` is the share of the 92 who put aside strictly LESS than you, so
 * saving nothing beats nobody rather than beating the other 37 people who also
 * saved nothing. Somebody who saved 5 000 beats the 38 who saved zero, which is
 * 41 %, and that is the number worth showing them.
 *
 * `ties` is reported separately rather than folded in, so a caller can say "the
 * same as 6 others" instead of silently rounding somebody up or down.
 *
 * Returns null for an unusable input rather than a zero. A screen cannot tell
 * "saved nothing" from "we do not know" once both are the number 0, and one of
 * those is a claim about a person.
 */
export function peerStanding(cents, code = 'XOF') {
  const xof = toXof(cents, code)
  if (xof == null || xof < 0) return null

  let below = 0
  let same = 0
  for (const v of MONTHLY_XOF) {
    if (v < xof) below += 1
    else if (v === xof) same += 1
  }

  const n = MONTHLY_XOF.length
  return {
    xof,
    n,
    below,
    ties: same,
    /* Whole percent. A screen saying "you beat 53.26 %" of a 92-person
       convenience sample is claiming a precision the sample cannot carry. */
    beats: Math.round((below / n) * 100),
    savesNothing: xof === 0,
  }
}

/** The median of the whole sample, zeroes included. */
export function medianAll() {
  return median(MONTHLY_XOF)
}

/** The median among those who put something aside. The other, kinder number. */
export function medianSavers() {
  return median(MONTHLY_XOF.filter((v) => v > 0))
}

function median(sorted) {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Whether this comparison is honest for THIS person.
 *
 * Four gates, and all four have to pass.
 *
 * WHERE, because 91 % of the sample is Ivorian. Counting in CFA francs is
 * enough on its own; otherwise the person has to have said Cote d'Ivoire. The
 * euro is on the peg and so the arithmetic works for a 19-year-old in Paris,
 * which is exactly why this gate exists separately from the currency one: the
 * conversion being exact does not make the comparison relevant, and showing a
 * French student where they stand against Abidjan teenagers would be a true
 * number answering a question nobody asked. The diaspora case it does allow is
 * somebody who picked CI and counts in euros.
 *
 * AGE, because three quarters of the sample is 18 to 20 and the oldest person
 * in it is 32. Telling a 45-year-old where they stand against a group of
 * teenagers is the kind of true-but-misleading claim this codebase keeps
 * refusing to make. Thirty is the honest edge of the data.
 *
 * CURRENCY, because anything outside the euro peg needs a market rate. See
 * COMPARABLE.
 *
 * A BIRTHDAY, because without one there is no age to gate on, and guessing that
 * an unknown user is young in order to show them a feature is deciding what is
 * true from what is convenient.
 */
const CFA = new Set(['XOF', 'XAF'])

export function appliesTo({ age, currency, country } = {}) {
  const cur = String(currency ?? '').toUpperCase()
  if (!comparableCurrency(cur)) return { ok: false, why: 'currency' }
  if (!CFA.has(cur) && country !== 'CI') return { ok: false, why: 'country' }
  if (age == null || !Number.isFinite(age)) return { ok: false, why: 'no-age' }
  if (age > 30) return { ok: false, why: 'age' }
  return { ok: true, why: null }
}
