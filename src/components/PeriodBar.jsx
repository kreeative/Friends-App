import { PERIODS } from '../lib/completion'
import { useT } from '../lib/i18n'

/**
 * The window picker, as a segmented control rather than a scrolling row.
 *
 * Five pills at a comfortable size come to about 400px, which does not fit
 * inside a card on a 390px phone, and the version that scrolled hid the last
 * one off the right edge: a filter nobody can see is a filter nobody uses.
 * Sharing the width equally fits all five at every size this app runs at, and
 * the equal widths are honest anyway, these are five peers.
 *
 * overflow-x-auto stays as the floor. If a translation ever makes the labels
 * longer than the row, it scrolls rather than squashing the text to nothing.
 *
 * Its own file because the group table and the personal card both use it, and
 * two copies of a control is how the two come to disagree about what a window
 * means.
 */
export default function PeriodBar({ value, onChange }) {
  const { t } = useT()

  return (
    <div className="flex gap-1 overflow-x-auto rounded-pill bg-ink/[0.05] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PERIODS.map((p) => {
        const on = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={on}
            className={`press flex-1 whitespace-nowrap rounded-pill px-1 py-2 text-label font-bold transition-colors duration-200 ${
              on ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t(`analytics.period_${p.id}`)}
          </button>
        )
      })}
    </div>
  )
}
