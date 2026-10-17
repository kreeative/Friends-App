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

const bb = read('api/_bb/billing.js')
ok('the Hakkilo Plus session carries Hakkilo branding', /branding_settings: CHECKOUT_BRANDING\.hakkilo/.test(bb))
ok('and is created at that version', /\}, \{ apiVersion: BRANDING_API_VERSION \}\)/.test(bb))
ok('every other Stripe call keeps the pinned version', /new Stripe\(env\('stripeSecret'\), \{ apiVersion: '2024-06-20' \}\)/.test(bb))
const rf = read('api/checkout.js')
ok('the book session carries Rich & Friends branding', /branding_settings: CHECKOUT_BRANDING\.rf/.test(rf))
ok('and is created at that version', /checkout\.sessions\.create\(sessionConfig, \{ apiVersion: BRANDING_API_VERSION \}\)/.test(rf))

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
