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
 * Validates a coupon code with Stripe.
 *
 * Returns the coupon object if valid, or null if invalid/not found.
 * Never returns the coupon code itself in error messages for security.
 */
async function validateCoupon(stripe, couponCode) {
  if (!couponCode || typeof couponCode !== 'string') return null

  const code = couponCode.trim().toUpperCase()
  if (code.length === 0) return null

  try {
    // Query for coupons matching the code
    const coupons = await stripe.coupons.list({ limit: 100 })
    const coupon = coupons.data.find((c) => c.id.toUpperCase() === code && c.valid === true)

    if (!coupon) return null

    return coupon
  } catch (err) {
    console.error('coupon validation failed', err.message)
    return null
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

    /**
     * Signing in is no longer a precondition for buying.
     *
     * It used to be, and that is a strange thing to ask of somebody who has
     * just finished the free chapter and wants the rest: the shop demanded an
     * account before it would take their money. Stripe collects an email
     * address during payment regardless, so the account can be matched or made
     * afterwards out of something the buyer had to give anyway.
     *
     * A signed-in buyer is still the better path, because the entitlement can
     * be written straight against their id. A guest gets the same book by a
     * slower route: the webhook matches the email, and if no account exists
     * yet it parks the purchase until one does. See 14_guest_purchase.sql.
     */
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    let user = null
    if (token) {
      const { data: userData } = await admin.auth.getUser(token)
      user = userData?.user ?? null
    }

    /* Either identifier. The signed-in library holds catalogue rows and knows
       the id; the public preview renders from the bundle, which has a slug and
       no id, and it has to be able to sell from there too. */
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const bookId = body?.book_id
    const slug = body?.slug
    const couponCode = body?.coupon_code
    if (!bookId && !slug) return res.status(400).json({ error: 'book_id or slug is required' })

    /**
     * A bundled book has no row to sell.
     *
     * localBooks() hands out ids of the form `local:<slug>` so the free
     * chapter can render with no database at all. Those are not catalogue
     * rows, and every surface is supposed to hide Buy when it sees one. If
     * one arrives here anyway, say so plainly rather than letting it fall
     * through to a lookup that will miss and report "no such book", which
     * sends somebody hunting for a missing row that was never meant to exist.
     */
    if (typeof bookId === 'string' && bookId.startsWith('local:')) {
      return res.status(409).json({
        error:
          'That is the bundled copy of the book, which has no catalogue row to record a purchase against. The library is being served from the local fallback, which means the catalogue read failed.',
      })
    }

    const query = admin
      .from('books')
      .select('id, slug, title, price_cents, currency, published, stripe_ref')
    const { data: book, error: bookErr } = await (
      bookId ? query.eq('id', bookId) : query.eq('slug', slug)
    ).maybeSingle()

    /**
     * Three different failures, three different messages.
     *
     * These were one branch answering "No such book" to all of them, which is
     * the least useful sentence available: it is the same words whether the
     * query itself failed, the row is missing, or the row is there and simply
     * unpublished. Those have completely different fixes, and the person
     * reading the message is the one who has to pick.
     */
    if (bookErr) {
      console.error('book lookup failed', bookErr)
      return res.status(500).json({
        error: `Could not read the catalogue: ${bookErr.message ?? bookErr.code ?? 'unknown error'}.`,
      })
    }

    if (!book) {
      return res.status(404).json({
        error: `No book in the catalogue with ${bookId ? `id ${bookId}` : `slug "${slug}"`.`,
      })
    }

    if (!book.published) {
      return res.status(409).json({
        error: `"${book.title}" exists but is not published, so it is not for sale.`,
      })
    }

    // Already owned. Sending them to Stripe would charge twice for nothing.
    // Only checkable for someone we can identify; a guest has not told us who
    // they are yet, and the webhook's upsert is what stops a double grant.
    if (user) {
      const { data: owned } = await admin
        .from('entitlements')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_id', book.id)
        .maybeSingle()

      if (owned) return res.status(409).json({ error: 'Already owned', owned: true })
    }

    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : 'https://richandfriends.xyz')

    // Validate coupon if provided
    let appliedDiscount = null
    if (couponCode) {
      const coupon = await validateCoupon(stripe, couponCode)
      if (coupon) {
        appliedDiscount = coupon.id
      } else {
        // Invalid coupon provided
        return res.status(400).json({
          error: `Coupon code "${couponCode}" is not valid or has expired.`,
          couponInvalid: true,
        })
      }
    }

    const sessionConfig = {
      mode: 'payment',
      // Prefilled when we know it, collected by Stripe when we do not. Either
      // way the webhook ends up with an address it can match an account to.
      customer_email: user?.email ?? undefined,
      ...(user ? {} : { customer_creation: 'always' }),
      line_items: [await lineItem(stripe, book)],
      // The webhook trusts these fields and nothing from the browser. user_id
      // is absent for a guest, which is the signal to match on email instead.
      metadata: {
        ...(user ? { user_id: user.id } : {}),
        book_id: book.id,
        ...(appliedDiscount ? { coupon_code: couponCode } : {}),
      },
      success_url: `${origin}/library?purchase=success&book=${book.slug}`,
      cancel_url: `${origin}/library?purchase=cancelled`,
    }

    // Apply discount if coupon is valid
    if (appliedDiscount) {
      sessionConfig.discounts = [{ coupon: appliedDiscount }]
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('checkout failed', err)
    return res.status(500).json({ error: 'Could not start checkout' })
  }
}
