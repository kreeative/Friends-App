import { createClient } from '@supabase/supabase-js'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { env, missingEnv } from '../_env.js'
import { apiMessage, failureOf, makeClient } from '../syllabus.js'
import { ROUTE_BUCKET, allow, costOf, tierOf } from '../../src/lib/bb/plans.js'

/**
 * What every Beauty & Brain route shares: who is calling, what they may
 * spend, the model call, and the bill.
 *
 * THE MODEL CALL IS THE ONE api/syllabus.js PROVED IN PRODUCTION.
 *
 * Its first eight calls were refused in 400 until the request was cut down
 * to the most common shape of the API: a document, a sentence, the schema,
 * streamed and read with finalMessage(). No server-side fallback, no beta
 * header. Same here, for the same reason: every option fewer is one cause of
 * failure fewer. When the strict schema itself is refused, the same request
 * goes again without it and the JSON is read loosely, exactly like the
 * syllabus reader.
 *
 * THE KEY NEVER LEAVES THE SERVER, and nothing that could carry it is
 * returned: errors go through failureOf()/apiMessage(), which redact.
 */

/* Two models since 18 October: "okay pour Sonnet" (Kee), once what the
   tokens cost had been laid out.

   Claude Sonnet 5.5, half the price of Opus 5.5 ($2 in and $10 out per
   million tokens, against $4 and $20; cache reads $0.20 on both), for what
   is written for the student: the coach, a chapter's questions, the
   corrections, the cases.

   Claude Opus 5.5 keeps the two jobs where a mistake spreads to everything
   after it: reading a file into the course's map (ingest.js), and checking
   every question against the excerpts before it is kept (check.js,
   pipeline.js). A question Sonnet writes is still vetted by Opus.

   Sonnet 5.5 refuses `thinking: { type: 'disabled' }` and a forced
   tool_choice with a 400; neither is sent anywhere here (server.test.mjs
   keeps it so). BB_MODEL and BB_MODEL_HEAVY change either in Vercel, then a
   redeploy, without touching the code. */
export const MODEL = 'claude-sonnet-5-5'
export const HEAVY_MODEL = 'claude-opus-5-5'
export const model = () => process.env.BB_MODEL || MODEL
export const heavyModel = () => process.env.BB_MODEL_HEAVY || HEAVY_MODEL

/* On hold since 19 October: "I have 100 dollars of free API credit but I
   don't wanna use it, so put a hold on the API utilisation for Hakkilo"
   (Kee). While paused, every route that would call a model answers 503
   'paused' before it does: no call leaves, nothing is spent, and the app
   says the AI is on pause instead of an error. The study itself (sessions,
   cards, the plan, the calendar, the Pomodoro) needs no model and keeps
   working. BB_AI_PAUSED in Vercel overrides this without touching the code:
   '0' resumes, '1' pauses; then a redeploy. */
export const AI_PAUSED = true
export function aiPaused() {
  const v = String(process.env.BB_AI_PAUSED ?? '').trim().toLowerCase()
  if (v === '') return AI_PAUSED
  return !['0', 'false', 'off', 'no'].includes(v)
}

export function admin() {
  return createClient(env('supabaseUrl'), env('serviceRole'), { auth: { persistSession: false } })
}

export function client() {
  return makeClient({ apiKey: env('anthropicKey'), workspace: env('anthropicWorkspace') })
}

/** The JSON body, whatever the runtime did with it. */
export function bodyOf(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return {}
  }
}

/** Configuration first, then the caller from the Bearer token. */
export async function start(req, res, { needsModel = true } = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method' })
    return null
  }
  const missing = missingEnv(['supabaseUrl', 'serviceRole'])
  if (missing.length) {
    res.status(503).json({ error: 'setup', missing })
    return null
  }
  if (needsModel && aiPaused()) {
    res.status(503).json({ error: 'paused' })
    return null
  }
  if (needsModel && !env('anthropicKey')) {
    res.status(503).json({ error: 'no_key' })
    return null
  }
  const db = admin()
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const { data } = token ? await db.auth.getUser(token) : { data: null }
  if (!data?.user) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  return { db, user: data.user, body: bodyOf(req) }
}

export async function subscriptionOf(db, userId) {
  const { data } = await db.from('bb_subscriptions').select('*').eq('user_id', userId).maybeSingle()
  return data ?? null
}

/** Today's (UTC) calls that spend this route's allowance. */
export async function usedToday(db, userId, route) {
  const bucket = ROUTE_BUCKET[route]
  if (!bucket) return 0
  const routes = Object.entries(ROUTE_BUCKET).filter(([, b]) => b === bucket).map(([r]) => r)
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const { count } = await db
    .from('bb_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('route', routes)
    .gte('created_at', since.toISOString())
  return count ?? 0
}

/**
 * May this caller run this route now? Answers 429 with when it resets if
 * not, and returns the subscription when yes.
 */
export async function gate(ctx, res, route) {
  const sub = await subscriptionOf(ctx.db, ctx.user.id)
  const used = await usedToday(ctx.db, ctx.user.id, route)
  const verdict = allow(route, sub, used)
  if (!verdict.ok) {
    res.status(429).json({ error: 'limit', limit: verdict.limit, resetsAt: verdict.resetsAt, tier: tierOf(sub) })
    return null
  }
  return { sub, tier: tierOf(sub), verdict }
}

/** One row per model call: route, model, tokens, and what it cost. */
export async function logUsage(db, userId, route, msgModel, usage) {
  const u = usage ?? {}
  await db.from('bb_usage').insert({
    user_id: userId,
    route,
    model: msgModel,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read: u.cache_read_input_tokens ?? 0,
    cache_write: u.cache_creation_input_tokens ?? 0,
    cost_usd: costOf(msgModel, u),
  })
}

/** The caller's own course, or null. Never trust an id from the body alone. */
export async function ownCourse(db, userId, courseId) {
  if (!courseId) return null
  const { data } = await db.from('bb_courses').select('*').eq('id', courseId).eq('user_id', userId).maybeSingle()
  return data ?? null
}

export async function profileOf(db, userId) {
  const [{ data: bb }, { data: rf }] = await Promise.all([
    db.from('bb_profiles').select('*').eq('user_id', userId).maybeSingle(),
    db.from('profiles').select('display_name, locale').eq('id', userId).maybeSingle(),
  ])
  return { ...(bb ?? {}), first_name: bb?.first_name || (rf?.display_name ?? '').split(/\s+/)[0] || null, locale: rf?.locale === 'en' ? 'en' : 'fr' }
}

/* The JSON in an answer that was not constrained: first brace to last. */
export function looseJson(text) {
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try {
    return JSON.parse(text.slice(s, e + 1))
  } catch {
    return null
  }
}

/**
 * A structured call: strict schema first, the same request without it if
 * the API refuses the schema (400), like api/syllabus.js.
 * Returns { data, usage, model } or { error, detail }.
 */
export async function structured(cl, { system, content, schema, effort = 'medium', maxTokens = 16000, model: m = model() }) {
  const base = { model: m, max_tokens: maxTokens, messages: [{ role: 'user', content }] }
  let msg
  let note = null
  try {
    msg = await cl.messages.stream({ ...base, system, output_config: { effort, format: jsonSchemaOutputFormat(schema) } }).finalMessage()
  } catch (err) {
    if (err?.status !== 400) throw err
    note = apiMessage(err)
    console.error(`bb: strict format refused (400): ${note}`)
    msg = await cl.messages
      .stream({ ...base, system: `${system}\nAnswer with the JSON object only: no prose before or after it, no code fence.`, output_config: { effort } })
      .finalMessage()
  }
  if (msg.stop_reason === 'refusal') return { error: 'refused', detail: note, usage: msg.usage, model: msg.model ?? m }
  if (msg.stop_reason === 'max_tokens') return { error: 'too_long', detail: 'max_tokens', usage: msg.usage, model: msg.model ?? m }
  let data = msg.parsed_output ?? null
  if (!data) {
    const text = (msg.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
    data = looseJson(text)
    if (!data) return { error: 'model_failed', detail: note ?? 'no JSON in the answer', usage: msg.usage, model: msg.model ?? m }
  }
  return { data, usage: msg.usage, model: msg.model ?? m, note }
}

/** A model failure as an HTTP answer, redacted. */
export function fail(res, err, where) {
  const f = failureOf(err)
  console.error(`bb ${where}: ${err?.status ?? '-'} ${err?.name ?? 'Error'}: ${f.detail}`)
  return res.status(f.status).json({ error: f.error, detail: f.detail })
}

export const nullable = (type, description) => ({ anyOf: [{ type }, { type: 'null' }], ...(description ? { description } : {}) })

/** Short, stable keys for anchors in a prompt: A1, A2... and back. */
export function keyMap(rows, prefix) {
  const toKey = new Map()
  const toId = new Map()
  rows.forEach((r, i) => {
    const k = `${prefix}${i + 1}`
    toKey.set(r.id, k)
    toId.set(k, r.id)
  })
  return { toKey, toId }
}
