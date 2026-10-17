import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { PRICES, money } from '../../lib/bb/plans'
import { canEmbed } from '../../lib/stripeEmbed'
import { CHECKOUT_LOOK } from '../../lib/checkoutLook'
import CheckoutCard, { CORNERS } from '../../components/CheckoutCard'
import { call } from '../api'
import { Note, PILL } from '../kit'
import PublicFrame from './PublicFrame'

/**
 * /hakkilo/paiement/:plan: paying for Plus on a page of Hakkilo's own.
 *
 *   "What about the sticker on the checkout page, our colors etc??", then
 *   "Oui, notre page" (Kee).
 *
 * The pricing page sends a signed-in student here once the build holds the
 * publishable key (canEmbed, src/lib/stripeEmbed.js). The server makes the
 * session for Stripe's embedded form when its two keys agree (embeddable in
 * api/_brand.js) and answers with its client secret; the form opens in a
 * lilac card with real stickers stuck on its edges. When the server answers
 * with Stripe's own address instead, or the form cannot open here, the
 * student goes to Stripe's hosted page, as before: a payment never waits on
 * the decoration.
 *
 * The amount shown is PRICES, the table the server charges from. Black and
 * white like every Hakkilo page; the colour is the card's, the lilac of what
 * you picked, and the stickers'.
 */
const PER = { plus_month: 'bb.price.per_month', plus_semester: 'bb.price.per_semester', plus_year: 'bb.price.per_year' }

/* What paying sounds like, CHACHING, on the top right; the MONEY coin on
   the left; the cloud head, the brain of the app, on the bottom edge. */
const STICKERS = [
  { name: 'coin', tilt: -9, className: CORNERS.topLeft },
  { name: 'chaching', tilt: 6, className: CORNERS.topRight },
  { name: 'cloudguy', tilt: 8, className: CORNERS.bottomRight },
]

export default function Checkout() {
  const { plan } = useParams()
  const { t, locale } = useT()
  const navigate = useNavigate()
  const price = PRICES[plan]
  /* asking: the session is on its way; form: Stripe's form opens; leaving:
     off to Stripe's page; error: a word and a way back. */
  const [state, setState] = useState({ kind: 'asking' })
  usePageMeta({ title: `${t('bb.pay.title')} · Hakkilo` })

  useEffect(() => {
    if (!price) return undefined
    let live = true
    call('checkout', { plan, locale, embedded: canEmbed() }).then((r) => {
      if (!live) return
      if (r.ok && r.data.client_secret) return setState({ kind: 'form', secret: r.data.client_secret })
      if (r.ok && r.data.url) {
        setState({ kind: 'leaving' })
        return window.location.assign(r.data.url)
      }
      if (r.data.error === 'already') return navigate('/hakkilo/profil', { replace: true })
      setState({ kind: 'error', code: r.data.error === 'owner' ? 'owner' : r.data.error === 'no_billing' ? 'no_billing' : 'error' })
    })
    return () => {
      live = false
    }
  }, [plan, locale, price, navigate])

  /* The form would not open here (Stripe.js blocked, the network): Stripe's
     own page, with a session made for it. */
  async function hosted() {
    setState({ kind: 'leaving' })
    const r = await call('checkout', { plan, locale })
    if (r.ok && r.data.url) window.location.assign(r.data.url)
    else setState({ kind: 'error', code: 'error' })
  }

  if (!price) return <Navigate to="/hakkilo/tarifs" replace />

  return (
    <PublicFrame>
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 pt-8 md:pt-12" data-hook="bb-checkout">
        <Link to="/hakkilo/tarifs" className={PILL} data-hook="bb-checkout-back">
          {t('bb.pay.back')}
        </Link>
        <p className="eyebrow mt-8">Hakkilo · {t(`bb.price.${plan}`)}</p>
        <h1 className="mt-1 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">{t('bb.pay.title')}</h1>
        <p className="mt-3 text-body font-semibold text-ink" data-hook="bb-checkout-price">
          {money(price.cents, locale)} {t(PER[plan])}
        </p>
        <p className="lede mt-1 max-w-[46ch]">{t('bb.pay.lede')}</p>

        {state.kind === 'error' ? (
          <div className="mt-10 max-w-[40rem]">
            <Note tone={state.code === 'owner' ? 'info' : 'error'}>
              {state.code === 'owner' ? t('bb.price.owner') : state.code === 'no_billing' ? t('bb.price.no_billing') : t('bb.price.error')}
            </Note>
          </div>
        ) : (
          <CheckoutCard
            clientSecret={state.kind === 'form' ? state.secret : null}
            ground={CHECKOUT_LOOK.hakkilo.ground}
            stickers={STICKERS}
            loading={state.kind === 'leaving' ? t('bb.pay.leaving') : t('bb.pay.loading')}
            onFail={hosted}
          />
        )}

        <p className="mt-12 text-small text-muted">{t('bb.price.taxes')}</p>
      </section>
    </PublicFrame>
  )
}
