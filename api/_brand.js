/**
 * How a Stripe Checkout page looks, per app.
 *
 * "When I want to try to pay for something, it says Stripe checkout sandbox,
 * and it doesn't even have the logo", then "can we personalize the checkout
 * with our own design?" (Kee). One Stripe account sells for two apps, so the
 * account's own branding can only ever be one of them. Since API version
 * 2025-09-30.clover a Checkout Session carries its own: the name at the top,
 * an icon, the background and button colours, a font and the corners. Only
 * the session creation asks for that version (a per-request option); every
 * other call keeps the version the client is pinned to.
 *
 * The images are given by URL on the production site, which Stripe can
 * always fetch: a localhost or preview origin it could not. Stripe's fonts do
 * not include Poppins; Be Vietnam Pro is the nearest of its list.
 *
 * Hakkilo: its H, the soft lilac of the app, the black button of every
 * Hakkilo screen. Rich & Friends: its tile, the rose pastel of its calendar
 * (--c-ev-cours), and the deep pink that exists to carry small white words
 * (CLAUDE.md: white on the logo pink is 3.80:1, under the 4.5 a button's
 * label needs; on #D6006B it passes).
 *
 * The first grounds were white and a blush at 98% white: "you just add the
 * logo, what about our colors?" (Kee). Both read as Stripe's own page. The
 * ground is the one colour Stripe paints across the page, so it is the
 * app's, and still pale enough for the dark words Stripe puts on it.
 *
 * Stickers cannot go on this page: Stripe's hosted Checkout takes a logo, an
 * icon, these two colours, a font from its list and a corner style, nothing
 * else. So the page is ours when it can be (embeddable, below): the same
 * session, embedded in a page with the stickers and the app's design, and
 * these settings still dress the form inside it.
 *
 * "Sandbox" at the top of the page is not branding: it is the key. It goes
 * once STRIPE_SECRET_KEY on Vercel is the live key, and that is set in
 * Vercel, never here.
 */
import { env } from './_env.js'
import { CHECKOUT_LOOK } from '../src/lib/checkoutLook.js'

export const BRANDING_API_VERSION = '2025-09-30.clover'

/** 'test' or 'live', from a Stripe key's prefix (sk_, rk_ or pk_); null for anything else. */
export function keyMode(key) {
  const m = /^(?:sk|rk|pk)_(test|live)_/.exec(String(key ?? ''))
  return m ? m[1] : null
}

/**
 * Our own checkout page, or Stripe's.
 *
 * "Oui, notre page" (Kee): our page with the stickers, and Stripe's form
 * inside it. That form (ui_mode 'embedded' at BRANDING_API_VERSION, renamed
 * 'embedded_page' from 2026-03-25.dahlia) is opened in the browser by
 * Stripe.js with the publishable key, and a key of the other mode cannot
 * open the session: a test pk with a live sk is a form that never appears.
 * So a session is made for it only when the page asked (it holds a key)
 * and both keys are set and of one mode; otherwise it is Stripe's hosted
 * page, as before, and the browser goes there.
 */
export function embeddable(asked) {
  if (!asked) return false
  const pk = keyMode(env('stripePublishable'))
  return pk !== null && pk === keyMode(env('stripeSecret'))
}

const SITE = 'https://richandfriends.xyz'

export const CHECKOUT_BRANDING = {
  hakkilo: {
    display_name: 'Hakkilo',
    icon: { type: 'url', url: `${SITE}/brand/hakkilo-icon-512.png` },
    background_color: CHECKOUT_LOOK.hakkilo.ground,
    button_color: CHECKOUT_LOOK.hakkilo.button,
    font_family: 'be_vietnam_pro',
    border_style: 'rounded',
  },
  rf: {
    display_name: 'Rich & Friends',
    icon: { type: 'url', url: `${SITE}/icon-512.png` },
    background_color: CHECKOUT_LOOK.rf.ground,
    button_color: CHECKOUT_LOOK.rf.button,
    font_family: 'be_vietnam_pro',
    border_style: 'rounded',
  },
}

/**
 * What a session may carry, by where it opens.
 *
 * Stripe's form inside our page refuses the icon: "You cannot set `icon`
 * when `ui_mode` is `embedded`" was the answer to every Hakkilo Plus
 * checkout once the keys went live on 18 October, and the page said "Le
 * paiement n'a pas pu demarrer". The icon is the header of Stripe's own
 * page; ours shows the logo itself. Stripe's page keeps all of it.
 */
export function brandingFor(app, embedded) {
  const { icon, ...rest } = CHECKOUT_BRANDING[app]
  return embedded ? rest : CHECKOUT_BRANDING[app]
}

/** A refusal that names a branding field, and nothing else. */
export function brandingRefused(err) {
  if (err?.type !== 'StripeInvalidRequestError') return false
  if (String(err.param ?? '').startsWith('branding_settings')) return true
  return /`(branding_settings|icon|logo|display_name|background_color|button_color|font_family|border_style)`/.test(String(err.message ?? ''))
}

/**
 * The session, at the branding version. A sale never fails over how it
 * looks: if Stripe refuses a branding field (the docs do not list what each
 * mode accepts, and only the live keys showed the icon), the same session
 * goes again without branding, and the log says which field it was.
 */
export async function createCheckoutSession(stripe, config) {
  try {
    return await stripe.checkout.sessions.create(config, { apiVersion: BRANDING_API_VERSION })
  } catch (err) {
    if (!config.branding_settings || !brandingRefused(err)) throw err
    console.error(`checkout branding refused, sent without it: ${err.param ?? '-'} ${err.message}`)
    const { branding_settings: _, ...plain } = config
    return stripe.checkout.sessions.create(plain, { apiVersion: BRANDING_API_VERSION })
  }
}
