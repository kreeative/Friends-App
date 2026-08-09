/**
 * The arithmetic behind the one number.
 *
 * Kept out of the components on purpose. This is the part that is worth being
 * certain about, and a pure function taking a date is testable in a way that a
 * component reading `new Date()` is not.
 *
 * Everything is in cents, integers throughout. See src/lib/money.js for why.
 */

/**
 * Cumulative spend, one point per day from the start of the period to today.
 *
 * Cumulative rather than per-day on purpose. A per-day bar chart of somebody's
 * spending is mostly noise: it is spiky, it is zero on half the days, and the
 * shape carries no answer to any question a person actually has. The running
 * total does: its slope is the rate of spending, and where it sits relative to
 * the pool is whether the month works. That is a line worth two centimetres of
 * screen.
 *
 * Always at least two points, because one point is not a line and an SVG
 * polyline with a single coordinate draws nothing.
 */
export function dailySeries({ entries = [], period, kind = 'expense' }) {
  const days = Math.max(1, Math.min(period.daysGone + 1, period.daysTotal))
  const out = []
  let running = 0

  for (let d = 0; d < days; d++) {
    const at = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() + d)
    const next = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1)
    running += sum(
      entries.filter((e) => e.kind === kind && inPeriod(e.happened_on, at, next)),
      (e) => e.amount_cents,
    )
    out.push(running)
  }

  return out.length === 1 ? [out[0], out[0]] : out
}

/** The six that cover almost everything. Order is the order they render in. */
export const CATEGORIES = ['food', 'transport', 'home', 'fun', 'health', 'other']

const DAY = 86400000

/** Local midnight. Dropping the clock keeps day arithmetic exact. */
function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * The spending period, which is payday to payday rather than the 1st to the
 * 31st.
 *
 * `startDay` is capped at 28 by the database, so neither constructor below can
 * roll into a month that does not have the day: no "31 February" silently
 * becoming the 2nd or the 3rd. The month arithmetic is left to the Date
 * constructor, which normalises month -1 and month 12 into the neighbouring
 * year correctly.
 *
 * `end` is exclusive: it is the next payday, the first day of the NEXT period.
 * That makes `daysLeft` count today as still spendable, which is what a person
 * checking the app at nine in the morning means by "how much can I spend
 * today".
 */
export function periodBounds(today, startDay = 1) {
  const t = midnight(today)
  const day = Math.min(Math.max(Math.trunc(startDay) || 1, 1), 28)

  const start =
    t.getDate() >= day
      ? new Date(t.getFullYear(), t.getMonth(), day)
      : new Date(t.getFullYear(), t.getMonth() - 1, day)

  const end = new Date(start.getFullYear(), start.getMonth() + 1, day)

  return {
    start,
    end,
    daysTotal: Math.round((end - start) / DAY),
    // Never below one. On the last day of the period the honest answer to
    // "spread this over how many days" is one, and it also keeps the division
    // below away from zero.
    daysLeft: Math.max(1, Math.round((end - t) / DAY)),
    daysGone: Math.max(0, Math.round((t - start) / DAY)),
  }
}

const inPeriod = (iso, start, end) => {
  if (!iso) return false
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return false
  const v = new Date(y, m - 1, d)
  return v >= start && v < end
}

const sum = (rows, pick) => rows.reduce((n, r) => n + (Number(pick(r)) || 0), 0)

/**
 * Everything the money screen shows, derived in one place.
 *
 * @param plan    a budget_plan row, or null when nothing is set up yet
 * @param fixed   budget_fixed rows
 * @param entries budget_entry rows
 * @param today   injected so tests can sit on a specific date
 */
export function summarise({ plan, fixed = [], entries = [], today = new Date(), currency }) {
  const startDay = plan?.period_start_day ?? 1
  const period = periodBounds(today, startDay)

  const income = Number(plan?.monthly_income_cents) || 0
  const savings = Number(plan?.savings_target_cents) || 0
  const committed = sum(
    fixed.filter((f) => f.active !== false),
    (f) => f.amount_cents,
  )

  const mine = entries.filter((e) => inPeriod(e.happened_on, period.start, period.end))
  const spent = sum(
    mine.filter((e) => e.kind === 'expense'),
    (e) => e.amount_cents,
  )
  // Money that arrived unplanned. A tracker that can only subtract makes
  // people stop entering the good months, and then it is wrong all year.
  const extra = sum(
    mine.filter((e) => e.kind === 'income'),
    (e) => e.amount_cents,
  )

  /** What was ever free, before any of this period's spending. */
  const pool = income - committed - savings
  const left = pool + extra - spent

  const byCategory = CATEGORIES.map((key) => ({
    key,
    cents: sum(
      mine.filter((e) => e.kind === 'expense' && (e.category ?? 'other') === key),
      (e) => e.amount_cents,
    ),
  }))
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents)

  return {
    ready: Boolean(plan) && income > 0,
    period,
    /**
     * The person's currency wins, then whatever the plan happens to say, then
     * the fallback.
     *
     * In that order because the plan's column was never written: it has read
     * CAD in every account since the feature shipped, so treating it as an
     * answer would override the real one. It is kept in the chain at all so a
     * database that was edited by hand is not ignored.
     */
    currency: currency || plan?.currency || 'CAD',

    income,
    committed,
    savings,
    pool,
    spent,
    extra,
    left,

    /**
     * The headline. Floor rather than round, because a number rounded up is a
     * number that overspends by a cent a day and then blames the app.
     */
    perDay: Math.floor(left / period.daysLeft),

    /** What the plan implied before this period's spending started. */
    perDayPlanned: Math.floor(pool / Math.max(1, period.daysTotal)),

    /**
     * The plan does not close. Fixed costs plus savings exceed income, so no
     * amount of careful spending makes the month work, and the honest thing is
     * to say so rather than to show a small daily allowance that is a lie.
     * This is the single most useful thing the feature can tell somebody.
     */
    overcommitted: pool < 0,

    /** Spent everything that was free, with days still to go. */
    overspent: pool >= 0 && left < 0,

    /**
     * Pace, for the ring. Where you would be if the period's free money were
     * spread evenly and you had spent exactly on plan up to today. Above 1
     * means ahead of pace, which is the polite way of saying too fast.
     */
    pace: pool > 0 ? spent / Math.max(1, (pool * period.daysGone) / period.daysTotal) : 0,

    byCategory,
    entries: mine,
  }
}
