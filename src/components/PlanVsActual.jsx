import { useT } from '../lib/i18n'
import { money } from '../lib/money'

/**
 * What you meant to do, beside what happened.
 *
 * These were one column of numbers, and that was the bug: `left` was computed
 * as the plan minus this period's spending, so a salary nobody had received
 * and a rent nobody had paid were both treated as facts the moment the setup
 * form was saved. An account thirty seconds old reported fifteen hundred
 * dollars available.
 *
 * Two columns is the fix, and it is a fix in the reading as much as in the
 * arithmetic. A plan is a claim about the future and is worth showing; it just
 * must not be dressed as a bank balance. Side by side, the gap between them is
 * the interesting part: it is how far through the month's intentions you
 * actually are.
 *
 * The rows line up deliberately. Income against what has come in, charges
 * against what has gone out on them, free against what is genuinely spendable.
 * Anything else would be two lists that happen to be adjacent.
 */
export default function PlanVsActual({ s, locale }) {
  const { t } = useT()
  const fmt = (c) => money(c, s.currency, locale)

  const rows = [
    { label: t('money.row_income'), plan: s.income, real: s.earned },
    { label: t('money.row_fixed'), plan: s.committed, real: s.fixedPaid },
    /* Savings has no actual side. Nothing in this app records money moved into
       an account it cannot see, and inventing a zero there would read as "you
       have saved nothing" rather than as "this is not measured". */
    ...(s.savings > 0 ? [{ label: t('money.row_savings'), plan: s.savings, real: null }] : []),
  ]

  /* The hook is on the card below. It has been div.lg and is now glass-card,
     and both suites that read it were keyed to the class. */
  /* The amount columns are 5.25rem, not 4.75. At 76px the total row's
     "1 430,00 $" wanted 78 and spilled its own box by two pixels: not enough
     to look broken in a screenshot, enough to clip the leading digit of a
     larger figure. Measured, not guessed.

     Written here rather than inside the JSX because a comment before the root
     element of a return is the trap CLAUDE.md already records for this exact
     file. It broke it silently once; this time it was a syntax error. */
  return (
    <div data-card="planvsactual" className="glass-card rounded-3xl px-5 py-2">
      {/* The two headings are the whole point, so they carry the weight. */}
      <div className="flex items-baseline gap-2 border-b border-hairline py-3 sm:gap-4">
        <span className="min-w-0 flex-1" aria-hidden="true" />
        <span className="w-[5.25rem] sm:w-[5.5rem] text-right text-label font-semibold uppercase tracking-[0.05em] text-muted">
          {t('money.planned')}
        </span>
        <span className="w-[5.25rem] sm:w-[5.5rem] text-right text-label font-semibold uppercase tracking-[0.05em] text-ink">
          {t('money.actual')}
        </span>
      </div>

      {rows.map(({ label, plan, real }) => (
        <div key={label} className="flex items-baseline gap-2 border-b border-hairline py-3.5 sm:gap-4">
          <span className="min-w-0 flex-1 truncate text-body text-ink">{label}</span>
          <span className="w-[5.25rem] sm:w-[5.5rem] shrink-0 text-right text-small text-muted [font-variant-numeric:tabular-nums]">
            {fmt(plan)}
          </span>
          <span className="w-[5.25rem] sm:w-[5.5rem] shrink-0 text-right text-small font-semibold text-ink [font-variant-numeric:tabular-nums]">
            {real === null ? (
              /* The full muted ink, not a faded one. The dash means "no
                 value", which is information, and a lighter tint of it
                 measured 2.45:1 on the card. */
              <span className="text-muted">–</span>
            ) : (
              fmt(real)
            )}
          </span>
        </div>
      ))}

      {/* The bottom line, and the two halves of it mean different things.
          Planned free is income minus everything the plan sets aside. Actual
          available is what has really arrived, minus what has really gone, minus
          what is still owed. They are only equal in a month that went exactly
          to plan, which is a month nobody has. */}
      <div className="flex items-baseline gap-2 py-4 sm:gap-4">
        <span className="min-w-0 flex-1 text-body font-semibold text-ink">{t('money.row_free')}</span>
        <span className="w-[5.25rem] sm:w-[5.5rem] shrink-0 text-right text-small text-muted [font-variant-numeric:tabular-nums]">
          {fmt(s.plannedPool)}
        </span>
        <span
          className={`w-[5.25rem] sm:w-[5.5rem] shrink-0 text-right text-body font-semibold [font-variant-numeric:tabular-nums] ${
            s.available < 0 ? 'text-negative' : 'text-ink'
          }`}
        >
          {fmt(s.available)}
        </span>
      </div>
    </div>
  )
}
