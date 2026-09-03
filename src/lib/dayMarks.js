/**
 * What is on a given day, for the dashboard's mini calendar.
 *
 * The strip already knew about check-ins, moods and the budget. It knew
 * nothing about the calendar: a person could have four classes and an exam on
 * Thursday, see a blank square on the dashboard, and only find out by opening
 * a different screen. This is the join.
 *
 * WHY THE MARKS AND THE LIST COME FROM ONE PLACE.
 *
 * Two questions get asked of the same day: "is there a dot" and "what is it".
 * Answering them in two functions built from two different reads is how a day
 * ends up with a dot and an empty panel, or the reverse, and neither looks
 * like a bug until somebody notices. So itemsFor() is the answer and marksFor()
 * is derived from it.
 *
 * FOUR KINDS, AND THEY ARE TOLD APART BY SHAPE AS WELL AS COLOUR.
 *
 * The dots are 6px. PHASE_DOT in Calendar.jsx records what happened the last
 * time four states differed by hue alone at that size: it failed 1.4.1
 * outright and one of the hues measured 1.83:1. The renderer gives each kind
 * its own silhouette, so the set survives a greyscale screenshot, and the
 * day's accessible name says in words what its dots say in shapes.
 */
import { dayKey } from './cycle.js'
import { clockOf } from './agenda.js'

/**
 * The order is the reading order, and it is deliberate.
 *
 * A class at ten is a fact about the day that cannot move. A goal is something
 * to do in it. The cycle is context for both. "Logged" is the past tense and
 * goes last because it describes what already happened rather than what is
 * coming.
 */
export const MARK_KINDS = ['event', 'goal', 'cycle', 'logged']

/**
 * Everything on one day, already ordered and already labelled.
 *
 * @param day        a Date
 * @param agenda     Map from agendaFor(), keyed by day
 * @param goalsByDay {[key]: goal[]} for goals with a deadline
 * @param phaseOf    (key) => 'period' | 'predicted' | 'pms' | 'fertile' | null
 * @param logged     (key) => boolean, the strip's existing "something happened"
 *
 * Returns [{ kind, id, title, detail }]. `detail` is a clock range or null;
 * the caller decides how to draw it, because this file does not know what
 * language anybody reads and must not build sentences.
 */
export function itemsFor(day, { agenda, goalsByDay = {}, phaseOf, logged } = {}) {
  const key = day instanceof Date ? dayKey(day) : String(day ?? '')
  if (!key) return []

  const out = []

  /* Timed things first, in clock order, which agendaFor already guarantees.
     An all-day entry has no start and sorts ahead of the rest there. */
  for (const e of agenda?.get?.(key) ?? []) {
    out.push({
      kind: e.goalId ? 'goal' : 'event',
      id: e.occurrenceId ?? e.id,
      title: e.title,
      /* A range, or null for an all-day entry. clockOf already returns null
         for a null minute, so this is one branch rather than three. */
      detail:
        e.start_min != null && e.end_min != null
          ? `${clockOf(e.start_min)} - ${clockOf(e.end_min)}`
          : null,
      location: e.location ?? null,
    })
  }

  /* Goals with a deadline that are not already in the agenda. The calendar
     page feeds its goals THROUGH agendaFor, so on that screen they arrive
     above; the dashboard reads them separately and they arrive here. Guarded
     against both, because a goal listed twice on its own due date is the kind
     of duplicate nobody reports and everybody notices. */
  /* Keyed on the GOAL's id, not the row's. An agenda entry for a goal carries
     occurrenceId `goal:<id>:<day>`, so comparing row ids finds no match and
     the goal lists twice. That was the first version and the test caught it. */
  const seen = new Set(
    (agenda?.get?.(key) ?? []).map((e) => e.goalId).filter(Boolean),
  )
  for (const g of goalsByDay[key] ?? []) {
    if (seen.has(g.id)) continue
    out.push({ kind: 'goal', id: g.id, title: g.commitment ?? g.title ?? '', detail: null })
  }

  /* The cycle, as one row and never more. It is a state of the day rather
     than an appointment in it, which is also why it is last of the three. */
  const phase = phaseOf?.(key) ?? null
  if (phase) out.push({ kind: 'cycle', id: `cycle:${key}`, title: null, phase, detail: null })

  if (logged?.(key)) out.push({ kind: 'logged', id: `logged:${key}`, title: null, detail: null })

  return out
}

/**
 * The dots, deduplicated and in MARK_KINDS order.
 *
 * A day with four classes gets ONE event dot. The strip has room for four
 * marks under a date and a person with a full timetable would otherwise get a
 * row of identical dots that says less than one does: the count belongs in the
 * panel, where it can be a number.
 */
export function marksFor(day, ctx) {
  const kinds = new Set(itemsFor(day, ctx).map((i) => i.kind))
  return MARK_KINDS.filter((k) => kinds.has(k))
}

/**
 * How many of each kind, for the accessible name.
 *
 * Returned rather than formatted, for the same reason as `detail` above: the
 * sentence is built where the translations live.
 */
export function countsFor(day, ctx) {
  const counts = { event: 0, goal: 0, cycle: 0, logged: 0 }
  for (const i of itemsFor(day, ctx)) counts[i.kind] += 1
  return counts
}
