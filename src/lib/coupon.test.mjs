/**
 * node src/lib/coupon.test.mjs
 *
 * WHY THIS FILE EXISTS.
 *
 * Two changes to the same Stripe call were merged within an hour of each
 * other: the promotion box on Stripe's payment page (allow_promotion_codes)
 * and a coupon_code parameter on the request (discounts). Stripe refuses a
 * session carrying both, with "You may only specify one of these parameters",
 * so the combination turned every checkout that supplied a code into a 500.
 * Neither change was wrong on its own and nothing in the repo noticed the
 * pair, because nothing here had ever looked at how that session is built.
 *
 * The coupon lookup had two further faults that no test would have caught
 * either, both of the silent kind: it listed the first hundred coupons and
 * searched them in memory, so coupon one hundred and one was reported to the
 * customer as invalid, and it matched coupon ids rather than promotion codes,
 * so the customer-facing object Stripe provides for exactly this purpose was
 * invisible to it.
 *
 * These assertions were run against the previous implementation and it failed
 * the two lookup cases while passing the one that had genuinely worked, which
 * is the only evidence that they test anything.
 *
 * Nothing here talks to Stripe. resolveDiscount is lifted out of the handler
 * and run against a fake, because what is being checked is this file's logic
 * and not Stripe's.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CHECKOUT = join(here, '..', '..', 'api', 'checkout.js')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) =>
  ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\ncoupon')

/* --- lifting the function out of the handler ---------------------------- */

const src = readFileSync(CHECKOUT, 'utf8')
const match = src.match(/async function resolveDiscount\(stripe, raw\) \{[\s\S]*?\n\}/)
ok('resolveDiscount is still in api/checkout.js', Boolean(match))
if (!match) {
  console.log(`\n  ${pass} passed, ${fail} failed\n`)
  process.exit(1)
}
const resolveDiscount = new Function(
  'stripe',
  'raw',
  `return (${match[0].replace('async function resolveDiscount', 'async function _')})(stripe, raw)`,
)

/* --- a Stripe with more coupons than one page --------------------------- */

/* The useful coupon is deliberately past position one hundred. That is the
   whole point of the fixture: the previous implementation could not see it. */
const coupons = Array.from({ length: 150 }, (_, i) => ({ id: `AUTO${i}`, valid: true }))
coupons.push({ id: 'LATECOUPON', valid: true })

const notFound = () => {
  const e = new Error('No such coupon')
  e.code = 'resource_missing'
  throw e
}

const stripe = {
  promotionCodes: {
    list: async ({ code }) => (code === 'LAUNCH20' ? { data: [{ id: 'promo_abc123' }] } : { data: [] }),
  },
  coupons: {
    retrieve: async (id) => coupons.find((c) => c.id === id) ?? notFound(),
  },
}

const t = async (name, input, want) => eq(name, await resolveDiscount(stripe, input), want)

await t('a promotion code resolves to promotion_code', 'LAUNCH20', { promotion_code: 'promo_abc123' })
await t('typed in lower case, still found', 'launch20', { promotion_code: 'promo_abc123' })
await t('surrounding whitespace is trimmed', '  LAUNCH20  ', { promotion_code: 'promo_abc123' })
await t('a coupon id still works, as it did before', 'AUTO7', { coupon: 'AUTO7' })
await t('a coupon past the hundredth is found', 'LATECOUPON', { coupon: 'LATECOUPON' })
await t('an unknown code is null rather than an error', 'NOPE', null)
await t('an empty string', '', null)
await t('whitespace only', '   ', null)
await t('a number', 12345, null)
await t('undefined', undefined, null)
await t('null', null, null)

/* Stripe's own verdict on expiry and redemption limits is `valid`, and a
   coupon that fails it must not reach the session. */
const expired = {
  promotionCodes: { list: async () => ({ data: [] }) },
  coupons: { retrieve: async () => ({ id: 'OLD', valid: false }) },
}
eq('an expired coupon is refused', await resolveDiscount(expired, 'OLD'), null)

/* A lookup that fails for a reason other than the code not existing must not
   take checkout down with it. The customer sees the same answer either way. */
const broken = {
  promotionCodes: {
    list: async () => {
      throw new Error('network')
    },
  },
  coupons: { retrieve: async () => notFound() },
}
eq('a failing lookup returns null rather than throwing', await resolveDiscount(broken, 'ANY'), null)

/* --- the two parameters that cannot travel together --------------------- */

/**
 * Mirrors how the handler assembles the session. If the shape in checkout.js
 * changes, this stops mirroring it and the guard is worth re-deriving; the
 * source assertion below is what makes that visible rather than silent.
 */
const build = (appliedDiscount) => {
  const cfg = {
    mode: 'payment',
    ...(appliedDiscount ? {} : { allow_promotion_codes: true }),
    line_items: [{ quantity: 1 }],
  }
  if (appliedDiscount) cfg.discounts = [appliedDiscount]
  return cfg
}

const noCode = build(null)
ok('with no code, the promotion box is on', noCode.allow_promotion_codes === true)
ok('with no code, there is no discounts array', noCode.discounts === undefined)

const withCode = build({ promotion_code: 'promo_abc123' })
ok('with a code, the promotion box is absent', !('allow_promotion_codes' in withCode))
eq('with a code, the discount is passed whole', withCode.discounts, [{ promotion_code: 'promo_abc123' }])
ok(
  'the two parameters never appear together, which is what Stripe refuses',
  !('allow_promotion_codes' in withCode && 'discounts' in withCode),
)

/* And the same guarantee read off the source, so that reverting the handler to
   an unconditional `allow_promotion_codes: true` fails here rather than in
   production. */
ok(
  'checkout.js sets allow_promotion_codes conditionally',
  /\.\.\.\(appliedDiscount \? \{\} : \{ allow_promotion_codes: true \}\)/.test(src),
  'an unconditional allow_promotion_codes is a 500 on any checkout with a code',
)
ok(
  'checkout.js passes the resolved discount whole',
  /sessionConfig\.discounts = \[appliedDiscount\]/.test(src),
  'wrapping it as { coupon: appliedDiscount } nests an object where an id belongs',
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
