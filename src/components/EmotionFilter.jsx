import { emojiOf } from '../lib/emotions'
import { formatCurrency } from '../lib/currency'
import { localeTag, useT } from '../lib/i18n'

/**
 * What each feeling cost this period.
 *
 * The point of tagging a spend is being able to ask the question later, and
 * the question is almost always one of two: how much did stress cost me, and
 * which of these is the big one. So the bar is both the answer and the filter,
 * rather than a chart somewhere else and a control here.
 *
 * ONLY WHAT ACTUALLY HAPPENED. emotionTotals returns the feelings with spend
 * against them, so a month with two tagged transactions shows two chips rather
 * than thirteen, eleven of them at zero. A bar showing the whole palette is a
 * picture of the palette, not of the month.
 *
 * THE TOTALS DO NOT SUM TO THE MONTH, ON PURPOSE. A transaction tagged two
 * feelings counts its full amount under both: forty dollars spent while
 * stressed and impulsive is forty of each, not twenty. Splitting it would
 * invent a precision nobody expressed. The line under the chips says so when a
 * filter is on, because a total that does not add up is the kind of thing
 * somebody would otherwise reasonably report as a bug.
 */
export default function EmotionFilter({ totals = [], active = null, onChange, currency, matched = 0 }) {
  const { t, locale } = useT()
  if (totals.length === 0) return null

  const tag = localeTag(locale)

  return (
    <div className="lg px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">{t('emo.insights')}</p>
        {active && (
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="press text-small font-semibold text-ink underline-offset-4 hover:underline"
          >
            {t('emo.clear')}
          </button>
        )}
      </div>

      {/**
       * Scrolls sideways rather than wrapping to four lines.
       *
       * A wrapping row pushes the whole transaction list down by however many
       * feelings happen to have been used this month, so the page moves under
       * the thumb as the month fills up. A single row that scrolls keeps the
       * list where it was. The negative margin lets it bleed to the card's
       * edge, so the last chip is visibly cut rather than looking like the end.
       */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {totals.map(({ id, cents, count }) => {
          const on = active === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange?.(on ? null : id)}
              className={`press flex shrink-0 items-center gap-2 rounded-pill px-3 py-2 text-small ring-1 ring-inset transition-[background-color,box-shadow] duration-200 ease-settle active:scale-[0.97] ${
                on ? 'bg-accent/[0.16] ring-accent/45' : 'bg-ink/[0.04] ring-transparent hover:bg-ink/[0.08]'
              }`}
            >
              <span aria-hidden="true" className="text-body leading-none">
                {emojiOf(id)}
              </span>
              <span className="font-semibold text-ink">{t(`emo.${id}`)}</span>
              <span className="text-muted [font-variant-numeric:tabular-nums]">
                {formatCurrency(cents, currency, [tag])}
              </span>
              <span className="sr-only">{t('emo.count', { n: count })}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <p className="animate-rise mt-2 text-small text-muted">
          {t('emo.filtered', { n: matched })}
        </p>
      )}
    </div>
  )
}
