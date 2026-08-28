import { bodyOf, guard, plaidCall } from '../_plaid.js'

/**
 * public_token in, access_token stored, nothing sensitive out.
 *
 * This is the moment the credential comes into existence. The response says
 * which institution was linked and nothing else: no token, no item id echo of
 * anything the caller did not already have.
 *
 * The row is written with the service role because plaid_item has row level
 * security enabled and NO POLICIES, so the browser's own JWT could not write
 * it and is not supposed to be able to. See supabase/44_plaid.sql.
 */
export default async function handler(req, res) {
  const ctx = await guard(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const publicToken = bodyOf(req)?.public_token
  if (!publicToken) return res.status(400).json({ error: 'public_token is required' })

  try {
    const exchanged = await plaidCall('/item/public_token/exchange', {
      public_token: publicToken,
    })

    const accessToken = exchanged.access_token
    const itemId = exchanged.item_id
    if (!accessToken || !itemId) {
      return res.status(502).json({ error: 'Plaid did not return a usable link.' })
    }

    /* The institution name, for a screen that has to say which bank this is.
       Best effort: a link with no resolvable institution is still a working
       link, so a failure here must not lose the token that was just created. */
    let institution = null
    try {
      const item = await plaidCall('/item/get', { access_token: accessToken })
      const id = item?.item?.institution_id
      if (id) {
        const inst = await plaidCall('/institutions/get_by_id', {
          institution_id: id,
          country_codes: ['CA', 'US'],
        })
        institution = inst?.institution?.name ?? null
      }
    } catch (err) {
      console.error('institution lookup failed, keeping the link', err.plaidCode ?? err.message)
    }

    /* onConflict on (user_id, item_id): re-linking the same bank, which is what
       the re-authentication flow does, has to replace the dead token rather
       than leave it beside the live one. cursor is deliberately NOT reset,
       so a re-auth resumes the sync instead of re-importing the history. */
    const { error } = await db
      .from('plaid_item')
      .upsert(
        {
          user_id: user.id,
          item_id: itemId,
          access_token: accessToken,
          institution,
          status: 'good',
        },
        { onConflict: 'user_id,item_id' },
      )

    if (error) {
      console.error('storing the plaid item failed', error)
      /* The token exists at Plaid but we could not keep it, so it is revoked
         rather than left as an orphan with access to somebody's bank and
         nothing here able to reach it. */
      await plaidCall('/item/remove', { access_token: accessToken }).catch(() => {})
      return res.status(500).json({
        error: `Could not save the connection: ${error.message ?? error.code ?? 'unknown error'}. If it names a missing table, run supabase/44_plaid.sql.`,
      })
    }

    return res.status(200).json({ item_id: itemId, institution })
  } catch (err) {
    console.error('exchange failed', err.plaidCode ?? err.message)
    return res.status(502).json({
      error: 'Could not finish connecting the bank.',
      code: err.plaidCode ?? null,
    })
  }
}
