/**
 * Who may delete a goal.
 *
 * WHY THIS IS A FILE AND NOT THREE LINES IN A PAGE.
 *
 * It was three lines in a page, written out by hand next to a comment claiming
 * they matched goals_delete "exactly":
 *
 *   g.owner_id === user?.id || (Boolean(groupId) && myRole === 'admin')
 *
 * They did not. A group carries one 'creator' and any number of 'admin', and
 * `role === 'admin'` is false for the creator. So the person who started the
 * group never saw Supprimer on a single shared goal, on any screen, while the
 * database would have accepted the delete from her without hesitating. The
 * report was "there are goals you cannot delete, I do not understand", and
 * there was nothing to understand: the button was not drawn.
 *
 * A copied rule drifts from the one it copies, silently, because nothing fails
 * when it does. So the rule is written once, here, with a test that is a
 * transcription of the policy, and the pages call it.
 *
 * WHY THE BUTTON HAS TO BE HIDDEN AT ALL, RATHER THAN LET RLS DECIDE.
 *
 * Postgres does not raise on a DELETE its policy refuses. It deletes nothing
 * and reports success. Measured, on a real Postgres 16 with the real policy: a
 * member deleting a goal they did not write gets zero rows and, in the error
 * column, the word "aucune". Showing the button to everybody and letting the
 * server sort it out therefore produces a button that does nothing, says
 * nothing, and leaves the card sitting there.
 *
 * removeGoal() in GroupContext asks for the deleted rows back and treats zero
 * as a refusal, so the two guards would both have to be wrong for a silent
 * failure to reach anybody. This one decides what to draw; that one decides
 * what to believe.
 */

/**
 * The mirror of goals_delete, migration 62:
 *
 *   owner_id = auth.uid()
 *   or created_by = auth.uid()
 *   or (group_id is not null and is_group_admin(group_id))
 *   or (group_id is not null and is_group_creator(group_id))
 *
 * @param goal   a row from `goals`: owner_id, created_by, group_id
 * @param viewer who is looking:
 *   userId         the signed-in person, null when nobody is
 *   role           their role IN THIS GOAL'S GROUP: member, admin or creator
 *   groupCreatedBy groups.created_by for this goal's group
 *
 * `role` and `groupCreatedBy` describe the goal's own group. On /goals there is
 * no group and nothing reads them; on /g/:id/goals every goal on screen belongs
 * to the group being looked at, so the context's values are the right ones.
 */
export function canDeleteGoal(goal, viewer) {
  const me = viewer?.userId ?? null
  /* No goal, or nobody signed in. `me` being null matters more than it looks:
     without this line a goal whose created_by is null, which is every goal
     written before migration 50, would compare null to null and come out
     deletable by a signed-out reader. */
  if (!goal || !me) return false

  /* Yours, whatever page it is on. */
  if (goal.owner_id === me) return true

  /* You wrote it. This is the branch migration 62 adds, and the only one that
     is new: a shared goal has no owner, so before it, adding one by mistake
     meant asking an admin to take it away again. */
  if (goal.created_by === me) return true

  /* Everything below is a right over the group, so a goal with no group has
     nothing left to check. */
  if (!goal.group_id) return false

  /* is_group_admin() has counted the creator since migration 18. Both words
     are written out here because the one that was missing is exactly the one
     that broke this. */
  const role = viewer?.role ?? null
  if (role === 'admin' || role === 'creator') return true

  /* And the group's creator, named. It overlaps with the line above today, on
     purpose: asked for in those words, and a right written down does not
     depend on a roster row having stayed correct. */
  return (viewer?.groupCreatedBy ?? null) === me
}
