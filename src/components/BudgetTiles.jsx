import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { dailySeries } from '../lib/budget'

/**
 * A cumulative line, drawn small.
 *
 * viewBox coordinates with preserveAspectRatio="none" so the path stretches to
 * whatever box it is given rather than needing measurement, and vector-effect
 * keeps the stroke one pixel wide instead of being scaled along with it. That
 * is the whole trick: no ResizeObserver, no layout read, no chart library for
 * what is nine points and a polyline.
 *
 * A flat series still draws a flat line rather than collapsing, because the
 * range is floored at 1.
 */
function Spark({ points, tone = 'accent' }) {
  if (!points || points.length < 2) return null

  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = Math.max(1, max - min)
  const w = 100
  const h = 32

  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-3 h-8 w-full"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={tone === 'ink' ? 'stroke-ink' : 'stroke-accent'}
      />
    </svg>
  )
}

/**
 * The two square tiles, in the shape a banking app uses them.
 *
 * Square because a pair of equal squares reads as one comparison rather than
 * as two unrelated boxes, and because the aspect ratio is what makes room for
 * a number, a line and a caption without any of the three being cramped.
 *
 * Left tile is what has left the account, right tile is what is still there.
 * That order is deliberate: spending is the thing a person is deciding about,
 * and the eye starts on the left.
 */
export default function BudgetTiles({ s, locale }) {
  const { t } = useT()
  const fmt = (c) => money(c, s.currency, locale)

  const spent = dailySeries({ entries: s.entries, period: s.period })

  // What remains, day by day. Same series read from the other end, so the two
  // lines cannot disagree about a day.
  const left = spent.map((v) => s.pool + s.extra - v)

  const pctOfPool = s.pool > 0 ? Math.round((s.spent / s.pool) * 100) : null

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass flex aspect-square flex-col justify-between rounded-card p-5">
        <div>
          <div className="text-small font-bold text-muted">{t('money.spent')}</div>
          <div className="mt-2 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
            {fmt(s.spent)}
          </div>
        </div>
        <div>
          <Spark points={spent} tone="ink" />
          <div className="mt-2 text-small leading-snug text-muted">
            {pctOfPool === null
              ? t('money.tile_no_pool')
              : t('money.tile_pct_of_free', { pct: pctOfPool })}
          </div>
        </div>
      </div>

      <div className="glass flex aspect-square flex-col justify-between rounded-card p-5">
        <div>
          <div className="text-small font-bold text-muted">{t('money.left')}</div>
          <div className="mt-2 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
            {fmt(s.left)}
          </div>
        </div>
        <div>
          <Spark points={left} tone="accent" />
          <div className="mt-2 text-small leading-snug text-muted">
            {t('money.tile_per_day', { amount: fmt(Math.max(0, s.perDay)) })}
          </div>
        </div>
      </div>
    </div>
  )
}
