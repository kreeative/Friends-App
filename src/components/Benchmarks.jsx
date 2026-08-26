import { useT } from '../lib/i18n'
import { Empty, Section } from './ui'
import { COUNTRIES, SNAPSHOT, compareRate, compareShares } from '../lib/benchmarks'

/**
 * How you compare, against published statistics and nobody's personal data.
 *
 * "Comparer son niveau d'epargne par rapport a d'autres gens de son pays base
 * sur une statistique."
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 * It does not compare you to other people using this app. That version was the
 * first thing considered and it is the one thing 19_budget.sql rules out:
 * answering "how do I compare to other users" means reading other users' money,
 * and a per-user aggregate over a small group is not anonymous anyway. Four
 * friends and a mean is arithmetic anybody can invert.
 *
 * So the comparison is against national accounts figures that ship inside the
 * bundle. No query leaves the device for this pane, there is no aggregate
 * endpoint to build, and the feature cannot become a privacy problem later
 * because there is no wire to widen.
 *
 * IT SAYS WHAT THE NUMBER IS NOT.
 *
 * A household saving rate from national accounts and "what I moved into savings
 * this month" are close in spirit and not identical in method. The caveat is on
 * the card rather than in a footnote, because a comparison whose limits are
 * hidden invites exactly the false precision it should be preventing. Same
 * reason the standing has a two-point dead band: see compareRate.
 */
export default function Benchmarks({ rate, months, byCategory = [], country, onCountry, locale }) {
  const { t } = useT()

  /* No country picked and none detectable. The picker is the whole pane until
     there is one, rather than Canada standing in for somebody in Abidjan. */
  const cmp = country ? compareRate(rate, country) : { standing: null, delta: null, benchmark: null }
  const shares = country ? compareShares(byCategory, country) : null

  const Picker = (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('bm.country')}</span>
      <select
        data-hook="country"
        value={country ?? ''}
        onChange={(e) => onCountry?.(e.target.value || null)}
        className="rounded-pill border border-hairline bg-[rgb(var(--glass-tint))] px-4 py-2
                   text-small font-semibold text-ink outline-none transition-shadow duration-200
                   ease-settle focus:ring-2 focus:ring-inset focus:ring-accent/70"
      >
        <option value="">{t('bm.country')}</option>
        {COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {t(`bm.c_${c}`)}
          </option>
        ))}
      </select>
    </label>
  )

  if (!country) {
    return (
      <Section title={t('bm.title')} action={Picker}>
        <div className="glass-card rounded-3xl p-6">
          <Empty>{t('bm.pick_country')}</Empty>
        </div>
      </Section>
    )
  }

  const mine = rate == null ? null : Math.round(rate)
  const theirs = cmp.benchmark?.rate ?? null
  /* Both bars are drawn against the taller of the two, so the shorter one is
     genuinely shorter. Scaling each to its own maximum would draw two full
     bars and call it a comparison. */
  const scale = Math.max(mine ?? 0, theirs ?? 0, 1)

  return (
    <>
      <Section title={t('bm.title')} action={Picker}>
        <div data-card="benchmark" className="glass-card rounded-3xl p-5">
          {mine == null ? (
            <p className="text-small leading-relaxed text-muted">{t('bm.no_rate')}</p>
          ) : (
            <>
              <p
                data-hook="standing"
                className="font-display text-h2 leading-tight text-ink"
              >
                {t(`bm.standing_${cmp.standing}`)}
              </p>
              <p className="mt-1.5 text-small leading-relaxed text-muted">
                {t('bm.standing_note', { n: months })}
              </p>
            </>
          )}

          <dl className="mt-5 space-y-3.5">
            {[
              ['you', mine, t('bm.you')],
              ['them', theirs, t(`bm.c_${country}`)],
            ].map(([who, value, label]) => (
              <div key={who} data-hook={`bar-${who}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-small font-semibold text-ink">{label}</dt>
                  <dd className="shrink-0 text-small font-semibold text-ink [font-variant-numeric:tabular-nums]">
                    {value == null ? t('bm.unknown') : `${value} %`}
                  </dd>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-pill bg-ink/10">
                  <div
                    /* Ink for the published figure, accent for you. Not two
                       shades of the accent: 1.4.1 says colour cannot be the
                       only signal, and the label above each bar carries it
                       anyway, so this is reinforcement rather than the message. */
                    className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
                      who === 'you' ? 'bg-accent' : 'bg-ink/45'
                    }`}
                    style={{ width: `${Math.min(100, ((value ?? 0) / scale) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>

          {/* Provenance on the card, not in a tooltip. */}
          <p className="mt-5 border-t border-hairline pt-4 text-small leading-relaxed text-muted">
            {cmp.benchmark?.source}, {cmp.benchmark?.period}. {t('bm.caveat')}
          </p>
        </div>
      </Section>

      {/**
       * The second table: where your money goes against where everybody's does.
       *
       * Only Canada has one, because only Canada has a survey in this shape.
       * Rendering an empty table for everybody else would imply the data exists
       * and simply failed to load.
       */}
      {shares && (
        <Section title={t('bm.shares')}>
          <div className="glass-card overflow-hidden rounded-3xl">
            <table data-hook="shares" className="w-full text-small">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-5 py-3 text-left font-semibold text-muted">
                    {t('bm.category')}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold text-muted">
                    {t('bm.you')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold text-muted">
                    {t(`bm.c_${country}`)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {shares.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="px-5 py-3 text-left font-semibold text-ink">
                      {t(`money.cat_${r.key}`)}
                    </th>
                    <td className="px-3 py-3 text-right font-semibold text-ink [font-variant-numeric:tabular-nums]">
                      {r.mine} %
                    </td>
                    <td className="px-5 py-3 text-right text-ink [font-variant-numeric:tabular-nums]">
                      {r.theirs} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-small leading-relaxed text-muted">
            {shares.source}, {shares.period}. {t('bm.snapshot', { d: SNAPSHOT })}
          </p>
        </Section>
      )}
    </>
  )
}
