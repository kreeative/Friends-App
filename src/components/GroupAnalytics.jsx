import { useMemo } from 'react'
import { completionRate, currentStreak, goalSuccessRate } from '../lib/stats'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'

/**
 * The two questions the group panel could not answer.
 *
 * ConsistencyPanel says how often people turn up. It says nothing about
 * whether the goals they turned up for actually happened, and nothing about
 * who is carrying the group this week, so the whole board read as one number
 * about attendance.
 *
 * So: a success rate over the goals themselves, and the streaks side by side.
 *
 * The streak table is a ranking, which the group settings screen deliberately
 * avoids for its member list, and the reasoning there still holds for a rate:
 * ranking people by a percentage teaches whoever is last to stop opening the
 * app. A streak is different in one way that matters. It is a personal record
 * rather than a comparison, it is reset by nothing but your own gap, and it is
 * the number people already keep in their heads. Ordering by it is reporting
 * something the group can already see rather than inventing a hierarchy.
 *
 * It is still drawn quietly: no medals, no podium, no colour on the leader.
 * Position is the number of days, and the number of days is the only claim.
 */
export default function GroupAnalytics({ members, statuses, items, days = 0 }) {
  const { t } = useT()

  const goals = useMemo(() => goalSuccessRate(items), [items])

  const board = useMemo(() => {
    const rows = members.map((m) => {
      const mine = statuses.filter((s) => s.user_id === m.user_id)
      return {
        id: m.user_id,
        profile: m.profile,
        streak: currentStreak(mine),
        rate: completionRate(mine, 14),
      }
    })
    /* Streak first, then the rate, so two people on the same streak are split
       by the longer record rather than by whichever order the members query
       happened to return. */
    return rows.sort((a, b) => b.streak - a.streak || (b.rate.pct ?? -1) - (a.rate.pct ?? -1))
  }, [members, statuses])

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* Same dark ground as the panel above it, because it is the same kind
          of statement. A third surface treatment here would say these are a
          different sort of fact, and they are not. */}
      <div className="panel-ink rounded-card p-6 text-white sm:p-7">
        <span className="text-small font-bold">{t('board.goal_success')}</span>

        <div className="mt-6 flex items-baseline gap-1">
          {/* '-', not '0'. Nothing recorded is not a measured zero. */}
          <span className="text-[3.5rem] font-bold leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums]">
            {goals.pct !== null ? goals.pct : '-'}
          </span>
          <span className="text-[2rem] font-bold leading-none tracking-[-0.024em] text-spark">%</span>
        </div>

        <p className="mt-2 text-small text-white/65">
          {goals.total
            ? `${goals.done}/${goals.total} · ${t('board.goal_success_window', { n: days })}`
            : t('board.no_goal_data')}
        </p>

        {/* Said out loud rather than folded into the percentage, because a
            partly-done goal is neither a success nor a failure and rounding it
            into one is how a number stops being trusted. */}
        {goals.partial > 0 && (
          <p className="mt-4 text-small text-white/65">
            {t('board.goal_partial', { n: goals.partial })}
          </p>
        )}
      </div>

      <div className="lg p-6 sm:p-7">
        <span className="eyebrow">{t('board.streaks')}</span>

        <div className="mt-5 list">
          {board.map((row, i) => (
            <div key={row.id} className="flex items-center gap-3.5 py-3.5">
              <span className="w-4 shrink-0 text-small text-muted/70 [font-variant-numeric:tabular-nums]">
                {i + 1}
              </span>
              <Avatar profile={row.profile} size={32} />
              <span className="min-w-0 flex-1 truncate text-small text-ink">
                {row.profile?.display_name}
              </span>
              <span className="shrink-0 text-small font-semibold text-ink [font-variant-numeric:tabular-nums]">
                {row.streak > 0 ? t('board.streak_days', { n: row.streak }) : t('board.no_streak')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
