import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { summarise } from '../lib/budget'
import { loadBudget } from '../lib/budgetData'
import { Section } from '../components/ui'

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
  const { user } = useAuth()
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

  const s = summarise({ ...state, today: new Date() })
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

  return (
    <Section title={t('money.title')}>
      <Link to="/money" className="block">
        {s.overcommitted ? (
          <>
            <div className="text-h2 text-ink">{t('money.overcommitted_title')}</div>
            <p className="lede mt-2 max-w-[32ch]">
              {t('money.overcommitted_short', { over: fmt(Math.abs(s.pool)) })}
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow">
              {s.overspent ? t('money.over_label') : t('money.today_label')}
            </div>
            <div className="font-display text-metric leading-none text-ink [font-variant-numeric:tabular-nums]">
              {fmt(s.overspent ? s.left : s.perDay)}
            </div>
            <p className="lede mt-3 max-w-[32ch]">
              {t('money.today_body', { left: fmt(s.left), days: s.period.daysLeft })}
            </p>
          </>
        )}
      </Link>
    </Section>
  )
}
