import { useState } from 'react'
import { useT } from '../lib/i18n'
import { Sheet } from './ui'
import { Gauge } from './Envelopes'
import { SNAPSHOT, compareRate, otherBasisFor } from '../lib/benchmarks'

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
export default function WealthRank({ rate, months, country, band, onAddTransaction }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)

  const code = country ?? 'CA'
  /* The band, when the profile has a birthday to derive one from. Where there
     is one the comparison is against people the same age, which is the useful
     one: a 24-year-old and a 50-year-old both saving 4 % are not doing the same
     thing, and telling them both "under the national 6 %" tells neither
     anything. Where there is not, it falls back to the country and the screen
     says which it used. */
  const cmp = compareRate(rate, code, band)
  const bench = cmp.benchmark
  /* A country with no household rate at all. See OTHER_BASIS: what exists for
     Cote d'Ivoire is a different measure, and it is shown as information rather
     than as a rank. */
  const other = bench ? null : otherBasisFor(code)
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
            arc="stroke-mark"
            track="stroke-mark/20"
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
              arc="stroke-mark"
              track="stroke-mark/20"
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
          ) : !bench ? (
            /* No household rate published for this country. Say so, name what
               does exist, and do not draw a rank against it. */
            <div data-hook="rank-nobasis" className="mt-6">
              <p className="text-center text-body leading-relaxed text-ink">
                {t('rank.no_basis', { country: t(`bm.c_${code}`) })}
              </p>
              {other && (
                <p className="mt-3 text-center text-small leading-relaxed text-muted">
                  {t('rank.other_basis', { n: other.rate, country: t(`bm.c_${code}`) })}
                </p>
              )}
            </div>
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
                  compare their sweep, and these two are not on one scale.

                  The row NAMES which comparison it is. "You against people your
                  age" and "you against the country" are different claims, and
                  showing one while the reader assumes the other is the quiet
                  way this feature could mislead. */}
              <dl data-hook="rank-against" className="mt-5 flex items-baseline justify-between gap-3 rounded-2xl bg-ink/[0.04] px-4 py-3">
                <dt className="min-w-0 text-small font-semibold text-ink">
                  {bench.scope === 'age'
                    ? t('rank.same_age', { band: t(`rank.band_${bench.band}`) })
                    : t(`bm.c_${code}`)}
                </dt>
                <dd className="shrink-0 text-small font-semibold text-ink [font-variant-numeric:tabular-nums]">
                  {bench.rate} %
                </dd>
              </dl>
              <p className="mt-3 text-center text-small leading-relaxed text-muted">
                {t('rank.window', { n: months })}
                {bench.scope === 'country' && ` ${t('rank.no_band')}`}
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

          {/**
           * WHAT THE NUMBER IS, then where it came from.
           *
           * This used to be one run of small grey text: source, then a caveat
           * about national accounts and employer pension contributions, then a
           * snapshot date. It was the most confusing thing on the screen, and
           * the reason is that it answered "where is this from" without ever
           * answering "what IS this", which is the question somebody looking at
           * a percentage actually has.
           *
           * So the plain sentence comes first and gets its own heading, and the
           * provenance follows it in the fine print where provenance belongs.
           */}
          <div className="mt-7 border-t border-hairline pt-5">
            <p className="text-label font-semibold uppercase tracking-wider text-muted">
              {t('rank.what_title')}
            </p>
            <p data-hook="rank-what" className="mt-2 text-small leading-relaxed text-ink">
              {t('rank.what_body')}
            </p>
            <p data-hook="rank-note" className="mt-3 text-label leading-relaxed text-muted">
              {(bench ?? other)?.source}, {(bench ?? other)?.period}. {t('bm.snapshot', { d: SNAPSHOT })}
            </p>
          </div>
        </div>
      </Sheet>
    </>
  )
}
