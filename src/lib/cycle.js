/**
 * Cycle arithmetic: what the recorded dates imply about the next one.
 *
 * WHAT THIS IS AND IS NOT.
 *
 * It is a moving average over the gaps between recorded period starts, plus
 * the one piece of physiology that makes a prediction possible at all. It is
 * not a fertility test, it is not contraception, and it is not a diagnosis.
 * The app says so in words; this file says so in how little it claims.
 *
 * THE ONE PIECE OF PHYSIOLOGY.
 *
 * Cycle length varies a lot between people and month to month. What varies
 * much less is the luteal phase, the stretch between ovulation and the next
 * period, which sits near fourteen days for most people. So ovulation is
 * estimated BACKWARDS from the predicted next start rather than forwards from
 * the last one. Counting forwards is the common mistake and it puts the window
 * in the wrong place for anybody whose cycle is not twenty-eight days.
 *
 * The fertile window is then the five days before ovulation plus the day
 * itself, because sperm survive in the reproductive tract for several days and
 * an egg does not. It is wider on the early side for that reason and not out
 * of caution.
 *
 * WHY THE PREDICTION IS DELIBERATELY BLUNT.
 *
 * Three recorded dates give two gaps. Two numbers is not a distribution, and
 * an app that draws a confident line from it is making something up. So
 * `confidence` is returned alongside every prediction and the interface is
 * expected to show it, and the spread widens rather than narrowing when the
 * gaps disagree.
 */

/** A calendar day as YYYY-MM-DD, which is how these arrive from Postgres. */
export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * A date from a YYYY-MM-DD string, at local midnight.
 *
 * `new Date('2026-08-01')` parses as UTC midnight and then displays in local
 * time, which moves the day backwards for everybody west of Greenwich. The
 * whole of this file is calendar-day arithmetic, so one day out is the entire
 * output being wrong.
 */
export function fromKey(iso) {
  if (typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

const DAY_MS = 86400000

/** Whole days from a to b, both at local midnight, so DST cannot shift it. */
export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / DAY_MS)
}

export function addDays(d, n) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() + n)
  return out
}

/** What a cycle length has to be to be believable. */
export const MIN_CYCLE = 21
export const MAX_CYCLE = 45
/** Used when there is nothing to average, and flagged as a guess when it is. */
export const DEFAULT_CYCLE = 28
/** Ovulation to next period. The stable half. */
export const LUTEAL_DAYS = 14
/** How long the fertile window runs before ovulation, plus the day itself. */
export const FERTILE_BEFORE = 5
/** The stretch before a period the app offers to prepare for. */
export const PMS_DAYS = 5

/**
 * Sorted, de-duplicated, valid period starts, oldest first.
 *
 * Everything below assumes this shape, and the raw input is whatever came back
 * from the database or out of an onboarding form somebody typed into.
 */
export function cleanStarts(list) {
  const seen = new Set()
  const out = []
  for (const item of list ?? []) {
    const d = item instanceof Date ? item : fromKey(item?.started_on ?? item)
    if (!d) continue
    const k = dayKey(d)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(d)
  }
  return out.sort((a, b) => a - b)
}

/**
 * The gaps between consecutive starts, in days, with the impossible ones
 * dropped.
 *
 * A gap under 21 days is usually two entries for one period, somebody logging
 * the start and then a heavy day. A gap over 45 is usually a period that went
 * unrecorded rather than a cycle that genuinely lasted seven weeks. Averaging
 * either in drags the estimate somewhere it should not go, and the person
 * cannot tell why the app now thinks their cycle is 61 days.
 */
export function gapsOf(starts) {
  const out = []
  for (let i = 1; i < starts.length; i += 1) {
    const gap = daysBetween(starts[i - 1], starts[i])
    if (gap >= MIN_CYCLE && gap <= MAX_CYCLE) out.push(gap)
  }
  return out
}

/**
 * The estimate, and how much to trust it.
 *
 * The last six gaps rather than all of them, because cycles change with age,
 * stress, weight and medication, and an average dragged back by data from two
 * years ago is worse than one built on this year.
 *
 * `spread` is the largest difference among the gaps used. It is what widens
 * the predicted window: somebody whose cycles run 26 to 34 should be shown a
 * range, not a date, and told which it is.
 */
export function estimate(starts, override = null) {
  const clean = cleanStarts(starts)
  const gaps = gapsOf(clean).slice(-6)

  if (override != null && override >= MIN_CYCLE && override <= MAX_CYCLE) {
    /* Somebody typed their own average during onboarding. It is theirs and it
       wins over two gaps, but not over a real history: once there are three
       gaps the measurements are better than the recollection. */
    if (gaps.length < 3) {
      return { length: Math.round(override), spread: 0, source: 'stated', confidence: 'low', gaps }
    }
  }

  if (gaps.length === 0) {
    return { length: DEFAULT_CYCLE, spread: 0, source: 'default', confidence: 'none', gaps }
  }

  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const spread = Math.max(...gaps) - Math.min(...gaps)

  return {
    length: Math.round(mean),
    spread,
    source: 'measured',
    /* Three gaps is four recorded periods. Below that the number moves a lot
       with each new entry, and calling it anything better than low would be
       the overstatement this file exists to avoid. */
    confidence: gaps.length >= 3 ? (spread <= 4 ? 'good' : 'fair') : 'low',
    gaps,
  }
}

/**
 * The next period, the fertile window and the stretch before.
 *
 * Returns null when there is nothing recorded: no dates means no prediction,
 * and inventing one from the default 28 would draw a confident marker on a
 * calendar for somebody who has entered nothing at all.
 *
 * @param starts   recorded period start dates, any order
 * @param override the average the person stated during onboarding, or null
 * @param from     treated as today, injectable so the tests are not seasonal
 */
export function predict(starts, override = null, from = new Date()) {
  const clean = cleanStarts(starts)
  if (clean.length === 0) return null

  const est = estimate(clean, override)
  const last = clean[clean.length - 1]

  /**
   * Roll forward until the prediction is not in the past.
   *
   * Somebody who has not opened the app for three months has a last recorded
   * start from three cycles ago, and predicting from it directly puts the next
   * period behind them. This walks forward by the cycle length instead, which
   * is the same thing the reminder would have to do anyway, and `missed` says
   * how many went unrecorded so the interface can stop pretending it knows.
   */
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let next = addDays(last, est.length)
  let missed = 0
  while (daysBetween(today, next) < 0 && missed < 24) {
    next = addDays(next, est.length)
    missed += 1
  }

  const ovulation = addDays(next, -LUTEAL_DAYS)

  return {
    /** The middle of the estimate. Never the whole truth, see `window`. */
    nextStart: next,
    /**
     * How wide to draw it. Half the observed spread either side, floored at a
     * day so there is always some width: a single date drawn precisely is a
     * claim this data cannot support.
     */
    window: Math.max(1, Math.round(est.spread / 2)),
    ovulation,
    fertileFrom: addDays(ovulation, -FERTILE_BEFORE),
    fertileTo: ovulation,
    pmsFrom: addDays(next, -PMS_DAYS),
    pmsTo: addDays(next, -1),
    /** Which cycle day today is, counting the last recorded start as day 1. */
    dayOfCycle: daysBetween(last, today) + 1,
    missed,
    ...est,
  }
}

/**
 * What a given day is, for drawing one tile on a calendar.
 *
 * Returns the strongest thing true of that day, because a tile has one state
 * and 'period' beats a prediction about the same day. Null for an ordinary
 * day, which is most of them, so the caller can skip drawing anything.
 */
export function phaseOn(day, starts, prediction, periodDays = 5) {
  const target = day instanceof Date ? day : fromKey(day)
  if (!target) return null

  /* Recorded beats predicted, always. A day inside a period somebody actually
     logged is a fact, and it must not be relabelled as a prediction because
     the estimate happens to disagree. */
  for (const s of cleanStarts(starts)) {
    const offset = daysBetween(s, target)
    if (offset >= 0 && offset < periodDays) return 'period'
  }

  if (!prediction) return null

  const within = (a, b) => daysBetween(a, target) >= 0 && daysBetween(target, b) >= 0

  const predFrom = addDays(prediction.nextStart, -prediction.window)
  const predTo = addDays(prediction.nextStart, prediction.window + periodDays - 1)
  if (within(predFrom, predTo)) return 'predicted'

  if (within(prediction.pmsFrom, prediction.pmsTo)) return 'pms'
  if (within(prediction.fertileFrom, prediction.fertileTo)) return 'fertile'

  return null
}

/**
 * Should a reminder go out today, and how many days ahead is it.
 *
 * Deliberately exact rather than "within N days": a reminder that fires on
 * each of the three days before is three notifications about one event, which
 * is how somebody turns the feature off.
 */
export function remindOn(prediction, daysBefore, from = new Date()) {
  if (!prediction) return null
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const ahead = daysBetween(today, prediction.nextStart)
  return ahead === daysBefore ? { ahead, on: prediction.nextStart } : null
}

/**
 * The three things worth doing beforehand, as keys the client translates.
 *
 * Kept short and kept practical. This is not medical advice and does not
 * pretend to be: water, something warm, and permission to do less are the
 * things people say helped, and none of them can hurt.
 */
export const PREP = ['prep.water', 'prep.warmth', 'prep.gentle']

/**
 * Glasses in a day, for the hydration row.
 *
 * Eight, which is the number the advice is always given as and therefore the
 * one people are counting against. It is a target to fill a row toward, not a
 * threshold: nothing in the app treats seven as a failure, and the count is
 * shown in words beside the marks so the row is never the only signal.
 *
 * Not litres. cycle_day.water is a count of glasses because nobody knows what
 * their glass holds, and a number that has to be estimated precisely is a
 * number that does not get entered.
 */
export const WATER_GOAL = 8
