import { useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { localISO } from '../lib/txn'
import { categoriesIn, dayHeading, filterHistory, groupByDay } from '../lib/history'
import CatDisc from './CatDisc'
import { Empty } from './ui'

/**
 * Every transaction, ever, grouped into days.
 *
 * The log pane shows `recent`, which is the CURRENT PERIOD cut to twenty
 * rows. That is right for a summary and useless as a history: "what did I
 * spend in June" cannot be answered from it at all, and the twentieth row of
 * a busy month is nowhere near the bottom of the list.
 *
 * So this is a place of its own rather than more rows on the money screen.
 * Filters at the top, days below, which is the shape every bank uses for the
 * same job because the question is nearly always "around when" before it is
 * "how much".
 *
 * The day heading carries that day's net. It is the one number a grouped list
 * can give you for free, and without it the groups are just visual separation.
 */
export default function TransactionHistory({ entries, currency, locale, onOpen, onBack }) {
  const { t } = useT()
  const [kind, setKind] = useState('all')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')

  const fmt = (c) => money(c, currency, locale)
  const today = localISO(new Date())

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
    [locale],
  )

  /* Only categories that actually occur. A filter offering six options when
     four of them return nothing is a filter that wastes four taps. */
  const cats = useMemo(() => categoriesIn(entries), [entries])

  const days = useMemo(
    () => groupByDay(filterHistory(entries, { kind, category, query })),
    [entries, kind, category, query],
  )

  const filtered = kind !== 'all' || category !== 'all' || query.trim() !== ''

  const label = (day) => {
    const h = dayHeading(day, today)
    if (h.key === 'today') return t('hist.today')
    if (h.key === 'yesterday') return t('hist.yesterday')
    const [y, m, d] = day.split('-').map(Number)
    return dayFmt.format(new Date(y, m - 1, d))
  }

  return (
    <div className="space-y-4" data-history="">
      <button className="goal-action press" onClick={onBack}>
        {t('hist.back')}
      </button>

      {/* Pills, in the order the questions get asked: what kind, then what
          for, then the one you only reach for when the first two failed. */}
      <div className="flex flex-wrap gap-2">
        <Pill
          value={kind}
          onChange={setKind}
          hook="filter-kind"
          options={[
            ['all', t('hist.all_kinds')],
            ['expense', t('hist.expenses')],
            ['income', t('hist.incomes')],
          ]}
        />
        {cats.length > 1 && (
          <Pill
            value={category}
            onChange={setCategory}
            hook="filter-category"
            options={[['all', t('hist.all_categories')]].concat(
              cats.map((c) => [c, t(`money.cat_${c}`)]),
            )}
          />
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('hist.search_ph')}
        aria-label={t('hist.search_ph')}
        data-hook="history-search"
        className="field"
      />

      {days.length === 0 ? (
        <div className="glass-card rounded-3xl p-5">
          {/* Which empty this is matters: "you have never logged anything" and
              "nothing matches this filter" want different next actions. */}
          <Empty>{filtered ? t('hist.none_filtered') : t('hist.none')}</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d.day} data-day={d.day}>
              <div className="mb-2 flex items-baseline justify-between gap-4 px-1">
                <h3 className="text-label font-semibold uppercase tracking-wider text-muted">
                  {label(d.day)}
                </h3>
                <span
                  className={`text-label font-semibold [font-variant-numeric:tabular-nums] ${
                    d.net > 0 ? 'text-green' : 'text-muted'
                  }`}
                >
                  {d.net > 0 ? '+' : ''}
                  {fmt(d.net)}
                </span>
              </div>

              <ul className="glass-card divide-y divide-hairline rounded-3xl px-4">
                {d.entries.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      data-txn={r.id}
                      className="press flex w-full items-center gap-3 py-3.5 text-left"
                    >
                      <CatDisc category={r.kind === 'income' ? 'income' : (r.category ?? 'other')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">
                          {r.note ||
                            (r.kind === 'income'
                              ? t('money.kind_income')
                              : t(`money.cat_${r.category ?? 'other'}`))}
                        </span>
                        <span className="block text-small text-muted">
                          {r.kind === 'income'
                            ? t('money.kind_income')
                            : t(`money.cat_${r.category ?? 'other'}`)}
                          {r.excluded && ` · ${t('txn.excluded_badge')}`}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-body font-semibold [font-variant-numeric:tabular-nums] ${
                          r.excluded
                            ? 'text-muted line-through'
                            : r.kind === 'income'
                              ? 'text-green'
                              : 'text-ink'
                        }`}
                      >
                        {r.kind === 'income' ? '+' : ''}
                        {fmt(r.amount_cents)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A native select wearing a pill.
 *
 * Not a custom dropdown. The reference draws one, and building it would mean
 * owning focus trapping, type-ahead, escape, and the whole keyboard contract
 * that a select already has correctly. On a phone the native control is also
 * the one people already know how to use.
 */
function Pill({ value, onChange, options, hook }) {
  return (
    <span className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-hook={hook}
        className="press appearance-none rounded-pill border border-hairline bg-[rgb(var(--glass-tint))] py-2 pl-4 pr-9 text-small font-semibold text-ink shadow-raised focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <path d="M6.5 9.5 12 15l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
