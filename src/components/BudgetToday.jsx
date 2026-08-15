import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { dailySeries, summarise } from '../lib/budget'
import { loadBudget } from '../lib/budgetData'
import { Section } from '../components/ui'
import Sparkline from './Sparkline'

/**
 * The money feature, reduced to the one line that belongs on the dashboard.
 *
 * Renders its own Section so that it disappears completely, heading included,
 * when there is nothing to say. Three ways that happens: the migration has not
 * been run, the person has not set a plan up, or they are signed out. An
 * empty box with a title over it is worse than no box.
 *
 * Refetched when the tab is looked at again, because a spend logged on the
 * money screen has to be reflected here without a reload.
 */
export default function BudgetToday() {
  const { user, profile } = useAuth()
  const { t, locale } = useT()
  const [state, setState] = useState(null)

  useEffect(() => {
    let dead = false
    const run = async () => {
      if (!user) return
      const r = await loadBudget(user.id)
      if (!dead) setState(r)
    }
    run()
    const onShow = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [user])

  if (!state || state.missing) return null

  const s = summarise({ ...state, today: new Date(), currency: profile?.currency })
  const fmt = (c) => money(c, s.currency, locale)

  /**
   * Nothing set up yet, so this renders nothing at all.
   *
   * It used to put a heading and a sentence here, which on a feed of real
   * sections read as a section that had failed to load rather than as an
   * invitation. Announcing the feature is BudgetBanner's job now, and a
   * banner can be dismissed, which a heading cannot.
   */
  if (!s.ready) return null

  /* Cumulative spend read from the other end, so the line falls as the month
     goes rather than climbing. Same helper the money screen uses. */
  const remaining = dailySeries({ entries: s.entries, period: s.period }).map(
    (v) => s.earned - s.fixedDue - v,
  )

  return (
    <Section title={t('money.title')}>
      {/* In a card, now that the page has a colour of its own. This was the
          one block on the dashboard still sitting straight on the ground, and
          on a tinted ground that reads as content that has escaped its
          container rather than as a deliberately plain block. */}
      <Link to="/money" className="lg block p-5 no-underline sm:p-6">
        {s.overcommitted ? (
          <>
            <div className="text-h2 text-ink">{t('money.overcommitted_title')}</div>
            <p className="lede mt-2 max-w-[32ch]">
              {t('money.overcommitted_short', { over: fmt(Math.abs(s.plannedPool)) })}
            </p>
          </>
        ) : (
          <>
            {/* The same three lines as the money screen's headline card, and
                the same fix: the label carried no bottom margin, so it and the
                number were touching at a measured 0px. Kept in step with
                Money.jsx deliberately, this is one card that appears twice
                rather than two cards that look alike. */}
            <div className="eyebrow mb-2 !text-[0.75rem] !font-medium !tracking-[0.05em]">
              {!s.logged
                ? t('money.balance_label')
                : s.overspent
                  ? t('money.over_label')
                  : t('money.today_label')}
            </div>
            {/* leading-none removed so `metric`'s own 1.04 applies. See the
                note on the twin in Money.jsx. */}
            <div className="font-display text-metric text-ink [font-variant-numeric:tabular-nums]">
              {fmt(s.logged ? (s.overspent ? s.available : s.perDay) : 0)}
            </div>
            {/* Nothing logged is its own sentence, not a number dressed as one.
                The plan is named beside it so the setup is not invisible, but
                it is named AS a plan. */}
            <p className="lede mt-2 max-w-[32ch]">
              {s.logged
                ? t('money.today_body', { left: fmt(s.available), days: s.period.daysLeft })
                : t('money.nothing_logged', { planned: fmt(s.plannedPerDay) })}
            </p>
            {/**
             * What is left, day by day, under the number that is today's slice
             * of it.
             *
             * The figure alone answers "how much", and a person reading this
             * card on the 22nd wants the other question: whether the month has
             * been going well or has been quietly draining. One line answers
             * that in the space a second sentence would have taken.
             *
             * Falling, not rising: the same series the money screen draws in
             * its "left" tile, so the two cannot disagree about a day.
             */}
            <Sparkline points={remaining} tone="accent" height={46} className="mt-4" />
          </>
        )}
      </Link>
    </Section>
  )
}
