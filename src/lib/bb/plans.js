/**
 * Plans, prices and the daily allowances (section 13 of the build prompt).
 *
 *   Free, forever     1 course, up to 3 chapters analysed, unlimited
 *                     flashcards and spaced repetition, 15 AI corrections
 *                     and 10 coach messages a day.
 *   Plus              everything, under fair use: up to 6 courses, every
 *                     chapter, the coach, the corrections.
 *     monthly         CAD 14.99 a month
 *     semester        CAD 49.99 every 4 months (the headline offer)
 *     yearly          CAD 129.99 a year
 *   Owner             Kee: no limit.
 *
 * Multiple choice and flashcards are marked in the app, with no AI call, so
 * practising is never what runs out. What is counted is what costs: reading
 * a file, preparing a chapter's questions, the coach, a written correction.
 *
 * Pure, shared by the server (which enforces) and the app (which explains).
 */

export const PRICES = {
  plus_month: { cents: 1499, currency: 'cad', interval: 'month', count: 1 },
  plus_semester: { cents: 4999, currency: 'cad', interval: 'month', count: 4 },
  plus_year: { cents: 12999, currency: 'cad', interval: 'year', count: 1 },
}
export const PAID = Object.keys(PRICES)

/** Per day unless marked total. null = no limit. */
export const LIMITS = {
  free: { courses: 1, chapters: 3, ingest: 6, generate: 6, coach: 10, grade: 15 },
  plus: { courses: 6, chapters: null, ingest: 40, generate: 60, coach: 150, grade: 200 },
  owner: { courses: null, chapters: null, ingest: null, generate: null, coach: null, grade: null },
}

/** Which allowance a route spends. */
export const ROUTE_BUCKET = { ingest: 'ingest', enrich: 'ingest', generate: 'generate', coach: 'coach', grade: 'grade', report: 'grade', elaborate: 'grade' }

/** The plan in force for a subscription row, now. */
export function tierOf(sub, now = new Date()) {
  if (!sub) return 'free'
  if (sub.plan === 'owner' && sub.status === 'active') return 'owner'
  if (!PAID.includes(sub.plan)) return 'free'
  const live = ['active', 'trialing', 'past_due'].includes(sub.status)
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null
  /* A cancelled plan runs to the end of what was paid for. */
  if (live && (!end || end > now)) return 'plus'
  if (sub.status === 'canceled' && end && end > now) return 'plus'
  return 'free'
}

export const limitsFor = (sub, now) => LIMITS[tierOf(sub, now)]

/** Midnight UTC tomorrow: when the daily allowances reset. */
export function resetsAt(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return d.toISOString()
}

/**
 * May this route run? `used` is today's count for its bucket.
 * Returns { ok, limit, remaining, resetsAt }.
 */
export function allow(route, sub, used, now = new Date()) {
  const bucket = ROUTE_BUCKET[route]
  const limit = bucket ? limitsFor(sub, now)[bucket] : null
  if (limit == null) return { ok: true, limit: null, remaining: null, resetsAt: null }
  const remaining = Math.max(0, limit - (Number(used) || 0))
  return { ok: remaining > 0, limit, remaining, resetsAt: resetsAt(now) }
}

/** May one more course be created? */
export function canAddCourse(sub, courseCount, now) {
  const limit = limitsFor(sub, now).courses
  return limit == null || courseCount < limit
}

/** May this chapter get questions? Free plans: the first three analysed. */
export function canPrepareChapter(sub, preparedCount, alreadyPrepared, now) {
  if (alreadyPrepared) return true
  const limit = limitsFor(sub, now).chapters
  return limit == null || preparedCount < limit
}

/** "12,50 $ par mois" for the semester plan, in the reader's language. */
export function perMonth(plan, locale = 'fr') {
  const p = PRICES[plan]
  if (!p) return null
  const months = p.interval === 'year' ? 12 * p.count : p.count
  return money(Math.round(p.cents / months), locale)
}

export function money(cents, locale = 'fr') {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)
}

/**
 * The cost of one model call in US dollars, from its usage, per million
 * tokens: Opus 5.5 $4 in, $20 out, cache reads $0.20, cache writes 1.25x
 * the input price ($5). Fable 5.1 $10 / $50, reads $0.25. Sonnet 5.5
 * $2 / $10, reads $0.20.
 */
export const RATES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
}

export function costOf(model, usage) {
  const r = RATES[model] ?? RATES['claude-opus-5-5']
  const u = usage ?? {}
  const usd =
    ((u.input_tokens ?? 0) * r.input + (u.output_tokens ?? 0) * r.output + (u.cache_read_input_tokens ?? 0) * r.cacheRead + (u.cache_creation_input_tokens ?? 0) * r.cacheWrite) / 1e6
  return Math.round(usd * 1e5) / 1e5
}
