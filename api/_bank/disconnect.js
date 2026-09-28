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
 * The delete is done with the service role, scoped by user_id on every
 * statement, so naming somebody else's item_id touches nothing. An earlier
 * draft routed it through a security definer disconnect_bank() function; that
 * function was removed, and this sentence described it for two commits after
 * it stopped existing.
 *
 * The transactions this bank imported go with it. That is the reverse of what
 * this file said originally, and the paragraph arguing for keeping them is
 * gone rather than left standing next to code that does the opposite. The
 * reasoning for the change is in 44_plaid.sql and in the block below.
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

  /**
   * THE IMPORTED TRANSACTIONS GO WITH THE LINK.
   *
   * This used to keep them, deliberately, on the reasoning that unlinking a
   * bank means "stop reading my account" and not "erase my history". That was
   * overruled: the expectation is that disconnecting undoes the import, and an
   * app that leaves a few hundred rows behind after you disconnect leaves you
   * deleting them one at a time.
   *
   * Only rows THIS import created are touched, found through plaid_entry.
   * Anything typed by hand has no link row and is never reached, including a
   * transaction somebody typed for the same shop on the same day.
   *
   * The link rows go too. While the import was permanent the link row had to
   * outlive its entry, so that deleting a transaction did not invite the next
   * sync to re-import it. That reasoning ends here: with the entries gone and
   * the bank unlinked there is nothing left to protect them from, and keeping
   * them would mean re-linking the same bank imported nothing at all.
   *
   * Done BEFORE plaid_item is deleted. If this half fails, the link still
   * exists and the person can try again; the other order would leave orphaned
   * rows attached to a bank they can no longer name.
   */
  const { data: links, error: linkErr } = await db
    .from('plaid_entry')
    .select('entry_id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)

  if (linkErr) {
    console.error('reading the imported rows failed', linkErr)
    return res.status(500).json({
      error: `Could not disconnect: ${linkErr.message ?? linkErr.code ?? 'unknown error'}. If it names a missing table, run supabase/44_plaid.sql.`,
    })
  }

  /* entry_id is null for anything already deleted by hand, and .in() with an
     empty list is a query that matches nothing rather than everything, but
     being explicit costs one line and the alternative is a delete with no
     filter if a future refactor drops the filter() call. */
  const entryIds = (links ?? []).map((l) => l.entry_id).filter(Boolean)
  let removedEntries = 0
  if (entryIds.length > 0) {
    const { error: delErr, count } = await db
      .from('budget_entry')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .in('id', entryIds)

    if (delErr) {
      console.error('deleting the imported transactions failed', delErr)
      return res.status(500).json({
        error: `Could not remove the imported transactions: ${delErr.message ?? delErr.code ?? 'unknown error'}.`,
      })
    }
    removedEntries = count ?? entryIds.length
  }

  await db.from('plaid_entry').delete().eq('user_id', user.id).eq('item_id', itemId)

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

  return res.status(200).json({
    disconnected: true,
    revoked_at_plaid: revoked,
    removed_entries: removedEntries,
  })
}
