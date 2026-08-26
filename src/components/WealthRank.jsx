import { useState } from 'react'
import { useT } from '../lib/i18n'
import { Sheet } from './ui'
import { Gauge } from './Envelopes'
import { SNAPSHOT, benchmarkFor, compareRate } from '../lib/benchmarks'

/**
 * Your saving rate against everybody else's, as one card and one sheet.
 *
 * WHAT THIS REPLACED.
 *
 * A whole pane: two bars, a shares table, a standing sentence and a paragraph
 * of methodology, all sitting in the budget's feed whether or not anybody
 * wanted it. Most of it was a footnote wearing a section's clothes. The rate
 * against the published one is the only part somebody would open on purpose,
 * so that is what the card promises and the sheet delivers, and the
 * methodology goes where a methodology belongs: at the bottom, small.
 *
 * IT STILL DOES NOT COMPARE YOU TO OTHER USERS.
 *
 * 19_budget.sql rules that out and nothing here changes it. The figure on the
 * other side of the gauge is a national accounts household saving rate that
 * ships inside the bundle. No query leaves the device for this card, there is
 * no aggregate endpoint, and there is no wire to widen later.
 *
 * THE LOCKED STATE IS A REAL STATE, NOT AN ERROR.
 *
 * A rate needs logged income to be a rate at all. Rather than printing 0 % to
 * somebody who has simply never logged a paycheque, which is a claim rather
 * than a blank, the gauge locks and the sheet says what would unlock it. The
 * primary button then does that exact thing.
 */
export default function WealthRank({ rate, months, country, onAddTransaction }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)

  const code = country ?? 'CA'
  const cmp = compareRate(rate, code)
  const bench = cmp.benchmark ?? benchmarkFor('CA')
  const locked = rate == null || !Number.isFinite(rate)
  const mine = locked ? null : Math.round(rate)

  /**
   * A FIXED ceiling, not the larger of the two figures.
   *
   * Scaling to the maximum of the pair sounded right and is useless: whoever is
   * higher fills the arch completely, so anybody saving more than the published
   * rate saw a full dial no matter what they saved. 17 % and 40 % drew the same
   * picture.
   *
   * 30 % is the ceiling because it is a genuinely strong household rate, well
   * above every figure in the published table, so a full arch means something.
   * Past it the arch pins rather than overflowing, which is the honest way for
   * a dial to say "off the top of this scale".
   */
  const CEILING = 30
  const fill = (v) => (v == null ? 0 : Math.min(100, Math.max(0, (v / CEILING) * 100)))

  return (
    <>
      <button
        type="button"
        data-hook="rank-card"
        onClick={() => setOpen(true)}
        className="press glass-card flex w-full items-center gap-4 rounded-3xl p-5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold leading-tight text-ink">
            {t('rank.card_title')}
          </span>
          <span className="mt-1.5 block text-small leading-snug text-muted">
            {t('rank.card_sub')}
          </span>
        </span>

        {/* The ring is the teaser: it shows the number without explaining it,
            which is the job. Locked, it shows the track and a dash. */}
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <Gauge
            pct={locked ? 0 : fill(mine)}
            size={64}
            stroke={6}
            sweep={1}
            dim={locked}
            arc="stroke-cat-3"
            track="stroke-cat-3/20"
          >
            <span className="text-label font-bold leading-none text-ink [font-variant-numeric:tabular-nums]">
              {locked ? '–' : `${mine} %`}
            </span>
          </Gauge>
        </span>

        {/* The affordance, and it is a shape rather than a colour: 1.4.1, and
            an arrow says "this goes somewhere" to everybody. */}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent/[0.18] text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('rank.modal_title')}>
        <div data-hook="rank-sheet">
          {/**
           * The arch, at 0.5 sweep: a semicircle with its mouth at the bottom,
           * which is the shape a dial has. A closed ring reads as a proportion
           * of a whole and this is not one, it is a position on a scale.
           */}
          <div className="flex justify-center">
            <Gauge
              pct={locked ? 0 : fill(mine)}
              size={200}
              stroke={16}
              sweep={0.5}
              dim={locked}
              arc="stroke-cat-3"
              track="stroke-cat-3/20"
            >
              <span
                data-hook="rank-value"
                className="font-display text-hero leading-none text-ink [font-variant-numeric:tabular-nums]"
              >
                {locked ? '–' : `${mine} %`}
              </span>
              <span className="mt-1 block text-label font-semibold uppercase tracking-wider text-muted">
                {t('rank.yours')}
              </span>
            </Gauge>
          </div>

          {locked ? (
            <p data-hook="rank-locked" className="mt-6 text-center text-body leading-relaxed text-muted">
              {t('rank.locked')}
            </p>
          ) : (
            <>
              <p
                data-hook="rank-standing"
                className="mt-6 text-center font-display text-h2 leading-tight text-ink"
              >
                {t(`rank.standing_${cmp.standing}`)}
              </p>

              {/* The other side of the comparison, as a plain row rather than a
                  second gauge. Two dials side by side invite the reader to
                  compare their sweep, and these two are not on one scale. */}
              <dl className="mt-5 flex items-baseline justify-between gap-3 rounded-2xl bg-ink/[0.04] px-4 py-3">
                <dt className="text-small font-semibold text-ink">{t(`bm.c_${code}`)}</dt>
                <dd className="shrink-0 text-small font-semibold text-ink [font-variant-numeric:tabular-nums]">
                  {bench?.rate} %
                </dd>
              </dl>
              <p className="mt-3 text-center text-small leading-relaxed text-muted">
                {t('rank.window', { n: months })}
              </p>
            </>
          )}

          <button
            type="button"
            className="btn-primary press mt-7"
            onClick={() => { setOpen(false); onAddTransaction?.() }}
          >
            {t('txn.open')}
          </button>

          {/* The methodology, in fine print, which is where a methodology
              belongs. It used to be a paragraph in the middle of the budget
              feed. */}
          <p data-hook="rank-note" className="mt-5 text-center text-label leading-relaxed text-muted">
            {bench?.source}, {bench?.period}. {t('bm.caveat')} {t('bm.snapshot', { d: SNAPSHOT })}
          </p>
        </div>
      </Sheet>
    </>
  )
}
