import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { CATEGORIES, summarise } from '../lib/budget'
import { loadBudget } from '../lib/budgetData'
import { Empty, Field, Screen, Section, Sheet, TopBar } from '../components/ui'
import BudgetIntro from '../components/BudgetIntro'

/**
 * The money screen.
 *
 * Deliberately not an envelope budgeter. See supabase/19_budget.sql for the
 * reasoning; the short version is that logging every coffee is work people
 * stop doing by March, and this app's promise is sixty seconds. So the screen
 * answers one question, in one number: what can I spend today without
 * breaking the month.
 *
 * Setting up is the only part that takes real effort, and it is asked for once.
 */

/** Cents from a typed string, tolerating "12,50", "$12.50" and "12.5". */
function toCents(text) {
  const cleaned = String(text ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(/,/g, '.')
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

const fromCents = (c) => (c == null ? '' : (c / 100).toFixed(2))

function MoneyInput({ value, onChange, placeholder = '0.00', autoFocus = false }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      className="field"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * How much of what was free has already gone.
 *
 * A bar that actually moves, unlike the fixed rule that used to sit under
 * every Stat. Over 100% it stays full and turns to the warning treatment
 * rather than overflowing its track.
 */
function SpendBar({ spent, pool }) {
  const pct = pool > 0 ? Math.min(100, Math.round((spent / pool) * 100)) : 100
  const over = pool <= 0 || spent > pool
  return (
    <div
      className="mt-5 h-2 w-full overflow-hidden rounded-pill bg-ink/10"
      role="img"
      aria-label={`${pct}%`}
    >
      <div
        className={`h-full rounded-pill transition-[width] duration-500 ${over ? 'bg-ink' : 'bg-accent'}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  )
}

export default function Money() {
  const { user, profile, updateProfile } = useAuth()
  const { t, locale } = useT()

  const [plan, setPlan] = useState(null)
  const [fixed, setFixed] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  // Quick add
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [kind, setKind] = useState('expense')

  const load = useCallback(async () => {
    if (!user) return
    const r = await loadBudget(user.id)
    setMissing(r.missing)
    setPlan(r.plan)
    setFixed(r.fixed)
    setEntries(r.entries)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const s = useMemo(
    () => summarise({ plan, fixed, entries, today: new Date() }),
    [plan, fixed, entries],
  )

  const fmt = (cents) => money(cents, s.currency, locale)

  async function addEntry(e) {
    e.preventDefault()
    const cents = toCents(amount)
    if (!cents || cents <= 0) return
    setBusy(true)
    // Written optimistically, then reconciled by the reload below, so the
    // number under your thumb moves the instant you tap.
    const row = {
      user_id: user.id,
      kind,
      amount_cents: cents,
      category: kind === 'expense' ? category : null,
      happened_on: new Date().toISOString().slice(0, 10),
    }
    setEntries((prev) => [{ ...row, id: `local-${Date.now()}` }, ...prev])
    setAmount('')
    await supabase.from('budget_entry').insert(row)
    await load()
    setBusy(false)
  }

  async function removeEntry(id) {
    if (String(id).startsWith('local-')) return
    setEntries((prev) => prev.filter((r) => r.id !== id))
    await supabase.from('budget_entry').delete().eq('id', id)
    await load()
  }

  /**
   * The intro, once.
   *
   * The flag lives on the profile rather than in localStorage so it follows
   * the person to a second device instead of replaying the whole carousel on
   * their laptop. It is written optimistically and the failure is swallowed:
   * somebody who has just watched six slides should not be shown an error,
   * and the worst case of a failed write is seeing them again.
   *
   * Held until loading finishes so the carousel does not flash over a screen
   * that was about to render anyway.
   */
  const seen = profile?.has_seen_budget_intro
  if (!loading && !missing && seen === false && !introDone) {
    const finish = async (start) => {
      setIntroDone(true)
      updateProfile?.({ has_seen_budget_intro: true })
      if (start) setEditing(true)
    }
    return <BudgetIntro onDone={() => finish(true)} onSkip={() => finish(false)} />
  }

  if (missing) {
    return (
      <Screen>
        <TopBar title={t('money.title')} />
        <Empty>{t('money.not_installed')}</Empty>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <TopBar title={t('money.title')} />
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar
        title={t('money.title')}
        sub={s.ready ? t('money.sub_period', { days: s.period.daysLeft }) : t('money.sub_new')}
        right={
          s.ready ? (
            <button className="btn-ghost press" onClick={() => setEditing(true)}>
              {t('money.edit_plan')}
            </button>
          ) : null
        }
      />

      {!s.ready ? (
        <Empty
          action={
            <button className="btn-primary press" onClick={() => setEditing(true)}>
              {t('money.set_up')}
            </button>
          }
        >
          {t('money.pitch')}
        </Empty>
      ) : (
        <>
          {/**
           * The headline. Two failure states are called out by name rather
           * than left for the reader to infer from a negative number.
           *
           * Overcommitted is the important one and it is not the same as
           * overspent: it means the plan itself does not close, so no amount
           * of careful spending fixes it. Saying "you can spend 4 dollars a
           * day" to somebody whose rent already exceeds their pay would be
           * arithmetically defensible and useless.
           */}
          <Section>
            {s.overcommitted ? (
              <div className="card-warn">
                <div className="text-h2 text-ink">{t('money.overcommitted_title')}</div>
                <p className="mt-2 text-body text-muted">
                  {t('money.overcommitted_body', {
                    over: fmt(Math.abs(s.pool)),
                    fixed: fmt(s.committed + s.savings),
                    income: fmt(s.income),
                  })}
                </p>
              </div>
            ) : (
              <div>
                <div className="eyebrow">
                  {s.overspent ? t('money.over_label') : t('money.today_label')}
                </div>
                <div className="font-display text-hero leading-none text-ink [font-variant-numeric:tabular-nums]">
                  {fmt(s.overspent ? s.left : s.perDay)}
                </div>
                <p className="lede mt-3 max-w-[32ch]">
                  {s.overspent
                    ? t('money.over_body', { days: s.period.daysLeft })
                    : t('money.today_body', {
                        left: fmt(s.left),
                        days: s.period.daysLeft,
                      })}
                </p>
                <SpendBar spent={s.spent} pool={s.pool} />
              </div>
            )}
          </Section>

          {/* Quick add. The whole point is that this is two taps. */}
          <Section title={t('money.add_title')}>
            <form onSubmit={addEntry} className="space-y-4">
              <div className="flex gap-2">
                {['expense', 'income'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={kind === k ? 'chip-accent' : 'chip'}
                  >
                    {t(`money.kind_${k}`)}
                  </button>
                ))}
              </div>

              <MoneyInput value={amount} onChange={setAmount} />

              {kind === 'expense' && (
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={category === c ? 'chip-accent' : 'chip'}
                    >
                      {t(`money.cat_${c}`)}
                    </button>
                  ))}
                </div>
              )}

              <button className="btn-primary press" disabled={busy || !toCents(amount)}>
                {t('money.add')}
              </button>
            </form>
          </Section>

          {/**
           * Rows, not columns, and not the shared Stat component.
           *
           * Stat renders at text-metric, 3rem, sized for a percentage or a
           * count. Three formatted currency amounts at that size ran straight
           * through each other on a phone. Dropping to heading size stopped
           * the overlap but they still touched, because "CA$1,367.00" is
           * eleven characters and a third of a 420px screen is not enough for
           * it at any size worth reading.
           *
           * Currency width is not predictable: the code, the thousands
           * separator and the locale all move it, and fr-CA writes the symbol
           * on the other end. So the amounts get a full line each and the
           * columns problem stops existing. It also matches the "where it
           * went" list further down, which is the same shape of information.
           */}
          <Section title={t('money.this_period')}>
            <dl className="space-y-3">
              {[
                [t('money.left'), fmt(s.left)],
                [t('money.spent'), fmt(s.spent)],
                [t('money.days_left'), String(s.period.daysLeft)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-body text-ink">{label}</dt>
                  <dd className="text-body font-bold text-ink [font-variant-numeric:tabular-nums]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          {s.byCategory.length > 0 && (
            <Section title={t('money.where')}>
              <ul className="space-y-3">
                {s.byCategory.map((c) => (
                  <li key={c.key} className="flex items-baseline justify-between gap-4">
                    <span className="text-body text-ink">{t(`money.cat_${c.key}`)}</span>
                    <span className="text-body font-bold text-ink [font-variant-numeric:tabular-nums]">
                      {fmt(c.cents)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t('money.recent')}>
            {s.entries.length === 0 ? (
              <Empty>{t('money.no_entries')}</Empty>
            ) : (
              <ul className="space-y-3">
                {s.entries.slice(0, 20).map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0 text-body text-ink">
                      {r.kind === 'income'
                        ? t('money.kind_income')
                        : t(`money.cat_${r.category ?? 'other'}`)}
                      <span className="pl-2 text-small text-muted">{r.happened_on}</span>
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-body font-bold text-ink [font-variant-numeric:tabular-nums]">
                        {r.kind === 'income' ? '+' : ''}
                        {fmt(r.amount_cents)}
                      </span>
                      <button
                        className="text-small text-muted underline"
                        onClick={() => removeEntry(r.id)}
                      >
                        {t('money.remove')}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <PlanSheet
        open={editing}
        onClose={() => setEditing(false)}
        plan={plan}
        fixed={fixed}
        userId={user?.id}
        onSaved={async () => {
          setEditing(false)
          await load()
        }}
      />
    </Screen>
  )
}

/**
 * The setup, in a sheet.
 *
 * Three questions and a list. Everything else the screen shows is derived, so
 * this is the entire amount of typing the feature ever asks for.
 */
function PlanSheet({ open, onClose, plan, fixed, userId, onSaved }) {
  const { t } = useT()
  const [income, setIncome] = useState('')
  const [savings, setSavings] = useState('')
  const [day, setDay] = useState('1')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)

  // Re-seeded each time it opens so a cancelled edit does not persist.
  useEffect(() => {
    if (!open) return
    setIncome(fromCents(plan?.monthly_income_cents) || '')
    setSavings(fromCents(plan?.savings_target_cents) || '')
    setDay(String(plan?.period_start_day ?? 1))
    setRows(
      (fixed ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        amount: fromCents(f.amount_cents),
        active: f.active !== false,
      })),
    )
  }, [open, plan, fixed])

  async function save() {
    if (!userId) return
    setBusy(true)

    await supabase.from('budget_plan').upsert(
      {
        user_id: userId,
        monthly_income_cents: toCents(income) ?? 0,
        savings_target_cents: toCents(savings) ?? 0,
        period_start_day: Math.min(Math.max(Number.parseInt(day, 10) || 1, 1), 28),
      },
      { onConflict: 'user_id' },
    )

    // Rows the user cleared out are removed rather than left at zero, since
    // the amount column refuses zero and a paused row is what `active` is for.
    const keep = rows.filter((r) => r.label.trim() && (toCents(r.amount) ?? 0) > 0)
    const keptIds = keep.map((r) => r.id).filter(Boolean)

    const gone = (fixed ?? []).filter((f) => !keptIds.includes(f.id)).map((f) => f.id)
    if (gone.length) await supabase.from('budget_fixed').delete().in('id', gone)

    for (const r of keep) {
      const payload = {
        user_id: userId,
        label: r.label.trim().slice(0, 60),
        amount_cents: toCents(r.amount),
        active: r.active,
      }
      if (r.id) await supabase.from('budget_fixed').update(payload).eq('id', r.id)
      else await supabase.from('budget_fixed').insert(payload)
    }

    setBusy(false)
    await onSaved?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('money.plan_title')}>
      <div className="space-y-6">
        <Field label={t('money.income')} hint={t('money.income_hint')}>
          <MoneyInput value={income} onChange={setIncome} autoFocus />
        </Field>

        <Field label={t('money.payday')} hint={t('money.payday_hint')}>
          <input
            type="number"
            min="1"
            max="28"
            className="field"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>

        <Field label={t('money.savings')} hint={t('money.savings_hint')}>
          <MoneyInput value={savings} onChange={setSavings} />
        </Field>

        <div>
          <span className="field-label">{t('money.fixed')}</span>
          <span className="field-note">{t('money.fixed_hint')}</span>
          <ul className="mt-4 space-y-3">
            {rows.map((r, i) => (
              <li key={r.id ?? `new-${i}`} className="flex gap-2">
                <input
                  className="field flex-1"
                  placeholder={t('money.fixed_label_ph')}
                  value={r.label}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <input
                  className="field w-28"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={r.amount}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  className="text-small text-muted underline"
                  onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                >
                  {t('money.remove')}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost press mt-4"
            onClick={() => setRows((p) => [...p, { label: '', amount: '', active: true }])}
          >
            {t('money.add_fixed')}
          </button>
        </div>

        <button className="btn-primary press" onClick={save} disabled={busy}>
          {busy ? t('money.saving') : t('money.save')}
        </button>
      </div>
    </Sheet>
  )
}
