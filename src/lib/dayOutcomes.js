import { countOn } from './streak.js'
import { outcomeFor } from './schedule.js'

/**
 * What a day's goals actually came to, from BOTH places an answer can live.
 *
 * THE BUG THIS EXISTS FOR.
 *
 * "Ici la j'ai marque que j'avais range ma chambre, ca a pas update?"
 *
 * It had not, and it never would have. Answering a goal writes to one of two
 * tables and which one depends on the goal:
 *
 *   a goal in a group  -> submit_checkin, a checkins row and checkin_items
 *   a goal on your own -> goal_days, one row per goal per day
 *
 * The dashboard's Today card read the first and only the first. So a goal
 * belonging to a group showed "Fait" and every solo goal on the same list
 * showed "Non enregistre", every day, no matter how many times it was ticked.
 * Four rows saying not recorded next to one saying done, and the four were
 * wrong.
 *
 * The split itself is not a mistake to undo. A group answer belongs to a
 * cycle, is submitted as a set, and carries proof that other people will read;
 * a solo tick is a count on a date and nobody else ever sees it. What was
 * missing is a reader that knows about both.
 *
 * WHY THE CHECK-IN WINS WHEN THERE ARE SOMEHOW TWO.
 *
 * It should not happen, since the two paths are chosen by the goal and not by
 * the screen. If it ever does, the check-in is the answer a person submitted
 * deliberately, with its proof and its partial, and the count is a tap.
 */

/**
 * @param goals  the goals shown for that day
 * @param items  checkin_items belonging to that day's cycles
 * @param index  indexDays() over goal_days rows, or null
 * @param day    the day, as YYYY-MM-DD
 * @returns Map from goal id to an outcome row. A goal with no answer is
 *          absent, which is what "not recorded" is drawn from: a goal_days
 *          row is deleted rather than set to zero, so there is no such thing
 *          as a stored zero to mistake for an answer.
 */
export function outcomesForDay(goals = [], items = [], index = null, day = null) {
  const out = new Map()

  for (const item of items ?? []) {
    if (item?.goal_id) out.set(item.goal_id, item)
  }

  if (!index || !day) return out

  for (const g of goals ?? []) {
    if (!g?.id || out.has(g.id)) continue
    const n = countOn(index, g.id, day)
    if (n <= 0) continue
    /**
     * `source` is what stops the recap printing "pas encore de preuve" under
     * a solo goal. A solo tick has no proof to be missing: that field is only
     * ever collected by the group check-in, so complaining about its absence
     * would be complaining about something that was never asked for.
     */
    out.set(g.id, {
      goal_id: g.id,
      outcome: outcomeFor(g, n),
      count_done: n,
      source: 'goal_day',
    })
  }

  return out
}
