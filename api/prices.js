import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { env, missingEnv } from './_env.js'

/**
 * What each book actually costs, according to Stripe.
 *
 * The price used to be a number in the database that somebody had to keep in
 * step with a number in the Stripe dashboard, and the two drifted, which is
 * the only thing that was ever going to happen. The storefront said twelve
 * dollars and the checkout took whatever the Price object said.
 *
 * There is only one right answer to "what will this cost", and it is held by
 * the system that is going to take the money. So the shop asks that system.
 * books.price_cents stays as a fallback for a book with no Stripe object yet,
 * and it is now clearly the second-best source rather than a rival truth.
 *
 * This endpoint is public and reads nothing user-specific: it is the price
 * list, which is on the shelf edge in any shop.
 */
const REQUIRED = ['stripeSecret', 'supabaseUrl', 'serviceRole']

/**
 * Cached in module scope for a few minutes.
 *
 * A serverless instance is reused between requests, so this spares Stripe a
 * call per page load without needing anything to invalidate it. Five minutes
 * is short enough that a price change shows up while you are still looking at
 * the dashboard wondering whether it worked.
 */
const TTL_MS = 5 * 60 * 1000
let cache = { at: 0, data: null }

/**
 * An error message that is safe to put on a public endpoint.
 *
 * Stripe puts a partially redacted key into the message for an authentication
 * failure, along the lines of "Invalid API Key provided: sk_live_****abcd".
 * Stripe's own redaction is not this project's decision to rely on, and the
 * rule here has always been that no error message carries a credential, so
 * anything key-shaped is removed before it can be returned. `whsec_` and the
 * publishable prefixes are in the pattern too: they should never appear in a
 * message from this file, and a filter that only catches what you expect is
 * not a filter.
 *
 * Truncated as well, because a Stripe error can run to several hundred
 * characters and this is a diagnostic line, not a log.
 */
function safeMessage(err) {
  const raw = String(err?.message ?? 'lookup failed')
  return raw.replace(/\b(sk|rk|pk|whsec)_[A-Za-z0-9_*]+/g, '[redacted]').slice(0, 200)
}

async function amountFor(stripe, ref) {
  const id = (ref ?? '').trim()
  if (!id) return null

  if (id.startsWith('price_')) {
    const price = await stripe.prices.retrieve(id)
    return { cents: price.unit_amount, currency: price.currency?.toUpperCase() }
  }

  if (id.startsWith('prod_')) {
    // A Product carries no amount. Expand its default price rather than
    // making a second round trip for it.
    const product = await stripe.products.retrieve(id, { expand: ['default_price'] })
    const price = product.default_price
    if (!price || typeof price === 'string') return null
    return { cents: price.unit_amount, currency: price.currency?.toUpperCase() }
  }

  return null
}

/**
 * WHY THIS ANSWERS WITH A REASON AND NOT JUST AN EMPTY MAP.
 *
 * Every branch below used to return `{"prices":{}}`, and that one response
 * meant five different things: the environment is not configured, Stripe
 * refused the key, the catalogue read failed, no book has a stripe_ref yet, or
 * every ref points at something that no longer exists. Those have five
 * different fixes and the shop looks identical in all of them, because the
 * fallback to the database columns is deliberately silent.
 *
 * That silence is right for a customer and useless for whoever is setting this
 * up, who is reduced to guessing which of five things went wrong. So the
 * status is still 200 and the shop still falls back, and the response now says
 * what happened.
 *
 * `missing` names environment variables, which is the same thing
 * /api/checkout already reports and is not a leak: a name is not a value. No
 * branch here returns a key, a token, or a Stripe error body.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Not configured is not an error here. The shop falls back to the database
  // columns and keeps working; saying 200 with an empty map is what lets it.
  const missing = missingEnv(REQUIRED)
  if (missing.length > 0) {
    return res.status(200).json({
      prices: {},
      configured: false,
      missing,
      note: 'Stripe is not configured on this deployment, so prices come from books.price_cents. Set these in Vercel and redeploy.',
    })
  }

  if (cache.data && Date.now() - cache.at < TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    return res.status(200).json({ prices: cache.data, configured: true, cached: true })
  }

  try {
    const stripe = new Stripe(env('stripeSecret'), { apiVersion: '2024-06-20' })
    const admin = createClient(env('supabaseUrl'), env('serviceRole'), {
      auth: { persistSession: false },
    })

    const { data: books, error: bookErr } = await admin
      .from('books')
      .select('id, slug, stripe_ref')
      .eq('published', true)

    /* The catalogue read failing is a different problem from Stripe failing,
       and it used to be indistinguishable. Not cached: a transient database
       error should not pin an empty price list for five minutes. */
    if (bookErr) {
      console.error('price list: catalogue read failed', bookErr)
      return res.status(200).json({
        prices: {},
        configured: true,
        note: `Could not read the catalogue: ${bookErr.message ?? bookErr.code ?? 'unknown error'}. Prices fall back to books.price_cents.`,
      })
    }

    /* Which books could not be priced, and why, one line each. This is the
       part that turns "empty" into "these three refs are gone", which is the
       answer somebody staring at an empty map actually needs. */
    const unpriced = []

    /* Keyed by id and by slug. The signed-in library holds rows and knows the
       id; the public preview renders from the bundled catalogue, which has a
       slug and no id at all, and both have to quote the same number. */
    const prices = {}
    await Promise.all(
      (books ?? []).map(async (b) => {
        const ref = (b.stripe_ref ?? '').trim()
        if (!ref) {
          unpriced.push({ slug: b.slug, reason: 'no stripe_ref set' })
          return
        }
        try {
          const amount = await amountFor(stripe, ref)
          if (amount && amount.cents != null) {
            prices[b.id] = amount
            if (b.slug) prices[b.slug] = amount
          } else {
            unpriced.push({ slug: b.slug, reason: `${ref} resolved to no amount` })
          }
        } catch (err) {
          // One misconfigured book must not take the whole price list down.
          // Its card falls back to the database column like any other. Only
          // Stripe's error type and message are echoed, never a request id or
          // anything carrying the key.
          unpriced.push({ slug: b.slug, reason: `${ref}: ${safeMessage(err)}` })
        }
      }),
    )

    /* Only a good answer is cached. Caching a failure would keep reporting it
       for five minutes after the fix, which is the wrong way round: the whole
       point of the five-minute TTL is that a price change shows up while you
       are still looking at the dashboard wondering whether it worked. */
    const complete = unpriced.length === 0
    if (complete) {
      cache = { at: Date.now(), data: prices }
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    } else {
      res.setHeader('Cache-Control', 'no-store')
    }

    return res.status(200).json({
      prices,
      configured: true,
      ...(complete ? {} : { unpriced }),
    })
  } catch (err) {
    console.error('price list failed', err)
    return res.status(200).json({
      prices: {},
      configured: true,
      note: `Stripe rejected the request: ${safeMessage(err)}. Prices fall back to books.price_cents.`,
    })
  }
}
