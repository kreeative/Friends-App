import { env } from '../_env.js'
import { start, subscriptionOf } from './common.js'
import { refreshFromStripe } from './billing.js'
import { LIMITS, ROUTE_BUCKET, resetsAt, tierOf } from '../../src/lib/bb/plans.js'

/**
 * POST /api/bb/status
 *
 * What the app needs to explain the plan before anybody hits a wall: the
 * tier, today's use of each allowance and when it resets, the number of
 * courses and of chapters already prepared, and whether the server can call
 * Claude at all (a missing key is a deployment to finish, and the app says
 * so instead of failing on the first upload).
 *
 * For the owner only, the week's cost: section 7 asks for a weekly cost
 * summary for Kee, and it is her own calls, read with the service role but
 * filtered on her id like everything else here.
 *
 * Needs no model key: this is the route that reports whether there is one.
 */
const BUCKETS = [...new Set(Object.values(ROUTE_BUCKET))]

export default async function status(req, res) {
  const ctx = await start(req, res, { needsModel: false })
  if (!ctx) return
  const { db, user } = ctx

  let sub = await subscriptionOf(db, user.id)
  /* A paid plan whose period has run out may simply have renewed without the
     webhook telling us: ask Stripe before saying "free". */
  if (sub?.stripe_subscription && env('stripeSecret')) {
    const end = sub.current_period_end ? new Date(sub.current_period_end) : null
    if (!end || end <= new Date()) sub = (await refreshFromStripe(db, user.id, sub.stripe_subscription).catch(() => null)) ?? sub
  }
  const tier = tierOf(sub)

  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const week = new Date(Date.now() - 7 * 86400000)
  const [{ data: today }, { count: courses }, { count: prepared }, weekRows] = await Promise.all([
    db.from('bb_usage').select('route').eq('user_id', user.id).gte('created_at', since.toISOString()),
    db.from('bb_courses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    db.from('bb_chapters').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('items_ready', true),
    tier === 'owner'
      ? db.from('bb_usage').select('route, cost_usd, cache_read, input_tokens').eq('user_id', user.id).gte('created_at', week.toISOString())
      : Promise.resolve({ data: null }),
  ])

  const used = Object.fromEntries(BUCKETS.map((b) => [b, 0]))
  for (const row of today ?? []) {
    const b = ROUTE_BUCKET[row.route]
    if (b) used[b] += 1
  }

  let cost = null
  if (weekRows.data) {
    const byRoute = {}
    let total = 0
    for (const r of weekRows.data) {
      const c = Number(r.cost_usd) || 0
      total += c
      byRoute[r.route] = Math.round(((byRoute[r.route] ?? 0) + c) * 1e4) / 1e4
    }
    cost = { week_usd: Math.round(total * 1e4) / 1e4, calls: weekRows.data.length, by_route: byRoute, cached_calls: weekRows.data.filter((r) => r.cache_read > 0).length }
  }

  return res.status(200).json({
    tier,
    plan: sub?.plan ?? 'free',
    status: sub?.status ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
    limits: LIMITS[tier],
    used,
    resetsAt: resetsAt(),
    courses: courses ?? 0,
    prepared: prepared ?? 0,
    ready: { model: Boolean(env('anthropicKey')), billing: Boolean(env('stripeSecret')) },
    cost,
  })
}
