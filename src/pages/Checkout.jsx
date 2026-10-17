import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { usePageMeta } from '../lib/pageMeta'
import { money } from '../lib/money'
import { canEmbed } from '../lib/stripeEmbed'
import { CHECKOUT_LOOK } from '../lib/checkoutLook'
import { livePrice, requestCheckout } from '../lib/library'
import { PREVIEW_BOOKS } from '../content/previews'
import CheckoutCard, { CORNERS } from '../components/CheckoutCard'
import { Screen } from '../components/ui'

/**
 * /paiement/:slug: paying for a book on a page of Rich & Friends' own.
 *
 *   "What about the sticker on the checkout page, our colors etc??", then
 *   "Oui, notre page" (Kee).
 *
 * The buy buttons (the public chapter, the library, the reader) come here
 * once the build holds the publishable key (canEmbed, src/lib/stripeEmbed.js),
 * signed in or not: buying never asked for an account and still does not.
 * The server makes the session for Stripe's embedded form when its two keys
 * agree (embeddable in api/_brand.js), and the form opens in a rose card with
 * real stickers stuck on its edges. When the server answers with Stripe's own
 * address instead, or the form cannot open here, the buyer goes to Stripe's
 * hosted page, as before. Once paid, Stripe brings them back to the address
 * it always did (/library?purchase=success).
 *
 * The title and the price shown come from the bundle and the live price
 * list, like the public chapter; the amount charged is the server's, read
 * from the catalogue.
 */
/* What paying sounds like, CHACHING, on the top right; the wallet on the
   left; the fire of a good book on the bottom edge. */
const STICKERS = [
  { name: 'wallet', tilt: -8, className: CORNERS.topLeft },
  { name: 'chaching', tilt: 5, className: CORNERS.topRight },
  { name: 'fire', tilt: 9, className: CORNERS.bottomRight },
]

export default function Checkout() {
  const { slug } = useParams()
  const { user } = useAuth()
  const { t, locale } = useT()
  const book = PREVIEW_BOOKS.find((b) => b.slug === slug) ?? null
  const [price, setPrice] = useState(null)
  /* asking: the session is on its way; form: Stripe's form opens; leaving:
     off to Stripe's page; error: a word and a way back. */
  const [state, setState] = useState({ kind: 'asking' })
  usePageMeta({ title: `${t('checkout.title')} · Rich & Friends` })

  useEffect(() => {
    let live = true
    livePrice(slug)
      .then((p) => live && p && setPrice(p))
      .catch(() => {})
    requestCheckout(slug, { embedded: canEmbed() }).then((r) => {
      if (!live) return
      if (r.clientSecret) return setState({ kind: 'form', secret: r.clientSecret })
      if (r.url) {
        setState({ kind: 'leaving' })
        window.location.href = r.url
        return
      }
      setState({ kind: 'error', owned: Boolean(r.owned), detail: r.error ?? null })
    })
    return () => {
      live = false
    }
  }, [slug])

  /* The form would not open here (Stripe.js blocked, the network): Stripe's
     own page, with a session made for it. */
  async function hosted() {
    setState({ kind: 'leaving' })
    const r = await requestCheckout(slug)
    if (r.url) window.location.href = r.url
    else setState({ kind: 'error', owned: Boolean(r.owned), detail: r.error ?? null })
  }

  const cents = price?.cents ?? book?.price_cents
  const currency = price?.currency ?? book?.currency ?? 'CAD'
  const body = (
    <article className="mx-auto w-full max-w-3xl" data-hook="checkout">
      <Link to={user ? '/library' : book ? `/books/${slug}` : '/books'} className="text-small text-muted hover:text-ink" data-hook="checkout-back">
        ← {t('checkout.back')}
      </Link>
      <p className="eyebrow mt-10">{t('checkout.eyebrow')}</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ink">{t('checkout.title')}</h1>
      {book && (
        <p className="mt-4 text-body font-semibold text-ink" data-hook="checkout-book">
          {book.title}
          {cents != null && <> · {money(cents, currency, locale)}</>}
        </p>
      )}
      <p className="lede mt-1 max-w-[46ch]">{t(user ? 'checkout.lede' : 'checkout.lede_guest')}</p>

      {state.kind === 'error' ? (
        <div className="mt-10 max-w-[40rem] rounded-card bg-field p-6 text-on-field" role="alert" data-hook="checkout-error">
          <p className="text-body font-semibold">{state.owned ? t('checkout.owned') : t('checkout.error')}</p>
          {!state.owned && state.detail && <p className="mt-2 text-small text-on-field/80">{state.detail}</p>}
          {state.owned && (
            <Link to={user ? `/library/${slug}` : '/signin'} className="btn press mt-5 w-auto bg-on-field px-8 text-field hover:opacity-90">
              {user ? t('checkout.read') : t('preview.already_bought')}
            </Link>
          )}
        </div>
      ) : (
        <CheckoutCard
          clientSecret={state.kind === 'form' ? state.secret : null}
          ground={CHECKOUT_LOOK.rf.ground}
          stickers={STICKERS}
          loading={state.kind === 'leaving' ? t('checkout.leaving') : t('checkout.loading')}
          onFail={hosted}
        />
      )}

      <p className="mt-12 text-small text-muted">{t('checkout.secure')}</p>
    </article>
  )

  /* In the app, a page of the app (its room under the top bar is the page's
     own: "Retour" sat against the bar); signed out, a page of the public site. */
  return user ? (
    <Screen className="column-page">
      <div className="pt-8 md:pt-12">{body}</div>
    </Screen>
  ) : (
    <div className="px-6 pb-24 pt-14">{body}</div>
  )
}
