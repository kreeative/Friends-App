import { useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { amountIn, categoriesIn, compareMonths, peak, spendHistory, typicalMonth } from '../lib/months'
import { Empty } from './ui'
import { CatIcon } from './CatDisc'

/**
 * What you spent, period by period, with each one against the one before it.
 *
 * A card in this app has promised "Compare tes depenses reelles mois par mois"
 * for a while and led nowhere, because there was no such screen. This is it.
 *
 * WHY BARS AND NOT A LINE.
 *
 * A line chart is the obvious answer and the wrong one at this size. Twelve
 * points across a 320px phone is 26px apart, which is narrower than the
 * fingertip that has to hit one, and a line's whole advantage is showing a
 * shape you read at a glance rather than values you compare one to one. The
 * question this screen answers is "was March worse than February", which is a
 * comparison of two lengths side by side. That is a bar.
 *
 * Rows rather than columns for the same reason the transaction history is
 * rows: the label is a month name in French, "septembre" is nine characters,
 * and twelve of those along an axis on a phone is unreadable at any angle you
 * are allowed to rotate text to.
 *
 * THE DELTA CARRIES NO COLOUR, AND THAT IS DELIBERATE.
 *
 * Green for less and red for more would be the obvious styling and it makes a
 * moral claim the app has no business making: rent going up is not a failure,
 * and a month where somebody finally bought a winter coat is not a relapse.
 * The arrow and the sign say which way it went, ink says it once, and the
 * reader decides what it means. It also sidesteps WCAG 1.4.1 without having to
 * think about it, since nothing here is carried by colour at all.
 */
export default function MonthByMonth({ entries, startDay, currency, locale }) {
  const { t } = useT()
  const [category, setCategory] = useState('all')

  const rows = useMemo(
    () => spendHistory({ entries, startDay, today: new Date() }),
    [entries, startDay],
  )
  const cats = useMemo(() => categoriesIn(rows), [rows])

  /* A category that had something in it, then stopped, would otherwise leave
     the picker holding a selection that draws twelve empty bars. */
  const active = category !== 'all' && !cats.includes(category) ? 'all' : category

  const compared = useMemo(() => compareMonths(rows, active), [rows, active])
  const top = peak(rows, active)
  const typical = typicalMonth(rows, active)

  const fmt = (c) => money(c, currency, locale)
  const monthFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  )
  const label = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return monthFmt.format(new Date(y, m - 1, d))
  }

  if (rows.length === 0 || top === 0) {
    return (
      <div className="glass-card rounded-3xl p-5" data-hook="months-empty">
        <Empty>{t('months.empty')}</Empty>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-hook="months">
      {/* Tout first, then only the categories that have something in them. The
          history's own filter makes the same argument: six options where four
          draw nothing is four wasted taps. */}
      {cats.length > 1 && (
        <div
          data-hook="months-filter"
          className="-mx-6 flex gap-2 overflow-x-auto overscroll-x-contain px-6 py-1
                     [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[['all', t('months.all')]].concat(cats.map((c) => [c, t(`money.cat_${c}`)])).map(([id, name]) => {
            const on = id === active
            return (
              <button
                key={id}
                type="button"
                data-month-cat={id}
                onClick={() => setCategory(id)}
                aria-pressed={on}
                className={`press flex shrink-0 items-center gap-2 rounded-pill px-4 py-2.5
                            text-small font-semibold leading-none text-ink
                            transition-[background-color,box-shadow] duration-200 ${
                  /* A wash and a ring, never a solid accent fill. Same reason
                     the section pills had: the ink stays ink, so the label is
                     legible in both themes whatever the accent is that month. */
                  on
                    ? 'border border-transparent bg-accent/[0.18] shadow-float ring-2 ring-inset ring-accent/50'
                    : 'border border-hairline bg-[rgb(var(--glass-tint))] shadow-raised'
                }`}
              >
                {id !== 'all' && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-mark">
                    <CatIcon category={id} className="h-4 w-4" />
                  </span>
                )}
                <span className="whitespace-nowrap">{name}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* The one number that makes every bar mean something. Without it a
          reader has twelve lengths and no idea which of them is normal. */}
      {typical > 0 && (
        <div className="glass-card rounded-3xl p-5" data-hook="months-typical">
          <p className="text-label font-semibold uppercase tracking-wider text-muted">
            {t('months.typical')}
          </p>
          <p className="mt-2 font-display text-h2 font-bold leading-none text-ink [font-variant-numeric:tabular-nums]">
            {fmt(typical)}
          </p>
          <p className="mt-2 max-w-[38ch] text-small leading-relaxed text-muted">
            {t('months.typical_hint')}
          </p>
        </div>
      )}

      <ul className="glass-card divide-y divide-hairline rounded-3xl px-5" data-hook="months-list">
        {compared.map((r) => {
          const width = top > 0 ? Math.max(2, Math.round((r.amount / top) * 100)) : 0
          const up = (r.delta ?? 0) > 0

          /* The whole row as one sentence, because the bar is decoration to
             anything that reads rather than looks and the delta is a glyph
             plus a number that would be announced as "up 12". */
          const said = [
            label(r.start),
            fmt(r.amount),
            !r.closed
              ? t('months.running')
              : r.pct !== null
                ? t(up ? 'months.up_pct' : 'months.down_pct', { pct: Math.abs(r.pct) })
                : r.delta !== null
                  ? t(up ? 'months.up_amt' : 'months.down_amt', { amount: fmt(Math.abs(r.delta)) })
                  : t('months.first'),
          ].join('. ')

          return (
            <li key={r.key} data-month={r.key} aria-label={said} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-body text-ink first-letter:uppercase">
                  {label(r.start)}
                  {!r.closed && (
                    <span className="ml-2 text-label text-muted">{t('months.running')}</span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-body font-semibold text-ink [font-variant-numeric:tabular-nums]"
                >
                  {fmt(r.amount)}
                </span>
              </div>

              {/* The bar. A graphic that carries information, so it is measured
                  against 3:1 like any other: --c-mark is the one colour in this
                  palette that clears it in both themes. */}
              <div
                aria-hidden="true"
                className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-ink/[0.07]"
              >
                <div
                  data-month-bar={r.key}
                  className={`h-full rounded-pill ${r.closed ? 'bg-mark' : 'bg-mark/45'}`}
                  style={{ width: `${width}%` }}
                />
              </div>

              {r.closed && (r.pct !== null || r.delta !== null) && (
                <p
                  aria-hidden="true"
                  data-month-delta={r.key}
                  className="mt-2 flex items-center gap-1.5 text-label text-muted"
                >
                  {/* Glyph and sign, never colour. See the note at the top. */}
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                    <path
                      d={up ? 'M12 19V6M6 12l6-6 6 6' : 'M12 5v13M6 12l6 6 6-6'}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {r.pct !== null
                    ? t(up ? 'months.up_pct' : 'months.down_pct', { pct: Math.abs(r.pct) })
                    : t(up ? 'months.up_amt' : 'months.down_amt', { amount: fmt(Math.abs(r.delta)) })}
                </p>
              )}
              {r.closed && r.pct === null && r.delta === null && (
                <p aria-hidden="true" className="mt-2 text-label text-muted">
                  {t('months.first')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
