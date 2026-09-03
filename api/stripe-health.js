import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { env, missingEnv } from './_env.js'

/**
 * Why a paid book did not arrive, answered without a dashboard login.
 *
 * WHY THIS EXISTS.
 *
 * The purchase path crosses four systems: the browser, this project's
 * functions, Stripe, and Postgres. When a book does not appear, every one of
 * them looks fine from where you are standing. The buyer sees a receipt. The
 * checkout function returns 200. The library shows nothing. Nothing anywhere
 * says which link broke, and the only places that know are a Stripe dashboard
 * and a Vercel log, which is a long way to go to learn that an environment
 * variable is unset.
 *
 * So this asks all four and reports back in one object. It is a diagnostic and
 * it is meant to be read by a person, which is why the answers are sentences
 * rather than codes.
 *
 * WHAT IT WILL NEVER DO, AND THIS IS THE PART TO KEEP.
 *
 * It reports whether a secret is SET. It never reports a secret's value, not
 * truncated, not fingerprinted, not the first four characters. There is no
 * version of "help me debug" that is worth putting a live Stripe key or a
 * service role key into an HTTP response, and a diagnostic endpoint is exactly
 * where that mistake gets made. The only values echoed are ones Stripe already
 * shows on a public receipt: an endpoint URL, an event type, a timestamp.
 *
 * It also requires a signed-in caller. The information here is not dangerous
 * on its own, but "which of my integrations is misconfigured" is not something
 * to hand to anybody who guesses the path.
 */

const admin = createClient(
  env('supabaseUrl') ?? '',
  env('serviceRole') ?? '',
  { auth: { persistSession: false } },
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  /* Signed in, and that is the whole gate. Any member of the site may run this
     about their own installation; nobody who is not signed in may. */
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first.' })
  const { data: who } = await admin.auth.getUser(token)
  if (!who?.user) return res.status(401).json({ error: 'That session is not valid.' })

  const out = { checked_at: new Date().toISOString(), problems: [] }

  /* --- 1. Is anything unset? ------------------------------------------- */
  const need = ['stripeSecret', 'stripeWebhook', 'supabaseUrl', 'serviceRole']
  const missing = missingEnv(need)
  out.env = Object.fromEntries(need.map((k) => [k, Boolean(env(k))]))
  if (missing.length) {
    out.problems.push(
      `Not set in this deployment: ${missing.join(', ')}. Add them in the Vercel project settings and redeploy. Nothing downstream can work until this is empty.`,
    )
  }

  /* --- 2. Does Stripe know where to send anything? ---------------------- */
  /**
   * THE MOST LIKELY ANSWER, AND THE ONE NOTHING IN THE APP CAN SEE.
   *
   * A webhook that was never registered produces no error anywhere. Checkout
   * succeeds, the customer is charged, and no request is ever made to this
   * project. From the inside that is indistinguishable from a webhook that is
   * registered and failing, which is why both were guessed at for a while.
   */
  if (env('stripeSecret')) {
    const stripe = new Stripe(env('stripeSecret'), { apiVersion: '2024-06-20' })
    try {
      const eps = await stripe.webhookEndpoints.list({ limit: 20 })
      out.webhook_endpoints = eps.data.map((e) => ({
        url: e.url,
        status: e.status,
        events: e.enabled_events,
      }))
      const wanted = eps.data.filter(
        (e) =>
          e.url.endsWith('/api/stripe-webhook') &&
          (e.enabled_events.includes('*') || e.enabled_events.includes('checkout.session.completed')),
      )
      if (eps.data.length === 0) {
        out.problems.push(
          'Stripe has no webhook endpoints at all. Nothing is being sent to this site when a payment completes, which is why a purchase does nothing. Add one in Stripe: Developers, Webhooks, Add endpoint, pointing at https://<your domain>/api/stripe-webhook, subscribed to checkout.session.completed. Then put its signing secret in STRIPE_WEBHOOK_SECRET.',
        )
      } else if (wanted.length === 0) {
        out.problems.push(
          'Stripe has webhook endpoints, but none of them points at /api/stripe-webhook and listens for checkout.session.completed. The list is above; fix the URL or the event, whichever is wrong.',
        )
      } else if (wanted.some((e) => e.status !== 'enabled')) {
        out.problems.push('The endpoint exists but is disabled in Stripe. Re-enable it.')
      }

      /**
       * 3. Recent events, and whether Stripe managed to deliver them.
       *
       * pending_webhooks is the number Stripe still has queued for an event.
       * Anything above zero on an event that is hours old means delivery is
       * being refused: our end answered 4xx or 5xx, or the endpoint is
       * unreachable. That is the difference between "never sent" and "sent and
       * rejected", which are the two failures this whole file exists to tell
       * apart.
       */
      const evs = await stripe.events.list({ type: 'checkout.session.completed', limit: 10 })
      out.recent_purchases = evs.data.map((e) => ({
        at: new Date(e.created * 1000).toISOString(),
        book_id: e.data?.object?.metadata?.book_id ?? null,
        had_user_id: Boolean(e.data?.object?.metadata?.user_id),
        payment_status: e.data?.object?.payment_status ?? null,
        still_queued_for_delivery: e.pending_webhooks,
      }))
      const undelivered = evs.data.filter((e) => e.pending_webhooks > 0)
      if (undelivered.length) {
        out.problems.push(
          `${undelivered.length} completed purchase(s) are still queued for delivery, which means this site answered an error or could not be reached. Check the endpoint's recent deliveries in Stripe for the status code. If it is 400, the signature is not matching; if 500, the secret is missing.`,
        )
      }
      const noBook = evs.data.filter((e) => !e.data?.object?.metadata?.book_id)
      if (noBook.length) {
        out.problems.push(
          `${noBook.length} completed purchase(s) carry no book_id in their metadata, so the webhook cannot tell what was bought. Those were not started by /api/checkout.`,
        )
      }
    } catch (e) {
      out.problems.push(`Stripe refused the request: ${e.message}. Usually a key from the wrong mode, test against live.`)
    }
  }

  /* --- 4. Can anything actually be written when a delivery does land? --- */
  for (const table of ['entitlements', 'pending_entitlements', 'books']) {
    const { error, count } = await admin.from(table).select('*', { count: 'exact', head: true })
    out[`table_${table}`] = error ? `unreadable: ${error.message}` : `ok, ${count} row(s)`
    if (error) {
      out.problems.push(
        `The ${table} table cannot be read with the service role: ${error.message}. A delivery that arrives will verify and then fail to record anything.`,
      )
    }
  }

  /* The buyer's own side of it, so "did MY purchase land" is answerable
     without reading anybody else's rows. */
  const { data: mine } = await admin
    .from('entitlements')
    .select('book_id, created_at')
    .eq('user_id', who.user.id)
  out.your_entitlements = mine ?? []

  if (out.problems.length === 0) {
    out.problems.push(
      'Everything this can check is configured and reachable. If a book still has not arrived, the next place to look is the endpoint\'s recent deliveries in Stripe, which shows the exact response this site sent back.',
    )
  }

  return res.status(200).json(out)
}
