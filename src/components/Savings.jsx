import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { money, moneyParts } from '../lib/money'
import { currencySymbol, minorDigits } from '../lib/currency'
import { toCents } from '../lib/txn'
import { Empty, Section } from './ui'
import {
  cushionTarget, history as buildHistory, pendingSweeps, recentRate, savedTotal,
} from '../lib/savings'
import { heroClass } from '../lib/amount'

/**
 * The savings pane. Where the surplus goes.
 *
 * "Avec le surplus, c'est a dire l'argent qui te reste apres avoir fait les
 * depenses, va dans l'epargne."
 *
 * WHY IT DOES NOT SWEEP BY ITSELF.
 *
 * The obvious build is a job that moves the leftover the moment a month closes.
 * It is the wrong one, and not for a technical reason: this app cannot move
 * anybody's actual money. All it can do is write a row saying money moved. An
 * app that silently records a transfer that never happened has not helped
 * somebody save, it has corrupted their picture of what they have, which is
 * the one thing a budget exists to protect.
 *
 * So the sweep is offered and never taken. The screen computes the surplus,
 * names the month it came from, and puts a button next to it. Pressing it means
 * "I have moved this", and the row it writes is a record of something the
 * person did, which is the only kind of row this table is allowed to contain.
 *
 * The database enforces one sweep per period (migration 39), so a double tap
 * on a slow connection cannot write the month twice.
 */
export default function Savings({
  userId, plan, entries = [], savings = [], currency, locale, missing, onChange,
}) {
  const { t } = useT()
  const [busy, setBusy] = useState(null)
  const [amount, setAmount] = useState('')
  const [failed, setFailed] = useState(false)

  const digits = minorDigits(currency)
  const { symbol } = currencySymbol(currency, [locale])
  const fmt = (cents) => money(cents, currency, locale)

  /**
   * Dates written the way the reader's device writes them.
   *
   * Built from the parts rather than from `new Date(iso)`, which parses a bare
   * 'YYYY-MM-DD' as UTC midnight and then prints it in local time: west of
   * Greenwich that is the evening before, so every row in the ledger was one
   * day early. The same trap `shiftDay` in history.js is built around.
   */
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA'
  const at = (v) => {
    const [y, m, d] = String(v ?? '').slice(0, 10).split('-').map(Number)
    return y && m && d ? new Date(y, m - 1, d) : null
  }
  const monthName = (v) => {
    const d = at(v)
    return d ? d.toLocaleDateString(tag, { month: 'long', year: 'numeric' }) : ''
  }
  const dayName = (v) => {
    const d = at(v)
    return d ? d.toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  }

  const startDay = plan?.period_start_day ?? 1
  const rows = buildHistory({ entries, startDay })
  const pending = pendingSweeps({ history: rows, savings })
  const total = savedTotal(savings)
  const parts = moneyParts(total, currency, locale)

  /* The plan's own monthly figure stands in until there are two closed months
     to take a middle of. See cushionTarget for why two and not one. */
  const planMonthly = Math.max(
    0,
    (Number(plan?.monthly_income_cents) || 0) - (Number(plan?.savings_target_cents) || 0),
  )
  const cushion = cushionTarget({ history: rows, months: 3, fallbackMonthly: planMonthly })
  const cushionPct = cushion.target > 0 ? Math.min(100, Math.round((total / cushion.target) * 100)) : 0

  const rate = recentRate({ history: rows, savings })

  /** One row, written once. `source` decides what the period column may hold. */
  async function put({ cents, source, periodStart, note }) {
    if (!userId || !cents) return
    setBusy(source === 'surplus' ? periodStart : 'manual')
    setFailed(false)
    const { error } = await supabase.from('budget_saving').insert({
      user_id: userId,
      amount_cents: cents,
      source,
      /* Null for anything that is not a sweep. The check constraint in 39
         refuses the other three combinations, so this cannot drift. */
      period_start: source === 'surplus' ? periodStart : null,
      note: note ?? null,
    })
    setBusy(null)
    if (error) {
      setFailed(true)
      return
    }
    setAmount('')
    await onChange?.()
  }

  /**
   * Migration 39 has not been run.
   *
   * Soft, like the envelopes pane, and for the same reason: a table somebody
   * has not installed must not take the money screen down with it. The pane
   * says what is missing rather than rendering an empty ledger that looks like
   * a person who has never saved anything.
   */
  if (missing) {
    return (
      <Section title={t('sav.title')}>
        <div className="glass-card rounded-3xl p-6">
          <Empty>{t('sav.not_installed')}</Empty>
        </div>
      </Section>
    )
  }

  return (
    <>
      {/* The same hero as the overview and the plan form. Three screens, one
          card, so the number you are looking at is always in the same place. */}
      <Section>
        <div
          data-card="savings-hero"
          className="glass-card relative overflow-hidden rounded-3xl bg-surface p-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-label font-semibold uppercase tracking-wider text-muted">
              {t('sav.total')}
            </p>
            {/* Only when there is an income to be a percentage of. A rate of
                null means nothing was ever logged as coming in, and printing
                "0 %" there would be a claim, not a blank. */}
            {rate.rate != null && (
              <span
                data-hook="rate"
                className="shrink-0 rounded-pill bg-accent/[0.35] px-3 py-1 text-label font-semibold text-ink"
              >
                {t('sav.rate_badge', { n: Math.round(rate.rate) })}
              </span>
            )}
          </div>
          <p
            data-hook="amount"
            className={`mt-2 font-display leading-none text-ink [font-variant-numeric:tabular-nums] ${heroClass(`${parts.head}${parts.cents}${parts.suffix}`)}`}
          >
            {parts.head}
            <span className="align-baseline text-[0.62em] text-muted">{parts.cents}</span>
            {parts.suffix}
          </p>
          <p className="mt-2.5 max-w-[26ch] text-small leading-relaxed text-muted">
            {rate.rate != null
              ? t('sav.rate_note', { n: rate.months })
              : t('sav.no_income_note')}
          </p>
        </div>
      </Section>

      {/**
       * The cushion, as a target with a bar.
       *
       * Three months of the way you actually live, from the median of your own
       * closed months. It says which of the two it used, because "3 400 $"
       * derived from your real spending and "3 400 $" derived from a number you
       * typed into a form once are worth different amounts of trust.
       */}
      <Section title={t('sav.cushion')}>
        <div data-card="cushion" className="glass-card rounded-3xl p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
              {fmt(cushion.target)}
            </p>
            <span className="shrink-0 text-label font-semibold text-muted">
              {t('sav.cushion_pct', { n: cushionPct })}
            </span>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-pill bg-ink/10">
            <div
              data-hook="cushion-bar"
              className="h-full rounded-pill bg-progress transition-[width] duration-500 ease-settle"
              style={{ width: `${cushionPct}%` }}
            />
          </div>
          <p className="mt-3 text-small leading-relaxed text-muted">
            {cushion.measured
              ? t('sav.cushion_measured', { m: fmt(cushion.monthly) })
              : t('sav.cushion_planned', { m: fmt(cushion.monthly) })}
          </p>
        </div>
      </Section>

      {/**
       * The offer, one row per unswept month.
       *
       * Never automatic. See the note at the top of this file: the app can
       * write a record, it cannot move money, and a record of a transfer that
       * did not happen is worse than no feature.
       */}
      {pending.length > 0 && (
        <Section title={t('sav.surplus')}>
          {/**
           * Stacked, not a three-column row.
           *
           * It was month, amount and button side by side, and at 390px there is
           * not room: "juillet 2026" broke over two lines, the in-and-out line
           * broke over three, and the amount landed on top of both of them. The
           * three things are a heading, a detail and an action, which is a card,
           * not a row, and a card has all the width it needs for each.
           */}
          <ul className="space-y-2.5">
            {pending.map((p) => (
              <li key={p.key} data-hook="sweep" className="glass-card rounded-3xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-body font-semibold leading-tight text-ink">
                    {monthName(p.start)}
                  </span>
                  <span className="shrink-0 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
                    {fmt(p.surplus)}
                  </span>
                </div>
                <p className="mt-1.5 text-small leading-relaxed text-muted">
                  {t('sav.surplus_from', { in: fmt(p.earned), out: fmt(p.spent) })}
                </p>
                <button
                  type="button"
                  className="goal-action-soft press mt-3.5 w-full justify-center"
                  disabled={busy === p.key}
                  onClick={() => put({ cents: p.surplus, source: 'surplus', periodStart: p.start })}
                >
                  {busy === p.key ? t('sav.moving') : t('sav.move')}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Anything else: a bonus, a gift, a transfer nobody's month explains. */}
      <Section title={t('sav.add')}>
        <div className="glass-card flex items-center gap-2 rounded-3xl p-2.5">
          <span
            className="flex min-w-0 flex-1 items-baseline rounded-2xl bg-raised px-3 py-2
                       ring-1 ring-inset ring-ink/50 transition-shadow duration-200 ease-settle
                       focus-within:ring-2 focus-within:ring-ink/60
                       focus-within:shadow-[0_0_0_4px_rgb(var(--c-accent)/0.4)]"
          >
            <span className="shrink-0 text-small font-semibold text-muted">{symbol}</span>
            <input
              aria-label={t('sav.add')}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
              className="ml-2 w-full min-w-0 border-0 bg-transparent p-0 text-body font-semibold text-ink
                         outline-none [font-variant-numeric:tabular-nums]
                         placeholder:font-normal placeholder:text-muted"
            />
          </span>
          <button
            type="button"
            className="goal-action-done press shrink-0"
            disabled={busy === 'manual' || !(toCents(amount) > 0)}
            onClick={() => put({ cents: toCents(amount), source: 'manual' })}
          >
            {busy === 'manual' ? t('sav.moving') : t('sav.add_do')}
          </button>
        </div>
        {/* A failed write is said out loud. It used to be swallowed, and a
            button that does nothing is indistinguishable from one that worked
            and lost the row. */}
        {failed && (
          <p role="alert" className="mt-3 text-small text-negative">
            {t('sav.failed')}
          </p>
        )}
      </Section>

      <Section title={t('sav.ledger')}>
        {savings.length === 0 ? (
          <div className="glass-card rounded-3xl px-5 py-2">
            <Empty>{t('sav.empty')}</Empty>
          </div>
        ) : (
          <ul data-hook="savings-ledger" className="glass-card divide-y divide-hairline rounded-3xl px-4">
            {savings.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3.5">
                <span className="min-w-0 flex-1 text-body text-ink">
                  <span className="block truncate">{r.note || t(`sav.src_${r.source}`)}</span>
                  <span className="block text-small text-muted">{dayName(r.happened_on)}</span>
                </span>
                <span
                  className={`shrink-0 text-body font-semibold [font-variant-numeric:tabular-nums] ${
                    r.amount_cents < 0 ? 'text-negative' : 'text-green'
                  }`}
                >
                  {r.amount_cents > 0 ? '+' : ''}
                  {fmt(r.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
