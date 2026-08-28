/**
 * node src/lib/plaidMap.test.mjs
 *
 * The three things that make an import wrong in a way nobody notices:
 *
 * THE SIGN. Plaid's amount is positive when money leaves. Get it backwards and
 * every expense is income, the budget says you are rich, and the check
 * constraint on amount_cents does not save you because the absolute value is
 * still positive. Asserted in both directions.
 *
 * THE DOUBLE COUNT. A credit card repayment is a transfer, and importing it
 * alongside the purchases it settles is exactly what the formation's card
 * module tells people not to do. Asserted as a whole realistic month.
 *
 * THE SILENT DROP. Everything not imported has to be counted and named. An
 * import that reports "42 added" while dropping 19 rows has lied about the
 * contents of somebody's bank account.
 */
import {
  CATEGORIES,
  CATEGORY_MAP,
  SKIP,
  TRANSFER_PRIMARIES,
  categoryFor,
  mapBatch,
  mapTransaction,
  noteFor,
  toCents,
} from './plaidMap.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/** A posted, in-currency, non-transfer transaction. Override what you need. */
const txn = (over = {}) => ({
  transaction_id: 'tx_1',
  amount: 12.5,
  iso_currency_code: 'CAD',
  date: '2026-08-20',
  pending: false,
  name: 'SOME MERCHANT',
  personal_finance_category: { primary: 'FOOD_AND_DRINK' },
  ...over,
})

/* --- the sign ---------------------------------------------------------------
   The whole reason this file exists. */

{
  const out = mapTransaction(txn({ amount: 12.5 }), 'CAD')
  ok('money leaving the account is an expense', out.entry?.kind === 'expense', JSON.stringify(out))
  ok('and is stored positive', out.entry?.amount_cents === 1250, String(out.entry?.amount_cents))

  const inc = mapTransaction(txn({ amount: -2000 }), 'CAD')
  ok('money arriving is income', inc.entry?.kind === 'income', JSON.stringify(inc))
  ok('and is ALSO stored positive, because the column checks > 0',
     inc.entry?.amount_cents === 200000, String(inc.entry?.amount_cents))

  /* A refund is a negative amount on an expense-looking merchant. It is
     income, and that is correct: the money came back. */
  const refund = mapTransaction(
    txn({ amount: -45.99, personal_finance_category: { primary: 'GENERAL_MERCHANDISE' } }), 'CAD')
  ok('a refund is income, not a negative expense',
     refund.entry?.kind === 'income' && refund.entry?.amount_cents === 4599,
     JSON.stringify(refund.entry))

  /* Plaid sends floats. 12.29 arrives as 12.289999999999999 often enough that
     truncating would make every imported amount a cent light. */
  ok('float noise rounds rather than truncates', toCents(12.289999999999999) === 1229,
     String(toCents(12.289999999999999)))
  ok('and so does the other direction', toCents(0.1 + 0.2) === 30, String(toCents(0.1 + 0.2)))
  ok('a non-number has no cents', toCents(undefined) === null && toCents(NaN) === null)
}

/* --- the double count ------------------------------------------------------- */

{
  for (const primary of TRANSFER_PRIMARIES) {
    const out = mapTransaction(txn({ personal_finance_category: { primary } }), 'CAD')
    ok(`${primary} is skipped as a transfer`, out.skip === SKIP.TRANSFER, JSON.stringify(out))
  }

  /* THE SCENARIO FROM THE CARD LESSON, END TO END.
     50 of groceries on the card, then 100 leaving the bank to settle the card.
     The lesson says the month cost 100 and the groceries must be counted once.
     Import both and the budget says 150. */
  const month = [
    txn({ transaction_id: 'a', amount: 50, personal_finance_category: { primary: 'FOOD_AND_DRINK' } }),
    txn({ transaction_id: 'b', amount: 50, personal_finance_category: { primary: 'GENERAL_MERCHANDISE' } }),
    txn({ transaction_id: 'c', amount: 100, personal_finance_category: { primary: 'LOAN_PAYMENTS' } }),
  ]
  const { entries, skipped } = mapBatch(month, 'CAD')
  const total = entries.reduce((s, e) => s + e.amount_cents, 0)
  ok('the card repayment does not enter the budget', entries.length === 2, String(entries.length))
  ok('so the month totals what was spent, not spent plus settled',
     total === 10000, `${total} cents`)
  ok('and the skip is reported as a transfer', skipped.transfer === 1, JSON.stringify(skipped))
}

/* --- pending --------------------------------------------------------------- */

{
  const out = mapTransaction(txn({ pending: true }), 'CAD')
  ok('a pending transaction is skipped', out.skip === SKIP.PENDING, JSON.stringify(out))

  /* The failure this prevents: Plaid returns the pending row, then later the
     posted row with a DIFFERENT id. Both would be imported and the dedupe key
     cannot catch it, because the two ids genuinely differ. */
  const pair = [
    txn({ transaction_id: 'pending_x', amount: 42.0, pending: true }),
    txn({ transaction_id: 'posted_y', amount: 42.0, pending: false, pending_transaction_id: 'pending_x' }),
  ]
  const { entries } = mapBatch(pair, 'CAD')
  ok('a purchase that is both pending and posted is imported once',
     entries.length === 1 && entries[0].plaid_transaction_id === 'posted_y',
     JSON.stringify(entries))
}

/* --- currency --------------------------------------------------------------- */

{
  const eur = mapTransaction(txn({ iso_currency_code: 'EUR' }), 'CAD')
  ok('a euro charge is not imported into a dollar budget', eur.skip === SKIP.CURRENCY)

  /* The argument is required. Defaulting it would make everything match, which
     is the exact failure the argument exists to prevent. */
  ok('no budget currency means nothing matches', mapTransaction(txn(), undefined).skip === SKIP.CURRENCY)
  ok('and a transaction with no currency is skipped, not assumed',
     mapTransaction(txn({ iso_currency_code: null }), 'CAD').skip === SKIP.CURRENCY)

  ok('case does not decide it', mapTransaction(txn({ iso_currency_code: 'cad' }), 'CAD').entry !== undefined)
  ok('the unofficial code counts when there is no ISO one',
     mapTransaction(txn({ iso_currency_code: null, unofficial_currency_code: 'CAD' }), 'CAD').entry !== undefined)
}

/* --- categories ------------------------------------------------------------- */

{
  ok('every mapped category is one the budget knows',
     Object.values(CATEGORY_MAP).every((c) => CATEGORIES.includes(c)),
     JSON.stringify([...new Set(Object.values(CATEGORY_MAP))]))

  ok('food maps to food', categoryFor(txn()) === 'food')
  ok('travel folds into transport',
     categoryFor(txn({ personal_finance_category: { primary: 'TRAVEL' } })) === 'transport')
  ok('rent and utilities fold into home',
     categoryFor(txn({ personal_finance_category: { primary: 'RENT_AND_UTILITIES' } })) === 'home')

  /* An unmapped primary must land somewhere visible. Null is allowed by the
     column and would hide a real spend from the envelopes screen. */
  ok('an unknown Plaid category becomes other, never null',
     categoryFor(txn({ personal_finance_category: { primary: 'SOMETHING_NEW' } })) === 'other')
  ok('and so does a transaction with no category at all',
     categoryFor({}) === 'other' && categoryFor(null) === 'other')
}

/* --- the note --------------------------------------------------------------- */

{
  ok('the merchant name wins over the raw bank string',
     noteFor({ merchant_name: 'Tim Hortons', name: 'TIM HORTONS #4471 MONTREAL QC' }) === 'Tim Hortons')
  ok('and the raw string is used when there is no merchant',
     noteFor({ name: 'INTERAC E-TRANSFER' }) === 'INTERAC E-TRANSFER')
  ok('whitespace is collapsed', noteFor({ name: 'A   B\n C' }) === 'A B C')

  /* budget_entry has check (note is null or length(note) <= 140). Going over
     it fails the insert with a constraint name, not a useful message. */
  const long = noteFor({ name: 'x'.repeat(400) })
  ok('a long note is cut to the 140 the column allows', long.length === 140, String(long.length))
  ok('an empty note is null rather than an empty string', noteFor({}) === null)
}

/* --- the date --------------------------------------------------------------- */

{
  /* The day you spent it, not the day the bank settled it. This is the rule
     the card lesson states, applied to the import. */
  const out = mapTransaction(txn({ date: '2026-08-25', authorized_date: '2026-08-20' }), 'CAD')
  ok('the authorised date wins, because that is the day it was spent',
     out.entry?.happened_on === '2026-08-20', out.entry?.happened_on)

  const posted = mapTransaction(txn({ date: '2026-08-25', authorized_date: null }), 'CAD')
  ok('and the posted date is used when there is no authorised one',
     posted.entry?.happened_on === '2026-08-25', posted.entry?.happened_on)

  ok('a transaction with no usable date is skipped, not dated today',
     mapTransaction(txn({ date: null, authorized_date: null }), 'CAD').skip === SKIP.NO_DATE)
  ok('and neither is a malformed one',
     mapTransaction(txn({ date: 'August 2026', authorized_date: null }), 'CAD').skip === SKIP.NO_DATE)
}

/* --- nothing is dropped silently -------------------------------------------- */

{
  const mixed = [
    txn({ transaction_id: '1' }),
    txn({ transaction_id: '2', pending: true }),
    txn({ transaction_id: '3', personal_finance_category: { primary: 'TRANSFER_OUT' } }),
    txn({ transaction_id: '4', iso_currency_code: 'EUR' }),
    txn({ transaction_id: '5', amount: 0 }),
    txn({ transaction_id: '6', date: null, authorized_date: null }),
  ]
  const r = mapBatch(mixed, 'CAD')

  /* THE INVARIANT. Every input lands in exactly one bucket. Without this a
     future skip reason can be added, forgotten in the tally, and the screen
     reports a number smaller than the truth with nothing to show for it. */
  ok('every transaction is either imported or counted as skipped',
     r.entries.length + r.skippedTotal === r.total,
     `${r.entries.length} + ${r.skippedTotal} != ${r.total}`)
  ok('and the reasons are itemised', JSON.stringify(r.skipped)
     === JSON.stringify({ pending: 1, transfer: 1, currency: 1, zero: 1, 'no-date': 1 }),
     JSON.stringify(r.skipped))

  ok('the imported row carries its Plaid id so a re-sync cannot duplicate it',
     r.entries[0].plaid_transaction_id === '1')

  ok('an empty batch is not an error', mapBatch([], 'CAD').total === 0)
  ok('and neither is a missing one', mapBatch(undefined, 'CAD').entries.length === 0)
}

console.log(`\nplaidMap\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
