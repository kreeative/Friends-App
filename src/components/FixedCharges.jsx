import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT, localeTag } from '../lib/i18n'
import { money } from '../lib/money'
import { localISO } from '../lib/txn'
import { dateFull } from '../lib/datecaps'
import { errorText, isMissingColumn } from '../lib/dberr'

/**
 * The charges you have not paid yet, and the ones you have.
 *
 * These existed only inside the setup form, which is a place you visit once.
 * So the app knew that rent was five hundred a month and had no way to be told
 * that this month's rent had gone out, which is why it subtracted all of it
 * from the moment it was typed in: with no way to say "paid", the only two
 * choices were always-owed or never-owed, and the code picked a third that was
 * neither, treating the money as already spent.
 *
 * A charge is Prévu until somebody says otherwise. Marking it paid writes
 * today's date to last_paid_on (migration 35), which makes it stop being held
 * back out of what is available. The date, not a flag, so the whole set comes
 * due again by itself when the period rolls over. See the note on that
 * migration.
 *
 * IT LOGS THE TRANSACTION TOO, AND THAT IS A CORRECTION.
 *
 * This used to write only the date, with a comment here arguing that also
 * logging a transaction would double-count for anybody who then logged it by
 * hand. That risk is real and it was the wrong thing to optimise for, because
 * the DEFAULT path was giving a wrong number. Measured, on a 3 000 income with
 * a 1 000 rent:
 *
 *   before Payer   reste a depenser = 2 000
 *   after  Payer   reste a depenser = 3 000
 *
 * Paying the rent made the app say there was a thousand more to spend.
 * available = (earned - spent) - fixedDue, so moving a charge out of fixedDue
 * without moving anything into spent lifts the answer by exactly the charge.
 * Both halves move or neither does.
 *
 * Now both move: the tap writes the date AND the ledger line, available stays
 * put, and the transaction that really happened is in the log where somebody
 * can see it. Un-tapping removes the line it wrote.
 *
 * WHICH LINE IT WROTE IS REMEMBERED, NOT GUESSED.
 *
 * budget_fixed.paid_entry_id (migration 43). Finding it again by matching
 * label, amount and date would also match a spend the person entered
 * themselves for the same rent on the same day, and deleting somebody's own
 * row because it resembles ours is not a tidy-up.
 *
 * AND THE PERSON IS TOLD NOT TO LOG IT TWICE.
 *
 * Which is the other half of the fix, and it lives in the guide: see
 * money.guide_* in i18n and the note under this list.
 */
export default function FixedCharges({ fixed = [], s, locale, onChange }) {
  const { t } = useT()
  const tag = localeTag(locale)
  const fmt = (c) => money(c, s.currency, locale)

  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const live = fixed.filter((f) => f.active !== false)
  if (live.length === 0) return null

  /* Paid means paid in THIS period, which is the same test summarise applies,
     so the badge and the arithmetic can never disagree about a charge. */
  const paidThisPeriod = (f) => {
    const d = String(f.last_paid_on ?? '').slice(0, 10)
    if (!d) return false
    return d >= localISO(s.period.start) && d < localISO(s.period.end)
  }

  async function toggle(row) {
    if (busy) return
    setBusy(row.id)
    setError(null)

    const paying = !paidThisPeriod(row)
    const next = paying ? localISO(new Date()) : null
    const patch = { last_paid_on: next }

    /**
     * The ledger line, written before the charge is marked.
     *
     * This order matters. If the entry is written and the update then fails,
     * the worst case is an orphan transaction the person can see and delete.
     * The other order leaves a charge marked paid with no money having moved,
     * which is the silent version of the exact bug being fixed.
     *
     * `home` because the six categories are a life's categories and a fixed
     * charge is a standing cost of living in it. The note carries the charge's
     * own name, so the row reads "Loyer" in the log rather than "home".
     */
    if (paying) {
      const { data, error: failedEntry } = await supabase
        .from('budget_entry')
        .insert({
          user_id: row.user_id,
          kind: 'expense',
          amount_cents: row.amount_cents,
          category: 'home',
          note: row.label,
          happened_on: next,
        })
        .select('id')
        .single()

      if (failedEntry) {
        setBusy(null)
        return setError(errorText(failedEntry))
      }
      patch.paid_entry_id = data.id
    }

    const { error: failed } = await supabase
      .from('budget_fixed')
      .update(patch)
      .eq('id', row.id)

    /* Un-paying removes the line the tap created, and only that line. A row
       the person typed themselves is not touched, because it is not the id
       the charge remembers. */
    if (!failed && !paying && row.paid_entry_id) {
      await supabase.from('budget_entry').delete().eq('id', row.paid_entry_id)
    }

    setBusy(null)
    if (failed) {
      /* Migration 35 not run yet. Saying which one is the difference between
         a person fixing it in a minute and filing a bug. */
      setError(
        /* Same split as everywhere else: the calm sentence on screen, the
           migration name in the console where somebody can act on it. */
        isMissingColumn(failed, 'last_paid_on')
          ? (console.warn('last_paid_on is missing: run supabase/35_fixed_paid.sql'), t('money.paid_unavailable'))
          : isMissingColumn(failed, 'paid_entry_id')
            ? (console.warn('paid_entry_id is missing: run supabase/43_fixed_charge_entry.sql'), t('money.paid_unavailable'))
            : errorText(failed),
      )
      return
    }
    await onChange?.()
  }

  return (
    <div className="glass-card divide-y divide-hairline rounded-3xl px-5">
      {live.map((f) => {
        const paid = paidThisPeriod(f)
        return (
          <div key={f.id} className="flex items-center justify-between gap-3 py-3.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-ink">{f.label}</span>
              <span className="mt-0.5 block text-small text-muted [font-variant-numeric:tabular-nums]">
                {fmt(f.amount_cents)}
                {paid && f.last_paid_on ? ` · ${dateFull(f.last_paid_on, tag) ?? ''}` : ''}
              </span>
            </span>

            {/* The badge IS the button. A chip that says the state and a
                separate control to change it would be two things where one
                will do, and on a list of five charges that is five extra
                targets on a screen that is mostly reading. */}
            <button
              type="button"
              onClick={() => toggle(f)}
              disabled={busy !== null}
              aria-pressed={paid}
              /**
               * The row's name and amount, then what pressing does.
               *
               * Without it the button announces "Payer" or "Paye", which
               * differ by one syllable and neither says WHICH charge, on a
               * list where every row has the same two buttons. The visible
               * label is the short one because it sits in a 3.5rem chip; the
               * spoken one has room to be a sentence.
               */
              aria-label={t(paid ? 'money.unmark_paid_a11y' : 'money.mark_paid_a11y', {
                label: f.label,
                amount: fmt(f.amount_cents),
              })}
              /**
               * A RING, BECAUSE A CONTROL HAS TO LOOK LIKE ONE AT REST.
               *
               * The unpaid state was `bg-accent/12 text-muted`: a 12 % wash of
               * the accent on a white card, which measures about 1.1:1 against
               * it. WCAG 1.4.11 asks 3:1 of anything needed to identify a
               * control, so there was nothing at rest saying this was
               * pressable, and the word inside it read as a status label. That
               * is the same fault AmountTile records about its own border, and
               * the same answer: ink at 50 %, which is measured rather than
               * guessed at.
               *
               * The paid state keeps its green, because green there is a fact
               * about the world rather than a matter of taste. Its ring goes to
               * the same weight so the two states differ by colour AND by
               * having been filled, not by whether they have an edge at all.
               */
              className={`press shrink-0 rounded-pill px-3.5 py-2 text-small font-semibold transition-colors duration-200 ease-settle disabled:opacity-50 ${
                paid
                  ? 'bg-green/[0.16] text-ink ring-1 ring-inset ring-green/70'
                  : 'bg-transparent text-ink ring-1 ring-inset ring-ink/50 hover:bg-ink/[0.05]'
              }`}
            >
              {busy === f.id ? '…' : paid ? t('money.paid') : t('money.planned_badge')}
            </button>
          </div>
        )
      })}

      {error && (
        <p className="break-words py-3 text-small text-negative" role="alert">
          {error}
        </p>
      )}

      {/**
       * THE CREDIT CARD RULE, WHERE THE BUTTON IS.
       *
       * Tapping Payer now writes the ledger line itself, which is what makes
       * the arithmetic right. It also creates exactly one way to get it wrong:
       * entering the same charge again by hand, which counts the money twice.
       *
       * The commonest version of that is a credit card. You buy groceries on
       * the card and log 50, then you transfer 100 from your account to clear
       * the card and log that too. The 50 is now counted twice and the account
       * transfer was never a new expense at all.
       *
       * So the rule is written at the foot of the list rather than in a guide
       * somebody would have to go and find. It is the last thing under the
       * buttons it is about.
       */}
      <details className="group py-3" data-hook="fixed-card-rule">
        <summary
          className="press flex cursor-pointer list-none items-center justify-between gap-3 py-1
                     text-label font-semibold text-muted [&::-webkit-details-marker]:hidden"
        >
          {t('money.card_rule_title')}
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center transition-transform duration-200 ease-settle group-open:rotate-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </summary>
        <p className="pb-1 text-small leading-relaxed text-ink">{t('money.card_rule_1')}</p>
        <p className="mt-3 text-small leading-relaxed text-ink">{t('money.card_rule_2')}</p>
        <p className="mt-3 text-small leading-relaxed text-muted">{t('money.card_rule_3')}</p>
      </details>

    </div>
  )
}
