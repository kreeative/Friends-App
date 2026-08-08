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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Not configured is not an error here. The shop falls back to the database
  // columns and keeps working; saying 200 with an empty map is what lets it.
  if (missingEnv(REQUIRED).length > 0) return res.status(200).json({ prices: {} })

  if (cache.data && Date.now() - cache.at < TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    return res.status(200).json({ prices: cache.data, cached: true })
  }

  try {
    const stripe = new Stripe(env('stripeSecret'), { apiVersion: '2024-06-20' })
    const admin = createClient(env('supabaseUrl'), env('serviceRole'), {
      auth: { persistSession: false },
    })

    const { data: books } = await admin
      .from('books')
      .select('id, slug, stripe_ref')
      .eq('published', true)

    /* Keyed by id and by slug. The signed-in library holds rows and knows the
       id; the public preview renders from the bundled catalogue, which has a
       slug and no id at all, and both have to quote the same number. */
    const prices = {}
    await Promise.all(
      (books ?? []).map(async (b) => {
        try {
          const amount = await amountFor(stripe, b.stripe_ref)
          if (amount && amount.cents != null) {
            prices[b.id] = amount
            if (b.slug) prices[b.slug] = amount
          }
        } catch {
          // One misconfigured book must not take the whole price list down.
          // Its card falls back to the database column like any other.
        }
      }),
    )

    cache = { at: Date.now(), data: prices }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
    return res.status(200).json({ prices })
  } catch (err) {
    console.error('price list failed', err)
    return res.status(200).json({ prices: {} })
  }
}
