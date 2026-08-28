/**
 * Turning a Plaid transaction into a budget_entry, or deciding not to.
 *
 * Pure and importless, so every rule below is testable in node without a
 * network, a bank or a key. The API route does the fetching and calls this; it
 * makes no judgements of its own.
 *
 * THE SIGN, WHICH IS THE CLASSIC WAY TO GET THIS BACKWARDS.
 *
 * Plaid's `amount` is POSITIVE when money LEAVES the account and NEGATIVE when
 * it arrives. That is the opposite of how most people read a number, and
 * budget_entry stores the sign as `kind` with a `check (amount_cents > 0)`, so
 * an unconverted Plaid amount does not merely land in the wrong column, it
 * violates the constraint and the whole import fails on a refund.
 *
 * So: positive is an expense, negative is income, and the stored figure is
 * always the absolute value in cents.
 *
 * WHY TRANSFERS ARE SKIPPED, AND WHY THAT IS THE SAME RULE AS THE CARD LESSON.
 *
 * The formation's credit card module says: log the purchase on the day of the
 * purchase, and do NOT log the repayment, because the repayment is the same
 * money moving a second time between two places that are both yours. An import
 * that pulls in every row from a linked bank does exactly the thing the lesson
 * tells people not to do, and does it automatically, thousands of rows at a
 * time. 50 of groceries on the card plus the 100 that settles the card is 150
 * counted for a month where 100 was spent.
 *
 * A transfer between your own accounts is not a spend. It is skipped, it is
 * counted, and the screen says how many were skipped and why, because silently
 * dropping rows from somebody's bank statement is its own kind of lie.
 *
 * WHY PENDING TRANSACTIONS ARE SKIPPED.
 *
 * Plaid returns a pending row and then, days later, a POSTED row for the same
 * purchase with a DIFFERENT transaction_id. Import both and every card
 * purchase is in the budget twice, at slightly different amounts, and the
 * dedupe key cannot catch it because the two ids genuinely differ. Only posted
 * rows are imported.
 *
 * WHY A FOREIGN CURRENCY IS SKIPPED RATHER THAN CONVERTED.
 *
 * benchmarks.js: a figure that means something other than what the screen
 * implies is worse than no figure. The budget is counted in one currency. A
 * 40 EUR charge imported into a dollar budget as "40" is not a small
 * inaccuracy, it is a wrong number presented as a real one, and there is no
 * rate in this app to convert it with. peers.js refuses the same way for the
 * same reason.
 */

/** The six the budget knows. Anything else is not a category, it is a typo. */
export const CATEGORIES = ['food', 'transport', 'home', 'fun', 'health', 'other']

/**
 * Plaid's personal finance categories, mapped to the six.
 *
 * Keyed on `personal_finance_category.primary`, which is Plaid's stable
 * taxonomy, rather than on the legacy `category` array of free strings that
 * changes shape per institution.
 *
 * The mapping is lossy on purpose. Sixteen Plaid primaries into six envelopes
 * means several land on `other`, and that is the honest answer: the budget has
 * six envelopes because six is what somebody will actually maintain, not
 * because the world has six kinds of spending.
 */
export const CATEGORY_MAP = {
  FOOD_AND_DRINK: 'food',
  TRANSPORTATION: 'transport',
  TRAVEL: 'transport',
  RENT_AND_UTILITIES: 'home',
  HOME_IMPROVEMENT: 'home',
  ENTERTAINMENT: 'fun',
  GENERAL_MERCHANDISE: 'fun',
  MEDICAL: 'health',
  PERSONAL_CARE: 'health',
  GENERAL_SERVICES: 'other',
  GOVERNMENT_AND_NON_PROFIT: 'other',
  BANK_FEES: 'other',
  OTHER: 'other',
}

/**
 * The primaries that are movements between accounts rather than spending.
 *
 * LOAN_PAYMENTS is in here and it is the one worth arguing about: paying down
 * a loan is a real outflow in a way that moving money to your own savings is
 * not. It is skipped anyway, because the single most common LOAN_PAYMENTS row
 * for the people this app is for is a credit card repayment, and importing
 * that alongside the purchases it settles is the double count the card lesson
 * exists to prevent. A person who wants their loan payment in the budget can
 * add it as a fixed charge, where it belongs and where it is counted once.
 */
export const TRANSFER_PRIMARIES = ['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS']

/** Why a transaction was not imported. One of these, never a bare false. */
export const SKIP = {
  PENDING: 'pending',
  TRANSFER: 'transfer',
  CURRENCY: 'currency',
  ZERO: 'zero',
  NO_DATE: 'no-date',
}

/**
 * The category for one transaction.
 *
 * Falls back to 'other' rather than to null: the column allows null, but a
 * null category is invisible in the envelopes screen, so an unmapped Plaid
 * primary would import a real spend into a place nobody looks at.
 */
export function categoryFor(txn) {
  const primary = txn?.personal_finance_category?.primary
  if (typeof primary !== 'string') return 'other'
  return CATEGORY_MAP[primary.toUpperCase()] ?? 'other'
}

/**
 * Cents, from Plaid's decimal amount.
 *
 * Rounded rather than truncated. Plaid sends floats, and 12.29 arrives often
 * enough as 12.289999999999999 that truncating turns it into 1228 and every
 * imported figure is a cent light.
 */
export function toCents(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null
  return Math.round(Math.abs(amount) * 100)
}

/**
 * One Plaid transaction as a budget_entry, or a reason it is not one.
 *
 * Returns `{ entry }` or `{ skip }`, never a bare null, so a caller cannot
 * quietly treat "we chose not to import this" as "nothing happened".
 *
 * `currency` is the budget's own currency, and is required. Passing it as
 * undefined would make every transaction match, which is the failure this
 * argument exists to prevent, so it is checked rather than defaulted.
 */
export function mapTransaction(txn, currency) {
  if (!txn || typeof txn !== 'object') return { skip: SKIP.ZERO }

  /* Pending first, because a pending row can also be a transfer and the more
     useful thing to report is that it is not final yet. */
  if (txn.pending === true) return { skip: SKIP.PENDING }

  const primary = String(txn.personal_finance_category?.primary ?? '').toUpperCase()
  if (TRANSFER_PRIMARIES.includes(primary)) return { skip: SKIP.TRANSFER }

  /* An explicit budget currency is required; see the note above. A transaction
     with no currency of its own is skipped rather than assumed to match. */
  const want = String(currency ?? '').toUpperCase()
  const got = String(txn.iso_currency_code ?? txn.unofficial_currency_code ?? '').toUpperCase()
  if (!want || !got || want !== got) return { skip: SKIP.CURRENCY }

  const cents = toCents(txn.amount)
  /* budget_entry has check (amount_cents > 0). A zero-amount row would fail
     the insert and take the rest of the batch with it. */
  if (cents === null || cents === 0) return { skip: SKIP.ZERO }

  /* `date` is the posted date, a plain YYYY-MM-DD, which is what happened_on
     wants. authorized_date is used when present because it is the day the
     person actually spent the money, which is the day the card lesson says to
     log it on. */
  const day = dateOf(txn.authorized_date) ?? dateOf(txn.date)
  if (!day) return { skip: SKIP.NO_DATE }

  return {
    entry: {
      kind: txn.amount > 0 ? 'expense' : 'income',
      amount_cents: cents,
      category: categoryFor(txn),
      note: noteFor(txn),
      happened_on: day,
    },
  }
}

/** A plain calendar date, or null. Plaid sends 'YYYY-MM-DD' or nothing. */
function dateOf(value) {
  const s = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * What the ledger row will say.
 *
 * merchant_name when Plaid resolved one, because "TIM HORTONS #4471 MONTREAL
 * QC" is what the bank sends and "Tim Hortons" is what a person recognises.
 * Truncated to 140, which is budget_entry's own check constraint: a longer
 * note does not get rejected by the database with a useful message, it gets
 * rejected with a constraint name.
 */
export function noteFor(txn) {
  const raw = txn?.merchant_name || txn?.name || ''
  const clean = String(raw).replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, 140) : null
}

/**
 * A whole batch, with a tally of what was left out and why.
 *
 * The tally is the point. An import that says "42 transactions added" while
 * silently dropping 19 transfers has told somebody their bank has 42
 * transactions in it, which is false. Every input is accounted for in exactly
 * one bucket, and mapBatch's own test asserts that the buckets sum to the
 * input length.
 */
export function mapBatch(transactions, currency) {
  const entries = []
  const skipped = { pending: 0, transfer: 0, currency: 0, zero: 0, 'no-date': 0 }

  for (const txn of transactions ?? []) {
    const { entry, skip } = mapTransaction(txn, currency)
    if (entry) entries.push({ ...entry, plaid_transaction_id: txn.transaction_id })
    else skipped[skip] += 1
  }

  return {
    entries,
    skipped,
    total: (transactions ?? []).length,
    skippedTotal: Object.values(skipped).reduce((a, b) => a + b, 0),
  }
}
