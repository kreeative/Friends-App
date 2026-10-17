import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { logAdd, logPending, logSent, totalsOf } from '../lib/bb/pomodoro'

/**
 * STUDY TIME. "Comme ca l'app calcule au total combien de temps tu passes"
 * (Kee): one row per stretch of focus (migration 83, bb_focus), the moment
 * it began and its seconds, from the timer, a session or a mock exam.
 *
 * Kept in this browser first and sent when it can be, like the answers in
 * data.js: a block that ends on the metro is not lost, and the rows wait
 * here until migration 83 has run. A row is known by its start, in the
 * browser and in the table (its key), so a block that two tabs both saw end
 * is counted once.
 *
 * The totals (today, this week from Monday, in all) come from the database
 * (bb_focus_totals, in the student's own time zone), plus what is still
 * waiting here; from this browser's log alone when the database cannot
 * answer.
 */
const KEY = (user) => `hakkilo.focus.${user}`

const read = (user) => {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY(user)) ?? '[]')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}
const write = (user, rows) => {
  try {
    localStorage.setItem(KEY(user), JSON.stringify(rows))
  } catch {
    /* storage blocked: the rows of this visit are sent or lost with it */
  }
}

const EMPTY = { today: 0, week: 0, total: 0, ready: false }
let totals = EMPTY
let current = null
let sending = false
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

async function refresh(user = current) {
  if (!user) return
  const rows = read(user)
  const { data, error } = await supabase.rpc('bb_focus_totals', { tz: zone() })
  if (user !== current) return
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) {
    totals = { ...totalsOf(rows), ready: true }
  } else {
    const waiting = totalsOf(logPending(rows))
    totals = {
      today: (Number(row.today) || 0) + waiting.today,
      week: (Number(row.week) || 0) + waiting.week,
      total: (Number(row.total) || 0) + waiting.total,
      ready: true,
    }
  }
  emit()
}

/** Send what waits. Safe to call often: a row already in the table is skipped there. */
export async function flushFocus(user = current) {
  if (!user || sending) return
  const waiting = logPending(read(user))
  if (!waiting.length) return refresh(user)
  sending = true
  try {
    const { error } = await supabase
      .from('bb_focus')
      .upsert(
        waiting.map(({ started_at, seconds, source }) => ({ user_id: user, started_at, seconds, source })),
        { onConflict: 'user_id,started_at', ignoreDuplicates: true },
      )
    if (!error) write(user, logSent(read(user), waiting.map((r) => r.started_at)))
  } catch {
    /* offline: they wait for the next try */
  } finally {
    sending = false
  }
  return refresh(user)
}

/** A stretch of focus is over: kept here at once, sent right after. */
export function logFocus(user, row) {
  if (!user || !row) return
  write(user, logAdd(read(user), row))
  if (user === current) {
    totals = { ...totals, ...addTo(totals, row) }
    emit()
  }
  flushFocus(user)
}

const addTo = (t, row) => {
  const one = totalsOf([row])
  return { today: t.today + one.today, week: t.week + one.week, total: t.total + one.total }
}

/** Whose log this is: set by the app when the account is known, then sent and counted. */
export function focusUser(user) {
  if (user === current) return
  current = user ?? null
  totals = EMPTY
  emit()
  if (current) flushFocus(current)
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** { today, week, total } in seconds, and `ready` once they are known. */
export function useFocusTotals() {
  const value = useSyncExternalStore(subscribe, () => totals, () => EMPTY)
  useEffect(() => {
    if (!value.ready) refresh()
  }, [value.ready])
  return value
}

/* The network came back: what waited goes. */
if (typeof window !== 'undefined') window.addEventListener('online', () => flushFocus())
