import { createClient } from '@supabase/supabase-js'
import { env, missingEnv } from './_env.js'

/**
 * The bits every Plaid route needs: who is calling, and how to call Plaid.
 *
 * WHY fetch AND NOT THE PLAID SDK.
 *
 * Plaid's API is a handful of JSON POSTs that take the credentials in the
 * body. The SDK adds a dependency, a bundle, and a generated client whose
 * version has to be kept in step with an api_version header, in exchange for
 * wrapping four calls this project makes. api/checkout.js uses the Stripe SDK
 * because Stripe's webhook signature verification is genuinely worth not
 * writing twice; there is no equivalent here.
 *
 * WHY THE SECRET IS NEVER RETURNED FROM ANYTHING IN THIS FILE.
 *
 * See the header of supabase/44_plaid.sql. The access_token and the client
 * secret are bank credentials. They exist in this process and in the database,
 * and they are never put in a response body, a log line, or an error message.
 * plaidCall() below is careful about the last one in particular: Plaid echoes
 * parts of the request in some error payloads, so the error that leaves this
 * function is rebuilt from named fields rather than passed through.
 */

export const PLAID_REQUIRED = ['plaidClientId', 'plaidSecret', 'supabaseUrl', 'serviceRole']

/** sandbox unless production is explicitly asked for. Never a guess upward. */
export function plaidHost() {
  const e = String(env('plaidEnv') ?? 'sandbox').toLowerCase()
  return e === 'production'
    ? 'https://production.plaid.com'
    : 'https://sandbox.plaid.com'
}

/**
 * Built per request, for the reason recorded in api/checkout.js: with the
 * variables unset, createClient('', '') throws while the module is still
 * loading and Vercel answers with its own HTML error page, so the browser sees
 * a button that does nothing instead of a message naming what is missing.
 */
export function admin() {
  return createClient(env('supabaseUrl'), env('serviceRole'), {
    auth: { persistSession: false },
  })
}

/**
 * One Plaid call.
 *
 * Throws a PlaidError carrying Plaid's own error_code, which is the field
 * worth acting on: ITEM_LOGIN_REQUIRED means the person has to re-authenticate
 * and is a normal thing that happens, not a bug, and the sync route marks the
 * item rather than failing.
 */
export async function plaidCall(path, body) {
  const res = await fetch(`${plaidHost()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env('plaidClientId'),
      secret: env('plaidSecret'),
      ...body,
    }),
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    /* Rebuilt from named fields. Plaid's error payloads can echo request
       context, and passing the whole thing through would be one refactor away
       from a secret in a log. */
    const err = new Error(json?.error_message || `Plaid ${path} failed`)
    err.name = 'PlaidError'
    err.plaidCode = json?.error_code ?? null
    err.plaidType = json?.error_type ?? null
    err.status = res.status
    throw err
  }

  return json
}

/**
 * The caller, from their Supabase JWT, or null.
 *
 * Every Plaid route is about one person's bank account, so there is no
 * anonymous path here at all. checkout.js deliberately allows a guest because
 * a stranger buying a book is a real flow; a stranger linking a bank is not.
 */
export async function userFrom(req, db) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data?.user ?? null
}

/**
 * The guard every route opens with: configured, POST, signed in.
 *
 * Returns the user, or writes the response and returns null. Written once
 * because three routes need exactly the same four checks in the same order,
 * and a route that forgets the signed-in one is a route that links a bank to
 * nobody.
 */
export async function guard(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return null
  }

  /* Named, not generic, for the reason checkout.js records: without the
     service-role key the identity lookup fails and the plausible answer is
     "not signed in", which sends somebody to debug their account instead of
     their Vercel settings. */
  const missing = missingEnv(PLAID_REQUIRED)
  if (missing.length > 0) {
    res.status(503).json({
      error: `Bank import is not set up yet. Missing from the Vercel environment: ${missing.join(', ')}.`,
      missing,
    })
    return null
  }

  const db = admin()
  const user = await userFrom(req, db)
  if (!user) {
    res.status(401).json({ error: 'Sign in first.' })
    return null
  }

  return { db, user }
}

/** JSON body, whichever form the platform hands it over in. */
export function bodyOf(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return {}
  }
}
