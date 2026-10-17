import Stripe from 'stripe'
import { env } from '../_env.js'
import { BRANDING_API_VERSION, CHECKOUT_BRANDING } from '../_brand.js'
import { start, subscriptionOf } from './common.js'
import { PAID, PRICES, tierOf } from '../../src/lib/bb/plans.js'

/**
 * Hakkilo Plus (Beauty & Brain Plus, then Nerd Plus, before), through Stripe
 * Billing (section 13).
 *
 *   POST /api/bb/checkout { plan, locale }  a Checkout session, subscription mode
 *   POST /api/bb/sync     { session_id? }   read the truth back from Stripe
 *   POST /api/bb/cancel                     stop at the end of the paid period
 *   POST /api/bb/resume                     undo that, before the period ends
 *   POST /api/bb/portal                     Stripe's own page for the card
 *
 * THE PRICE IS NEVER READ FROM THE REQUEST. The body names a plan; the amount,
 * the currency and the interval come from PRICES in src/lib/bb/plans.js, the
 * same table the pricing page prints. A client that could name its own price
 * could subscribe for a cent.
 *
 * ONE PRODUCT, THREE PRICES, AND NO DASHBOARD STEP. The product has a fixed id
 * (`bb_plus`) and is created on the first checkout if it does not exist; the
 * three prices are inline `price_data` with their recurrence, so nothing has
 * to be clicked in Stripe before the button works.
 *
 * TWO WAYS THE ROW GETS WRITTEN, ON PURPOSE. The webhook writes
 * bb_subscriptions when Stripe sends the events, and /sync asks Stripe
 * directly when the student comes back from Checkout. The endpoint may only be
 * subscribed to checkout.session.completed (it was set up for books), and a
 * student who has just paid must not see "Free" because an event was not
 * ticked in a dashboard. Both write the same row from the same Stripe object,
 * through subscriptionRow() below, so they cannot disagree.
 *
 * Only the server writes the row: students can read it (migration 80) and
 * never write it.
 */
export const PRODUCT_ID = 'bb_plus'

export function stripeClient() {
  return new Stripe(env('stripeSecret'), { apiVersion: '2024-06-20' })
}

/** Where to send the student back: this site, or the production address. */
export function originOf(req) {
  const o = String(req.headers?.origin ?? '')
  if (/^https:\/\/([a-z0-9-]+\.)*richandfriends\.xyz$/.test(o) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o
  return 'https://richandfriends.xyz'
}

const PLAN_OF = Object.fromEntries(Object.entries(PRICES).map(([plan, p]) => [`${p.interval}:${p.count}:${p.cents}`, plan]))

/** The plan a Stripe subscription is on, from its metadata or its price. */
export function planOf(subscription) {
  const named = subscription?.metadata?.plan
  if (PAID.includes(named)) return named
  const price = subscription?.items?.data?.[0]?.price
  const key = price?.recurring ? `${price.recurring.interval}:${price.recurring.interval_count}:${price.unit_amount}` : ''
  return PLAN_OF[key] ?? 'plus_month'
}

/** The bb_subscriptions row for a Stripe subscription object. */
export function subscriptionRow(userId, subscription) {
  const end = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end ?? null
  return {
    user_id: userId,
    plan: planOf(subscription),
    status: subscription.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    stripe_customer: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
    stripe_subscription: subscription.id,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Write the row, unless it is the owner's: Kee's "owner" row is never
 * overwritten by a subscription she might take to test the flow.
 */
export async function writeSubscription(db, userId, subscription) {
  const current = await subscriptionOf(db, userId)
  if (current?.plan === 'owner') return current
  const row = subscriptionRow(userId, subscription)
  const { error } = await db.from('bb_subscriptions').upsert(row, { onConflict: 'user_id' })
  if (error) throw Object.assign(new Error(`bb_subscriptions: ${error.message}`), { status: 500 })
  return row
}

export async function refreshFromStripe(db, userId, subscriptionId, stripe = stripeClient()) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (subscription?.metadata?.user_id && subscription.metadata.user_id !== userId) return null
  return writeSubscription(db, userId, subscription)
}

/* The name on the checkout page and on receipts. The product was made as
   "Beauty & Brain Plus" before the app was renamed: the first checkout
   after a rename renames it, and a failure there never blocks a payment. */
const PRODUCT_NAME = 'Hakkilo Plus'

async function product(stripe) {
  try {
    const found = await stripe.products.retrieve(PRODUCT_ID)
    if (found.name !== PRODUCT_NAME) {
      try {
        await stripe.products.update(PRODUCT_ID, { name: PRODUCT_NAME })
      } catch {
        /* the old name on a receipt is not worth a failed checkout */
      }
    }
    return found.id
  } catch (err) {
    if (err?.code !== 'resource_missing') throw err
    const made = await stripe.products.create({ id: PRODUCT_ID, name: PRODUCT_NAME, metadata: { product: 'bb' } })
    return made.id
  }
}

const summary = (row) => ({
  tier: tierOf(row),
  plan: row?.plan ?? 'free',
  status: row?.status ?? null,
  current_period_end: row?.current_period_end ?? null,
  cancel_at_period_end: Boolean(row?.cancel_at_period_end),
})

async function billingStart(req, res) {
  const ctx = await start(req, res, { needsModel: false })
  if (!ctx) return null
  if (!env('stripeSecret')) {
    res.status(503).json({ error: 'no_billing' })
    return null
  }
  return ctx
}

function stripeFail(res, err, where) {
  /* Stripe's message names the parameter, never the key; it is still cut
     short and logged rather than trusted wholesale. */
  console.error(`bb ${where}: ${err?.type ?? 'Error'} ${err?.code ?? ''} ${String(err?.message ?? '').slice(0, 300)}`)
  return res.status(502).json({ error: 'stripe', code: err?.code ?? null })
}

export async function checkout(req, res) {
  const ctx = await billingStart(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const plan = String(body.plan ?? '')
  const price = PRICES[plan]
  if (!price) return res.status(400).json({ error: 'plan' })

  const sub = await subscriptionOf(db, user.id)
  const tier = tierOf(sub)
  if (tier === 'owner') return res.status(409).json({ error: 'owner' })
  if (tier === 'plus' && sub?.stripe_subscription && !sub.cancel_at_period_end) return res.status(409).json({ error: 'already' })

  const origin = originOf(req)
  try {
    const stripe = stripeClient()
    const productId = await product(stripe)
    const meta = { product: 'bb', user_id: user.id, plan }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: price.currency,
            unit_amount: price.cents,
            recurring: { interval: price.interval, interval_count: price.count },
            product: productId,
          },
        },
      ],
      ...(sub?.stripe_customer ? { customer: sub.stripe_customer } : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      metadata: meta,
      subscription_data: { metadata: meta },
      allow_promotion_codes: true,
      locale: body.locale === 'en' ? 'en' : 'fr-CA',
      success_url: `${origin}/hakkilo/profil?plus=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/hakkilo/tarifs?plus=annule`,
      /* Hakkilo's own page, not the account's: see api/_brand.js. */
      branding_settings: CHECKOUT_BRANDING.hakkilo,
    }, { apiVersion: BRANDING_API_VERSION })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    return stripeFail(res, err, 'checkout')
  }
}

export async function sync(req, res) {
  const ctx = await billingStart(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  try {
    const stripe = stripeClient()
    const sessionId = String(body.session_id ?? '')
    if (sessionId.startsWith('cs_')) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
      /* A session id is not a secret: check it is this student's own. */
      if (session.client_reference_id !== user.id && session.metadata?.user_id !== user.id) return res.status(403).json({ error: 'forbidden' })
      if (session.status !== 'complete' || !session.subscription) return res.status(200).json({ ...summary(await subscriptionOf(db, user.id)), pending: true })
      const subscription = typeof session.subscription === 'string' ? await stripe.subscriptions.retrieve(session.subscription) : session.subscription
      return res.status(200).json(summary(await writeSubscription(db, user.id, subscription)))
    }
    const sub = await subscriptionOf(db, user.id)
    if (sub?.stripe_subscription) return res.status(200).json(summary((await refreshFromStripe(db, user.id, sub.stripe_subscription, stripe)) ?? sub))
    return res.status(200).json(summary(sub))
  } catch (err) {
    return stripeFail(res, err, 'sync')
  }
}

async function setCancel(req, res, cancel) {
  const ctx = await billingStart(req, res)
  if (!ctx) return
  const { db, user } = ctx
  const sub = await subscriptionOf(db, user.id)
  if (!sub?.stripe_subscription) return res.status(409).json({ error: 'no_subscription' })
  try {
    const subscription = await stripeClient().subscriptions.update(sub.stripe_subscription, { cancel_at_period_end: cancel })
    return res.status(200).json(summary(await writeSubscription(db, user.id, subscription)))
  } catch (err) {
    return stripeFail(res, err, cancel ? 'cancel' : 'resume')
  }
}

export const cancel = (req, res) => setCancel(req, res, true)
export const resume = (req, res) => setCancel(req, res, false)

export async function portal(req, res) {
  const ctx = await billingStart(req, res)
  if (!ctx) return
  const { db, user } = ctx
  const sub = await subscriptionOf(db, user.id)
  if (!sub?.stripe_customer) return res.status(409).json({ error: 'no_subscription' })
  try {
    const session = await stripeClient().billingPortal.sessions.create({ customer: sub.stripe_customer, return_url: `${originOf(req)}/hakkilo/profil` })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    /* The portal needs one save in the Stripe dashboard before it exists.
       Until then cancel and resume above do the job without it. */
    console.error(`bb portal: ${err?.code ?? ''} ${String(err?.message ?? '').slice(0, 200)}`)
    return res.status(409).json({ error: 'portal_unavailable' })
  }
}
