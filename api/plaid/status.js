import { guard, plaidEnvName } from '../_plaid.js'

/**
 * Which Plaid environment this deployment actually calls.
 *
 * WHY THIS ROUTE EXISTS.
 *
 * PLAID_ENV is optional and falls back to sandbox, and in the sandbox Plaid
 * rejects real bank credentials and real phone numbers by design: only
 * user_good / pass_good and a handful of test numbers work. Both rejections
 * are worded as though the person got something wrong. "Incorrect
 * credentials" under a correct password, and "We couldn't verify that
 * +1 506... is a valid number" under a perfectly valid area code.
 *
 * Somebody hitting that has no way to tell it apart from a bug in their own
 * details, and will retype their real bank password several times before
 * giving up. That is what happened here, and it is worth a whole route to
 * prevent: the panel asks once, on mount, and says "test mode" before anybody
 * types anything.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN.
 *
 * No keys, no lengths, no prefixes, no fingerprints. `configured` is a boolean
 * about presence, and `env` is one of two known words this file chooses from a
 * fixed set rather than echoing what the variable holds. A status endpoint is
 * exactly the sort of thing that grows a "helpful" diagnostic field, so the
 * shape is kept to two values and the test asserts nothing else appears.
 *
 * It is behind the same guard as every other route: knowing how somebody's
 * deployment is configured is not information for a stranger.
 */
export default async function handler(req, res) {
  const ctx = await guard(req, res)
  if (!ctx) return

  return res.status(200).json({
    /* Chosen from a fixed set by plaidEnvName, never echoed from the
       environment, so a typo in PLAID_ENV cannot paint arbitrary text onto
       somebody's screen. */
    env: plaidEnvName(),
    /* guard() has already refused the request if either key were missing, so
       reaching this line means both are set. Returned anyway, because the
       panel should not have to infer it from the absence of an error. */
    configured: true,
  })
}
