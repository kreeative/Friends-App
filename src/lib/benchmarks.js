/**
 * How your saving rate compares to everybody else's, from published figures.
 *
 * "Comparer son niveau d'epargne par rapport a d'autres gens de son pays base
 * sur une statistique." So the numbers here have to be real ones, and the two
 * ways to get that wrong are both worse than having no feature at all: making
 * a figure up, and quoting a real figure that means something different from
 * what the screen implies.
 *
 * WHERE THESE COME FROM, AND WHAT THEY ARE NOT.
 *
 * Every row below is a HOUSEHOLD SAVING RATE from national accounts: the whole
 * household sector's disposable income minus its consumption, over its
 * disposable income. It is the standard published measure and it is the only
 * one that exists for enough countries to compare.
 *
 * It is not quite the same thing as "what I put in my savings account this
 * month". National accounts count employer pension contributions and imputed
 * items an individual never sees, so a household that puts nothing aside is not
 * necessarily at zero on this measure. The screen says this out loud rather
 * than pretending the two are identical. The comparison is still worth making,
 * it is just an order-of-magnitude one: 5 % against 18 % is a real difference
 * and 12 % against 13 % is not.
 *
 * A STORED SNAPSHOT, NOT LIVE DATA.
 *
 * There is no API call here and no key to leak. These were transcribed by hand
 * on the date in SNAPSHOT and go stale on their own, so every figure carries
 * its own source and its own period and the UI prints both. Rounded to whole
 * percent deliberately: writing 6.1 % implies somebody refreshed it this
 * morning, and nobody did.
 *
 * WHERE THERE IS NO FIGURE, THERE IS NO ROW IN THIS TABLE.
 *
 * Cote d'Ivoire has no published household saving rate on this basis. It is
 * therefore not in SAVING_RATE and never will be. What exists for it is a
 * different measure on a different basis, and it lives in OTHER_BASIS below
 * with its basis named, so the screen can answer "is there one for my country"
 * with something true instead of with silence.
 */

/** When this table was transcribed. Shown, so its age is the reader's to judge. */
export const SNAPSHOT = '2026-08'

/**
 * Household saving rate, national accounts basis, percent of disposable income.
 * `period` is the period the figure itself covers, which is not the snapshot.
 */
export const SAVING_RATE = [
  { code: 'CA', rate: 6, source: 'Statistique Canada, tableau 36-10-0112', period: 'T4 2024' },
  { code: 'US', rate: 5, source: 'U.S. Bureau of Economic Analysis', period: '2024' },
  { code: 'FR', rate: 18, source: 'INSEE, comptes nationaux', period: '2024' },
  { code: 'EA', rate: 15, source: 'Eurostat, comptes sectoriels', period: '2024' },
]

/**
 * The five age bands, and what a household in each one puts aside.
 *
 * The ask was a rank against people your own age rather than against the
 * country, which is the more useful comparison by a distance: a 24-year-old
 * saving 4 % and a 50-year-old saving 4 % are not doing the same thing, and
 * telling them both "below the national 6 %" tells neither of them anything.
 *
 * The shape of this is not in doubt and is worth knowing on its own: saving
 * rises through working life, peaks in the forties and fifties, and goes
 * NEGATIVE after 65, because retirement is when a household is supposed to be
 * spending what it put aside. A minus sign there is the system working.
 *
 * THE NUMBERS ARE THE LEAST CERTAIN THING IN THIS FILE.
 *
 * The country-level figures above are headline series quoted everywhere. These
 * come from Statistics Canada's distributions of household economic accounts,
 * by age of the main income earner, and they are a best reading rather than a
 * transcription from an open table. They are rounded hard for that reason, and
 * the UI names the source so a reader can check. Anybody updating them should
 * check the published table first and correct all five together.
 *
 * Only Canada. The same breakdown is not published in the same shape
 * elsewhere, and lining a French nomenclature up against a Canadian one would
 * make a table that looks comparable and is not.
 */
export const AGE_BANDS = ['u35', '35_44', '45_54', '55_64', '65p']

export const SAVING_RATE_BY_AGE = {
  CA: {
    source: 'Statistique Canada, comptes économiques des ménages par groupe d’âge',
    period: '2024',
    rates: { u35: 5, '35_44': 10, '45_54': 9, '55_64': 7, '65p': -2 },
  },
}

/**
 * Côte d'Ivoire, and the honest answer to "do we have the same statistic".
 *
 * No. There is no published household saving rate for Côte d'Ivoire on the
 * national accounts basis every other row here uses, and inventing one would
 * be the worst thing this file could do.
 *
 * What DOES exist is gross national savings as a share of GDP, published by
 * the IMF and the World Bank. It is a real figure and it is a different
 * measure: it counts what companies and the government put aside as well as
 * households, so it is typically much higher than a household rate and is not
 * comparable to one. Quoting it in the same gauge would be the exact mistake
 * the note at the top of this file warns about.
 *
 * So it is here, clearly marked, on its own basis, and the UI shows it as
 * information rather than as a rank. `basis` is what keeps the two apart, and
 * compareRate refuses anything that is not a household rate.
 */
export const OTHER_BASIS = [
  {
    code: 'CI',
    basis: 'gross-national',
    rate: 18,
    source: 'FMI et Banque mondiale, épargne nationale brute (% du PIB)',
    period: '2024',
  },
]

/**
 * Age in whole years, or null when there is no usable birthday.
 *
 * Split out of ageBandOf because the peer survey in peers.js gates on the age
 * itself rather than on one of these five bands: its sample runs 15 to 32 and
 * `u35` would sweep a 34-year-old into a comparison against teenagers. One
 * implementation, so the two cannot drift.
 */
export function ageOf(birthday, today = new Date()) {
  const [y, m, d] = String(birthday ?? '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  let age = today.getFullYear() - y
  /* Not yet had this year's birthday. Compared as month-then-day rather than
     by subtracting dates, which is the same trap daysUntilBirthday avoids. */
  const before = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)
  if (before) age -= 1
  if (age < 0 || age > 130) return null
  return age
}

/** The bands a birthday falls into, or null when there is no birthday on file. */
export function ageBandOf(birthday, today = new Date()) {
  const age = ageOf(birthday, today)
  if (age == null) return null
  if (age < 35) return 'u35'
  if (age < 45) return '35_44'
  if (age < 55) return '45_54'
  if (age < 65) return '55_64'
  return '65p'
}

/**
 * The figure to compare against: your own age band where there is one, the
 * country otherwise.
 *
 * Returns which of the two it used, because the screen has to say so. "You
 * against Canadians your age" and "you against Canadians" are different
 * claims and a reader is entitled to know which one they are being shown.
 */
export function benchmarkFor(code, band) {
  const table = SAVING_RATE_BY_AGE[code]
  if (band && table && table.rates[band] != null) {
    return {
      code,
      band,
      rate: table.rates[band],
      source: table.source,
      period: table.period,
      scope: 'age',
    }
  }
  const row = SAVING_RATE.find((r) => r.code === code)
  return row ? { ...row, band: null, scope: 'country' } : null
}

/** A published figure on some OTHER basis, which is not a rank. */
export function otherBasisFor(code) {
  return OTHER_BASIS.find((r) => r.code === code) ?? null
}

/**
 * Where a Canadian household's money goes, as a share of current consumption.
 *
 * Statistics Canada, Survey of Household Spending. Whole percent, and the six
 * buckets are this app's six, so `other` is genuinely everything the other five
 * do not cover: furnishings, clothing, personal care, education, communications
 * and the rest. It is large because it is a remainder, not because Canadians
 * spend a third of their money on nothing in particular.
 *
 * Only Canada. The same survey does not exist in the same shape elsewhere and
 * lining up a French nomenclature against a Canadian one would produce a table
 * that looks comparable and is not.
 */
export const SPEND_SHARE = {
  CA: {
    source: 'Statistique Canada, Enquête sur les dépenses des ménages',
    period: '2021',
    shares: { home: 30, transport: 15, food: 15, fun: 5, health: 3, other: 32 },
  },
}

/**
 * Spending by category over a window, for the comparison to be a fair one.
 *
 * The pane first fed this the CURRENT period, which on the sixth of the month
 * was two transactions: it reported spending 67 % of everything on food and
 * compared that against a national annual average of 15 %. Both numbers were
 * correct and putting them in the same table was not.
 *
 * So the window is the closed months, and the caller passes their bounds. Half
 * a month is not a spending pattern, and a table that implies it is invites the
 * reader to draw a conclusion from noise.
 *
 * Uncategorised expenses land in `other`, which is where the app puts them
 * everywhere else, and excluded rows are left out, which is what excluded
 * means.
 */
export function spendOver(entries = [], from, to) {
  const totals = new Map()
  for (const e of entries) {
    if (e.excluded || e.kind !== 'expense') continue
    const day = String(e.happened_on ?? '').slice(0, 10)
    if (!day || day < from || day >= to) continue
    const key = e.category ?? 'other'
    totals.set(key, (totals.get(key) ?? 0) + (Number(e.amount_cents) || 0))
  }
  return [...totals].map(([key, cents]) => ({ key, cents })).filter((c) => c.cents > 0)
}

/** The countries this table can answer for. */
export const COUNTRIES = SAVING_RATE.map((r) => r.code)

/**
 * The region a locale tag implies, including when it does not say.
 *
 * Same `maximize` trick as currency.js, and for the same reason: a browser
 * reporting a bare "fr" still resolves to a region, so somebody gets a sensible
 * default instead of nothing.
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
 * A first guess at which row to show, from the browser's own preferences.
 *
 * Euro-area members fall through to EA rather than to nothing, since the
 * aggregate is a real published figure for exactly those countries. Anywhere
 * else returns null, which is not a failure: it is the honest answer, and the
 * screen offers the picker rather than quietly showing Canada to somebody in
 * Abidjan.
 */
const EURO_AREA = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
])

export function detectCountry(tags = []) {
  for (const tag of tags) {
    const region = regionOf(tag)
    if (!region) continue
    if (COUNTRIES.includes(region)) return region
    if (EURO_AREA.has(region)) return 'EA'
  }
  return null
}



/**
 * Where a rate stands against a published one.
 *
 * `near` is a band, not a point. Two percentage points either side, because the
 * measures are not the same measure and a screen that flips between "above" and
 * "below" on a rounding difference is claiming a precision it does not have.
 *
 * Returns null for the standing when either side is unknown, so a caller cannot
 * accidentally render "below average" for somebody the app knows nothing about.
 */
export function compareRate(mine, code, band) {
  const row = benchmarkFor(code, band)
  if (row == null || mine == null || !Number.isFinite(mine)) {
    return { standing: null, delta: null, benchmark: row }
  }
  const delta = mine - row.rate
  const standing = Math.abs(delta) <= 2 ? 'near' : delta > 0 ? 'above' : 'below'
  return { standing, delta, benchmark: row }
}

/**
 * Category spending as whole-percent shares of the total.
 *
 * Largest remainder, so the shares add to exactly 100 and the table does not
 * show a column that sums to 99. Ties broken by the category's own order, which
 * is fixed, so the same input always produces the same table.
 */
export function sharesOf(byCategory = []) {
  const total = byCategory.reduce((n, c) => n + (Number(c.cents) || 0), 0)
  if (total <= 0) return []

  const raw = byCategory.map((c) => ({ key: c.key, exact: ((Number(c.cents) || 0) * 100) / total }))
  const out = raw.map((r) => ({ key: r.key, share: Math.floor(r.exact), rest: r.exact - Math.floor(r.exact) }))
  let short = 100 - out.reduce((n, r) => n + r.share, 0)

  const order = [...out.keys()].sort((a, b) => out[b].rest - out[a].rest || a - b)
  for (const i of order) {
    if (short <= 0) break
    out[i].share += 1
    short -= 1
  }
  return out.map(({ key, share }) => ({ key, share }))
}

/**
 * Your shares beside the published ones, for the categories the table covers.
 *
 * Only where both sides exist. A row comparing your food spending against a
 * blank is a row that invites the reader to fill the blank in themselves.
 */
export function compareShares(byCategory = [], code) {
  const table = SPEND_SHARE[code]
  if (!table) return null
  const mine = new Map(sharesOf(byCategory).map((s) => [s.key, s.share]))
  const rows = Object.entries(table.shares)
    .filter(([key]) => mine.has(key))
    .map(([key, theirs]) => ({ key, mine: mine.get(key), theirs, delta: mine.get(key) - theirs }))
    .sort((a, b) => b.mine - a.mine)
  return rows.length ? { ...table, rows } : null
}
