/**
 * Progress and streaks for a goal you keep on your own.
 *
 * A goal inside a group is measured by the check-in: the group opens a cycle,
 * everybody files a checkin_item, and completion.js turns those into a
 * percentage. None of that machinery exists for somebody with no group, because
 * cycles.group_id is not null, so a solo goal had no way to be marked done at
 * all. Migration 32 adds goal_days, one row per goal per day, and this file is
 * the reading of it.
 *
 * Deliberately NOT a second completion.js. That file answers "how much of the
 * window did this group do", over members and cycles, and it is the right shape
 * for a shared scoreboard. This one answers the two questions a person alone
 * with a list actually has: did I do it today, and how long have I kept it up.
 *
 * Pure and importless apart from schedule.js, which is itself pure, so every
 * case below is tested against fixed dates with no database and no clock.
 */
/* Extension included deliberately. Vite resolves either way; node, running
   this file directly for the tests, resolves only the explicit one. */
import { isDueOn, targetFor } from './schedule.js'

/**
 * How far back a streak is allowed to look, in days.
 *
 * The walk is one day at a time, so this is the only thing standing between a
 * goal dated 2019 and a couple of thousand iterations per card per render. It
 * is also the window the client fetches: see the query in GroupContext, which
 * reads this same constant so the two cannot drift. A streak longer than this
 * reads as this, which is a lie nobody will ever be in a position to tell.
 */
export const LOOKBACK_DAYS = 400

const pad = (n) => String(n).padStart(2, '0')

/**
 * Local calendar day, as YYYY-MM-DD.
 *
 * Never toISOString, which is UTC: at 9pm in Montreal that returns tomorrow,
 * and a goal ticked in the evening would be filed under a day that has not
 * happened. The same bug, caught the same way, as localISO in txn.js.
 */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * n days before a date, at local midnight.
 *
 * Built by subtracting from the day-of-month rather than from a timestamp, so
 * the hour a DST shift adds or removes cannot produce two of one day and none
 * of another. Date normalises the overflow, so day 0 is the last of the
 * previous month and it works across years.
 */
export function shiftDay(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** A date column compared as a calendar date rather than as an instant. */
const dateKey = (value) => (value ? String(value).slice(0, 10) : null)

/**
 * The ticks for one goal, indexed by day.
 *
 * Built once per list rather than filtered per card: with five goals and a
 * year of history the naive version is five scans of two thousand rows on
 * every render, and this is a Map lookup.
 */
export function indexDays(rows = []) {
  const out = new Map()
  for (const row of rows) {
    if (!row?.goal_id) continue
    const day = dateKey(row.on_date)
    if (!day) continue
    const key = `${row.goal_id}|${day}`
    /* Max, not last-wins. The unique constraint means there is only ever one
       row per goal per day in the database, but a list assembled from two
       fetches mid-refresh can briefly hold both, and taking the larger is the
       reading that never shows a tick going backwards. */
    const n = Number(row.count_done) || 0
    out.set(key, Math.max(out.get(key) ?? 0, n))
  }
  return out
}

/** How many times a goal was done on a day. 0 when there is no row. */
export function countOn(index, goalId, day) {
  if (!index || !goalId || !day) return 0
  return index.get(`${goalId}|${day}`) ?? 0
}

/**
 * Where a goal stands today.
 *
 * `target` is what the goal asks for on a day it runs, so a "3 times a day"
 * goal reports 2 of 3 rather than a tick that is either on or off. `due` is
 * false on a day the goal does not run at all, which is a different thing from
 * unfinished and has to look different on the card: a Monday-and-Wednesday
 * goal showing an empty checkbox on a Thursday reads as a miss.
 */
export function progressFor(goal, index, today = new Date()) {
  const day = dayKey(today)
  const target = targetFor(goal)
  const done = Math.min(countOn(index, goal?.id, day), target)
  return {
    day,
    done,
    target,
    due: isDueOn(goal, today),
    complete: done >= target,
    pct: target > 0 ? Math.round((done / target) * 100) : 0,
  }
}

/**
 * What one tap does.
 *
 * A goal wanted once a day is a toggle, which is what a tick should be. A goal
 * wanted three times counts up and then wraps to zero, so the same control
 * both records the second of three and takes back a mistake. Wrapping rather
 * than clamping matters: a control that sticks at its maximum has no undo, and
 * the alternative is a second button whose only job is to fix the first.
 */
export function nextCount(goal, current = 0) {
  const target = targetFor(goal)
  const n = Math.max(0, Math.floor(Number(current) || 0))
  return n >= target ? 0 : n + 1
}

/**
 * Was this goal due on a day, ignoring what its status is now?
 *
 * isDueOn refuses anything that is not currently active, which is right when
 * asking "is this on today's list" and wrong when walking backwards through
 * history: pausing a goal would make every past day report not-due, the walk
 * below would skip all of them, and a streak of ninety days would read as
 * zero the moment somebody took a week off. Status is a fact about now.
 * starts_on and ends_on are genuinely historical and stay in play.
 */
const dueThatDay = (goal, date) => isDueOn({ ...goal, status: 'active' }, date)

/**
 * How many days in a row, counting only days the goal actually ran.
 *
 * A goal set to Mondays and Wednesdays is not broken by a Tuesday, so days it
 * was not due are stepped over rather than counted or failed. Days before the
 * goal existed end the walk: a goal created on Thursday was not missed on
 * Monday.
 *
 * TODAY DOES NOT BREAK A STREAK UNTIL IT IS OVER.
 *
 * If today is due and not yet done, the count runs to yesterday instead of
 * returning zero. Otherwise every streak in the app reads zero every morning
 * until the person opens it and ticks, which is precisely the number they were
 * relying on to make them want to. Being at 11 since yesterday is true; being
 * told you are at 0 at 8am because the day is young is not.
 */
export function streakOf(goal, index, today = new Date()) {
  if (!goal?.id) return 0

  const born = dateKey(goal.created_at) ?? dateKey(goal.starts_on)
  const target = targetFor(goal)
  const doneOn = (date) => countOn(index, goal.id, dayKey(date)) >= target

  let cursor = today
  /* Today, unfinished, is pending rather than failed. A day the goal is not
     due is not a day it can be pending on either, so both cases step back. */
  if (!dueThatDay(goal, cursor) || !doneOn(cursor)) cursor = shiftDay(cursor, -1)

  let n = 0
  for (let i = 0; i < LOOKBACK_DAYS; i += 1) {
    const key = dayKey(cursor)
    if (born && key < born) break
    if (dueThatDay(goal, cursor)) {
      if (!doneOn(cursor)) break
      n += 1
    }
    cursor = shiftDay(cursor, -1)
  }
  return n
}

/**
 * The last n days as {day, due, done} for a small dot row on the card.
 *
 * Oldest first, so it reads left to right the way a week does. `done` is only
 * true at full target: a partial day is a day the goal was not kept, and a
 * dot filled for one of three would make the row a record of having opened the
 * app rather than of having done the thing.
 */
export function recentDays(goal, index, days = 7, today = new Date()) {
  const target = targetFor(goal)
  const out = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = shiftDay(today, -i)
    out.push({
      day: dayKey(date),
      due: dueThatDay(goal, date),
      done: countOn(index, goal?.id, dayKey(date)) >= target,
    })
  }
  return out
}

/**
 * The oldest day worth fetching, as YYYY-MM-DD.
 *
 * Exported so the query and the walk share one number rather than two that
 * agree until somebody changes one of them.
 */
export function since(today = new Date()) {
  return dayKey(shiftDay(today, -LOOKBACK_DAYS))
}
