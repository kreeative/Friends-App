/**
 * What happened to a transaction, and when.
 *
 * A budget row is the one thing in this app people go back and argue with
 * themselves about. "I thought I put forty" is a real sentence, and until now
 * the app's answer was the current value and nothing else: an edit overwrote
 * its own evidence, so a number that looked wrong was indistinguishable from a
 * number somebody had changed.
 *
 * WHY THE LOG IS WRITTEN BY A TRIGGER AND NOT BY THIS APP.
 *
 * Three reasons, and the third is the one that decided it. A client can forget
 * a code path. A client cannot see a row changed from the SQL editor or by a
 * future job. And a client that writes its own audit trail is a client that
 * can be asked not to: an audit row inserted by the same session that made the
 * change is worth exactly as much as the change. The trigger in migration 33
 * runs on every write regardless of who made it, and the log table has no
 * insert policy at all, so nothing that reaches Supabase over the API can add
 * to or edit this history.
 *
 * This file is only the reading. Pure and importless, so the diff shapes can
 * be tested without a database and without a browser.
 */

/** The actions the trigger records. Anything else is a row we do not render. */
export const ACTIONS = ['created', 'updated', 'deleted']

/**
 * The fields worth showing a change in, in the order a person reads them.
 *
 * Not every column. `created_at` never changes, `id` and `user_id` cannot, and
 * a history that lists them is a history nobody scrolls to the end of. The
 * amount is first because it is the one anybody opens this drawer for.
 */
export const FIELDS = ['amount_cents', 'kind', 'category', 'note', 'happened_on', 'excluded', 'emotions']

const RANK = new Map(FIELDS.map((f, i) => [f, i]))

/** Milliseconds, or null for anything unparseable. Sorting needs a number. */
function stamp(value) {
  const t = Date.parse(value ?? '')
  return Number.isNaN(t) ? null : t
}

/**
 * One stored change, normalised.
 *
 * The trigger writes `changes` as an array of {field, from, to}. Postgres
 * hands jsonb back already parsed, but a row that predates a column, a hand
 * written row, or a driver that stringifies would all arrive differently, so
 * this takes a string too rather than throwing inside a render.
 */
function parseChanges(raw) {
  let list = raw
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []

  return list
    .filter((c) => c && typeof c.field === 'string' && RANK.has(c.field))
    .map((c) => ({ field: c.field, from: c.from ?? null, to: c.to ?? null }))
    /* Field order, not the order Postgres happened to build the array in. Two
       edits that changed the same two things should read the same way. */
    .sort((a, b) => RANK.get(a.field) - RANK.get(b.field))
}

/**
 * The stored rows, ready to draw.
 *
 * NEWEST FIRST. A history reads backwards from now: the change somebody is
 * looking for is almost always the last one, and making them scroll to the
 * bottom to find it is making them scroll past every answer that is not it.
 *
 * An 'updated' row that changed nothing this file renders is dropped. The
 * trigger fires on any update, including one that only touched a column not in
 * FIELDS, and "modified" with no visible difference underneath reads as the
 * app having lost the detail rather than as there being none.
 */
export function readLog(rows = []) {
  return rows
    .filter((r) => r && ACTIONS.includes(r.action))
    .map((r) => ({
      id: r.id ?? null,
      action: r.action,
      at: r.at ?? r.created_at ?? null,
      ms: stamp(r.at ?? r.created_at),
      changes: parseChanges(r.changes),
    }))
    .filter((r) => r.action !== 'updated' || r.changes.length > 0)
    .sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))
}

/**
 * How a value should be rendered, without knowing the locale or the currency.
 *
 * Returns a tag and the raw value; the component owns the words and the
 * formatting. Keeping the two apart is what lets this be tested with no
 * Intl and no translation table, and it is also what stops a currency symbol
 * being baked into a string that a person may read on a different device with
 * a different currency set.
 *
 * `empty` matters more than it looks. A note cleared to null and a note that
 * was never set both arrive as null, and "changed the note from to buying
 * milk" is what happens when null renders as an empty string.
 */
export function valueShape(field, value) {
  if (value === null || value === undefined) return { tag: 'empty', value: null }
  if (field === 'amount_cents') return { tag: 'money', value: Number(value) || 0 }
  if (field === 'happened_on') return { tag: 'date', value: String(value).slice(0, 10) }
  if (field === 'excluded') return { tag: 'bool', value: value === true || value === 'true' }
  if (field === 'emotions') {
    const list = Array.isArray(value) ? value : []
    return list.length === 0 ? { tag: 'empty', value: null } : { tag: 'emotions', value: list }
  }
  if (field === 'category' || field === 'kind') return { tag: 'term', value: String(value) }

  const text = String(value).trim()
  return text ? { tag: 'text', value: text } : { tag: 'empty', value: null }
}

/**
 * Whether a change is worth a sentence of its own.
 *
 * A change from nothing to nothing is not a change. The trigger compares with
 * `is distinct from`, so it will not record one, but a row written by an older
 * version of the trigger or by hand can carry one, and a line reading "note
 * changed" with nothing on either side of it is worse than no line.
 */
export function isRealChange(change) {
  const a = valueShape(change?.field, change?.from)
  const b = valueShape(change?.field, change?.to)
  if (a.tag === 'empty' && b.tag === 'empty') return false
  return JSON.stringify(a.value) !== JSON.stringify(b.value)
}

/** The drawer's own summary line: how many entries there are to read. */
export function logCount(rows = []) {
  return readLog(rows).length
}
