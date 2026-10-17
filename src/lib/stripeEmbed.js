/**
 * Stripe's checkout form, on a page of ours.
 *
 *   "What about the sticker on the checkout page, our colors etc??", then
 *   "Oui, notre page" (Kee).
 *
 * Stripe's hosted page takes a logo, two colours, a font from its list and a
 * corner style, and nothing else. So the checkout is our page now, with the
 * stickers and the app's design (src/bb/pages/Checkout.jsx for Hakkilo Plus,
 * src/pages/Checkout.jsx for the books), and Stripe's form sits inside it.
 * The form is Stripe's own iframe: nothing of our page reaches into it (it is
 * another origin), and what dresses it is the session's branding_settings,
 * the same as the hosted page's (api/_brand.js).
 *
 * Stripe.js is loaded from js.stripe.com and never bundled: the code that
 * touches a card stays Stripe's, and current. The clover build, the version
 * the sessions are made at (BRANDING_API_VERSION): its initEmbeddedCheckout
 * opens a session made with ui_mode 'embedded'. Dahlia renamed both, so the
 * two move together or not at all.
 *
 * The key is VITE_STRIPE_PUBLISHABLE_KEY, a pk_, public by design. Until it
 * is set in Vercel the buttons keep going to Stripe's hosted page, as before.
 */
export const STRIPE_JS = 'https://js.stripe.com/clover/stripe.js'
export const PUBLISHABLE_KEY = import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY ?? ''

/** Can this build open the form on our page? */
export const canEmbed = () => /^pk_(test|live)_/.test(PUBLISHABLE_KEY)

let loading = null

/** window.Stripe, the script loaded the first time it is asked for. */
export function loadStripe() {
  if (typeof window === 'undefined') return Promise.reject(new Error('stripe.js'))
  if (window.Stripe) return Promise.resolve(window.Stripe)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = STRIPE_JS
      script.async = true
      script.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error('stripe.js')))
      script.onerror = () => reject(new Error('stripe.js'))
      document.head.appendChild(script)
    }).catch((err) => {
      /* A blocked or dropped load is not the last word: the next try asks again. */
      loading = null
      throw err
    })
  }
  return loading
}

/* One form at a time. Stripe.js refuses a second embedded checkout while one
   exists, and React may mount a page, take it down and mount it again before
   the first form has even opened. So each one waits for the one before. */
let queue = Promise.resolve()

/**
 * Open the form for `clientSecret` in `el`.
 *
 * `ready` resolves once it is mounted and rejects when it cannot be (Stripe.js
 * blocked, a key of the wrong mode). `destroy` takes it down, or stops one
 * still on its way.
 */
export function mountCheckout(clientSecret, el) {
  let form = null
  let gone = false
  const ready = queue.then(async () => {
    if (gone) return
    const Stripe = await loadStripe()
    const made = await Stripe(PUBLISHABLE_KEY).initEmbeddedCheckout({ fetchClientSecret: async () => clientSecret })
    if (gone) {
      made.destroy()
      return
    }
    form = made
    made.mount(el)
  })
  queue = ready.catch(() => {})
  return {
    ready,
    destroy() {
      gone = true
      form?.destroy()
      form = null
    },
  }
}
