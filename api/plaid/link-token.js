import { bodyOf, guard, plaidCall } from '../_plaid.js'

/**
 * A link_token: the one Plaid string the browser is allowed to hold.
 *
 * It is short-lived, scoped to this one user, and useless for reading an
 * account. Plaid Link swaps it for a public_token in the browser, and
 * api/plaid/exchange.js swaps that for the access_token on the server. The
 * access_token is the credential and it never crosses to the client.
 *
 * The user id sent to Plaid is the Supabase id, taken from the verified JWT
 * and NOT from the request body. A client that could name its own client_user_id
 * could link a bank onto somebody else's account, which is the same class of
 * mistake as letting a client name its own price in checkout.js.
 */
export default async function handler(req, res) {
  const ctx = await guard(req, res)
  if (!ctx) return
  const { user } = ctx

  try {
    const body = bodyOf(req)

    /* Re-authentication rather than a new link. When an item goes into
       ITEM_LOGIN_REQUIRED the person has to log in again, and Plaid wants the
       existing access_token so Link opens on the right institution instead of
       asking them to find their bank in a list again. The token is looked up
       here, server side, from an item_id the client is allowed to know. */
      let accessToken
    if (body?.item_id) {
      const { data: item } = await ctx.db
        .from('plaid_item')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('item_id', body.item_id)
        .maybeSingle()
      /* Scoped by user_id as well as item_id, so naming somebody else's item
         finds nothing rather than reopening their bank. */
      accessToken = item?.access_token
    }

    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : 'https://richandfriends.xyz')

    const payload = {
      client_name: 'Rich & Friends',
      /* fr is what most of these users read. Plaid falls back to en for any
         institution that has no French flow. */
      language: body?.language === 'en' ? 'en' : 'fr',
      /* CA and US only. Plaid's coverage in Cote d'Ivoire, which is 91 % of
         the survey behind this product, is effectively nil, so this is a
         feature for the diaspora and the country list says so honestly rather
         than offering a search that will find nobody's bank. */
      country_codes: ['CA', 'US'],
      user: { client_user_id: user.id },
      ...(accessToken
        ? { access_token: accessToken }
        : { products: ['transactions'] }),
    }

    const out = await plaidCall('/link/token/create', payload)
    return res.status(200).json({ link_token: out.link_token, expiration: out.expiration })
  } catch (err) {
    console.error('link token failed', err.plaidCode ?? err.message)
    return res.status(502).json({
      error: 'Could not start the bank connection.',
      code: err.plaidCode ?? null,
    })
  }
}
