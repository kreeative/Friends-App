import { useMemo, useState } from 'react'
import { DEFAULT_PERIOD, firstName, groupRate, memberRates, rank } from '../lib/completion'
import { useT } from '../lib/i18n'
import PeriodBar from './PeriodBar'
import { Avatar } from './ui'

/**
 * One table, one question.
 *
 * What was here before was three answers to a question nobody asked. A card of
 * fourteen status dots, a twelve-point curve, and a streak leaderboard, all
 * three counting check-ins: whether you opened the app, three times over, in
 * three shapes. Two of them also lied on a fresh group, showing "0%" and
 * "0/14" where the truth was that nothing had happened yet, and the curve card
 * carried a "7 Groupes" figure that was really the member count.
 *
 * They are gone. In their place is the number the group is actually keeping
 * score with: of everything we said we would do in this window, how much got
 * done, per person.
 *
 * IT IS A STANDING NOW, AND THE OLD ARGUMENT IS KEPT HERE ON PURPOSE.
 *
 * This said there would be no ranks and no sorting by the percentage, because
 * telling somebody they are last among four friends is how they stop opening
 * the app. That is still true and still worth having written down. It was
 * overruled deliberately, by the person whose app this is, who wanted a board
 * that moves when somebody finishes what they said they would do.
 *
 * Two things soften the edge without arguing with the decision. A tie SHARES a
 * place, so two people on the same figure are both second and neither is
 * ranked below somebody they drew with. And anybody who had nothing scheduled
 * in the window is unranked rather than last: they have not failed at
 * anything, so a position would be an accusation. See rank() in
 * src/lib/completion.js, where the tie-breaks are tested.
 *
 * The colour is the theme's accent and nothing else. No red for a low bar, no
 * green for a high one. A bar that turns red at 40% is the app raising its
 * voice at somebody who can already read the number.
 */

/**
 * One person's row.
 *
 * The bar animates its width rather than appearing at it, so switching period
 * reads as the same bars moving instead of a different table arriving.
 */
function Row({ row }) {
  const { t } = useT()
  const has = row.pct !== null
  const name = firstName(row.profile) || t('analytics.someone')

  return (
    <div className="flex items-center gap-3.5 py-3.5" data-rank-row={row.id}>
      {/**
       * The place, or a dash for somebody who was never on the hook.
       *
       * Tabular figures and a fixed width, so 1 and 10 occupy the same column
       * and the avatars below them stay in a line. A ragged left edge on a
       * list of five people reads as a rendering fault rather than as a
       * standing.
       *
       * `tied` gets an equals sign, the way a league table does: =2 says two
       * people share second, which is a different claim from 2 and is the
       * whole reason rank() shares places rather than inventing an order.
       */}
      <span
        data-rank={row.position ?? ''}
        className={`w-6 shrink-0 text-right text-small font-bold [font-variant-numeric:tabular-nums] ${
          row.position === 1 ? 'text-mark' : 'text-muted'
        }`}
      >
        {row.position === null ? '-' : `${row.tied ? '=' : ''}${row.position}`}
      </span>

      <Avatar profile={row.profile} size={34} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-small font-semibold text-ink">{name}</span>
          <span className="shrink-0 text-small font-semibold text-ink [font-variant-numeric:tabular-nums]">
            {/* A dash, not a zero. Nothing scheduled is not a measured zero,
                and "0%" beside somebody who had no goals this week is the app
                accusing them of something they were never asked to do. */}
            {has ? `${row.pct}%` : '-'}
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-pill bg-ink/[0.07]">
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${has ? row.pct : 0}%` }}
          />
        </div>

        {has && (
          <p className="mt-1.5 text-label text-muted [font-variant-numeric:tabular-nums]">
            {t('analytics.of_scheduled', { done: row.done, total: row.target })}
          </p>
        )}
      </div>
    </div>
  )
}

export default function GroupAnalytics({ members = [], goals = [], cycles = [], checkins = [], items = [] }) {
  const { t } = useT()
  const [period, setPeriod] = useState(DEFAULT_PERIOD)

  const rows = useMemo(
    () => rank(memberRates({ members, goals, cycles, checkins, items, period })),
    [members, goals, cycles, checkins, items, period],
  )
  /* From the same two totals the rows are built on, so a member can add the
     rows up and get this. Ranking reorders them and changes neither total. */
  const whole = useMemo(() => groupRate(rows), [rows])

  return (
    <div className="lg p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="eyebrow">{t('analytics.title')}</span>
        {/* The group's own figure, from the same two totals the rows are built
            on, so a member can add the rows up and get this. */}
        <span className="text-small font-semibold text-muted [font-variant-numeric:tabular-nums]">
          {whole.pct !== null ? t('analytics.group_pct', { n: whole.pct }) : t('analytics.nothing_yet')}
        </span>
      </div>

      <div className="mt-4">
        <PeriodBar value={period} onChange={setPeriod} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-small text-muted">{t('analytics.nothing_yet')}</p>
      ) : (
        <div className="mt-2 list">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </div>
      )}

      <p className="mt-4 text-small text-muted">{t('analytics.note')}</p>
    </div>
  )
}
