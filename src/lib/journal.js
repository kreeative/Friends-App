import { supabase } from './supabase'
import { isBlank } from './ink'
import { ITERATIONS, cryptoReady, hashPin, makeLock, verifyPin } from './lock'

/**
 * The journal's data layer.
 *
 * Everything here is scoped to one person by the database rather than by this
 * file: see supabase/27_journal.sql, where all four policies are
 * `user_id = auth.uid()` with no group in the predicate anywhere. The queries
 * below still pass the id, because a query that says what it means is easier
 * to read than one relying on a policy to narrow it, but the id is not what
 * makes it private.
 *
 * All of it is soft against an unrun migration, the same way celebrations and
 * proofs are: a project that has not run 27 yet gets a journal that says it
 * needs installing, not a stack trace about a relation nobody reading it has
 * heard of.
 */

/**
 * "That table is not there" as opposed to "that went wrong".
 *
 * PostgREST reports an unknown relation as PGRST205 with a schema-cache
 * message, Postgres itself as 42P01. Anything else is a real failure and must
 * not be swallowed into a friendly empty state.
 */
export function isMissing(error) {
  const raw = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return raw.includes('pgrst205') || raw.includes('42p01') || raw.includes('schema cache')
}

const COLUMNS = 'id, user_id, day, kind, body, ink, mood, created_at, updated_at'

/**
 * Every entry, newest day first.
 *
 * Ordered by `day` and not by `created_at`, because the grid is a calendar of
 * what happened rather than a log of when it was typed. Writing up Sunday on
 * Tuesday puts it under Sunday, which is where somebody looking for Sunday
 * will look. created_at only breaks ties within a day.
 */
export async function loadEntries(userId, limit = 200) {
  if (!userId) return { rows: [], missing: false, error: null }

  const { data, error } = await supabase
    .from('journal_entries')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('day', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { rows: [], missing: isMissing(error), error }
  return { rows: data ?? [], missing: false, error: null }
}

/**
 * Write one entry, new or edited.
 *
 * Insert and update rather than upsert on a natural key, because there is no
 * natural key: several entries can share a day on purpose. A morning page and
 * something at midnight are two entries about the same Tuesday, and collapsing
 * them because they share a date would delete one of them.
 */
export async function saveEntry({ id, userId, day, kind, body, ink, mood }) {
  const row = {
    day,
    kind,
    /* Null rather than an empty string. The not-empty constraint reads
       `length(trim(body)) > 0`, and a row storing "" is a row claiming to have
       a body that renders as nothing. */
    body: body?.trim() ? body.trim() : null,
    /* A blank canvas is not a drawing. Sending `{strokes: []}` would satisfy
       `ink is not null` and produce an entry that opens on an empty page. */
    ink: kind === 'ink' && !isBlank(ink) ? ink : null,
    mood: mood || null,
  }

  if (id) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(row)
      .eq('id', id)
      .select(COLUMNS)
      .single()
    return { row: data ?? null, error }
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ ...row, user_id: userId })
    .select(COLUMNS)
    .single()
  return { row: data ?? null, error }
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id)
  return { error }
}

// ---------------------------------------------------------------------------
// The passcode.
// ---------------------------------------------------------------------------

/**
 * The lock record, or null if there is no passcode set.
 *
 * `maybeSingle` rather than `single`: having no passcode is the default state
 * of every account, and treating the ordinary case as an error means the
 * journal reports a failure to everybody who has never opened this setting.
 */
export async function loadLock(userId) {
  if (!userId) return { lock: null, missing: false }

  const { data, error } = await supabase
    .from('journal_locks')
    .select('user_id, hash, salt, iterations')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { lock: null, missing: isMissing(error) }
  return { lock: data ?? null, missing: false }
}

/**
 * Set or change the passcode.
 *
 * The hash is computed here, on the device, and the passcode itself never
 * leaves it. That is not much protection on its own, since the server could
 * serve different code tomorrow, but sending four digits over the wire to be
 * hashed by somebody else would be pointless in a way this at least is not.
 */
export async function setPasscode(userId, pin) {
  if (!cryptoReady()) return { error: { message: 'crypto-unavailable' } }

  const lock = await makeLock(pin, ITERATIONS)
  const { error } = await supabase
    .from('journal_locks')
    .upsert({ user_id: userId, ...lock }, { onConflict: 'user_id' })

  return { error, lock: error ? null : lock }
}

/**
 * Turn the passcode off.
 *
 * The row is deleted rather than a flag being flipped, so "no passcode" is the
 * absence of a record instead of a record that says it does not count. One
 * fewer state for anything to get wrong.
 */
export async function clearPasscode(userId) {
  const { error } = await supabase.from('journal_locks').delete().eq('user_id', userId)
  return { error }
}

/** Does this passcode open that lock? Re-exported so callers need one import. */
export { verifyPin, hashPin }

// ---------------------------------------------------------------------------
// Staying open.
// ---------------------------------------------------------------------------

const OPEN_KEY = 'friends.journal.open'

/**
 * Unlocked for this tab, and no longer.
 *
 * sessionStorage rather than localStorage on purpose. Unlocking should survive
 * what somebody does inside one sitting, which is navigating to the board and
 * back and reloading when something looks stale; it should not survive closing
 * the app. localStorage would mean a passcode you type once and never again,
 * which is a passcode that is not doing anything.
 *
 * Wrapped in try/catch because storage throws in Safari private mode, and an
 * exception here would take down the page rather than merely asking for four
 * digits again.
 */
export function isOpen() {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markOpen() {
  try {
    sessionStorage.setItem(OPEN_KEY, '1')
  } catch {
    /* The journal simply asks again on the next navigation. */
  }
}

export function markClosed() {
  try {
    sessionStorage.removeItem(OPEN_KEY)
  } catch {
    /* Nothing to clear if nothing could be stored. */
  }
}

/** The keypad's memory of wrong guesses, kept per device. */
const ATTEMPTS_KEY = 'friends.journal.attempts'

export function loadAttempts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? 'null')
    if (raw && typeof raw.fails === 'number') return raw
  } catch {
    /* Corrupt or unavailable is the same as a clean slate. */
  }
  return { fails: 0, until: 0 }
}

export function saveAttempts(record) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(record))
  } catch {
    /* Without storage the throttle lasts one page life, which is still the
       length of a person standing there guessing. */
  }
}
