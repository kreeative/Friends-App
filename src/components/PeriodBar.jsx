import { PERIODS } from '../lib/completion'
import { useT } from '../lib/i18n'

/**
 * The window picker: 1D 1W 1M 3M 6M ALL.
 *
 * WHY THE LABELS SHRANK.
 *
 * They were words, "Jour Semaine Mois 3 mois 6 mois", and words is what made
 * this hard. Five of them at a readable size come to about 400px, which does
 * not fit in a card on a 390px phone, so the row either scrolled and hid its
 * last option or squeezed until the type was too small to read. A sixth
 * option, ALL, would have made it worse.
 *
 * The chart-filter convention solves it outright. "1W" is not shorter for the
 * sake of being shorter, it is the notation anybody who has looked at a price
 * chart already reads without translating, and six of them fit on a 320px
 * screen with room left over. The words have not gone anywhere: they are the
 * accessible name on each button, so a screen reader still says "six months"
 * rather than spelling out an abbreviation.
 *
 * The unit letter is localised, because D for day and W for week are English.
 * French reads 1J and 1S, which is what Wealthsimple's own French app uses.
 *
 * Its own file because the group table and the personal card both use it, and
 * two copies of a control is how the two come to disagree about what a window
 * means.
 */
export default function PeriodBar({ value, onChange }) {
  const { t } = useT()

  return (
    /**
     * A track with a moving pill in it, not six separate buttons.
     *
     * The container carries the recessed ground and the buttons carry nothing
     * until they are selected, which is what makes this read as one control
     * with a state rather than as a row of six things you could each press.
     *
     * flex-1 with a min-w-0 floor: the six share the width evenly at every
     * size the app runs at, and if a translation ever overflows they shrink
     * rather than pushing the last one off the edge. overflow-x-auto is the
     * last resort under that.
     */
    <div
      role="tablist"
      className="flex gap-0.5 overflow-x-auto rounded-pill bg-ink/[0.055] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {PERIODS.map((p) => {
        const on = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={on}
            /* The long name, said out loud. The button's visible text is an
               abbreviation, and an abbreviation is not what anybody listening
               to this page wants read to them. */
            aria-label={t(`analytics.period_${p.id}`)}
            onClick={() => onChange(p.id)}
            className={`press min-w-0 flex-1 whitespace-nowrap rounded-pill px-1 py-2 text-label font-bold uppercase tracking-[0.02em] transition-colors duration-200 ${
              on ? 'bg-ink text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]' : 'text-muted hover:text-ink'
            }`}
          >
            {t(`analytics.short_${p.id}`)}
          </button>
        )
      })}
    </div>
  )
}
