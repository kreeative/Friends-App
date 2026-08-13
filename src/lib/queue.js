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

/** A refusal that will never succeed on retry, however many times it is sent. */
function isPermanent(error) {
  return error?.code === '42501' || error?.code === '23514' || error?.code === '23503'
}

/**
 * Send everything queued, and say what happened.
 *
 * TWO THINGS WERE WRONG HERE.
 *
 * The error was thrown away. Every caller got back a count and nothing else,
 * so a check-in the server had refused produced "kept on this device, it will
 * send when you are back online" no matter what the server had actually said.
 * That sentence is right for a dead connection and a lie for a constraint
 * violation, and there was no way to tell them apart from the outside. The
 * last error now comes back with the counts.
 *
 * And a permanent refusal counted as a success. The old loop dropped the
 * entry, as it should, and then fell through to `sent += 1`, so a check-in
 * that Postgres had rejected outright was reported as sent, the screen
 * celebrated, and the row was never written. That is the worst of the three
 * outcomes because nothing anywhere says it happened. Rejections are now
 * counted separately and returned.
 */
export async function flush() {
  if (flushing) return { sent: 0, rejected: 0, failed: read().length, error: null }
  if (!navigator.onLine) {
    return {
      sent: 0,
      rejected: 0,
      failed: read().length,
      /* Shaped like a Postgres error so callers have one thing to format. */
      error: read().length ? { code: 'OFFLINE', message: 'The device reports no connection.' } : null,
    }
  }

  flushing = true
  let sent = 0
  let rejected = 0
  let last = null

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
        last = error
        /* A rejected write (closed cycle, revoked membership, a constraint)
           will never succeed on retry, so it comes out of the queue rather
           than looping on it forever. It is not a send, and it is reported. */
        if (!isPermanent(error)) break
        write(read().filter((i) => i.cycle_id !== entry.cycle_id))
        rejected += 1
        continue
      }

      write(read().filter((i) => i.cycle_id !== entry.cycle_id))
      sent += 1
    }
  } finally {
    flushing = false
  }

  return { sent, rejected, failed: read().length, error: last }
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
