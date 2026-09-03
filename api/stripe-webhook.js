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

/**
 * The bytes Stripe signed, whatever the runtime already did to them.
 *
 * THIS IS THE BUG THAT MADE A COMPLETED PURCHASE DO NOTHING.
 *
 * `export const config = { api: { bodyParser: false } }` above is a NEXT.JS
 * setting. This project is Vite, so `/api/*.js` runs on Vercel's plain Node
 * runtime, which reads that config for runtime, memory and maxDuration and
 * ignores `api.bodyParser` entirely. The proof is next door: api/checkout.js
 * reads `req.body` and works, so the runtime is parsing bodies.
 *
 * A parsed body is a consumed stream. So the old reader attached a `data`
 * listener to a stream that had already ended, got zero chunks, and handed
 * constructEvent an empty Buffer. Every delivery failed signature
 * verification, every one returned 400, Stripe retried and got 400 again, and
 * no entitlement was ever written. The buyer was charged, came back to the
 * library, and the book was not there.
 *
 * FOUR SOURCES, IN ORDER OF HOW MUCH THEY CAN BE TRUSTED.
 *
 * WHY THE LAST ONE IS SAFE, WHICH IS THE ONLY PART THAT NEEDS AN ARGUMENT.
 *
 * Re-serialising a parsed object cannot reproduce arbitrary bytes: key order
 * survives JSON.parse then JSON.stringify, but whitespace and unicode escaping
 * are not guaranteed to. That is a reason for it to be last, not a reason for
 * it to be absent, because the signature is an HMAC over exact bytes and it is
 * still the thing deciding. If the reconstruction differs by one byte the
 * check FAILS and the delivery is rejected. A forged payload cannot be made to
 * pass by this path; the only thing that can happen is a genuine one being
 * rejected. So it is a false-negative risk, never a false-positive one.
 *
 * Each source is logged, because "which of these fired" is the first question
 * anybody debugging this will have and the Vercel log is the only place to
 * answer it.
 */
export async function rawBody(req) {
  /* 1. The stream, if the runtime left it alone. `readable` is false once it
        has been consumed, so this is asked rather than assumed: attaching to a
        dead stream is what silently returned an empty buffer before. */
  if (req.readable) {
    const chunks = []
    for await (const c of req) chunks.push(Buffer.from(c))
    const body = Buffer.concat(chunks)
    if (body.length) return { body, from: 'stream' }
  }

  /* 2. Some runtimes keep the original bytes alongside the parsed value. */
  if (Buffer.isBuffer(req.rawBody)) return { body: req.rawBody, from: 'rawBody' }
  if (typeof req.rawBody === 'string') return { body: Buffer.from(req.rawBody, 'utf8'), from: 'rawBody' }

  /* 3. A body the runtime did not know how to parse arrives untouched. */
  if (Buffer.isBuffer(req.body)) return { body: req.body, from: 'body-buffer' }
  if (typeof req.body === 'string') return { body: Buffer.from(req.body, 'utf8'), from: 'body-string' }

  /* 4. Last resort, per the note above. */
  if (req.body && typeof req.body === 'object') {
    return { body: Buffer.from(JSON.stringify(req.body), 'utf8'), from: 'reserialised' }
  }

  return { body: Buffer.alloc(0), from: 'nothing' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  /* Named separately from a bad signature. A missing secret is a deployment
     that was never finished and a bad signature is a request that did not come
     from Stripe; they are fixed in different places and the log said neither. */
  if (!env('stripeWebhook')) {
    console.error('STRIPE_WEBHOOK_SECRET is not set, so no delivery can ever verify')
    return res.status(500).json({ error: 'Webhook secret is not configured' })
  }

  let event
  const { body, from } = await rawBody(req)
  try {
    event = stripe.webhooks.constructEvent(
      body,
      req.headers['stripe-signature'],
      env('stripeWebhook'),
    )
  } catch (err) {
    /* A bad signature means this did not come from Stripe. Never act on it.
       `from` is logged because it is the difference between "somebody is
       poking the endpoint" and "the runtime ate the body again", and those
       look identical without it. */
    console.error(`signature verification failed (body from: ${from}, ${body.length} bytes)`, err.message)
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` })
  }
  if (from !== 'stream') {
    /* Not an error. Worth a line, because it means the runtime is parsing
       bodies and the fallback is load-bearing rather than dead code. */
    console.log(`webhook verified from ${from} rather than the raw stream`)
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
