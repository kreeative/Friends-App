import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Stripe Checkout session for one book.
 *
 * This endpoint deliberately does NOT grant anything. It reads the price from
 * the database rather than from the request — a client that could name its own
 * price would be able to buy a book for a cent — and it records who is buying
 * what in the session metadata so the webhook can act on it later.
 *
 * Entitlement is written by the webhook and only by the webhook.
 */
const REQUIRED = ['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

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
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }),
    // Service role: needed to read the caller's identity from their JWT. It
    // never reaches the browser — Vercel only exposes VITE_ variables there.
    admin: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    }),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  /* Named, not generic. Without the service-role key the identity lookup below
     fails and the plausible-looking answer is "Not signed in" — which sends
     someone off to debug their account instead of their Vercel settings. */
  const missing = REQUIRED.filter((name) => !process.env[name])
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
      .select('id, slug, title, price_cents, currency, published')
      .eq('id', bookId)
      .maybeSingle()

    if (bookErr || !book || !book.published) {
      return res.status(404).json({ error: 'No such book' })
    }

    // Already owned — sending them to Stripe would charge twice for nothing.
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
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: book.currency?.toLowerCase() || 'eur',
            unit_amount: book.price_cents,
            product_data: { name: book.title },
          },
        },
      ],
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
