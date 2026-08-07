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
 * finishing one made it disappear — which is exactly backwards, since a
 * finished goal is the only evidence you have that any of this works.
 */
const LIVE = new Set(['active', 'paused'])

export default function Goals() {
  const { user } = useAuth()
  const { groupId } = useParams()
  const { goals, soloGoals, members } = useGroup()
  const { t } = useT()
  const [showPast, setShowPast] = useState(false)

  const source = groupId ? goals : soloGoals
  const base = groupId ? `/g/${groupId}/goals` : '/goals'

  const live = useMemo(() => source.filter((g) => LIVE.has(g.status)), [source])
  const past = useMemo(() => source.filter((g) => !LIVE.has(g.status)), [source])

  const mine = live.filter((g) => g.kind === 'personal' && g.owner_id === user?.id)
  const shared = live.filter((g) => g.kind === 'group')
  const others = live.filter((g) => g.kind === 'personal' && g.owner_id !== user?.id)

  const ownerOf = (id) => members.find((m) => m.user_id === id)?.profile

  return (
    <Screen>
      <TopBar
        title={t('nav.goals')}
        sub={groupId ? undefined : t('goals.solo_sub')}
        right={
          <Link to={`${base}/new`} className="chip-accent press">
            {t('goals.add')}
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
              <GoalCard key={g.id} goal={g} showControls editHref={`${base}/${g.id}/edit`} />
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
       * able to find, but it is not what you came to this screen for — and a
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
                />
              ))}
            </div>
          )}
        </Section>
      )}
    </Screen>
  )
}
