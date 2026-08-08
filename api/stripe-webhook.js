import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { env } from './_env.js'

/**
 * The only thing in the system that grants entitlement.
 *
 * Two properties matter here and both are easy to get wrong:
 *
 *   Signature verification needs the RAW body. Any JSON parsing before
 *   constructEvent re-serialises the bytes and the signature stops matching,
 *   so body parsing is disabled and the stream is read by hand.
 *
 *   Stripe retries. The same event can arrive several times, and a network
 *   blip on our side guarantees it will. The insert is therefore an upsert
 *   against a unique (user_id, book_id), so a redelivery is a no-op rather
 *   than a duplicate row.
 */
export const config = { api: { bodyParser: false } }

const stripe = new Stripe(env('stripeSecret') ?? '', {
  apiVersion: '2024-06-20',
})

const admin = createClient(
  env('supabaseUrl') ?? '',
  env('serviceRole') ?? '',
  { auth: { persistSession: false } },
)

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  let event
  try {
    const body = await rawBody(req)
    event = stripe.webhooks.constructEvent(
      body,
      req.headers['stripe-signature'],
      env('stripeWebhook'),
    )
  } catch (err) {
    // A bad signature means this did not come from Stripe. Never act on it.
    console.error('signature verification failed', err.message)
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object

      // Only a paid session grants anything. `complete` with an unpaid status
      // happens for async payment methods that can still fail afterwards.
      if (session.payment_status !== 'paid') {
        return res.status(200).json({ received: true, skipped: 'unpaid' })
      }

      const bookId = session.metadata?.book_id
      if (!bookId) {
        console.error('session without a book', session.id)
        return res.status(200).json({ received: true, skipped: 'no book' })
      }

      /**
       * Who bought it, in order of how much the answer can be trusted.
       *
       * user_id is written by /api/checkout for somebody who was signed in,
       * and it is the only field here that came out of a verified session
       * rather than off a payment form.
       *
       * A guest has no user_id, so the email Stripe collected is all there is.
       * If an account already uses that address the book goes straight onto
       * it; if not, the purchase is parked against the address and claimed the
       * first time somebody signs in with it. Parking is the important half.
       * Without it, buying before making an account loses the book, and the
       * person who paid has no way to tell that apart from a bug.
       */
      const email = (session.customer_details?.email ?? session.customer_email ?? '')
        .trim()
        .toLowerCase()

      let userId = session.metadata?.user_id ?? null

      if (!userId && email) {
        // listUsers is paginated and has no exact-email filter, so this asks
        // the database directly rather than walking every page.
        const { data: match } = await admin
          .from('profiles')
          .select('id')
          .eq('email_lower', email)
          .maybeSingle()
        userId = match?.id ?? null
      }

      if (!userId) {
        if (!email) {
          console.error('guest session with no email', session.id)
          return res.status(200).json({ received: true, skipped: 'no email' })
        }

        const { error: parkErr } = await admin.from('pending_entitlements').upsert(
          {
            email,
            book_id: bookId,
            stripe_session_id: session.id,
            amount_cents: session.amount_total ?? null,
          },
          { onConflict: 'email,book_id', ignoreDuplicates: true },
        )

        if (parkErr) {
          console.error('could not park guest purchase', parkErr)
          return res.status(500).json({ error: 'Could not record purchase' })
        }
        return res.status(200).json({ received: true, parked: true })
      }

      const { error } = await admin.from('entitlements').upsert(
        {
          user_id: userId,
          book_id: bookId,
          stripe_session_id: session.id,
          amount_cents: session.amount_total ?? null,
        },
        { onConflict: 'user_id,book_id', ignoreDuplicates: true },
      )

      if (error) {
        // Returning non-2xx makes Stripe retry, which is what we want if the
        // database was briefly unreachable.
        console.error('entitlement write failed', error)
        return res.status(500).json({ error: 'Could not record entitlement' })
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('webhook handler failed', err)
    return res.status(500).json({ error: 'Handler failed' })
  }
}
