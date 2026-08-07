import { useT } from '../lib/i18n'
import CycleChart from './CycleChart'
import TrendChart from './TrendChart'

/**
 * The analytics block: a dark metric card with capsule bars, beside a
 * saturated chart card carrying a pinned readout.
 *
 * This was one white panel with a number in its corner and the bars beneath.
 * What the reference gets right is that the two questions have different
 * shapes — "how much" is a figure with bars under it, "which way" is a curve
 * — and asking one panel to answer both meant it answered neither loudly.
 *
 * The two cards are the only saturated surfaces on the dashboard, which is
 * what keeps them reading as the data rather than as decoration: everything
 * around them is white with coloured type.
 *
 * On a phone they stack and both take the full column. Below `lg` a chart
 * squeezed into half the width is a smear.
 */

/** The reference's metric badge. Drawn rather than imported — one glyph. */
function Bolt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M13 2 4.5 13.2h5.8L11 22l8.5-11.2h-5.8L13 2Z" fill="currentColor" />
    </svg>
  )
}

export default function ConsistencyPanel({ rate, trend, cycles, goalCount, groupCount }) {
  const { t } = useT()

  return (
    <div className="stagger grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* The one dark surface in the app. It is the theme's own ink — deep
          plum in sun, deep teal in sea — rather than black, so white on it
          measures 7:1 and it still belongs to the palette. */}
      <div style={{ '--i': 0 }} className="rounded-card bg-ink p-6 text-white sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-white/15">
            <Bolt />
          </span>
          <span className="text-small font-bold">{t('me.checked_in')}</span>
        </div>

        <div className="mt-6 flex items-baseline gap-1">
          <span className="text-[3.5rem] font-bold leading-none tracking-[-0.045em] [font-variant-numeric:tabular-nums]">
            {rate.pct !== null ? rate.pct : '—'}
          </span>
          {/* The unit picked out in colour, as in the reference. It is a glyph
              rather than a label, so the hue carries no meaning on its own. */}
          <span className="text-[2rem] font-bold leading-none tracking-[-0.03em] text-spark">
            %
          </span>
        </div>
        <p className="mt-2 text-small text-white/65">
          {rate.total ? `${rate.done}/${rate.total} · ${t('me.rate_window')}` : t('me.no_cycles')}
        </p>

        <CycleChart rows={cycles} count={12} tone="dark" className="mt-7" />

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-small text-white/65">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-pill bg-white/90" />
            {t('me.legend_in')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-pill bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgb(255_255_255/0.5)_2px,rgb(255_255_255/0.5)_4px)] ring-1 ring-inset ring-white/25" />
            {t('me.legend_away')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-pill bg-white/[0.18]" />
            {t('me.legend_missed')}
          </span>
        </div>
      </div>

      {/* The field colour with black on it, exactly as the reference puts its
          chart on the loudest surface it has. */}
      <div
        style={{ '--i': 1 }}
        className="flex flex-col rounded-card bg-field p-6 text-on-field sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-pill bg-on-field/10 px-3.5 py-1.5 text-small font-bold">
            {t('me.last12')}
          </span>
          <span className="text-small font-semibold text-on-field/60">
            {t('me.rate_note_short')}
          </span>
        </div>

        {/* Centred in whatever height is left over. The left card is taller —
            a bar chart plus a legend — and pinning the curve directly under
            the header stranded it above a block of empty colour. */}
        <div className="flex flex-1 items-center py-4">
          <TrendChart series={trend} />
        </div>

        {/* Two figures that were buried in the corner of the old panel. On
            their own row they are readable; set beside a 56px number they
            were decoration. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-inner bg-on-field/10 px-4 py-3">
            <div className="text-h2 leading-none [font-variant-numeric:tabular-nums]">
              {goalCount}
            </div>
            <div className="mt-1.5 text-small text-on-field/70">{t('me.live_goals')}</div>
          </div>
          <div className="rounded-inner bg-on-field/10 px-4 py-3">
            <div className="text-h2 leading-none [font-variant-numeric:tabular-nums]">
              {groupCount}
            </div>
            <div className="mt-1.5 text-small text-on-field/70">{t('home.groups')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
