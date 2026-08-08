import { useNavigate, useParams } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Screen, TopBar } from '../components/ui'
import GoalForm from '../components/GoalForm'

/**
 * Adding or editing a goal, as a page.
 *
 * This was a bottom sheet, and a bottom sheet was the wrong container for it.
 * Nine fields do not fit in one, so the form scrolled inside a rounded box
 * that was itself inside the page, two nested scrolling regions on a phone,
 * with the tab bar floating over the bottom of the inner one. You could not
 * see how much form was left, the keyboard covered a third of what remained,
 * and dismissing it by accident lost everything typed.
 *
 * A page has none of those problems. It also gives the form an address, which
 * means the back button does the obvious thing and a half-finished goal
 * survives a tab switch.
 *
 * The same component serves both places. Inside a group it is
 * /g/:groupId/goals/new; on its own it is /goals/new and the goal it makes
 * belongs to nobody but you.
 */
export default function GoalEditor() {
  const { groupId, goalId } = useParams()
  const navigate = useNavigate()
  const { goals, soloGoals, group } = useGroup()
  const { t } = useT()

  const existing = goalId
    ? [...goals, ...soloGoals].find((g) => g.id === goalId) ?? null
    : null

  // Editing something that is not in either list means a stale link or a goal
  // belonging to someone else. Bounce rather than render an empty form that
  // would silently create a second goal on save.
  if (goalId && !existing) {
    navigate(groupId ? `/g/${groupId}/goals` : '/goals', { replace: true })
    return null
  }

  const back = () => navigate(groupId ? `/g/${groupId}/goals` : '/goals')

  return (
    <Screen>
      <TopBar
        title={existing ? t('goals.edit_goal') : t('goals.new_goal')}
        sub={groupId ? group?.name : t('goals.solo_sub')}
      />
      <div className="pt-8">
        <GoalForm
          initial={existing}
          groupId={groupId ?? null}
          onDone={back}
          onCancel={back}
        />
      </div>
    </Screen>
  )
}
