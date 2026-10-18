/**
 * node src/lib/checkoutBrand.test.mjs
 *
 * "When I want to try to pay for something, it says Stripe checkout sandbox,
 * and it doesn't even have the logo", then "can we personalize the checkout
 * with our own design?" (Kee). Each Checkout Session now carries its app's
 * branding (api/_brand.js). Nothing here talks to Stripe: what is checked is
 * that both sessions ask for it, at the API version that knows the field,
 * with values Stripe accepts and images that exist.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { BRANDING_API_VERSION, CHECKOUT_BRANDING } from '../../api/_brand.js'

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

console.log('\ncheckout branding')

/* Stripe's lists for branding_settings (API reference, 2025-09-30.clover). */
const FONTS = ['be_vietnam_pro', 'bitter', 'chakra_petch', 'default', 'hahmlet', 'inconsolata', 'inter', 'lato', 'lora', 'm_plus_1_code', 'montserrat', 'noto_sans', 'noto_sans_jp', 'noto_serif', 'nunito', 'open_sans', 'pridi', 'pt_sans', 'pt_serif', 'raleway', 'roboto', 'roboto_slab', 'source_sans_pro', 'titillium_web', 'ubuntu_mono', 'zen_maru_gothic']
const BORDERS = ['pill', 'rectangular', 'rounded']

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

ok('the version that knows branding_settings, or a later one', /^20(2[5-9])-\d\d-\d\d\.[a-z]+$/.test(BRANDING_API_VERSION) && BRANDING_API_VERSION >= '2025-09-30')

for (const [app, b] of Object.entries(CHECKOUT_BRANDING)) {
  ok(`${app}: a name at the top`, typeof b.display_name === 'string' && b.display_name.length > 1)
  ok(`${app}: its icon by URL on the production site, which Stripe can fetch`, b.icon?.type === 'url' && /^https:\/\/richandfriends\.xyz\//.test(b.icon.url))
  const file = join(root, 'public', b.icon.url.replace('https://richandfriends.xyz/', ''))
  ok(`${app}: and that image exists`, existsSync(file), file)
  ok(`${app}: colours as Stripe takes them`, /^#[0-9A-F]{6}$/i.test(b.background_color) && /^#[0-9A-F]{6}$/i.test(b.button_color))
  ok(`${app}: a font from Stripe's list`, FONTS.includes(b.font_family), b.font_family)
  ok(`${app}: a border style from Stripe's list`, BORDERS.includes(b.border_style), b.border_style)
  const white = ratio('#FFFFFF', b.button_color)
  ok(`${app}: white words on the button pass 4.5:1 (${white.toFixed(2)})`, white >= 4.5)
}
ok('Rich & Friends uses the deep pink for its button, not the logo pink (3.80:1)', CHECKOUT_BRANDING.rf.button_color === '#D6006B' && ratio('#FFFFFF', '#FF007A') < 4.5)
ok('Hakkilo uses its H', /hakkilo-icon/.test(CHECKOUT_BRANDING.hakkilo.icon.url))
/* "You just add the logo, what about our colors?" (Kee): white and a blush at
   98% white read as Stripe's own page. Each ground is the app's colour now,
   and still pale enough for the dark words Stripe sets on it. */
ok('Hakkilo\'s ground is its soft lilac', CHECKOUT_BRANDING.hakkilo.background_color === '#E6DFFF')
ok('Rich & Friends\' ground is its rose pastel', CHECKOUT_BRANDING.rf.background_color === '#FFCDE2')
for (const [app, b] of Object.entries(CHECKOUT_BRANDING)) {
  const ink = ratio('#111111', b.background_color)
  ok(`${app}: dark words on the ground pass 4.5:1 (${ink.toFixed(2)})`, ink >= 4.5)
  ok(`${app}: and the ground is not white`, ratio('#FFFFFF', b.background_color) > 1.15)
}

const bb = read('api/_bb/billing.js')
ok('the Hakkilo Plus session carries Hakkilo branding, for where it opens', /branding_settings: brandingFor\('hakkilo', embedded\)/.test(bb))
ok('and is made by createCheckoutSession, at that version', /await createCheckoutSession\(stripe, \{/.test(bb) && !/checkout\.sessions\.create\(/.test(bb))
ok('every other Stripe call keeps the pinned version', /new Stripe\(env\('stripeSecret'\), \{ apiVersion: '2024-06-20' \}\)/.test(bb))
const rf = read('api/checkout.js')
ok('the book session carries Rich & Friends branding, for where it opens', /branding_settings: brandingFor\('rf', embedded\)/.test(rf))
ok('and is made by createCheckoutSession', /await createCheckoutSession\(stripe, sessionConfig\)/.test(rf) && !/checkout\.sessions\.create\(/.test(rf))

/* "You cannot set `icon` when `ui_mode` is `embedded`": Stripe's answer to every
   Hakkilo Plus checkout once the keys went live (18 October). */
const { brandingFor, brandingRefused, createCheckoutSession } = await import('../../api/_brand.js')
for (const app of Object.keys(CHECKOUT_BRANDING)) {
  ok(`${app}: the form inside our page carries no icon`, !('icon' in brandingFor(app, true)) && !('logo' in brandingFor(app, true)))
  ok(`${app}: and keeps the colours, the font and the corners`, ['background_color', 'button_color', 'font_family', 'border_style'].every((k) => brandingFor(app, true)[k] === CHECKOUT_BRANDING[app][k]))
  ok(`${app}: Stripe's own page keeps its icon`, brandingFor(app, false).icon?.type === 'url')
}

const refusal = (message, param) => Object.assign(new Error(message), { type: 'StripeInvalidRequestError', param })
ok('the live refusal reads as a branding refusal', brandingRefused(refusal('You cannot set `icon` when `ui_mode` is `embedded`.')))
ok('so does one that names its param', brandingRefused(refusal('Invalid value', 'branding_settings[font_family]')))
ok('a refused promo code is not one', !brandingRefused(refusal('This promotion code cannot be redeemed', 'discounts')))
ok('nor a card or a network error', !brandingRefused(Object.assign(new Error('`icon`'), { type: 'StripeConnectionError' })))

const fakeStripe = (refuse) => {
  const calls = []
  return {
    calls,
    checkout: {
      sessions: {
        async create(config, opts) {
          calls.push({ config, opts })
          if (refuse && config.branding_settings) throw refuse
          return { id: 'cs_fake', client_secret: 'secret_fake' }
        },
      },
    },
  }
}
{
  const s = fakeStripe(null)
  const out = await createCheckoutSession(s, { mode: 'subscription', branding_settings: brandingFor('hakkilo', true) })
  ok('accepted: one call, at the branding version', out.id === 'cs_fake' && s.calls.length === 1 && s.calls[0].opts.apiVersion === BRANDING_API_VERSION)
}
{
  const s = fakeStripe(refusal('You cannot set `display_name` when `ui_mode` is `embedded`.'))
  const err = console.error
  console.error = () => {}
  const out = await createCheckoutSession(s, { mode: 'subscription', allow_promotion_codes: true, branding_settings: brandingFor('hakkilo', true) })
  console.error = err
  ok('a branding field refused: the same session again, without branding', out.id === 'cs_fake' && s.calls.length === 2 && !('branding_settings' in s.calls[1].config))
  ok('and nothing else of it lost', s.calls[1].config.allow_promotion_codes === true && s.calls[1].config.mode === 'subscription' && s.calls[1].opts.apiVersion === BRANDING_API_VERSION)
}
{
  const s = fakeStripe(refusal('No such price', 'line_items[0]'))
  let threw = false
  try {
    await createCheckoutSession(s, { mode: 'payment', branding_settings: brandingFor('rf', false) })
  } catch {
    threw = true
  }
  ok('any other refusal is still a failure, tried once', threw && s.calls.length === 1)
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
