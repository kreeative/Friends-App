import { supabase } from './supabase'

/**
 * Offline queue for check-ins.
 *
 * A check-in gets written to localStorage first and sent second, so a dead
 * connection in a stairwell never loses one. Replay is safe because
 * submit_checkin() upserts on (cycle_id, user_id). Sending the same entry
 * twice updates one row instead of creating two, which means we never have to
 * work out whether the first attempt actually landed.
 */

const KEY = 'friends.checkin.queue.v1'
const listeners = new Set()

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Storage full or disabled. The check-in still goes out over the network
    // below; it just isn't durable across a reload, which beats throwing in
    // the middle of a submit.
  }
  listeners.forEach((fn) => fn(items.length))
}

export function pendingCount() {
  return read().length
}

export function onPendingChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function enqueue(entry) {
  const items = read().filter((i) => i.cycle_id !== entry.cycle_id)
  items.push({ ...entry, queued_at: Date.now() })
  write(items)
}

let flushing = false

export async function flush() {
  if (flushing || !navigator.onLine) return { sent: 0, failed: read().length }
  flushing = true
  let sent = 0

  try {
    for (const entry of read()) {
      const { error } = await supabase.rpc('submit_checkin', {
        p_cycle_id: entry.cycle_id,
        p_next_commitment: entry.next_commitment ?? null,
        p_note: entry.note ?? null,
        p_items: entry.items ?? [],
        p_mood: entry.mood ?? null,
      })

      if (error) {
        // A rejected write (closed cycle, revoked membership) will never
        // succeed on retry. Drop it rather than looping on it forever.
        const permanent = error.code === '42501' || error.code === '23514' || error.code === '23503'
        if (!permanent) break
      }
      write(read().filter((i) => i.cycle_id !== entry.cycle_id))
      sent += 1
    }
  } finally {
    flushing = false
  }

  return { sent, failed: read().length }
}

/** Try to drain whenever the browser says we are back online. */
export function startAutoFlush() {
  const attempt = () => flush().catch(() => {})
  window.addEventListener('online', attempt)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') attempt()
  })
  attempt()
  return () => window.removeEventListener('online', attempt)
}
