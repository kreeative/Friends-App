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
 * WHY THIS DOES NOT ALSO LOG A TRANSACTION.
 *
 * Because they are two different claims and somebody may want either, or both.
 * "The rent went out" is a fact about a plan being met; "I spent 500 on home"
 * is a line in the ledger. Doing both from one tap would double-count for
 * anybody who then logs the transaction themselves, and summarise is careful to
 * subtract each exactly once precisely because they are separate.
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

    const next = paidThisPeriod(row) ? null : localISO(new Date())
    const { error: failed } = await supabase
      .from('budget_fixed')
      .update({ last_paid_on: next })
      .eq('id', row.id)

    setBusy(null)
    if (failed) {
      /* Migration 35 not run yet. Saying which one is the difference between
         a person fixing it in a minute and filing a bug. */
      setError(
        /* Same split as everywhere else: the calm sentence on screen, the
           migration name in the console where somebody can act on it. */
        isMissingColumn(failed, 'last_paid_on')
          ? (console.warn('last_paid_on is missing: run supabase/35_fixed_paid.sql'), t('money.paid_unavailable'))
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
    </div>
  )
}
