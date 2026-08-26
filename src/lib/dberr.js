/**
 * Telling apart the three ways a Supabase call fails.
 *
 * They need different answers and they arrive looking similar, which is how a
 * form ends up showing "TypeError: Load failed" to somebody whose only problem
 * is a migration that has not been run.
 *
 * A MISSING COLUMN is a migration that has not landed yet. The app knows about
 * a field the database has never heard of. This is recoverable without anybody
 * doing anything: send the row without that field. Every other value the
 * person typed is still good.
 *
 * A NETWORK FAILURE is the request never arriving. supabase-js catches the
 * fetch rejection and hands back an error whose message is the stringified
 * TypeError, so "TypeError: Load failed" (Safari) and "TypeError: Failed to
 * fetch" (Chrome) are what a dropped connection looks like by the time it
 * reaches a component. Retrying is worth one attempt; changing the payload is
 * not, because the payload was never the problem.
 *
 * EVERYTHING ELSE is a real refusal from Postgres, and the only useful thing
 * to do with it is show it, in full, including the code.
 *
 * Pure and importless.
 */

/**
 * Does this error mean the table is not there at all?
 *
 * Which is a migration nobody has run, not a fault. PostgREST answers an
 * unknown relation with PGRST205 and Postgres itself with 42P01.
 *
 * Here rather than beside each caller because there are three of them now, and
 * the third one copying the pair of codes out of budgetData.js by hand is how a
 * set like this ends up with two members in one file and three in another.
 */
const ABSENT = new Set(['PGRST205', '42P01'])

export function isMissingTable(error) {
  if (!error) return false
  if (ABSENT.has(error.code)) return true
  const raw = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return raw.includes('pgrst205') || raw.includes('42p01')
}

/**
 * Does this error mean the database has no such column?
 *
 * PostgREST answers an unknown column on a write with PGRST204 and a message
 * naming it; Postgres itself says 42703. The name is checked too, so a missing
 * column nobody was expecting is not quietly treated as the one we were ready
 * to drop.
 */
export function isMissingColumn(error, column) {
  if (!error) return false
  const raw = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()

  const known =
    raw.includes('pgrst204') ||
    raw.includes('42703') ||
    (raw.includes('column') && (raw.includes('does not exist') || raw.includes('could not find')))

  if (!known) return false
  return column ? raw.includes(String(column).toLowerCase()) : true
}

/**
 * Did the request fail to arrive at all?
 *
 * Matched on the TypeError rather than on the wording, because the wording is
 * per engine: Safari says "Load failed", Chrome says "Failed to fetch",
 * Firefox says "NetworkError when attempting to fetch resource". supabase-js
 * also sets details to "Request failed due to network error" on this path,
 * which is checked as well for the engines that do not stringify the type.
 */
export function isNetworkError(error) {
  if (!error) return false
  const raw = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return (
    raw.includes('typeerror') ||
    raw.includes('failed to fetch') ||
    raw.includes('load failed') ||
    raw.includes('networkerror') ||
    raw.includes('network error')
  )
}

/** Longer than this and it has stopped being a message. */
export const MAX_TEXT = 220

/**
 * One line of a stack trace, which is never something to show a person.
 *
 * supabase-js puts the whole trace in `details` on a network failure, so
 * without this the form showed four frames of bundler URLs under "Failed to
 * fetch". That is not more information, it is the same information with the
 * useful part pushed off the screen.
 */
function isStackish(line) {
  return /^\s*at\s/.test(line) || /https?:\/\/\S+:\d+:\d+/.test(line)
}

/**
 * The sentence to put on screen.
 *
 * The code is included when there is one, because "PGRST204" is the difference
 * between a person who can search for their problem and a person who can only
 * describe a colour. The hint from Postgres is kept for the same reason: it is
 * written for exactly this moment and it was being thrown away.
 *
 * Deduplicated, because PostgREST often repeats the message inside details and
 * the same sentence printed twice reads as a rendering fault.
 */
export function errorText(error, max = MAX_TEXT) {
  if (!error) return ''

  const parts = []
  const seen = new Set()

  const push = (raw) => {
    /* First real line only. Everything after it in a multi-line value is a
       trace, and the first line is the sentence. */
    const text = String(raw ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !isStackish(l))[0]

    if (!text) return
    const key = text.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    parts.push(text)
  }

  if (error.code) push(`[${error.code}]`)
  push(error.message)
  push(error.details)
  push(error.hint)

  const out = parts.join(' ')
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out
}
