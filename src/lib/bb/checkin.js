import { goalRow } from '../goalRow.js'
import { dayKey } from './days.js'

/**
 * A Beauty & Brain session as the daily check-in of a Rich & Friends goal
 * (section 6, "Today's session").
 *
 * Opt-in, from the profile: the student's own personal goal, every day but
 * Sunday (the plan's rest day, so a day off never reads as a miss), with no
 * proof to attach because the session is the proof. Built by goalRow(), so
 * the row is exactly the one the goal form would write.
 *
 * A finished session writes one goal_days tick for the day. The upsert
 * ignores a row that is already there: a second session the same day, or a
 * count the student raised by hand in Rich & Friends, is never lowered.
 *
 * Pure, tested in app.test.mjs.
 */
export const STUDY_DAYS = [1, 2, 3, 4, 5, 6]

export function studyGoal({ userId, title, today = dayKey(new Date()) }) {
  return goalRow(
    {
      groupId: null,
      kind: 'personal',
      userId,
      commitment: String(title ?? '').trim().slice(0, 200),
      goalType: 'process',
      proofType: 'none',
      cadence: 'recurring',
      target: 1,
      days: STUDY_DAYS,
      dueOn: '',
      endsOn: '',
      startsOn: today,
      stake: '',
      remind: false,
      remindAt: '',
      remindEvery: '',
      when: '',
      where: '',
      evidence: '',
    },
    today,
  )
}

/** Does this session count? Something answered, pretest guesses included: it was studying. */
export const sessionCounts = (answered) => (answered ?? []).length > 0

/** The tick, for upsert(..., { onConflict: 'goal_id,user_id,on_date', ignoreDuplicates: true }). */
export const tickRow = ({ goalId, userId, now = new Date() }) => ({ goal_id: goalId, user_id: userId, on_date: dayKey(now), count_done: 1 })
