import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { env } from './_env.js'

/**
 * Books that were paid for while nothing was listening, handed over.
 *
 * WHY THIS HAD TO EXIST.
 *
 * The diagnostic came back with one sentence that explained everything: Stripe
 * had no webhook endpoints at all. Every payment succeeded, every buyer got a
 * receipt, and nothing was ever told to grant anything. Three completed
 * purchases sat in Stripe carrying a book_id and a user_id, against zero rows
 * in entitlements.
 *
 * Registering the endpoint fixes the NEXT purchase. It does not fix those
 * three, because Stripe only delivers events to endpoints that existed when
 * the event happened. Resending by hand from the dashboard works and depends
 * on somebody remembering, on the retention window, and on there being few
 * enough to click through.
 *
 * So this asks Stripe directly what the signed-in person has actually paid
 * for, and grants whatever is missing. It fixes the three, and it stays as the
 * floor under every future webhook that is late, retried out, or briefly
 * misconfigured. A purchase system whose only path to delivery is one webhook
 * has one point of failure and no way back from it.
 *
 * THE RULE THAT MAKES THIS SAFE TO EXPOSE.
 *
 * It grants for the CALLER and nobody else, and the caller is the bearer token
 * rather than anything in the request body. A session counts only when
 * session.metadata.user_id equals that verified id. There is no email
 * fallback here, deliberately: the webhook has one because a guest checkout
 * has no user_id and the address is all there is, but an endpoint anybody can
 * call must never let "I know an address" become "give me that person's
 * books". A guest purchase stays parked for the sign-in flow to claim, which
 * is what pending_entitlements is for.
 *
 * It writes the same row the webhook writes, through the same upsert on the
 * same conflict target, so running it twice grants nothing twice and the two
 * paths cannot disagree about what an entitlement is.
 */

const admin = createClient(
  env('supabaseUrl') ?? '',
  env('serviceRole') ?? '',
  { auth: { persistSession: false } },
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first.' })
  const { data: who } = await admin.auth.getUser(token)
  const user = who?.user
  if (!user) return res.status(401).json({ error: 'That session is not valid.' })

  const secret = env('stripeSecret')
  if (!secret) return res.status(500).json({ error: 'Stripe is not configured on this deployment.' })

  const stripe = new Stripe(secret)
  const out = { granted: [], already_had: 0, scanned: 0 }

  try {
    /**
     * A hundred sessions back, which is the whole history of a project this
     * age and is bounded so this cannot become a slow scan later. Anything
     * older than that is past the point where a self-service recovery is the
     * right tool; that is a support conversation.
     */
    const sessions = await stripe.checkout.sessions.list({ limit: 100 })

    for (const s of sessions.data) {
      out.scanned += 1

      /* Paid, mine, and about a book. All three, or it is not a grant. */
      if (s.payment_status !== 'paid') continue
      if (s.metadata?.user_id !== user.id) continue
      const bookId = s.metadata?.book_id
      if (!bookId) continue

      /* ignoreDuplicates, so a book already granted is a no-op rather than an
         error, and the count below distinguishes the two honestly. */
      const { data, error } = await admin
        .from('entitlements')
        .upsert(
          {
            user_id: user.id,
            book_id: bookId,
            stripe_session_id: s.id,
            amount_cents: s.amount_total ?? null,
          },
          { onConflict: 'user_id,book_id', ignoreDuplicates: true },
        )
        .select('book_id')

      if (error) {
        return res.status(500).json({ error: 'Could not record the purchase.', detail: error.message })
      }
      if (data?.length) out.granted.push(bookId)
      else out.already_had += 1
    }
  } catch (e) {
    /* Stripe's own words are safe to pass on: this endpoint never reads a key
       into a response, and a Stripe API error names the call, not the secret. */
    return res.status(502).json({ error: 'Stripe would not answer.', detail: String(e?.message ?? e) })
  }

  return res.status(200).json(out)
}
