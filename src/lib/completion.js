/**
 * One percentage per person, over a window you choose.
 *
 * The analytics section used to be two charts and a leaderboard: fourteen
 * status dots, a twelve-cycle curve, and a streak table. Between them they
 * answered "did you open the app", three times, in three shapes. Nobody was
 * asking that. The question a group actually has is "how much of what we said
 * we would do did we do", and none of the three could answer it, because all
 * three counted check-ins rather than goals.
 *
 * So: one number per member, and a window.
 *
 *   percentage = occurrences completed / occurrences scheduled
 *
 * An occurrence is one instance of one goal on one day. A goal set to twice a
 * day contributes two occurrences per day it is due; a goal set to Mondays and
 * Wednesdays contributes none on a Thursday. That is the same rule the
 * check-in screen uses to decide what to put in front of you, which is the
 * only way the number can mean what the screen implied it would.
 *
 * WHAT IS COUNTED, AND WHY IT IS ONLY ACTIVE GOALS.
 *
 * A finished or abandoned goal is excluded from both sides. There is no status
 * history in the schema, so for a goal that is finished today there is no way
 * to know which of the last ninety days it was live for, and guessing gets it
 * wrong in the expensive direction: keep its check-ins and drop its scheduled
 * days and everybody's rate climbs for having given up on something.
 * Restricting both the numerator and the denominator to the same set of goals
 * costs some history and keeps the ratio honest, which is the trade a
 * percentage has to make.
 *
 * Pure and importless apart from schedule.js, which is itself pure, so a
 * six-month window can be tested without a database.
 */
/* Extension included deliberately. Vite resolves either way; node, running
   this file directly for the tests, resolves only the explicit one. */
import { isDueOn, targetFor } from './schedule.js'

/**
 * The filter bar, in order. Days are calendar days including today.
 *
 * `all` has no fixed length: it runs from the oldest thing there is back to,
 * which is the day the earliest goal in scope was created. A fixed large
 * number would be the easy version and it is wrong in both directions, either
 * short enough to silently cut history off or long enough to walk ten years of
 * empty days on every render.
 *
 * It is still bounded. See MAX_SPAN_DAYS.
 */
export const PERIODS = [
  { id: 'day', days: 1 },
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
  { id: 'quarter', days: 90 },
  { id: 'half', days: 180 },
  { id: 'all', days: null },
]

export const DEFAULT_PERIOD = 'week'

/**
 * The ceiling on "all", in days.
 *
 * The window is walked one day at a time per goal, so an account with a goal
 * created in 2019 would otherwise loop a couple of thousand times per goal on
 * every period change. Two years is longer than this app has existed and far
 * longer than anybody reads back, and a bound that can never be hit in
 * practice is still worth having: the alternative is an unbounded loop over a
 * date somebody could put in by hand.
 */
export const MAX_SPAN_DAYS = 730

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar day. Never toISOString, which is UTC. See time.js. */
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const dateKey = (value) => (value ? String(value).slice(0, 10) : null)

/**
 * Every day in the window, oldest first, at local midnight.
 *
 * Built by subtracting from the day-of-month rather than from a timestamp, so
 * the clocks going back does not produce two of one day and none of another.
 *
 * `since` is only consulted by the open-ended period, and only to decide where
 * to start. A missing or future one collapses the window to today, which is
 * the honest answer for an account with nothing in it: "all of your history"
 * over no history is one day, not two years of blanks.
 */
export function windowDays(periodId, today = new Date(), since = null) {
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[1]

  let span = period.days
  if (span === null) {
    const start = since ? new Date(since) : null
    if (!start || Number.isNaN(start.getTime())) span = 1
    else {
      const a = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const b = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      /* Divided at midday to stay clear of the hour a DST shift adds or
         removes, which would otherwise round a whole day off the count. */
      const diff = Math.round((b - a) / 86400000)
      span = Math.min(MAX_SPAN_DAYS, Math.max(1, diff + 1))
    }
  }

  const out = []
  for (let i = span - 1; i >= 0; i -= 1) {
    out.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))
  }
  return out
}

/**
 * Who is on the hook for a goal.
 *
 * A personal goal is one person's, whoever else can see it. A group goal is
 * everybody's, which is the whole of what makes it a group goal, so it lands
 * in every member's denominator.
 */
function ownersOf(goal, memberIds) {
  if (goal.kind === 'group') return memberIds
  return goal.owner_id ? [goal.owner_id] : []
}

/**
 * How much of the window each member actually did.
 *
 * Returns one row per member in the order the roster came in. Deliberately not
 * sorted: this replaced a leaderboard, and re-sorting by the percentage would
 * rebuild the thing it replaced with the badges filed off.
 *
 * `pct` is null rather than 0 when nothing was scheduled. A person with no
 * goals in the window has not failed at anything, and a bar sitting at zero
 * next to their name says they have.
 */
export function memberRates({
  members = [],
  goals = [],
  cycles = [],
  checkins = [],
  items = [],
  period = DEFAULT_PERIOD,
  today = new Date(),
} = {}) {
  /* Where "all" starts: the oldest goal still in scope. Not the oldest cycle,
     which for a group somebody joined late runs back before any of their goals
     existed and would open the window on a stretch nobody was ever on the hook
     for. */
  const born = goals
    .map((g) => dateKey(g.created_at))
    .filter(Boolean)
    .sort()[0]

  const days = windowDays(period, today, born ? `${born}T00:00:00` : null)
  const first = key(days[0])
  const last = key(days[days.length - 1])

  const memberIds = members.map((m) => m.user_id)
  const live = goals.filter((g) => g.status === 'active')
  const goalById = new Map(live.map((g) => [g.id, g]))

  /* The denominator. Days the goal did not exist for yet are not days it was
     missed on: a goal created on Thursday cannot be behind by Monday. */
  const target = new Map(memberIds.map((id) => [id, 0]))
  for (const goal of live) {
    const born = dateKey(goal.created_at)
    const owners = ownersOf(goal, memberIds)
    if (owners.length === 0) continue

    let n = 0
    for (const day of days) {
      if (born && key(day) < born) continue
      if (isDueOn(goal, day)) n += targetFor(goal)
    }
    if (n === 0) continue
    for (const id of owners) target.set(id, (target.get(id) ?? 0) + n)
  }

  /* The numerator. Filed against the day the check-in was for rather than the
     day it was typed, so something recorded at ten past midnight counts to the
     day it was about. */
  const dayOfCycle = new Map()
  for (const c of cycles) {
    if (!c.opens_at) continue
    const k = key(new Date(c.opens_at))
    if (k >= first && k <= last) dayOfCycle.set(c.id, k)
  }

  const userOfCheckin = new Map()
  for (const c of checkins) {
    if (dayOfCycle.has(c.cycle_id)) userOfCheckin.set(c.id, c.user_id)
  }

  const done = new Map(memberIds.map((id) => [id, 0]))
  for (const item of items) {
    const uid = userOfCheckin.get(item.checkin_id)
    if (uid === undefined || !done.has(uid)) continue
    const goal = goalById.get(item.goal_id)
    if (!goal) continue

    const cap = targetFor(goal)
    /* count_done is the number when there is one. An older row, or a one-tap
       mark, carries only an outcome, and a partial with no count is worth one:
       something happened, and claiming the full target for it would be the
       app inventing work nobody did. */
    const raw =
      item.count_done ?? (item.outcome === 'done' ? cap : item.outcome === 'partial' ? 1 : 0)
    done.set(uid, done.get(uid) + Math.min(Math.max(0, raw), cap))
  }

  return members.map((m) => {
    const t = target.get(m.user_id) ?? 0
    const d = Math.min(done.get(m.user_id) ?? 0, t)
    return {
      id: m.user_id,
      profile: m.profile,
      done: d,
      target: t,
      pct: t > 0 ? Math.round((d / t) * 100) : null,
    }
  })
}

/** The group's own figure, from the same two totals the rows are built on. */
export function groupRate(rows = []) {
  const done = rows.reduce((sum, r) => sum + r.done, 0)
  const target = rows.reduce((sum, r) => sum + r.target, 0)
  return { done, target, pct: target > 0 ? Math.round((done / target) * 100) : null }
}

/**
 * A display name cut to what a table row can hold.
 *
 * "Meliane Marie-sarah Lasm" beside a progress bar on a 390px screen leaves
 * the bar about forty pixels, so the row stops being a comparison. The first
 * name is what people call each other anyway.
 */
export function firstName(profile) {
  const full = (profile?.display_name ?? '').trim()
  if (!full) return ''
  return full.split(/\s+/)[0]
}
