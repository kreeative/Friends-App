import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Spot } from '../../components/StickerKit'
import { PRICES, money, perMonth } from '../../lib/bb/plans'
import { call } from '../api'
import { Note } from '../kit'
import PublicFrame from './PublicFrame'

/**
 * /nerd/tarifs: the plans of section 13, with fair use written out.
 *
 * The amounts come from PRICES (src/lib/bb/plans.js), the same table the
 * server charges from, so the page cannot advertise one price and Stripe
 * take another. A signed-out student is sent to sign in first and comes
 * back here; a signed-in one goes straight to Stripe Checkout.
 *
 * The semester plan is the one pointed at, in words ("Notre conseil"), never
 * by a code-drawn badge: it matches a term and its exams.
 */
const PER = { plus_month: 'bb.price.per_month', plus_semester: 'bb.price.per_semester', plus_year: 'bb.price.per_year' }

export default function Pricing() {
  const { t, locale } = useT()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  usePageMeta({ title: `${t('bb.price.title')} · Nerd`, description: t('bb.price.lede') })

  async function choose(plan) {
    setError(null)
    if (!user) return navigate(`/nerd/connexion?next=${encodeURIComponent('/nerd/tarifs')}`)
    setBusy(plan)
    const r = await call('checkout', { plan, locale })
    if (r.ok && r.data.url) {
      window.location.assign(r.data.url)
      return
    }
    setBusy(null)
    if (r.data.error === 'owner') setError('owner')
    else if (r.data.error === 'already') navigate('/nerd/profil')
    else if (r.data.error === 'no_billing') setError('no_billing')
    else setError('error')
  }

  const plans = ['plus_semester', 'plus_month', 'plus_year']

  return (
    <PublicFrame>
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10 md:pt-14" data-hook="bb-pricing">
        <div className="relative">
          <h1 className="max-w-[16ch] text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">{t('bb.price.title')}</h1>
          <p className="lede mt-4 max-w-[46ch]">{t('bb.price.lede')}</p>
          <Spot name="coin" tilt={10} delay={300} className="absolute -top-4 right-0 hidden w-20 sm:block md:w-24" />
        </div>

        {params.get('plus') === 'annule' && <Note className="mt-6 max-w-[40rem]">{t('bb.price.cancelled')}</Note>}
        {error && (
          <Note tone={error === 'owner' ? 'info' : 'error'} className="mt-6 max-w-[40rem]">
            {error === 'owner' ? t('bb.price.owner') : error === 'no_billing' ? t('bb.price.no_billing') : t('bb.price.error')}
          </Note>
        )}

        <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="lg flex flex-col p-6" data-hook="plan-free">
            <h2 className="text-body font-bold text-ink">{t('bb.price.free')}</h2>
            <p className="mt-3 text-[2.25rem] font-bold leading-none tracking-[-0.02em] text-ink">{t('bb.price.free_price')}</p>
            <p className="mt-2 text-small text-muted">{t('bb.price.free_note')}</p>
            <ul className="mt-5 flex-1 space-y-2 text-small text-ink">
              {['f_free_1', 'f_free_2', 'f_free_3'].map((k) => (
                <li key={k} className="flex gap-2">
                  <Check />
                  <span>{t(`bb.price.${k}`)}</span>
                </li>
              ))}
            </ul>
            <Link to={user ? '/nerd/app' : '/nerd/connexion?next=/nerd/start'} className="btn-outline press mt-6">
              {user ? t('bb.pub.open') : t('bb.price.free_cta')}
            </Link>
          </article>

          {plans.map((plan) => {
            const p = PRICES[plan]
            const pick = plan === 'plus_semester'
            return (
              <article key={plan} className={`lg flex flex-col p-6 ${pick ? 'ring-2 ring-ink' : ''}`} data-hook={`plan-${plan}`}>
                <h2 className="text-body font-bold text-ink">{t(`bb.price.${plan}`)}</h2>
                <p className="mt-3 text-[2.25rem] font-bold leading-none tracking-[-0.02em] text-ink">{money(p.cents, locale)}</p>
                <p className="mt-2 text-small text-muted">
                  {t(PER[plan])}
                  {plan !== 'plus_month' && <> · {t('bb.price.about_month', { amount: perMonth(plan, locale) })}</>}
                </p>
                {pick && <p className="mt-3 text-small font-semibold text-ink">{t('bb.price.pick')}</p>}
                {plan === 'plus_year' && <p className="mt-3 text-small font-semibold text-ink">{t('bb.price.year_off')}</p>}
                {plan === 'plus_month' && <p className="mt-3 text-small font-semibold text-ink">{t('bb.price.cancel')}</p>}
                <ul className="mt-5 flex-1 space-y-2 text-small text-ink">
                  {['f_plus_1', 'f_plus_2', 'f_plus_3', 'f_plus_4'].map((k) => (
                    <li key={k} className="flex gap-2">
                      <Check />
                      <span>{t(`bb.price.${k}`)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choose(plan)}
                  disabled={busy !== null}
                  data-hook={`choose-${plan}`}
                  className={`btn press mt-6 font-bold ${pick ? 'bg-ink text-white hover:opacity-90' : 'btn-outline'}`}
                >
                  {busy === plan ? '…' : t('bb.price.choose', { plan: 'Plus' })}
                </button>
              </article>
            )
          })}
        </div>

        <div className="mt-12 max-w-[60ch]">
          <h2 className="text-h2 text-ink">{t('bb.price.fair_title')}</h2>
          <p className="mt-3 text-body text-muted">{t('bb.price.fair_body')}</p>
          <p className="mt-4 text-small text-muted">{t('bb.price.taxes')}</p>
          {!user && <p className="mt-2 text-small text-muted">{t('bb.price.signin_first')}</p>}
        </div>
      </section>
    </PublicFrame>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-1 h-3.5 w-3.5 shrink-0 text-ink" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  )
}
