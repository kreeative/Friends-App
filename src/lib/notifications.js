import { supabase } from './supabase'

/**
 * The unread notifications, and the two writes that clear them.
 *
 * Pulled out of the bell when the panel became a page. The bell needs the
 * count and the page needs the rows, and they are the same query: leaving a
 * copy in each is how two screens start disagreeing about what "unread" means,
 * which is the bug where a badge says 3 over a list showing 2.
 */

/**
 * Unread only, capped at twenty.
 *
 * This is what arrived while you were away, not an archive. Somebody coming
 * back after a month does not want two hundred rows, and the ones that matter
 * are the recent ones. RLS restricts this to the caller's own rows whatever is
 * asked for.
 */
export async function listNotifications() {
  const { data, error } = await supabase
    .from('notification')
    .select('id, kind, href, created_at, goals(commitment), books(title), profiles!notification_actor_id_fkey(display_name)')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data ?? []
}

/**
 * Marked read is an UPDATE, never a delete.
 *
 * The row stays so the sender can still see it was delivered, and so a
 * notification cannot be made never to have existed.
 *
 * The count matters here. RLS refuses an update silently, with zero rows and
 * no error, so "no error" is not the same as "it worked". Callers use the
 * count to decide whether to put the list back.
 */
export async function markRead(ids) {
  if (!ids?.length) return { ok: true, changed: 0 }
  const { error, count } = await supabase
    .from('notification')
    .update({ read_at: new Date().toISOString() }, { count: 'exact' })
    .in('id', ids)
  if (error) return { ok: false, changed: 0, error }
  return { ok: true, changed: count ?? ids.length }
}
