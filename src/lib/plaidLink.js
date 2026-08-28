import { supabase } from './supabase'

/**
 * The browser half of the bank import.
 *
 * Everything here talks to /api/plaid/*. Nothing here ever holds an
 * access_token, a client id or a secret: the only Plaid string that reaches
 * this file is a link_token, which is short-lived, scoped to one user and
 * useless for reading an account. See supabase/44_plaid.sql for why that
 * division is the whole design rather than a nicety.
 */

/** Plaid Link, loaded from Plaid's own CDN and only when somebody asks. */
const LINK_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'

/**
 * Loads Plaid Link once and resolves when window.Plaid exists.
 *
 * Deliberately not in index.html. A third-party script on every page load, for
 * a feature almost nobody on this app can use (Plaid has effectively no
 * coverage in Cote d'Ivoire, which is 91 % of the survey behind the product),
 * is a cost paid by everyone for the benefit of a few. It loads when the
 * button is pressed.
 */
let linkPromise = null
export function loadPlaidLink() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Plaid) return Promise.resolve(window.Plaid)
  if (linkPromise) return linkPromise

  linkPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = LINK_SRC
    el.async = true
    el.onload = () => (window.Plaid ? resolve(window.Plaid) : reject(new Error('Plaid Link did not initialise')))
    el.onerror = () => {
      /* Cleared so a second attempt can retry rather than being handed the
         rejected promise from a one-off network failure forever. */
      linkPromise = null
      reject(new Error('Could not load Plaid Link'))
    }
    document.head.appendChild(el)
  })
  return linkPromise
}

/**
 * A POST to one of our own Plaid routes, with the caller's token.
 *
 * The content-type check is the same guard as startCheckout's and exists for
 * the same reason: these are serverless functions, so on `vite dev` or any
 * plain static host the request falls through to index.html and a page of HTML
 * comes back with a 200. Parsing that and reporting "no link_token in the
 * response" is true and useless.
 */
async function call(path, body = {}) {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess?.session?.access_token
  if (!token) return { error: 'Sign in first.' }

  let res
  try {
    res = await fetch(`/api/plaid/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    return { error: `Could not reach the bank import. ${e?.message ?? e}` }
  }

  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    return {
      error: `/api/plaid/${path} did not answer as an API (HTTP ${res.status}). Bank import works on the deployed site, not on a local dev server.`,
    }
  }

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) return { error: payload.error || `Request failed (${res.status})`, ...payload }
  return payload
}

/**
 * Which Plaid environment the deployment calls, so the panel can warn.
 *
 * In the sandbox Plaid rejects real credentials and real phone numbers by
 * design, and words both rejections as though the person got something wrong.
 * Asked once on mount so the warning is on screen before anybody types a bank
 * password rather than after they have retyped it three times.
 *
 * Returns `{ env }` or `{ error }`; the caller treats a failure as "unknown"
 * and simply shows no banner, because a status call that fails is not a reason
 * to block the feature.
 */
export function plaidStatus() {
  return call('status')
}

/** The connected banks, safe fields only. Never includes a token. */
export async function bankConnections() {
  const { data, error } = await supabase.rpc('my_bank_connections')
  if (error) return { error, connections: [] }
  return { connections: data ?? [] }
}

/**
 * Opens Plaid Link and, if it completes, stores the connection.
 *
 * `itemId` re-opens an existing broken link for re-authentication rather than
 * adding a second copy of the same bank.
 *
 * Resolves with `{ item_id, institution }` on success, `{ cancelled: true }`
 * when the person closed the dialog, or `{ error }`. Closing the dialog is not
 * an error and must not be reported as one: it is the single most common way
 * this flow ends.
 */
export async function connectBank({ locale = 'fr', itemId = null } = {}) {
  const started = await call('link-token', {
    language: locale === 'en' ? 'en' : 'fr',
    ...(itemId ? { item_id: itemId } : {}),
  })
  if (started.error) return started

  let Plaid
  try {
    Plaid = await loadPlaidLink()
  } catch (e) {
    return { error: e?.message ?? 'Could not load Plaid Link' }
  }

  return new Promise((resolve) => {
    const handler = Plaid.create({
      token: started.link_token,
      onSuccess: async (publicToken) => {
        /* Re-authentication returns no new public_token worth exchanging: the
           existing item is already repaired at Plaid by the Link flow itself.
           Exchanging anyway would mint a second token for the same item. */
        if (itemId) return resolve({ item_id: itemId, reauthorised: true })
        resolve(await call('exchange', { public_token: publicToken }))
      },
      onExit: (err) => {
        /* err is null when the person simply closed it. Anything else is a
           real failure worth naming. */
        if (err) resolve({ error: err.display_message || err.error_message || 'Connection cancelled' })
        else resolve({ cancelled: true })
      },
    })
    handler.open()
  })
}

/** Pull new transactions. Returns the tally, including what was skipped. */
export function syncBanks() {
  return call('sync')
}

/** Unlink one bank. The imported transactions are deliberately kept. */
export function disconnectBank(itemId) {
  return call('disconnect', { item_id: itemId })
}
