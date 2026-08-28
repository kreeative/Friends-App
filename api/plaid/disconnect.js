import { bodyOf, guard, plaidCall } from '../_plaid.js'

/**
 * Unlink a bank, at Plaid and here, in that order.
 *
 * THE ORDER IS THE WHOLE POINT.
 *
 * Revoking an item at Plaid requires its access_token, and the token is gone
 * the moment the row is deleted. Delete first and the item stays live at
 * Plaid, still authorised against somebody's bank, with nothing left here able
 * to revoke it. So Plaid is told first, and the row is deleted after.
 *
 * If Plaid's call fails the row is deleted anyway. That leaves an orphaned
 * item at Plaid, which is untidy, but the alternative is refusing to
 * disconnect somebody's bank because a third party is having an outage, and
 * between "untidy record at Plaid" and "cannot revoke access to my own bank
 * account" there is no contest. The failure is logged and reported.
 *
 * The delete itself goes through disconnect_bank(), which is scoped to
 * auth.uid(), so naming somebody else's item_id returns false and touches
 * nothing. The budget rows are deliberately kept: unlinking a bank means "stop
 * reading my account", not "erase my spending history". See 44_plaid.sql.
 */
export default async function handler(req, res) {
  const ctx = await guard(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const itemId = bodyOf(req)?.item_id
  if (!itemId) return res.status(400).json({ error: 'item_id is required' })

  /* Scoped by user_id as well, so this cannot read a token that is not theirs
     even before disconnect_bank does its own check. */
  const { data: item } = await db
    .from('plaid_item')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .maybeSingle()

  if (!item) return res.status(404).json({ error: 'No such connection.' })

  let revoked = true
  try {
    await plaidCall('/item/remove', { access_token: item.access_token })
  } catch (err) {
    revoked = false
    console.error('plaid item/remove failed, deleting locally anyway', err.plaidCode ?? err.message)
  }

  /* Scoped by user_id, the same clause that guarded the token read above.
     plaid_item has RLS with no policies, so this has to be the service role;
     the scoping is therefore this line's job and it is not optional.

     An earlier draft routed this through a security definer disconnect_bank()
     function instead, called with the service-role key as the apikey and the
     caller's JWT in the Authorization header so that auth.uid() resolved. It
     worked, and it meant a reader had to know that PostgREST takes the role
     from the second of two credentials in the same request to see why it was
     safe. One explicit eq() says the same thing without the puzzle. */
  const { error } = await db
    .from('plaid_item')
    .delete()
    .eq('user_id', user.id)
    .eq('item_id', itemId)

  if (error) {
    console.error('deleting the plaid item failed', error)
    return res.status(500).json({
      error: `Could not disconnect: ${error.message ?? error.code ?? 'unknown error'}. If it names a missing table, run supabase/44_plaid.sql.`,
    })
  }

  return res.status(200).json({ disconnected: true, revoked_at_plaid: revoked })
}
