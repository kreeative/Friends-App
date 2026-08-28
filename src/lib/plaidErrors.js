/**
 * Plaid's error codes, turned into something a person can act on.
 *
 * Pure and importless so it can be tested in node and imported by the API
 * routes, same arrangement as plaidMap.js.
 *
 * WHY THIS EXISTS AT ALL.
 *
 * Every Plaid failure was coming back as "Could not start the bank
 * connection", which is true of all of them and useful for none. The single
 * most likely failure when setting this up is not a bug and not an outage: it
 * is credentials from one Plaid environment being sent to another.
 *
 * Plaid issues ONE client_id and a DIFFERENT SECRET PER ENVIRONMENT. So a
 * production secret sent to sandbox.plaid.com is rejected, and the message a
 * person needs is "your keys do not match the environment this server is
 * calling", naming the environment, not a generic apology. PLAID_ENV is
 * optional and defaults to sandbox, which makes this the DEFAULT state for
 * anybody who set only the client id and the secret.
 *
 * Everything here is about which sentence to show. Nothing here decides
 * whether a call is retried, and nothing here is allowed to include a secret:
 * the host is named, the keys never are.
 */

/** Codes the routes act on rather than merely report. */
export const REAUTH_CODES = ['ITEM_LOGIN_REQUIRED', 'ITEM_LOCKED', 'PENDING_EXPIRATION']

/**
 * `{ error, code, hint }` for a Plaid failure.
 *
 * `hint` is the operator's sentence: what to change in Vercel or in the Plaid
 * dashboard. It is separate from `error` because one is for the person holding
 * the phone and the other is for the person holding the deploy, and merging
 * them gives both audiences the wrong message.
 */
export function describePlaidError(code, { env = 'sandbox' } = {}) {
  const host = env === 'production' ? 'production.plaid.com' : 'sandbox.plaid.com'

  switch (code) {
    case 'INVALID_API_KEYS':
      return {
        error: 'The bank connection is not configured correctly yet.',
        code,
        /* The whole reason this file exists. Names the environment being
           called, because that is the variable somebody has to change, and
           says which key is per-environment, because the client id is not and
           people reasonably assume both behave the same way. */
        hint: `Plaid rejected the keys for ${host}. PLAID_ENV is currently "${env}", and Plaid issues a DIFFERENT SECRET for each environment while the client id stays the same. Either set PLAID_SECRET to the ${env} secret from the Plaid dashboard, or set PLAID_ENV to the environment your secret belongs to. Vercel only picks up an environment variable on a NEW deployment, so redeploy after changing it.`,
      }

    case 'INVALID_PRODUCT':
    case 'PRODUCTS_NOT_SUPPORTED':
      return {
        error: 'This account cannot be used for importing transactions.',
        code,
        hint: 'The Plaid team does not have the transactions product enabled. Enable it in the Plaid dashboard under Team Settings, then try again.',
      }

    case 'INSTITUTION_NOT_RESPONDING':
    case 'INSTITUTION_DOWN':
      return {
        error: 'Your bank is not answering right now. Try again in a little while.',
        code,
        hint: null,
      }

    case 'ITEM_LOGIN_REQUIRED':
    case 'ITEM_LOCKED':
    case 'PENDING_EXPIRATION':
      return {
        error: 'Your bank wants you to sign in again.',
        code,
        hint: null,
      }

    case 'RATE_LIMIT_EXCEEDED':
      return {
        error: 'Too many requests at once. Try again in a minute.',
        code,
        hint: null,
      }

    case 'INVALID_ACCESS_TOKEN':
    case 'ITEM_NOT_FOUND':
      return {
        error: 'This connection is no longer valid. Disconnect it and connect again.',
        code,
        hint: null,
      }

    default:
      return {
        error: 'Could not reach your bank. Try again in a little while.',
        code: code ?? null,
        hint: null,
      }
  }
}

/** Does this failure mean the person has to re-authenticate? */
export function isReauth(code) {
  return REAUTH_CODES.includes(code)
}
