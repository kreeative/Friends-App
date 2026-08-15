import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { dailySeries } from '../lib/budget'
import Sparkline from './Sparkline'

/**
 * The bare polyline that used to live here is now Sparkline, which adds the
 * gradient, the endpoint and the draw-on. Same geometry, same argument about
 * not measuring anything; see that file.
 */

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

  /**
   * What remains, day by day. Same series read from the other end, so the two
   * lines cannot disagree about a day.
   *
   * `balance`, not `available`: this tile is headed "what is left", which is a
   * question about money in hand, and the answer is what came in less what went
   * out. Subtracting charges that have not been paid yet would put a fresh
   * account at minus the rent before anything had happened, which is the same
   * lie the headline used to tell with the sign the other way round.
   *
   * What is left AFTER those obligations is a different question, and it has
   * its own line, labelled "free", in the planned-against-actual card below.
   */
  const left = spent.map((v) => s.earned - v)

  /* Against the PLAN, because "how much of my free money have I got through" is
     a question about the plan. Against actual it would read 0% all month for
     anybody who logs no income. */
  const pctOfPool = s.plannedPool > 0 ? Math.round((s.spent / s.plannedPool) * 100) : null

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass flex aspect-square flex-col justify-between rounded-card p-5">
        <div>
          <div className="text-small font-semibold text-muted">{t('money.spent')}</div>
          <div className="mt-2 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
            {fmt(s.spent)}
          </div>
        </div>
        <div>
          <Sparkline points={spent} tone="ink" height={38} className="mt-3" />
          <div className="mt-2 text-small leading-snug text-muted">
            {pctOfPool === null
              ? t('money.tile_no_pool')
              : t('money.tile_pct_of_free', { pct: pctOfPool })}
          </div>
        </div>
      </div>

      <div className="glass flex aspect-square flex-col justify-between rounded-card p-5">
        <div>
          <div className="text-small font-semibold text-muted">{t('money.left')}</div>
          <div className="mt-2 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
            {fmt(s.balance)}
          </div>
        </div>
        <div>
          <Sparkline points={left} tone="accent" height={38} className="mt-3" />
          <div className="mt-2 text-small leading-snug text-muted">
            {t('money.tile_per_day', { amount: fmt(Math.max(0, s.perDay)) })}
          </div>
        </div>
      </div>
    </div>
  )
}
