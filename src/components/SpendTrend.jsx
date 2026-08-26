import { useT } from '../lib/i18n'
import { moneyParts } from '../lib/money'
import { dailySeries } from '../lib/budget'
import Sparkline from './Sparkline'

/**
 * Spending across the month, as one wide card.
 *
 * This replaces the two square tiles, which were broken in a way that only
 * showed up on a real month's data. They were `aspect-square`, so on a 390px
 * screen each was about 168 by 168, and into that went a label, a number at
 * heading size, a 38px sparkline and a caption. The caption is a sentence in
 * French. It did not fit, so it spilled out of the bottom of the card and sat
 * under the tab bar, and there is no width at which "Il te reste 153,00 $ par
 * jour à partir d'ici" fits in half a phone.
 *
 * They were also saying things the pane had already said. The left tile was
 * the spent total, which is in the headline sentence directly above it; the
 * right tile was the balance, which IS the headline. Two of the four figures
 * on the pane were repeats, and one of the other two contradicted a row
 * further down that carried the same label.
 *
 * So: one card, full width, and the only thing on it is the thing nothing
 * else on the pane shows, which is the shape of the month. A sparkline needs
 * width more than it needs anything else, and now it has all of it.
 */
export default function SpendTrend({ s, locale }) {
  const { t } = useT()

  const spent = dailySeries({ entries: s.entries, period: s.period })

  /* Against the PLAN, because "how much of my free money have I got through"
     is a question about the plan. Against actual it would read 0% all month
     for anybody who logs no income. */
  const pctOfPool = s.plannedPool > 0 ? Math.round((s.spent / s.plannedPool) * 100) : null

  const a = moneyParts(s.spent, s.currency, locale)

  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-label font-semibold uppercase tracking-wider text-muted">
          {t('money.pace')}
        </span>
        {/**
         * The percentage is the caption the tiles could not fit, reduced to
         * the part that carries information and moved up beside the total
         * where there is room for it on one line.
         *
         * Past 100 it says "de trop", not "116 % of what was free". A figure
         * over a hundred per cent is only obviously bad if you are already
         * holding the denominator in your head, and the phrasing is the same
         * one the envelope cards use for the same condition. The colour
         * changes too, but the words carry it on their own: colour is never
         * the only signal (WCAG 1.4.1).
         */}
        {pctOfPool !== null && (
          <span
            className={`text-label [font-variant-numeric:tabular-nums] ${
              pctOfPool > 100 ? 'font-semibold text-negative' : 'text-muted'
            }`}
          >
            {pctOfPool > 100
              ? t('money.tile_pct_over_free', { pct: pctOfPool - 100 })
              : t('money.tile_pct_of_free', { pct: pctOfPool })}
          </span>
        )}
      </div>

      <p className="mt-1.5 font-display text-h1 leading-none text-ink [font-variant-numeric:tabular-nums]">
        {a.head}
        <span className="text-[0.62em] align-baseline text-muted">{a.cents}</span>
        {a.suffix}
      </p>

      {/* Full width, which is the whole reason this card exists. */}
      <Sparkline points={spent} tone="ink" height={54} className="mt-4" />
    </div>
  )
}
