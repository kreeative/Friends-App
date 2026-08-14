/**
 * node src/lib/txn.test.mjs
 *
 * The date arithmetic is the part that matters here. A local date written as a
 * UTC one is off by a day for anybody west of Greenwich after their evening,
 * and it is invisible until the last day of a period, when the spend lands in
 * the next one and the total quietly stops matching the receipts.
 */
import {
  KINDS,
  NOTE_MAX,
  blankTxn,
  fromCents,
  localISO,
  toCents,
  txnFromRow,
  txnPayload,
  txnValid,
  withoutField,
} from './txn.js'

let pass = 0
let fail = 0

function ok(name, cond) {
  if (cond) {
    pass += 1
  } else {
    fail += 1
    console.error(`  FAIL  ${name}`)
  }
}

const eq = (name, a, b) => ok(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, a === b)

console.log('\ntxn')

/* --- shape ------------------------------------------------------------- */
eq('two kinds only', KINDS.join(','), 'expense,income')
eq('note cap matches the check constraint', NOTE_MAX, 140)

/* --- toCents ----------------------------------------------------------- */
eq('plain', toCents('12.50'), 1250)
eq('comma decimal', toCents('12,50'), 1250)
eq('currency symbol', toCents('$12.50'), 1250)
eq('one decimal', toCents('12.5'), 1250)
eq('integer', toCents('40'), 4000)
eq('spaces', toCents(' 7 '), 700)
eq('rounds the half cent', toCents('0.005'), 1)
eq('empty is null', toCents(''), null)
eq('letters are null', toCents('abc'), null)
eq('undefined is null', toCents(undefined), null)
eq('negative keeps its sign', toCents('-4'), -400)

/* The bilingual pair. Both of these arrive at the same field. */
eq('en grouped', toCents('1,000'), 100000)
eq('fr grouped', toCents('1.000'), 100000)
eq('en grouped with decimals', toCents('1,000.50'), 100050)
eq('fr grouped with decimals', toCents('1.000,50'), 100050)
eq('fr spaced grouping', toCents('1 000,50'), 100050)
eq('nbsp grouping, which is what fr-CA actually emits', toCents('1 000,50'), 100050)
eq('two groups', toCents('1,234,567'), 123456700)
eq('two groups with decimals', toCents('1,234,567.89'), 123456789)
eq('a bare zero before three digits is a fraction, not a group', toCents('0.005'), 1)
eq('leading decimal point', toCents('.50'), 50)
eq('trailing separator', toCents('12.'), 1200)
eq('four decimals round', toCents('1.2345'), 123)

/* --- fromCents --------------------------------------------------------- */
eq('two decimals', fromCents(1250), '12.50')
eq('no decimals for a zero-digit currency', fromCents(50000, 0), '500')
eq('null stays empty', fromCents(null), '')
eq('undefined stays empty', fromCents(undefined), '')
eq('zero is a number, not empty', fromCents(0), '0.00')

/* --- localISO ---------------------------------------------------------- */
{
  /* Ten at night on the last day of January, in a zone behind UTC. Constructed
     with local components on purpose: this is the exact case where toISOString
     would answer February. */
  const late = new Date(2025, 0, 31, 22, 30)
  eq('late evening stays on its own day', localISO(late), '2025-01-31')

  const early = new Date(2025, 0, 1, 0, 15)
  eq('just after midnight stays on its own day', localISO(early), '2025-01-01')

  const noon = new Date(2025, 6, 4, 12, 0)
  eq('midday', localISO(noon), '2025-07-04')

  eq('pads the month and day', localISO(new Date(2025, 8, 5, 9)), '2025-09-05')
  eq('a bad date is empty, not NaN', localISO(new Date('nonsense')), '')
  eq('accepts a parseable string', localISO('2025-03-09T12:00:00'), '2025-03-09')

  /* The property that actually matters, checked against the platform rather
     than against a hand-written expectation: whatever the machine's zone, the
     answer is the calendar date the person would say it is. */
  const d = new Date(2025, 10, 30, 23, 59)
  const parts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  eq('agrees with the local calendar in any zone', localISO(d), parts)
}

/* --- blankTxn ---------------------------------------------------------- */
{
  const b = blankTxn(new Date(2025, 3, 9, 20))
  eq('starts as a spend', b.kind, 'expense')
  eq('starts empty', b.amount, '')
  eq('starts counting', b.excluded, false)
  eq('dated today, locally', b.happened_on, '2025-04-09')
  eq('no id yet', b.id, null)
  ok('a fresh one every call', blankTxn() !== blankTxn())
}

/* --- txnFromRow -------------------------------------------------------- */
{
  const row = {
    id: 'abc',
    kind: 'income',
    amount_cents: 25000,
    category: null,
    note: 'refund',
    happened_on: '2025-02-14',
    excluded: true,
  }
  const f = txnFromRow(row)
  eq('carries the id', f.id, 'abc')
  eq('carries the kind', f.kind, 'income')
  eq('amount as text', f.amount, '250.00')
  eq('null category becomes the default', f.category, 'food')
  eq('carries the note', f.note, 'refund')
  eq('carries the date', f.happened_on, '2025-02-14')
  eq('carries the flag', f.excluded, true)

  eq('honours the currency digits', txnFromRow(row, 0).amount, '250')

  /* A row written before migration 29. The flag has to come back false and
     not undefined, or React swaps the checkbox to uncontrolled mid-life. */
  const old = txnFromRow({ id: 'x', kind: 'expense', amount_cents: 100, happened_on: '2025-01-01' })
  eq('a pre-29 row is not excluded', old.excluded, false)
  eq('and it is a boolean, not undefined', typeof old.excluded, 'boolean')

  eq('a timestamp is cut back to a date', txnFromRow({ happened_on: '2025-05-06T00:00:00Z' }).happened_on, '2025-05-06')
  eq('an unknown kind falls back', txnFromRow({ kind: 'transfer' }).kind, 'expense')
  eq('no row at all is a blank form', txnFromRow(null).amount, '')
  eq('a row with no date still gets one', /^\d{4}-\d{2}-\d{2}$/.test(txnFromRow({}).happened_on), true)
}

/* --- txnValid ---------------------------------------------------------- */
{
  const good = { ...blankTxn(), amount: '10' }
  eq('a filled form is valid', txnValid(good), true)
  eq('no amount is not', txnValid({ ...good, amount: '' }), false)
  eq('zero is not', txnValid({ ...good, amount: '0' }), false)
  eq('negative is not', txnValid({ ...good, amount: '-4' }), false)
  eq('letters are not', txnValid({ ...good, amount: 'ten' }), false)
  eq('an unknown kind is not', txnValid({ ...good, kind: 'transfer' }), false)
  eq('a blank date is not', txnValid({ ...good, happened_on: '' }), false)
  eq('a half-typed date is not', txnValid({ ...good, happened_on: '2025-4' }), false)
  eq('nothing at all is not', txnValid(null), false)
  eq('income is valid too', txnValid({ ...good, kind: 'income' }), true)
}

/* --- txnPayload -------------------------------------------------------- */
{
  const form = {
    ...blankTxn(new Date(2025, 0, 5)),
    amount: '12,50',
    category: 'transport',
    note: '  bus  ',
  }
  const row = txnPayload(form, 'u1')
  eq('owner', row.user_id, 'u1')
  eq('kind', row.kind, 'expense')
  eq('cents', row.amount_cents, 1250)
  eq('category', row.category, 'transport')
  eq('note is trimmed', row.note, 'bus')
  eq('date', row.happened_on, '2025-01-05')
  eq('flag', row.excluded, false)
  ok('the id is never sent', !('id' in row))

  eq('an empty note is null, not an empty string', txnPayload({ ...form, note: '   ' }, 'u1').note, null)

  const long = 'x'.repeat(300)
  eq('a long note is cut to the limit', txnPayload({ ...form, note: long }, 'u1').note.length, NOTE_MAX)

  eq(
    'income carries no category',
    txnPayload({ ...form, kind: 'income', category: 'fun' }, 'u1').category,
    null,
  )
  eq('the flag survives', txnPayload({ ...form, excluded: true }, 'u1').excluded, true)
  eq('a truthy non-boolean flag is still a boolean', txnPayload({ ...form, excluded: 1 }, 'u1').excluded, false)

  eq('no user, no row', txnPayload(form, null), null)
  eq('no amount, no row', txnPayload({ ...form, amount: '' }, 'u1'), null)
}

/* --- withoutField ------------------------------------------------------ */
{
  const row = txnPayload({ ...blankTxn(), amount: '5' }, 'u1')
  const trimmed = withoutField(row, 'excluded')
  ok('the field is gone', !('excluded' in trimmed))
  eq('everything else survives', trimmed.amount_cents, 500)
  ok('the original is untouched', 'excluded' in row)
  ok('a field that was never there is a no-op', withoutField(row, 'nope') === row)
  eq('null in, null out', withoutField(null, 'excluded'), null)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
