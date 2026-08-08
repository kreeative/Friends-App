import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { env, missingEnv } from './_env.js'

/**
 * Creates a Stripe Checkout session for one book.
 *
 * This endpoint deliberately does NOT grant anything. It reads the price from
 * the database rather than from the request, a client that could name its own
 * price would be able to buy a book for a cent, and it records who is buying
 * what in the session metadata so the webhook can act on it later.
 *
 * Entitlement is written by the webhook and only by the webhook.
 */
const REQUIRED = ['stripeSecret', 'supabaseUrl', 'serviceRole']

/**
 * Both clients are built per request rather than at module scope. With the
 * variables unset, `createClient('', '')` throws while the module is still
 * loading, so the function dies before `handler` ever runs: Vercel answers
 * with its own HTML error page and the browser just sees a button that does
 * nothing. Building them after the check below lets an unconfigured
 * deployment say so instead.
 */
function clients() {
  return {
    stripe: new Stripe(env('stripeSecret'), { apiVersion: '2024-06-20' }),
    // Service role: needed to read the caller's identity from their JWT. It
    // never reaches the browser, since Vercel only exposes VITE_ variables
    // there. Read through env() because this project stores it under the name
    // `service_role`, Vercel having refused the canonical one.
    admin: createClient(env('supabaseUrl'), env('serviceRole'), {
      auth: { persistSession: false },
    }),
  }
}

/**
 * What Stripe should actually charge for.
 *
 * `books.stripe_ref` holds whichever identifier the catalogue was set up with,
 * and the two are not interchangeable:
 *
 *   price_…   a Price. This is what line_items wants, so it is used as-is.
 *   prod_…    a Product. A Product has no amount on it; the amount lives on
 *             its Price. Passing one straight to Checkout fails, so it is
 *             resolved to the product's default_price first.
 *
 * With no ref at all it falls back to inline price_data from the database
 * columns, which is how this worked before there were Stripe objects. That
 * fallback matters: it keeps the catalogue sellable while products are still
 * being wired up, rather than making a half-configured book a dead button.
 *
 * Reading the price from Stripe rather than the request is the same rule as
 * before. A client that could name its own price could buy a book for a cent.
 */
async function lineItem(stripe, book) {
  const ref = (book.stripe_ref ?? '').trim()

  if (ref.startsWith('price_')) return { price: ref, quantity: 1 }

  if (ref.startsWith('prod_')) {
    const product = await stripe.products.retrieve(ref)
    const price =
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id

    if (!price) {
      throw new Error(
        `Stripe product ${ref} has no default price. Set one on the product in the Stripe dashboard, or store its price_… id instead.`,
      )
    }
    return { price, quantity: 1 }
  }

  return {
    quantity: 1,
    price_data: {
      currency: book.currency?.toLowerCase() || 'cad',
      unit_amount: book.price_cents,
      product_data: { name: book.title },
    },
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  /* Named, not generic. Without the service-role key the identity lookup below
     fails and the plausible-looking answer is "Not signed in", which sends
     someone off to debug their account instead of their Vercel settings. */
  const missing = missingEnv(REQUIRED)
  if (missing.length > 0) {
    return res.status(503).json({
      error: `Checkout is not set up yet. Missing from the Vercel environment: ${missing.join(', ')}.`,
      missing,
    })
  }

  try {
    const { stripe, admin } = clients()

    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Not signed in' })

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Not signed in' })
    const user = userData.user

    const bookId = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)?.book_id
    if (!bookId) return res.status(400).json({ error: 'book_id is required' })

    const { data: book, error: bookErr } = await admin
      .from('books')
      .select('id, slug, title, price_cents, currency, published, stripe_ref')
      .eq('id', bookId)
      .maybeSingle()

    if (bookErr || !book || !book.published) {
      return res.status(404).json({ error: 'No such book' })
    }

    // Already owned. Sending them to Stripe would charge twice for nothing.
    const { data: owned } = await admin
      .from('entitlements')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', book.id)
      .maybeSingle()

    if (owned) return res.status(409).json({ error: 'Already owned', owned: true })

    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : 'https://richandfriends.xyz')

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [await lineItem(stripe, book)],
      // The webhook trusts these two fields and nothing from the browser.
      metadata: { user_id: user.id, book_id: book.id },
      success_url: `${origin}/library?purchase=success&book=${book.slug}`,
      cancel_url: `${origin}/library?purchase=cancelled`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('checkout failed', err)
    return res.status(500).json({ error: 'Could not start checkout' })
  }
}
