import { guard, plaidCall, plaidFailure } from '../_plaid.js'
import { mapBatch } from '../../src/lib/plaidMap.js'
import { isReauth } from '../../src/lib/plaidErrors.js'

/**
 * Pull new transactions from every linked bank into the ledger.
 *
 * WHY /transactions/sync AND NOT /transactions/get.
 *
 * sync is a cursor over a change feed: it returns what has been added,
 * modified and removed since the last call, and hands back a new cursor. get
 * returns a date window, which means the caller has to decide what "new" means
 * and gets it wrong at every boundary. Plaid also revises transactions after
 * they post, and a date window has no way to learn that an amount changed.
 *
 * THE DEDUPE IS THE WHOLE JOB.
 *
 * A sync that runs twice must not import anything twice, and a transaction the
 * person deleted on purpose must stay deleted. Both come out of plaid_entry:
 * a row there means "this Plaid transaction has been dealt with", and it
 * outlives the budget_entry it created precisely so that deleting the entry
 * does not invite the next sync to put it back. See the long note in
 * supabase/44_plaid.sql.
 *
 * WHAT IS NOT IMPORTED IS COUNTED AND NAMED.
 *
 * Transfers, pending rows, foreign currency. src/lib/plaidMap.js decides, and
 * the tally comes back in the response so the screen can say "38 added, 9
 * transfers skipped" instead of quietly showing a number that does not match
 * the person's bank.
 */
export default async function handler(req, res) {
  const ctx = await guard(req, res)
  if (!ctx) return
  const { db, user } = ctx

  /* The budget's currency, which decides what can be imported at all. Read
     from the profile rather than taken from the request: a client that could
     name its own currency could import euros into a dollar budget, which is
     the exact thing plaidMap refuses to do. */
  const { data: profile } = await db
    .from('profiles')
    .select('currency')
    .eq('id', user.id)
    .maybeSingle()

  const currency = profile?.currency
  if (!currency) {
    return res.status(409).json({
      error: 'Set your currency in your profile before importing, so amounts land in the right money.',
    })
  }

  const { data: items, error: itemsErr } = await db
    .from('plaid_item')
    .select('item_id, access_token, cursor, status')
    .eq('user_id', user.id)

  if (itemsErr) {
    console.error('reading linked items failed', itemsErr)
    return res.status(500).json({
      error: `Could not read your linked banks: ${itemsErr.message ?? itemsErr.code ?? 'unknown error'}. If it names a missing table, run supabase/44_plaid.sql.`,
    })
  }

  if (!items?.length) return res.status(200).json({ added: 0, items: [], banks: 0 })

  const report = []

  for (const item of items) {
    try {
      report.push(await syncOne({ db, user, item, currency }))
    } catch (err) {
      /* ITEM_LOGIN_REQUIRED is not a bug, it is a bank asking the person to log
         in again, and it happens routinely. Marked so the screen can offer the
         re-authentication flow instead of showing a failure they cannot act
         on. */
      /* The shared list, not one code. ITEM_LOCKED and PENDING_EXPIRATION
         need the same trip through Link, and hard-coding one of the three
         meant the other two showed as a plain failure the person could not
         act on. */
      const needsReauth = isReauth(err.plaidCode)
      if (needsReauth) {
        await db.from('plaid_item').update({ status: 'reauth' })
          .eq('user_id', user.id).eq('item_id', item.item_id)
      }
      console.error('sync failed for one item', item.item_id, err.plaidCode ?? err.message)
      report.push({
        item_id: item.item_id,
        error: needsReauth ? 'reauth' : 'failed',
        ...plaidFailure(err),
      })
    }
  }

  return res.status(200).json({
    banks: items.length,
    added: report.reduce((s, r) => s + (r.added ?? 0), 0),
    removed: report.reduce((s, r) => s + (r.removed ?? 0), 0),
    skipped: report.reduce((s, r) => s + (r.skippedTotal ?? 0), 0),
    items: report,
  })
}

/**
 * One linked bank, followed to the end of its change feed.
 *
 * Plaid pages with has_more, and the cursor is only saved AFTER the rows of
 * that page are written. If the function dies mid-way the cursor still points
 * at the last page that was fully applied, so the next run repeats a page
 * rather than skipping one. Repeating is harmless because plaid_entry dedupes;
 * skipping would lose transactions silently and nobody would ever find out.
 */
async function syncOne({ db, user, item, currency }) {
  let cursor = item.cursor ?? null
  let added = 0
  let removed = 0
  let hasMore = true
  const skipped = { pending: 0, transfer: 0, currency: 0, zero: 0, 'no-date': 0 }
  /* Plaid can loop forever if a cursor never advances. Bounded so a bad feed
     costs one function timeout rather than a runaway bill. */
  let pages = 0

  while (hasMore && pages < 40) {
    pages += 1
    const page = await plaidCall('/transactions/sync', {
      access_token: item.access_token,
      ...(cursor ? { cursor } : {}),
      count: 500,
    })

    added += await applyAdded({ db, user, item, currency, page, skipped })
    await applyModified({ db, user, page, currency })
    removed += await applyRemoved({ db, user, page })

    /* Only now. See the note above about which direction to fail in. */
    cursor = page.next_cursor
    hasMore = Boolean(page.has_more)

    await db.from('plaid_item')
      .update({ cursor, last_synced_at: new Date().toISOString(), status: 'good' })
      .eq('user_id', user.id).eq('item_id', item.item_id)
  }

  return {
    item_id: item.item_id,
    added,
    removed,
    skipped,
    skippedTotal: Object.values(skipped).reduce((a, b) => a + b, 0),
  }
}

/** New transactions, minus the ones already dealt with. */
async function applyAdded({ db, user, item, currency, page, skipped }) {
  const batch = mapBatch(page.added ?? [], currency)
  for (const [k, v] of Object.entries(batch.skipped)) skipped[k] += v
  if (batch.entries.length === 0) return 0

  /* THE DEDUPE. Anything already in plaid_entry has been dealt with: imported,
     or imported and then deleted on purpose. Either way it is not imported
     again. Checked in one query rather than per row. */
  const ids = batch.entries.map((e) => e.plaid_transaction_id)
  const { data: seen } = await db
    .from('plaid_entry')
    .select('plaid_transaction_id')
    .eq('user_id', user.id)
    .in('plaid_transaction_id', ids)

  const known = new Set((seen ?? []).map((r) => r.plaid_transaction_id))
  const fresh = batch.entries.filter((e) => !known.has(e.plaid_transaction_id))
  if (fresh.length === 0) return 0

  const { data: written, error } = await db
    .from('budget_entry')
    .insert(fresh.map(({ plaid_transaction_id, ...entry }) => ({ ...entry, user_id: user.id })))
    .select('id')

  if (error) {
    console.error('inserting imported transactions failed', error)
    throw Object.assign(new Error(error.message), { plaidCode: null })
  }

  /* The link rows, in the same order the entries were inserted. Supabase
     returns inserted rows in input order, which is what makes this pairing
     safe; if that ever stopped being true the dedupe would attach the wrong
     Plaid id to the wrong entry, so it is worth stating out loud. */
  const links = written.map((row, i) => ({
    plaid_transaction_id: fresh[i].plaid_transaction_id,
    user_id: user.id,
    item_id: item.item_id,
    entry_id: row.id,
  }))

  const { error: linkErr } = await db.from('plaid_entry').insert(links)
  if (linkErr) {
    /* Without the link rows the next sync would import these again. Roll the
       entries back rather than leave a duplicate generator behind. */
    console.error('linking imported transactions failed, undoing the insert', linkErr)
    await db.from('budget_entry').delete().in('id', written.map((r) => r.id))
    throw Object.assign(new Error(linkErr.message), { plaidCode: null })
  }

  return fresh.length
}

/**
 * Transactions Plaid revised after they posted.
 *
 * An amount or a date can change when a purchase settles. Only rows this
 * import created are touched, found through plaid_entry: a person who edited
 * an imported row by hand still gets Plaid's correction, which is right,
 * but a row they typed themselves is never reached because it has no link.
 */
async function applyModified({ db, user, page, currency }) {
  const batch = mapBatch(page.modified ?? [], currency)
  for (const entry of batch.entries) {
    const { data: link } = await db
      .from('plaid_entry')
      .select('entry_id')
      .eq('user_id', user.id)
      .eq('plaid_transaction_id', entry.plaid_transaction_id)
      .maybeSingle()

    /* No link, or a link whose entry the person deleted. Both mean leave it
       alone: re-creating a deleted row as a "modification" would be the
       re-import this whole design exists to prevent. */
    if (!link?.entry_id) continue

    const { plaid_transaction_id, ...fields } = entry
    await db.from('budget_entry').update(fields).eq('id', link.entry_id).eq('user_id', user.id)
  }
}

/**
 * Transactions the bank took back.
 *
 * These are genuinely cancelled, so the ledger row goes. The plaid_entry row
 * stays, with entry_id null, which is the same state a manual delete leaves
 * behind and means the same thing: dealt with, do not import again.
 */
async function applyRemoved({ db, user, page }) {
  const ids = (page.removed ?? []).map((r) => r.transaction_id).filter(Boolean)
  if (ids.length === 0) return 0

  const { data: links } = await db
    .from('plaid_entry')
    .select('entry_id')
    .eq('user_id', user.id)
    .in('plaid_transaction_id', ids)

  const entryIds = (links ?? []).map((l) => l.entry_id).filter(Boolean)
  if (entryIds.length > 0) {
    await db.from('budget_entry').delete().in('id', entryIds).eq('user_id', user.id)
  }
  return entryIds.length
}
