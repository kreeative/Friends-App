/**
 * node src/lib/plaidErrors.test.mjs
 *
 * The case that matters is INVALID_API_KEYS. It is not a bug and not an
 * outage: it is what happens when the keys belong to one Plaid environment and
 * the server is calling another, which is the DEFAULT state for anybody who
 * set PLAID_CLIENT_ID and PLAID_SECRET and nothing else, because PLAID_ENV is
 * optional and falls back to sandbox.
 *
 * So the hint has to name the environment being called, say that the secret is
 * per-environment while the client id is not, and mention that Vercel needs a
 * redeploy. Those three facts are the whole fix, and they are asserted rather
 * than left to survive a future edit on trust.
 *
 * And nothing here may ever contain a key.
 */
import { REAUTH_CODES, describePlaidError, isReauth } from './plaidErrors.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/* --- the setup failure --------------------------------------------------- */

{
  const sandbox = describePlaidError('INVALID_API_KEYS', { env: 'sandbox' })
  ok('a key mismatch does not read as an outage',
     !/try again/i.test(sandbox.error), sandbox.error)
  ok('it says the thing is misconfigured', /configured/i.test(sandbox.error), sandbox.error)

  /* The three facts that constitute the fix. */
  ok('the hint names the host actually being called',
     sandbox.hint.includes('sandbox.plaid.com'), sandbox.hint)
  ok('and the current PLAID_ENV value', /"sandbox"/.test(sandbox.hint), sandbox.hint)
  ok('and says the SECRET is per environment while the client id is not',
     /DIFFERENT SECRET/.test(sandbox.hint) && /client id stays the same/.test(sandbox.hint),
     sandbox.hint)
  ok('and that Vercel needs a redeploy to pick it up',
     /redeploy/i.test(sandbox.hint), sandbox.hint)

  const prod = describePlaidError('INVALID_API_KEYS', { env: 'production' })
  ok('production names the production host',
     prod.hint.includes('production.plaid.com') && !prod.hint.includes('sandbox.plaid.com'),
     prod.hint)
  ok('and the production env value', /"production"/.test(prod.hint), prod.hint)

  /* Defaulted, because that is what the server does when PLAID_ENV is unset,
     and the hint has to describe the server's real behaviour rather than an
     assumption about what somebody meant to configure. */
  const bare = describePlaidError('INVALID_API_KEYS')
  ok('with no env given it describes sandbox, which is what the server calls',
     bare.hint.includes('sandbox.plaid.com'), bare.hint)
}

/* --- the failures that are somebody's bank, not somebody's config --------- */

{
  for (const code of ['INSTITUTION_NOT_RESPONDING', 'INSTITUTION_DOWN', 'RATE_LIMIT_EXCEEDED']) {
    const d = describePlaidError(code)
    ok(`${code} is presented as temporary`, /try again/i.test(d.error), d.error)
    ok(`${code} gives the operator no false lead`, d.hint === null, String(d.hint))
  }

  const login = describePlaidError('ITEM_LOGIN_REQUIRED')
  ok('a re-auth says what the person has to do', /sign in again/i.test(login.error), login.error)
  ok('and is not dressed up as a configuration problem', login.hint === null)
}

/* --- the product not being enabled --------------------------------------- */

{
  const d = describePlaidError('PRODUCTS_NOT_SUPPORTED')
  ok('a missing product points at the Plaid dashboard',
     /dashboard/i.test(d.hint) && /transactions/i.test(d.hint), d.hint)
  /* This one is an operator problem, so it must not tell the person on the
     phone to try again: no amount of retrying enables a product. */
  ok('and does not tell the person to retry', !/try again/i.test(d.error), d.error)
}

/* --- unknown codes ------------------------------------------------------- */

{
  const d = describePlaidError('SOMETHING_PLAID_ADDED_LAST_WEEK')
  ok('an unknown code still produces a sentence', d.error.length > 0)
  ok('and carries the code through for the log',
     d.code === 'SOMETHING_PLAID_ADDED_LAST_WEEK', d.code)
  ok('with no invented hint', d.hint === null)

  const none = describePlaidError(null)
  ok('a missing code does not throw', none.error.length > 0)
  ok('and reports a null code rather than the string "null"', none.code === null)
}

/* --- re-auth classification ---------------------------------------------- */

{
  ok('the codes the routes act on are the ones listed',
     REAUTH_CODES.every((c) => describePlaidError(c).error.includes('sign in again')),
     JSON.stringify(REAUTH_CODES))
  ok('isReauth agrees with the list', REAUTH_CODES.every(isReauth))
  ok('and a key mismatch is NOT a re-auth, which would send somebody to their bank for a Vercel problem',
     !isReauth('INVALID_API_KEYS'))
  ok('nor is an unknown code', !isReauth('WHATEVER') && !isReauth(null))
}

/* --- nothing here may ever contain a credential -------------------------- */

{
  /* The hints talk about keys, so this checks that they talk about the NAMES
     of the variables and never about a value. A future edit that helpfully
     interpolates the secret into the message would be caught here. */
  const codes = ['INVALID_API_KEYS', 'PRODUCTS_NOT_SUPPORTED', 'ITEM_LOGIN_REQUIRED',
                 'INSTITUTION_DOWN', 'RATE_LIMIT_EXCEEDED', 'ITEM_NOT_FOUND', 'NOPE']
  for (const code of codes) {
    for (const env of ['sandbox', 'production']) {
      const d = describePlaidError(code, { env })
      const text = `${d.error} ${d.hint ?? ''}`
      /* Plaid secrets and client ids are 30-char lowercase hex. Any long hex
         run in a message is a credential that got interpolated. */
      ok(`${code}/${env} carries no key-shaped string`,
         !/[0-9a-f]{24,}/i.test(text), text.slice(0, 80))
      ok(`${code}/${env} does not echo an access token`,
         !/access-(sandbox|production)-/.test(text), text.slice(0, 80))
    }
  }
}

console.log(`\nplaidErrors\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
