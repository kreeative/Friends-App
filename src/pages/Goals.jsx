import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Empty, Screen, Section, TopBar } from '../components/ui'
import GoalCard from '../components/GoalCard'

/**
 * Goals, in a group or on your own.
 *
 * One component for both, because they are the same screen with a different
 * source: /g/:groupId/goals reads the group's goals, /goals reads the ones
 * with no group attached. Splitting them into two pages would have duplicated
 * the sections, the empty states and the archive for no gain.
 *
 * The archive is new. Goals used to be loaded as active-or-paused only, so
 * finishing one made it disappear, which is exactly backwards, since a
 * finished goal is the only evidence you have that any of this works.
 */
const LIVE = new Set(['active', 'paused'])

export default function Goals() {
  const { user } = useAuth()
  const { groupId } = useParams()
  const { goals, soloGoals, members, myRole } = useGroup()
  const { t } = useT()
  /**
   * Open by default.
   *
   * It was collapsed, and collapsed was wrong: marking a goal done removed it
   * from the live list and put it somewhere you could not see, so the reward
   * for finishing something was watching it disappear. This section is last
   * on the page, so showing it buries nothing.
   */
  const [showPast, setShowPast] = useState(true)

  const source = groupId ? goals : soloGoals
  const base = groupId ? `/g/${groupId}/goals` : '/goals'

  const live = useMemo(() => source.filter((g) => LIVE.has(g.status)), [source])
  const past = useMemo(() => source.filter((g) => !LIVE.has(g.status)), [source])

  const mine = live.filter((g) => g.kind === 'personal' && g.owner_id === user?.id)
  const shared = live.filter((g) => g.kind === 'group')
  const others = live.filter((g) => g.kind === 'personal' && g.owner_id !== user?.id)

  const ownerOf = (id) => members.find((m) => m.user_id === id)?.profile

  /**
   * Who may delete what, matching goals_delete in supabase/09 exactly:
   *
   *   owner_id = auth.uid() or (group_id is not null and is_group_admin(...))
   *
   * A goal you own is yours to remove wherever it lives. A group goal has no
   * owner, so it belongs to the group and only an admin may take it away from
   * four other people.
   *
   * Mirrored here rather than shown to everybody and left to fail, because a
   * delete that RLS refuses does not raise: Postgres deletes nothing and
   * reports success. A button that silently does nothing is worse than no
   * button. removeGoal checks the returned rows as well, so the two have to
   * both be wrong for anything to go unnoticed.
   */
  const canDelete = (g) => g.owner_id === user?.id || (Boolean(groupId) && myRole === 'admin')

  /* The daily tick belongs to goals with no group. Inside a group the check-in
     already asks this question, and answering it twice would be two records of
     one day that can disagree. */
  const tracks = !groupId

  return (
    <Screen>
      <TopBar
        title={t('nav.goals')}
        sub={groupId ? undefined : t('goals.solo_sub')}
        right={
          /**
           * A plus and nothing else. "+ Add" wrapped onto two lines inside the
           * pill on a phone, making the chip taller than the heading beside
           * it. The word was never doing work that a plus in the corner of a
           * list does not already do, but it has to keep its accessible name,
           * so the label moves to aria-label rather than disappearing.
           */
          <Link
            to={`${base}/new`}
            aria-label={t('goals.new_goal')}
            title={t('goals.new_goal')}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-accent text-h2 font-semibold leading-none text-on-accent"
          >
            +
          </Link>
        }
      />

      <Section title={t('goals.yours')}>
        {mine.length === 0 ? (
          <Empty
            action={
              <Link to={`${base}/new`} className="btn-primary press inline-flex w-auto px-8">
                {t('goals.new_goal')}
              </Link>
            }
          >
            {groupId ? t('goals.empty') : t('goals.empty_solo')}
          </Empty>
        ) : (
          <div className="space-y-4">
            {mine.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                owner={ownerOf(g.owner_id)}
                showControls
                track={tracks}
                deletable={canDelete(g)}
                editHref={`${base}/${g.id}/edit`}
              />
            ))}
          </div>
        )}
      </Section>

      {shared.length > 0 && (
        <Section title={t('board.together')}>
          <div className="space-y-4">
            {shared.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                showControls
                deletable={canDelete(g)}
                editHref={`${base}/${g.id}/edit`}
              />
            ))}
          </div>
        </Section>
      )}

      {others.length > 0 && (
        <Section title={t('goals.everyone_else')}>
          <div className="space-y-4">
            {others.map((g) => (
              <GoalCard key={g.id} goal={g} owner={ownerOf(g.owner_id)} />
            ))}
          </div>
        </Section>
      )}

      {/**
       * Collapsed by default. The archive is worth keeping and worth being
       * able to find, but it is not what you came to this screen for, and a
       * long list of finished things above your live ones would bury them.
       */}
      {past.length > 0 && (
        <Section
          title={t('goals.past')}
          action={
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-small text-ink underline-offset-4 hover:underline"
            >
              {showPast ? t('goals.hide') : t('goals.show_n', { n: past.length })}
            </button>
          }
        >
          {showPast && (
            <div className="space-y-4">
              {past.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  owner={ownerOf(g.owner_id)}
                  /* Restarting is only yours to offer on your own goals and on
                     the group's. Someone else's finished goal is a record. */
                  showControls={g.kind === 'group' || g.owner_id === user?.id}
                  deletable={canDelete(g)}
                />
              ))}
            </div>
          )}
        </Section>
      )}
    </Screen>
  )
}
