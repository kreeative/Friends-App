import { supabase } from './supabase'

/**
 * Celebrating somebody else.
 *
 * The only row in this app one person writes about another. Everything else in
 * the feed is written by the machine when a day closes, which is deliberate:
 * nobody reports anybody. This goes the other way, and it is the one direction
 * worth opening by hand.
 *
 * All of it is soft. A project that has not run 25_celebrations.sql yet gets a
 * check-in with no celebrate step and a board with no banner, rather than an
 * error about a relation nobody reading it has heard of. See isMissing.
 */

/** How long a celebration keeps announcing itself to the person it is about. */
export const BANNER_WINDOW_HOURS = 72

/**
 * "That table is not there" as opposed to "that went wrong".
 *
 * Same shape as isMissingProofs and isMissingTable: PostgREST reports an
 * unknown relation as PGRST205 with a schema-cache message, Postgres itself as
 * 42P01. Anything else is a real failure and must not be swallowed.
 */
export function isMissing(error) {
  const raw = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return raw.includes('pgrst205') || raw.includes('42p01') || raw.includes('schema cache')
}

/** Everything the group has celebrated lately, newest first. */
export async function loadCelebrations(groupId, limit = 12) {
  if (!groupId) return { rows: [], missing: false }

  const { data, error } = await supabase
    .from('celebrations_detail')
    .select('id, group_id, sender_id, receiver_id, message, created_at, sender_name, sender_avatar, receiver_name, receiver_avatar')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { rows: [], missing: isMissing(error) }
  return { rows: data ?? [], missing: false }
}

/**
 * Waiting for me, across every group.
 *
 * Deliberately not scoped to a group: the banner sits on the dashboard as well
 * as on a board, and the whole point is that you find out somebody said
 * something nice about you without having to go looking in the right group
 * first.
 *
 * Bounded by age as well as by seen_at. A celebration nobody opened for a
 * fortnight has stopped being news, and a banner that waits forever is one
 * people learn to dismiss without reading.
 */
export async function loadUnseen(userId) {
  if (!userId) return { rows: [], missing: false }

  const since = new Date(Date.now() - BANNER_WINDOW_HOURS * 3600 * 1000).toISOString()

  const { data, error } = await supabase
    .from('celebrations_detail')
    .select('id, group_id, message, created_at, group_name, sender_name, sender_avatar')
    .eq('receiver_id', userId)
    .is('seen_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) return { rows: [], missing: isMissing(error) }
  return { rows: data ?? [], missing: false }
}

/**
 * Send one.
 *
 * The message is trimmed here rather than at the call site so that the check
 * the database makes and the check the form makes are looking at the same
 * string. A message of nothing but spaces is refused by the constraint, and
 * finding that out from a 400 would be a poor way to learn it.
 */
export async function celebrate({ groupId, senderId, receiverId, message }) {
  const text = (message ?? '').trim()
  if (!groupId || !senderId || !receiverId || !text) return { error: 'incomplete' }
  if (senderId === receiverId) return { error: 'self' }

  const { error } = await supabase.from('celebrations').insert({
    group_id: groupId,
    sender_id: senderId,
    receiver_id: receiverId,
    message: text.slice(0, 280),
  })

  return { error: error ?? null }
}

/**
 * Mark them read.
 *
 * One update for the whole batch rather than one per row: the banner shows
 * them together and is dismissed together, so treating them separately would
 * mean a burst of writes to say one thing.
 */
export async function markSeen(ids = []) {
  if (ids.length === 0) return
  await supabase
    .from('celebrations')
    .update({ seen_at: new Date().toISOString() })
    .in('id', ids)
}
