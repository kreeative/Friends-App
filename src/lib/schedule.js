/**
 * Which goals are due today, and which are not.
 *
 * Until now every active goal appeared in every check-in, because a cycle is a
 * day and a goal had one number: how many times per cycle. That works for "3x
 * a day" and is wrong for everything else. "Twice a week" had nowhere to live,
 * so it was entered as a daily goal and then missed five days out of seven,
 * and a one-off milestone with a deadline in October sat in the form every
 * morning from August asking to be ticked.
 *
 * Two additions fix both:
 *
 *   active_days       which weekdays a recurring goal is due, 0 = Sunday.
 *                     Null or empty means every day, which is what every
 *                     existing goal is and why no backfill is needed.
 *   target_per_cycle  unchanged, and already means per day: a cycle IS a day
 *                     since migration 18. A second `target_per_day` column
 *                     would be the same number under two names, which is how
 *                     two numbers come to disagree.
 *
 * Pure and importless, like budget.js and birthdays.js, so a Tuesday in
 * December can be tested without a browser.
 */

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar day. Never toISOString, which is UTC. See time.js. */
function key(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A date column, compared as a calendar date rather than as an instant. */
function dateKey(value) {
  return value ? String(value).slice(0, 10) : null
}

/** How close to a deadline a one-off starts asking to be ticked. */
export const DEADLINE_WINDOW_DAYS = 7

/**
 * Is this goal on today's list?
 *
 * A one-off with a deadline stays out of the way until the deadline is in
 * sight, and then stays in the list past it: something overdue is exactly what
 * a check-in should keep raising. A one-off with no deadline has no way to
 * decide, so it is always due, which is the honest reading of "at some point".
 */
export function isDueOn(goal, date = new Date()) {
  if (!goal) return false
  if (goal.status && goal.status !== 'active') return false

  const today = key(date)
  const starts = dateKey(goal.starts_on)
  const ends = dateKey(goal.ends_on)
  if (starts && today < starts) return false
  if (ends && today > ends) return false

  if (goal.cadence === 'once') {
    const due = dateKey(goal.due_on)
    if (!due) return true

    const deadline = new Date(`${due}T00:00:00`)
    const soonest = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate() - DEADLINE_WINDOW_DAYS,
    )
    return today >= key(soonest)
  }

  const days = goal.active_days
  if (!Array.isArray(days) || days.length === 0) return true
  return days.includes(date.getDay())
}

/** The subset of a list that is due, in the order it came. */
export function dueOn(goals = [], date = new Date()) {
  return goals.filter((g) => isDueOn(g, date))
}

/** How many times this goal wants doing on a day it is due. */
export function targetFor(goal) {
  if (!goal || goal.cadence === 'once') return 1
  return Math.max(1, goal.target_per_cycle || 1)
}

/**
 * What a count means against the target.
 *
 * Shared so the check-in, the one-tap card and anything that reads an outcome
 * back agree. Partial exists because two of three is neither a success nor a
 * failure, and rounding it into either is how a number stops being trusted.
 */
export function outcomeFor(goal, count) {
  const target = targetFor(goal)
  if (count >= target) return 'done'
  if (count > 0) return 'partial'
  return 'missed'
}
