import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { minorDigits } from '../lib/currency'
import { fromCents, localISO, toCents } from '../lib/txn'
import { errorText } from '../lib/dberr'
/* isMissingTable lives with the mood store, which needed the same check first.
   Shared rather than copied: two spellings of "this table is not installed"
   is one spelling too many. */
import { isMissingTable } from '../lib/moodStore'
import { allocationsFor, envelopes, toAllocate, totalAllocated } from '../lib/envelope'

/**
 * Every dollar that arrived, given a job.
 *
 * The pool at the top is income that has actually been LOGGED, less whatever
 * has been handed out. The screen's whole ask is that it reaches zero, so it is
 * the loudest thing here and it is allowed to go negative: handing out more
 * than arrived is the mistake this model exists to catch, and a pool that
 * stopped at zero would say the job was finished.
 *
 * Each row underneath is one category's envelope: what went in, a bar showing
 * what has come out of it, and one line saying what that leaves. Two sentences,
 * not one with a sign: "50 $ restant" and "46 $ de plus" are different things
 * to be told and the second is red.
 *
 * The amounts are edited in place. A sheet per envelope would be six sheets to
 * get through on the one screen whose job is to be finished quickly, and the
 * number being typed is the number on the bar, so watching it move as you type
 * is the feedback.
 */
export default function Envelopes({ s, allocations, locale, onChange }) {
  const { user } = useAuth()
  const { t } = useT()
  const fmt = (c) => money(c, s.currency, locale)

  /* How many decimals this currency actually has. The CFA francs have none, so
     a hard-coded two would print "20000.00" in a field where every other money
     input on the screen prints "20000". */
  const digits = minorDigits(s.currency)

  const periodStart = localISO(s.period.start)

  /* What is in each box while it is being typed, keyed by category. A field
     holds a string because "12," is a thing somebody is halfway through
     writing and is not a number yet. */
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  /* Cleared when the period turns over, so September never opens with August's
     half-typed figure sitting in a field. */
  useEffect(() => {
    setDraft({})
    setError(null)
  }, [periodStart])

  /** The live picture: saved allocations, overridden by anything being typed. */
  const live = useMemo(() => {
    const out = { ...allocations }
    for (const [key, text] of Object.entries(draft)) {
      const c = toCents(text)
      out[key] = c === null ? 0 : Math.max(0, c)
    }
    return out
  }, [allocations, draft])

  const pool = toAllocate({ earned: s.earned, allocations: live })
  const rows = envelopes({
    allocations: live,
    spentByCategory: Object.fromEntries(s.byCategory.map((c) => [c.key, c.cents])),
  })

  async function commit(category) {
    const text = draft[category]
    if (text === undefined) return
    const c = toCents(text)
    const amount = c === null ? 0 : Math.max(0, c)

    setSaving(category)
    setError(null)

    const { error: failed } = await supabase.from('budget_allocation').upsert(
      {
        user_id: user.id,
        period_start: periodStart,
        category,
        amount_cents: amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_start,category' },
    )

    setSaving(null)
    if (failed) {
      /* Naming the migration is the difference between somebody fixing this in
         a minute and filing a bug. */
      setError(isMissingTable(failed) ? t('env.unavailable') : errorText(failed))
      return
    }
    /* The typed value is dropped only once the row is saved, so the field never
       flickers back to the old number between the write and the reload. */
    setDraft((d) => {
      const { [category]: _gone, ...rest } = d
      return rest
    })
    await onChange?.()
  }

  return (
    <div className="space-y-3">
      {/* --- the pool ---------------------------------------------------- */}
      <div className={`lg p-5 ${pool < 0 ? 'ring-1 ring-inset ring-negative/40' : ''}`}>
        <p className="eyebrow">{t('env.to_allocate')}</p>
        <p
          className={`mt-2 font-display text-metric leading-none [font-variant-numeric:tabular-nums] ${
            pool < 0 ? 'text-negative' : pool === 0 ? 'text-green' : 'text-ink'
          }`}
        >
          {fmt(pool)}
        </p>
        <p className="lede mt-2 max-w-[38ch]">
          {!s.earned
            ? t('env.no_income')
            : pool > 0
              ? t('env.pool_left', { total: fmt(s.earned) })
              : pool < 0
                ? t('env.pool_over', { over: fmt(Math.abs(pool)) })
                : t('env.pool_done')}
        </p>
        {s.earned > 0 && (
          <p className="mt-1 text-small text-muted [font-variant-numeric:tabular-nums]">
            {t('env.allocated_of', { allocated: fmt(totalAllocated(live)), total: fmt(s.earned) })}
          </p>
        )}
      </div>

      {/* --- one row per envelope ---------------------------------------- */}
      <div className="lg divide-y divide-hairline px-5">
        {rows.map((e) => {
          /* Empty rather than a zero when nothing has been put in: the
             placeholder already says 0, and a field pre-filled with 0.00 has to
             be cleared before it can be typed into. */
          const text = draft[e.key] ?? (e.allocated ? fromCents(e.allocated, digits) : '')
          return (
            <div key={e.key} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`env-${e.key}`} className="min-w-0 flex-1 truncate text-body text-ink">
                  {t(`money.cat_${e.key}`)}
                </label>
                {/* The field is the allocation. Typed straight onto the row so
                    the bar under it moves as the number changes. */}
                <span className="flex shrink-0 items-baseline gap-1">
                  <input
                    id={`env-${e.key}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    /* The same shape MoneyInput uses on the setup form, so the
                       two money fields on this screen do not disagree about
                       what an empty amount looks like. */
                    placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
                    aria-label={t('env.allocate_to', { category: t(`money.cat_${e.key}`) })}
                    /**
                     * Sized to what it holds, not to a guess.
                     *
                     * A fixed width and a right-aligned value is the worst of
                     * both: an amount too long for the box scrolls its LEADING
                     * digits out of sight, so 1 200 000 reads as 00 000 and the
                     * error is invisible. The CFA francs make this ordinary
                     * rather than hypothetical, since they carry no decimals
                     * and their amounts run five and six figures.
                     *
                     * tabular-nums above makes ch exact here: every digit is
                     * the width of "0", so the count is the width.
                     */
                    style={{ width: `${Math.max(5, text.length + 1)}ch` }}
                    className="shrink-0 border-0 bg-transparent p-0 text-right text-body font-semibold text-ink placeholder:text-muted/60 focus:outline-none [font-variant-numeric:tabular-nums]"
                    value={text}
                    onChange={(ev) => setDraft((d) => ({ ...d, [e.key]: ev.target.value }))}
                    onBlur={() => commit(e.key)}
                    onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                  />
                  {saving === e.key && <span className="text-small text-muted">…</span>}
                </span>
              </div>

              {/* The bar. Only drawn once there is something to measure
                  against: an unfunded envelope is not "0% spent", it is not in
                  use, and an empty track under every category would be six
                  lines of furniture. */}
              {(e.funded || e.spent > 0) && (
                <>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
                    <div
                      className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
                        e.over > 0 ? 'bg-negative' : 'bg-accent'
                      }`}
                      style={{ width: `${e.pct}%` }}
                    />
                  </div>
                  <p
                    className={`mt-1.5 text-small [font-variant-numeric:tabular-nums] ${
                      e.over > 0 ? 'font-semibold text-negative' : 'text-muted'
                    }`}
                  >
                    {e.over > 0
                      ? t('env.over_by', { amount: fmt(e.over) })
                      : t('env.remaining', { amount: fmt(e.remaining) })}
                    <span className="text-muted"> · {t('env.spent_of', { spent: fmt(e.spent) })}</span>
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="break-words px-1 text-small text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The one bar at the top of the screen: what is left of real income.
 *
 * Income minus SPENDING, never minus allocations. Allocating is a plan for
 * money you still have, and a dollar sitting in the rent envelope is still in
 * the account until the rent goes out. A bar that emptied as you allocated
 * would tell somebody they had spent their month by deciding what it was for.
 */
export function SpendableBar({ bar, currency, locale }) {
  const { t } = useT()
  const fmt = (c) => money(c, currency, locale)

  return (
    <div className="lg p-5">
      <p className="eyebrow">{t('env.left_to_spend')}</p>
      <p
        className={`mt-2 font-display text-hero leading-none [font-variant-numeric:tabular-nums] ${
          bar.left < 0 ? 'text-negative' : 'text-ink'
        }`}
      >
        {fmt(bar.left)}
      </p>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
        <div
          className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
            bar.over > 0 ? 'bg-negative' : 'bg-accent'
          }`}
          style={{ width: `${bar.funded ? bar.pct : 0}%` }}
        />
      </div>

      <p className="lede mt-2 max-w-[38ch]">
        {!bar.funded
          ? t('env.no_income_bar')
          : bar.over > 0
            ? t('env.bar_over', { over: fmt(bar.over), earned: fmt(bar.earned) })
            : t('env.bar_of', { spent: fmt(bar.spent), earned: fmt(bar.earned) })}
      </p>
    </div>
  )
}
