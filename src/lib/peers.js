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
 * Every answer, one row per person: [sex, age, XOF per month, difficulty].
 *
 * WHY THE ROWS AND NOT JUST THE AMOUNTS.
 *
 * This started as a sorted list of the 92 amounts, which is all the rank
 * feature needs. Sorting throws away which amount belonged to whom, so the
 * moment the study wanted to say whether women save more than men, the only
 * way to answer was to type the answer in by hand next to the prose. That is
 * exactly the arrangement the header of src/content/studies.js exists to
 * forbid: a percentage copied into a text file drifts from the one the app
 * computes, and nobody notices which of the two is wrong.
 *
 * So the rows are the source and every figure on the public page is derived
 * from them. MONTHLY_XOF is now the sorted third column rather than a second
 * copy of it, which also means the ranking in the app and the breakdown in the
 * study cannot disagree about the same sample.
 *
 * WHY THIS IS STILL NOT IDENTIFYING.
 *
 * Sex, age, an amount and a 1-to-10 rating, with no name, no initial, no city,
 * no date and no free text attached to the row. The written ambitions live in
 * studies.js and are not joined to these; a quote carries an age and an amount
 * because that pairing is the point of the quote, and stops there. The form
 * asked for none of the rest. Rows are ordered by age, then sex, then amount,
 * so the array does not preserve submission order either.
 *
 * Amounts are rounded to the nearest hundred, because the source was free text
 * full of round numbers and a stored 43 333 would imply a precision nobody
 * typed. The values that are not round (6 600, 13 100, 32 800, 65 600, 98 400)
 * are euro amounts converted at the peg, and 43 300 is a weekly answer scaled
 * to a month. See the conversion note below.
 */
export const RESPONDENTS = [
  ['f', 15, 5000, 5], ['f', 17, 0, 8], ['f', 17, 0, 9],
  ['f', 17, 0, 6], ['f', 17, 10000, 4], ['f', 17, 20000, 9],
  ['f', 17, 43300, 4], ['f', 17, 44000, 8], ['h', 17, 45000, 8],
  ['f', 18, 0, 5], ['f', 18, 0, 10], ['f', 18, 0, 7],
  ['f', 18, 0, 8], ['f', 18, 0, 5], ['f', 18, 5000, 10],
  ['f', 18, 6600, 8], ['f', 18, 10000, 7], ['f', 18, 10000, 5],
  ['f', 18, 20000, 4], ['f', 18, 30000, 9], ['f', 18, 30000, 9],
  ['f', 18, 98400, 5], ['f', 18, 98400, 5], ['f', 18, 150000, 9],
  ['h', 18, 0, 10], ['h', 18, 0, 4], ['h', 18, 0, 7],
  ['h', 18, 0, 6], ['h', 18, 20000, 8], ['h', 18, 60000, 7],
  ['h', 18, 100000, 6], ['f', 19, 0, 6], ['f', 19, 0, 5],
  ['f', 19, 0, 6], ['f', 19, 0, 8], ['f', 19, 5000, 7],
  ['f', 19, 13200, 10], ['f', 19, 65600, 3], ['f', 19, 65600, 7],
  ['f', 19, 78000, 5], ['f', 19, 200000, 5], ['h', 19, 0, 3],
  ['h', 19, 0, 8], ['h', 19, 0, 6], ['h', 19, 0, 9],
  ['h', 19, 0, 7], ['h', 19, 0, 6], ['h', 19, 0, 6],
  ['h', 19, 0, 7], ['h', 19, 0, 7], ['h', 19, 5000, 6],
  ['h', 19, 32800, 2], ['h', 19, 50000, 5], ['h', 19, 50000, 3],
  ['h', 19, 75000, 10], ['h', 19, 100000, 4], ['f', 20, 0, 8],
  ['f', 20, 0, 5], ['f', 20, 13100, 4], ['f', 20, 13100, 10],
  ['f', 20, 20000, 4], ['f', 20, 25000, 1], ['f', 20, 45000, 7],
  ['f', 20, 50000, 5], ['f', 20, 65600, 6], ['f', 20, 120000, 4],
  ['h', 20, 0, 8], ['h', 20, 0, 8], ['h', 20, 0, 6],
  ['h', 20, 0, 3], ['h', 20, 0, 6], ['h', 20, 0, 10],
  ['h', 20, 5000, 7], ['h', 20, 32800, 3], ['h', 20, 35000, 7],
  ['h', 20, 65600, 10], ['h', 20, 125000, 4], ['h', 20, 1000000, 3],
  ['f', 21, 200000, 8], ['h', 21, 0, 10], ['h', 21, 0, 3],
  ['h', 21, 0, 10], ['h', 21, 5000, 8], ['h', 21, 65000, 7],
  ['h', 21, 100000, 6], ['f', 22, 30000, 2], ['f', 23, 0, 7],
  ['h', 25, 0, 5], ['h', 25, 50000, 6], ['f', 27, 200000, 5],
  ['h', 28, 1000000, 1], ['h', 32, 30000, 6],
]

/**
 * The amounts alone, sorted ascending. Derived, so it cannot drift from the
 * rows above. peerStanding walks it, so ascending order is load-bearing.
 */
export const MONTHLY_XOF = RESPONDENTS.map((r) => r[2]).sort((a, b) => a - b)

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

/**
 * A round XOF figure, with thin spaces between the thousands.
 *
 * Not Intl.NumberFormat with the reader's locale. These amounts are quoted FROM
 * the survey in CFA francs, so they are facts about the sample rather than
 * figures in the reader's own money, and formatting them as though they were
 * theirs is how "44 500 XOF" quietly becomes "44 500 $".
 *
 * Here rather than in a component because two screens print it now, the rank
 * sheet and the public study, and two copies of a formatter is two chances to
 * disagree about what the same number looks like.
 */
export function formatXof(n) {
  if (n == null || !Number.isFinite(n)) return ''
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')}\u202fXOF`
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
 * One slice of the sample, described the same way every time.
 *
 * `n` comes back on every group and the public page prints it, because the
 * interesting slices here are small. A median over 5 people is a number, not a
 * finding, and the only defence against it being read as one is showing the 5
 * next to it.
 *
 * Two rates rather than one: `savePct` is the share who put anything aside at
 * all, `medianSavers` is how much the ones who do manage. They answer different
 * questions and the survey separates the sexes on the first while saying
 * nothing certain about the second, so folding them together would hide the
 * only real result.
 */
export function groupStats(rows) {
  if (!rows || rows.length === 0) return null
  const amounts = rows.map((r) => r[2])
  const savers = amounts.filter((v) => v > 0).sort((a, b) => a - b)
  const zeros = amounts.length - savers.length
  const hard = rows.map((r) => r[3]).sort((a, b) => a - b)
  return {
    n: rows.length,
    zeros,
    savers: savers.length,
    zeroPct: Math.round((zeros / rows.length) * 100),
    savePct: Math.round((savers.length / rows.length) * 100),
    medianAll: median([...amounts].sort((a, b) => a - b)),
    medianSavers: savers.length ? median(savers) : 0,
    difficulty: median(hard),
    /* The share who rated saving 7 or more out of 10. Kept as its own figure
       because the median difficulty is 6 in almost every slice, so the median
       alone makes the question look settled when the tail is where the
       difference would show up. */
    hardPct: Math.round((hard.filter((d) => d >= 7).length / hard.length) * 100),
  }
}

/** Women and men, each described by groupStats. */
export function bySex() {
  return {
    women: groupStats(RESPONDENTS.filter((r) => r[0] === 'f')),
    men: groupStats(RESPONDENTS.filter((r) => r[0] === 'h')),
  }
}

/**
 * The four age bands.
 *
 * The bands are uneven on purpose: 18 to 20 is where three quarters of the
 * sample is, and splitting it further would produce cells of 20 rather than a
 * finer answer. The three outside it hold 9, 9 and 5 people, which is why
 * every caller gets `n` back and the study says so in words.
 */
export const AGE_BANDS = [
  { id: '15-17', lo: 15, hi: 17 },
  { id: '18-20', lo: 18, hi: 20 },
  { id: '21-24', lo: 21, hi: 24 },
  { id: '25+', lo: 25, hi: 200 },
]

export function byAgeBand() {
  return AGE_BANDS.map((b) => ({
    ...b,
    ...groupStats(RESPONDENTS.filter((r) => r[1] >= b.lo && r[1] <= b.hi)),
  }))
}

/** Those who save nothing, and those who save, rated on the same question. */
export function byOutcome() {
  return {
    zero: groupStats(RESPONDENTS.filter((r) => r[2] === 0)),
    saving: groupStats(RESPONDENTS.filter((r) => r[2] > 0)),
  }
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
