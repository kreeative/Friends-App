/**
 * node src/lib/checkoutEmbed.test.mjs
 *
 * "What about the sticker on the checkout page, our colors etc??", then "Oui,
 * notre page" (Kee). The checkout is our own page now, with Stripe's form
 * inside it, for Hakkilo Plus and for the books. Nothing here talks to Stripe:
 * what is checked is when a session is made for that form, what it carries,
 * how the browser opens it (one at a time), and that every button keeps its
 * way to Stripe's own page.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\ncheckout on our own page')

/* --- when the server makes a session for the form ------------------------------------------- */
const { BRANDING_API_VERSION, CHECKOUT_BRANDING, embeddable, keyMode } = await import('../../api/_brand.js')
const { CHECKOUT_LOOK } = await import('./checkoutLook.js')

ok('a key says its mode', keyMode('sk_test_x') === 'test' && keyMode('pk_live_x') === 'live' && keyMode('rk_live_x') === 'live')
ok('anything else has none', keyMode('whsec_x') === null && keyMode('') === null && keyMode(undefined) === null && keyMode('pk_x') === null)

/* Fake strings, never keys: only their prefixes are read. */
const keys = (pk, sk) => {
  for (const n of ['VITE_STRIPE_PUBLISHABLE_KEY', 'STRIPE_PUBLISHABLE_KEY', 'stripe_publishable_key', 'STRIPE_SECRET_KEY', 'stripe_secret_key']) delete process.env[n]
  if (pk) process.env.VITE_STRIPE_PUBLISHABLE_KEY = pk
  if (sk) process.env.STRIPE_SECRET_KEY = sk
}
keys('pk_test_a', 'sk_test_b')
ok('the form, when the page asks and both keys are test', embeddable(true) === true)
ok('Stripe\'s page when the page did not ask', embeddable(false) === false && embeddable(undefined) === false)
keys('pk_live_a', 'rk_live_b')
ok('both live, a restricted secret key too', embeddable(true) === true)
keys('pk_test_a', 'sk_live_b')
ok('a test pk with a live sk: Stripe\'s page, not a form that never opens', embeddable(true) === false)
keys(null, 'sk_live_b')
ok('no pk set: Stripe\'s page, as before', embeddable(true) === false)
keys('pk_live_a', null)
ok('no secret key: no form', embeddable(true) === false)
keys(null, null)

/* --- what the two sessions carry ------------------------------------------------------------ */
const bb = read('api/_bb/billing.js')
const books = read('api/checkout.js')
for (const [name, code] of [['Hakkilo Plus', bb], ['the books', books]]) {
  ok(`${name}: asks embeddable with what the page sent`, /const embedded = embeddable\(body\??\.embedded\)/.test(code))
  ok(`${name}: the form's session is ui_mode embedded, back to the same address`, /\? \{ ui_mode: 'embedded', return_url: paid \}/.test(code))
  ok(`${name}: Stripe's page keeps its success and cancel`, /: \{ success_url: paid, cancel_url: `\$\{origin\}/.test(code))
  ok(`${name}: the form gets its client secret, Stripe's page its url`, /json\(embedded \? \{ client_secret: session\.client_secret \} : \{ url: session\.url \}\)/.test(code))
  ok(`${name}: made at the branding version`, /await createCheckoutSession\(stripe, /.test(code))
}
ok('Hakkilo comes back with the session, for /sync', /const paid = `\$\{origin\}\/hakkilo\/profil\?plus=ok&session_id=\{CHECKOUT_SESSION_ID\}`/.test(bb))

/* ui_mode 'embedded' and initEmbeddedCheckout are the clover names; dahlia renamed both
   (embedded_page, createEmbeddedCheckoutPage). The session and the script move together. */
const embed = await import('./stripeEmbed.js')
ok('Stripe.js from js.stripe.com, of the release the sessions are made at',
  embed.STRIPE_JS === `https://js.stripe.com/${BRANDING_API_VERSION.split('.')[1]}/stripe.js` && BRANDING_API_VERSION === '2025-09-30.clover',
  embed.STRIPE_JS)
ok('never bundled: no @stripe/stripe-js', !/"@stripe\/stripe-js"/.test(read('package.json')))
ok('no publishable key in this build: the buttons keep going to Stripe\'s page', embed.canEmbed() === false)

/* --- the form, one at a time ---------------------------------------------------------------- */
{
  const log = []
  let open = 0
  let most = 0
  globalThis.window = {
    Stripe: () => ({
      initEmbeddedCheckout: async ({ fetchClientSecret }) => {
        const secret = await fetchClientSecret()
        await new Promise((r) => setTimeout(r, 5))
        open += 1
        most = Math.max(most, open)
        log.push(`init ${secret}`)
        return {
          mount: (el) => log.push(`mount ${secret} in ${el}`),
          destroy: () => {
            open -= 1
            log.push(`destroy ${secret}`)
          },
        }
      },
    }),
  }
  /* React's double mount: the first taken down before it even started. */
  const first = embed.mountCheckout('cs_1', 'host')
  first.destroy()
  const second = embed.mountCheckout('cs_2', 'host')
  await first.ready
  await second.ready
  ok('a form taken down before it started is never made', !log.includes('init cs_1') && !log.includes('mount cs_1 in host'), log.join(' / '))
  ok('and the next one opens', log.includes('mount cs_2 in host'), log.join(' / '))
  second.destroy()
  /* Taken down while Stripe is still making it: destroyed when it arrives,
     and the next one waits for that. */
  const third = embed.mountCheckout('cs_3', 'host')
  await new Promise((r) => setTimeout(r, 1))
  third.destroy()
  const fourth = embed.mountCheckout('cs_4', 'host')
  await third.ready
  await fourth.ready
  ok('one taken down on its way is destroyed when it arrives, never mounted', log.includes('init cs_3') && log.includes('destroy cs_3') && !log.includes('mount cs_3 in host'), log.join(' / '))
  ok('the next one waits for it, then opens', log.indexOf('init cs_4') > log.indexOf('destroy cs_3') && log.includes('mount cs_4 in host'), log.join(' / '))
  ok('never two forms at once', most === 1, `most ${most}`)
  fourth.destroy()
  ok('and leaving the page takes it down', open === 0)
  delete globalThis.window
  const nowhere = embed.mountCheckout('cs_5', 'host')
  let refused = false
  await nowhere.ready.catch(() => {
    refused = true
  })
  ok('no Stripe.js: ready rejects, so the page can go to Stripe\'s', refused)
}

/* --- the pages ------------------------------------------------------------------------------ */
const card = read('src/components/CheckoutCard.jsx')
const hak = read('src/bb/pages/Checkout.jsx')
const rf = read('src/pages/Checkout.jsx')
ok('the card is the colour Stripe paints behind its form', /style=\{\{ background: ground \}\}/.test(card))
ok('Hakkilo: its lilac, from the one table', /ground=\{CHECKOUT_LOOK\.hakkilo\.ground\}/.test(hak) && CHECKOUT_BRANDING.hakkilo.background_color === CHECKOUT_LOOK.hakkilo.ground)
ok('the books: their rose, from the same table', /ground=\{CHECKOUT_LOOK\.rf\.ground\}/.test(rf) && CHECKOUT_BRANDING.rf.background_color === CHECKOUT_LOOK.rf.ground)
ok('the branding writes no colour of its own', !/background_color: '#|button_color: '#/.test(read('api/_brand.js')))
for (const [name, code] of [['Hakkilo', hak], ['the books', rf]]) {
  const stickers = [...code.matchAll(/\{ name: '([a-z-]+)', tilt: -?\d+, className: CORNERS\.(\w+) \}/g)]
  ok(`${name}: real stickers, from the folder`, stickers.length >= 2 && stickers.every(([, n]) => existsSync(join(root, 'src/assets/stickers', `${n}.png`))), stickers.map((s) => s[1]).join(' '))
  ok(`${name}: each in a corner the probe measured`, stickers.every(([, , c]) => ['topLeft', 'topRight', 'bottomRight'].includes(c)))
  ok(`${name}: asks for the form only when this build can open it`, /embedded: canEmbed\(\)/.test(code))
  ok(`${name}: Stripe's page when the server sends its address`, /window\.location\.(assign\(r\.data\.url\)|href = r\.url)/.test(code))
  ok(`${name}: and when the form cannot open here`, /onFail=\{hosted\}/.test(code) && /async function hosted\(\)/.test(code))
}
/* "Le design du checkout n'est pas bien ajuste sur le telephone" (Kee): inside the
   page's 24px and the card's 8px, Stripe's form had 326px of a 390 screen. On a
   phone the card is a band from edge to edge, undoing the pages' px-6; from sm
   the rounded card again. */
ok('on a phone the card runs edge to edge', /className="relative -mx-6 mt-12 sm:mx-0" data-hook="checkout-card"/.test(card) && /className="px-0 py-14 sm:rounded-card sm:px-4"/.test(card))
ok('and both pages have the 24px sides it undoes', /<section className="mx-auto w-full max-w-3xl px-6 /.test(hak) && /<div className="px-6 pb-24 pt-14">\{body\}<\/div>/.test(rf))
ok('no badge drawn in code on the card', !/rounded-pill[^"]*uppercase/.test(card) && /<Spot /.test(card))

/* --- the way there -------------------------------------------------------------------------- */
const app = read('src/App.jsx')
ok('the books\' page, signed out and signed in', (app.match(/<Route path="paiement\/:slug" element=\{<Checkout \/>\} \/>/g) ?? []).length === 2)
ok('Hakkilo\'s, behind sign-in', /path="paiement\/:plan"\s*element=\{\s*<RequireUser>\s*<Checkout \/>\s*<\/RequireUser>/.test(read('src/bb/BBApp.jsx')))
ok('the pricing page leads there, or to Stripe\'s page without the key',
  /const ours = canEmbed\(\) \? `\/hakkilo\/paiement\/\$\{plan\}` : null/.test(read('src/bb/pages/Pricing.jsx')) && /window\.location\.assign\(r\.data\.url\)/.test(read('src/bb/pages/Pricing.jsx')))
for (const file of ['src/pages/Library.jsx', 'src/pages/Reader.jsx', 'src/pages/public/Preview.jsx']) {
  const code = read(file)
  ok(`${file}: buy leads to our page when it can open`, /if \(canEmbed\(\)[^)]*\) return navigate\(checkoutPath\(/.test(code))
  ok(`${file}: and to Stripe's page otherwise`, /await startCheckout\(/.test(code))
}

/* --- the words, in both languages ----------------------------------------------------------- */
const i18n = read('src/lib/i18n.jsx')
const keysOf = (block) => [...block.matchAll(/'(checkout\.[a-z_]+)'/g)].map((m) => m[1]).sort()
const en = i18n.slice(i18n.indexOf("'checkout.title': 'Your payment'"), i18n.indexOf("'checkout.secure'", i18n.indexOf("'checkout.title': 'Your payment'")) + 20)
const fr = i18n.slice(i18n.indexOf("'checkout.title': 'Ton paiement'"), i18n.indexOf("'checkout.secure'", i18n.indexOf("'checkout.title': 'Ton paiement'")) + 20)
ok('every word of the books\' page in English and in French', keysOf(en).length === 11 && keysOf(en).join() === keysOf(fr).join(), `${keysOf(en).length} / ${keysOf(fr).length}`)
ok('and every key the page asks for exists', [...rf.matchAll(/t\('(checkout\.[a-z_]+)'\)/g)].every((m) => keysOf(en).includes(m[1])))
ok('no em dash in what was written for it', ![card, hak, rf, read('src/lib/stripeEmbed.js'), read('src/lib/checkoutLook.js'), en, fr].some((s) => s.includes('\u2014')))

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
