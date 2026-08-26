import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { loadBudget } from '../lib/budgetData'

const KEY = 'has_dismissed_budget_banner'

/**
 * "There is a new thing, here is the door to it."
 *
 * Replaces a bare heading and a sentence that sat in the middle of the feed
 * looking like a section with nothing in it. The difference is that this is
 * shaped like an announcement, so it reads as something new rather than as a
 * broken part of the page, and it can be got rid of.
 *
 * It removes itself in four cases, and quietly in all of them: the migration
 * has not been run, the person already has a plan, they dismissed it, or they
 * are signed out. A banner advertising a feature you are already using is
 * worse than no banner.
 *
 * Dismissal is in localStorage rather than on the profile. The intro flag went
 * to the database because replaying six slides on a laptop is genuinely
 * annoying; a banner reappearing once on a second device is not worth another
 * migration to run. Say the word and it moves to a column.
 */
export default function BudgetBanner() {
  const { user } = useAuth()
  const { t } = useT()
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!user) return
      try {
        if (localStorage.getItem(KEY) === '1') return
      } catch {
        /* private mode with storage disabled: show it, dismissing just will
           not stick, which is better than the banner never appearing. */
      }
      const r = await loadBudget(user.id)
      // Already has a plan, or the tables are not there. Either way, nothing
      // to announce.
      if (dead || r.missing || (r.plan && Number(r.plan.monthly_income_cents) > 0)) return
      setShow(true)
    })()
    return () => {
      dead = true
    }
  }, [user])

  if (!show) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* see above */
    }
    // Played out rather than yanked, so the feed does not jump under a thumb
    // that has just tapped something.
    setLeaving(true)
    setTimeout(() => setShow(false), 220)
  }

  return (
    <div
      className={`relative mt-6 overflow-hidden rounded-card border border-accent/25 p-5 transition-all duration-200 ease-settle ${
        leaving ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'
      }`}
      style={{
        // A wash rather than a fill. At full strength the accent would make
        // this the loudest thing on a page whose actual job is the groups
        // underneath it.
        backgroundImage:
          'rgb(var(--c-field) / 0.16)',
      }}
    >
      <button
        onClick={dismiss}
        aria-label={t('banner.dismiss')}
        className="press absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-body leading-none text-ink/60"
      >
        &times;
      </button>

      {/* No icon. An emoji renders as a different picture on every platform
          and at a different weight from the type beside it, so it was the one
          thing in the card that did not look drawn by the same hand. The
          gradient and the border already say "this is new". */}
      <div className="pr-8">
        <div className="text-body font-semibold text-ink">{t('banner.budget_title')}</div>
        <p className="mt-1 text-small leading-snug text-muted">{t('banner.budget_sub')}</p>
      </div>

      <Link to="/money" onClick={dismiss} className="btn-primary press mt-4 inline-flex">
        {t('banner.budget_cta')}
      </Link>
    </div>
  )
}
