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

/**
 * Ask Supabase to push a claimed nudge to the person it is about, now.
 *
 * WHY THE CALL GOES TO SUPABASE AND NOT TO /api.
 *
 * A push is signed with the VAPID private key, and that key lives in Supabase
 * and nowhere else. A Vercel route could not send one without moving it there,
 * so the send happens where the key already is.
 *
 * WHY IT SENDS ONLY AN ID.
 *
 * The endpoint takes a nudge id and nothing else. It reads the row itself and
 * the row says who the message is for, so the browser cannot choose a
 * recipient or write the words. An endpoint taking { user_id, title, body }
 * would be the obvious shape and would let anybody with an account put
 * anything on anybody's lock screen.
 *
 * NEVER THROWS, AND FAILURE IS NOT REPORTED TO THE PERSON WHO CLAIMED.
 *
 * The claim itself already succeeded and is what matters: the group can see
 * somebody has taken this on. Whether the other person's phone happened to be
 * reachable is not something the claimer did wrong, and an error toast about
 * it would be asking them to fix something they have no access to. The inbox
 * row is written server-side either way, so nothing is lost.
 */
export async function pushNudge(nudgeId) {
  return callNotify({ nudge_id: nudgeId })
}

/**
 * Ask the server to push to whoever is asking, and to nobody else.
 *
 * WHY THIS EXISTS.
 *
 * There was no way to test the chain alone. The button in Settings above this
 * one calls showNotification in the browser: it proves the device will paint
 * a notification and proves nothing about the server. And you cannot nudge
 * yourself to test the rest, because the endpoint refuses it and the card
 * about you is never shown to you. So finding out which link was broken took
 * two people, two phones, and a lot of guessing.
 *
 * The request carries no recipient and cannot. The server pushes to the id in
 * the verified token, so the worst anybody can do here is send themselves a
 * notification, and it writes no inbox row because a diagnostic should leave
 * nothing behind.
 */
export async function serverPushOutcome() {
  const res = await callNotify({ self_test: true })

  /* Read in the order the chain breaks, so the answer names the FIRST broken
     link rather than the last symptom. */
  if (res?.sent !== null && typeof res?.sent === 'object') return 'stale'
  if (res?.ok !== true) {
    if (res?.reason === 'signed_out') return 'signed_out'
    if (res?.reason === 'not_configured') return 'not_configured'
    return 'failed'
  }
  /* The old function answers ok: true to anything, so a body with no
     self_test echoed back is a deployment that has never heard of it. */
  if (res.self_test !== true) return 'stale'
  if (res.push === false) return 'no_keys'
  if (res.devices === 0) return 'no_device'
  if (res.delivered === 0) return 'refused'
  return 'ok'
}

/** The one POST both of the above make. */
async function callNotify(body) {
  try {
    const url = import.meta.env?.VITE_SUPABASE_URL
    if (!url) return { ok: false, reason: 'not_configured' }
    if ('nudge_id' in body && !body.nudge_id) return { ok: false, reason: 'not_configured' }

    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return { ok: false, reason: 'signed_out' }

    const res = await fetch(`${url}/functions/v1/notify`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, reason: `http_${res.status}` }
    return await res.json()
  } catch (e) {
    return { ok: false, reason: String(e?.message ?? e) }
  }
}
