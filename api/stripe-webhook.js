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

      const userId = session.metadata?.user_id
      const bookId = session.metadata?.book_id
      if (!userId || !bookId) {
        console.error('session without metadata', session.id)
        return res.status(200).json({ received: true, skipped: 'no metadata' })
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
