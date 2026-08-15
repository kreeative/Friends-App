/**
 * One transaction, on its way in and out of the form.
 *
 * Split out of the money screen for the same reason budget.js is: this is the
 * part worth being certain about, and a pure function is testable under plain
 * node with no bundler and no browser. Pure and importless.
 *
 * WHAT A TRANSACTION IS HERE.
 *
 * An amount, a direction, a category, a note, a date, and whether it counts.
 * That is the whole of budget_entry, and it is deliberately not a ledger: there
 * are no accounts, so there is nothing for money to move between, and a
 * "transfer" with no two sides is a spend wearing a different word.
 */

/* Extension included deliberately. Vite resolves either way; node, running
   this file directly for the tests, resolves only the explicit one. */
import { DEFAULT_EMOTIONS, cleanEmotions } from './emotions.js'

/** The two directions money moves. There is no third, see above. */
export const KINDS = ['expense', 'income']

/** The database refuses longer, so the form has to refuse it first. */
export const NOTE_MAX = 140

/**
 * Today, in the person's own calendar.
 *
 * NOT `new Date().toISOString().slice(0, 10)`, which is what this screen used
 * to write. That is the UTC date, and the column is a local date: a coffee
 * bought at eight in the evening in Montréal was being filed under tomorrow,
 * which in the last four days of a period moves it into the next period
 * entirely and drops it out of the total the person is looking at.
 *
 * The offset is subtracted before the ISO string is taken rather than the
 * parts being assembled by hand, so the padding and the month's 1-based index
 * are the platform's problem and not this function's.
 */
export function localISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/**
 * Cents from a typed string.
 *
 * Always a hundredth of the unit whatever the currency: see src/lib/currency.js
 * for why the column never changes scale.
 *
 * WHY THIS IS NOT ONE REPLACE.
 *
 * It used to be `.replace(/,/g, '.')` and a parseFloat, which is right for
 * "12,50" and silently catastrophic for "1,000": parseFloat("1.000.") stops at
 * the second dot and returns 1, so somebody typing their rent the way an
 * English keyboard writes it had it stored as one dollar. In a bilingual app
 * the two conventions arrive at the same field, and both of these are real:
 *
 *   1 000,50   fr-CA        1,000.50   en-CA
 *   1.000,50   fr-FR        1,234,567  grouped
 *
 * The rule that separates them without asking: the LAST separator is the
 * decimal point, and everything before it is grouping. The one case that rule
 * cannot settle on its own is a lone separator followed by exactly three
 * digits, "1,000", which is a thousand in English and one in French. It is
 * read as a thousand, because no currency this app offers has three decimal
 * places, so "1,000" meaning one is a shape nobody types on purpose.
 *
 * Except when what precedes it is a bare zero. "0.005" is not five thousand,
 * it is somebody typing a fraction of a cent, and it rounds up to one.
 */
export function toCents(text) {
  const cleaned = String(text ?? '').replace(/[^0-9.,-]/g, '')
  if (!/\d/.test(cleaned)) return null

  const negative = cleaned.trimStart().startsWith('-')
  const body = cleaned.replace(/-/g, '')

  const cut = Math.max(body.lastIndexOf('.'), body.lastIndexOf(','))

  let whole = body
  let frac = ''

  if (cut >= 0) {
    const head = body.slice(0, cut).replace(/[.,]/g, '')
    const tail = body.slice(cut + 1)
    const grouped = tail.length === 3 && head.length > 0 && head !== '0'

    if (grouped) {
      whole = head + tail
    } else {
      whole = head
      frac = tail
    }
  }

  whole = whole.replace(/[.,]/g, '')
  const n = Number.parseFloat(`${whole || '0'}.${frac || '0'}`)
  if (!Number.isFinite(n)) return null

  return Math.round(n * 100) * (negative ? -1 : 1)
}

/** Cents back to a typed string, in as many decimals as the currency has. */
export function fromCents(cents, digits = 2) {
  return cents == null ? '' : (cents / 100).toFixed(digits)
}

/**
 * A form with nothing in it yet.
 *
 * The date defaults to today rather than being left blank, because the
 * overwhelming case is logging something that just happened and an empty date
 * field is a question nobody wanted to be asked.
 */
export function blankTxn(today = new Date()) {
  return {
    id: null,
    kind: 'expense',
    amount: '',
    category: 'food',
    note: '',
    happened_on: localISO(today),
    excluded: false,
    /* Neutral, pre-selected. See DEFAULT_EMOTIONS: the point of the tags is
       that they cost nothing, and an empty selector asks a question before the
       amount has even been typed. */
    emotions: [...DEFAULT_EMOTIONS],
  }
}

/**
 * A saved row, in the shape the fields hold it.
 *
 * `excluded` is read with a fallback rather than trusted: rows written before
 * migration 29 have no such property, and `undefined` in a checkbox is an
 * uncontrolled input three renders later.
 */
export function txnFromRow(row, digits = 2) {
  if (!row) return blankTxn()
  return {
    id: row.id ?? null,
    kind: KINDS.includes(row.kind) ? row.kind : 'expense',
    amount: fromCents(row.amount_cents, digits),
    category: row.category ?? 'food',
    note: row.note ?? '',
    happened_on: String(row.happened_on ?? '').slice(0, 10) || localISO(),
    excluded: row.excluded === true,
    /* Cleaned, not trusted, and NOT defaulted. A row written before migration
       33 has no feelings on it, and seeding neutral here would mean opening an
       old transaction to fix a typo silently tags it, so the history would
       record a change the person never made. Empty is the truth about those
       rows and has to stay empty until somebody says otherwise. */
    emotions: cleanEmotions(row.emotions),
  }
}

/** Is there enough here to save? The button asks this, and so does the write. */
export function txnValid(form) {
  const cents = toCents(form?.amount)
  if (!cents || cents <= 0) return false
  if (!KINDS.includes(form?.kind)) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form?.happened_on ?? ''))) return false
  return true
}

/**
 * The row to send, or null if the form is not ready.
 *
 * Category is dropped on income deliberately, matching what the screen has
 * always written. "Food" on money arriving is not a fact about anything, and
 * the breakdown only ever sums expenses, so a category there would be a value
 * stored and never read.
 *
 * The note is trimmed to the length the check constraint allows rather than
 * being sent long and refused. A person who pasted a paragraph gets the first
 * hundred and forty characters of it; they do not get a Postgres error.
 */
export function txnPayload(form, userId) {
  if (!userId || !txnValid(form)) return null

  const note = String(form.note ?? '').trim().slice(0, NOTE_MAX)

  return {
    user_id: userId,
    kind: form.kind,
    amount_cents: toCents(form.amount),
    category: form.kind === 'expense' ? form.category : null,
    note: note || null,
    happened_on: form.happened_on,
    excluded: form.excluded === true,
    /* Through the sanitiser on the way out as well as on the way in. The
       check constraint in migration 33 names its thirteen values, so a stale
       tab holding an id this build has dropped would otherwise fail the whole
       save on a chip nobody touched. */
    emotions: cleanEmotions(form.emotions),
  }
}

/**
 * The same row without a field the database has never heard of.
 *
 * Migration 29 adds `excluded`, and a person running last week's schema would
 * otherwise have every save fail with PGRST204 on a checkbox they did not
 * touch. Dropping the field loses the flag, which is the correct trade: the
 * amount, the date and the note are what they typed, and a row saved without
 * its flag beats a row not saved at all. See src/lib/dberr.js.
 */
export function withoutField(row, field) {
  if (!row || !(field in row)) return row
  const out = { ...row }
  delete out[field]
  return out
}
