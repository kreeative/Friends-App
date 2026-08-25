import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { CatIcon } from './CatDisc'

/**
 * Where the month went, as one ring and a legend.
 *
 * The list this replaces was six rows of "Nourriture ....... 150,00 $", which
 * is the data and none of the shape: nothing in it said that one category was
 * half the month and another was a rounding error. A ring says that before a
 * single figure has been read, which is why every reference for this screen
 * has one on its analytics view.
 *
 * The legend is not a colour key, it is the list. Each row carries the mark,
 * the name, the share and the amount, so nothing was lost by drawing the ring
 * and somebody who cannot separate these hues still has every number.
 *
 * SEGMENTS ARE DRAWN, NOT SPACED.
 *
 * One circle per category with a dash pattern and a rotation, rather than a
 * path per arc: the arithmetic is a running offset and it cannot produce a
 * gap or an overlap, which hand-built arc paths do the moment a share rounds.
 */
const ARC = ['stroke-cat-1', 'stroke-cat-2', 'stroke-cat-3', 'stroke-cat-4', 'stroke-cat-5', 'stroke-cat-6']
const TEXT = ['text-cat-1', 'text-cat-2', 'text-cat-3', 'text-cat-4', 'text-cat-5', 'text-cat-6']
const ORDER = ['food', 'transport', 'home', 'fun', 'health', 'other']

const SIZE = 168
const STROKE = 22

export default function SpendDonut({ byCategory, total, currency, locale }) {
  const { t } = useT()
  const fmt = (c) => money(c, currency, locale)

  const rows = byCategory.filter((c) => c.cents > 0)
  const sum = rows.reduce((n, c) => n + c.cents, 0)
  if (!rows.length || sum <= 0) return null

  const r = (SIZE - STROKE) / 2
  const circumference = 2 * Math.PI * r
  const mid = SIZE / 2

  /* A running offset, so the segments meet exactly. */
  let walked = 0
  const arcs = rows.map((c) => {
    const share = c.cents / sum
    const seg = { key: c.key, share, at: walked, length: circumference * share }
    walked += share
    return seg
  })

  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex justify-center">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={STROKE} className="stroke-slate-100" />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={mid}
                cy={mid}
                r={r}
                fill="none"
                strokeWidth={STROKE}
                /* No round cap: a rounded end on a segment overlaps its
                   neighbour, so a ring of six would show six little bites
                   taken out of it. */
                className={ARC[ORDER.indexOf(a.key)] ?? ARC[5]}
                strokeDasharray={`${a.length} ${circumference}`}
                strokeDashoffset={-circumference * a.at}
                transform={`rotate(-90 ${mid} ${mid})`}
                style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-label font-semibold uppercase tracking-wider text-slate-600">
              {t('money.spent')}
            </span>
            <span className="mt-1 font-display text-h2 font-bold leading-none text-slate-800 [font-variant-numeric:tabular-nums]">
              {fmt(total)}
            </span>
          </div>
        </div>
      </div>

      {/* The legend IS the list. Every figure the old rows carried is here,
          plus the share, which the ring shows and the rows never could. */}
      <ul className="mt-5 divide-y divide-slate-200/70">
        {rows.map((c) => (
          <li key={c.key} className="flex items-center gap-3 py-2.5">
            <span className={`shrink-0 ${TEXT[ORDER.indexOf(c.key)] ?? TEXT[5]}`}>
              <CatIcon category={c.key} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-body text-slate-800">
              {t(`money.cat_${c.key}`)}
            </span>
            <span className="shrink-0 text-label text-slate-600 [font-variant-numeric:tabular-nums]">
              {Math.round((c.cents / sum) * 100)} %
            </span>
            <span className="w-[5.5rem] shrink-0 text-right text-body font-semibold text-slate-800 [font-variant-numeric:tabular-nums]">
              {fmt(c.cents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
