import { useT } from '../lib/i18n'
import { BookIcon, ListIcon, ScaleIcon, SuitcaseIcon } from './ActionBar'

/**
 * Four ways in, as cards rather than as figures.
 *
 * WHAT THESE REPLACED, AND WHAT WENT WITH THEM.
 *
 * The bottom of the budget used to be three blocks of arithmetic: the pace
 * sparkline, a "this month" tile grid, and the after-bills figure. They were
 * removed on purpose, and it is worth writing down what that cost, because two
 * of the numbers had nowhere else to live.
 *
 *   after bills   survives. PlanVsActual on the plan pane carries the same
 *                 figure as its "free" row, planned beside actual.
 *   days left     survives. It is the page heading's own subtitle.
 *   a day from    GONE from every read view. It is still collected and still
 *                 computed; nothing reads it back but the plan form's tile.
 *
 * That last one is a real loss and is recorded here rather than discovered
 * later by somebody wondering where it went.
 *
 * WHY A CARD AND NOT A ROW.
 *
 * These four sections are the ones nobody opens by accident. The pills at the
 * top get you there once you know they exist, and a pill is a word: it can say
 * "Formation" and it cannot say what the formation is for. A card can carry the
 * sentence that makes somebody press it, which is the whole job of this block.
 *
 * The icons are the pane's own, at twice the size they are in the pills. Same
 * glyph in both places, so the card and the tab you land on are recognisably
 * the same thing.
 */
const CARDS = [
  { pane: 'formation', icon: <BookIcon />, key: 'formation', well: 'bg-cat-1-soft' },
  { pane: 'projects', icon: <SuitcaseIcon />, key: 'projects', well: 'bg-cat-3-soft' },
  { pane: 'benchmarks', icon: <ScaleIcon />, key: 'benchmarks', well: 'bg-cat-4-soft' },
  { pane: 'log', icon: <ListIcon />, key: 'log', well: 'bg-cat-6-soft' },
]

export default function FeatureCards({ onOpen }) {
  const { t } = useT()

  return (
    <div className="grid grid-cols-2 gap-4" data-hook="features">
      {CARDS.map((c) => (
        <button
          key={c.key}
          type="button"
          data-feature={c.key}
          onClick={() => onOpen?.(c.pane)}
          /* items-start, so a two-line title and a five-line body both stack
             from the same left edge rather than centring against each other. */
          className="press glass-card flex flex-col items-start rounded-3xl p-5 text-left"
        >
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-ink
                        [&>svg]:h-7 [&>svg]:w-7 ${c.well}`}
          >
            {c.icon}
          </span>
          <span className="mt-4 block text-body font-bold leading-tight text-ink">
            {t(`feat.${c.key}_t`)}
          </span>
          {/* The sentence that earns the tap. Small and muted, so the title is
              still the thing the eye lands on: the hierarchy is carried by
              weight and size, because on a light card there is no lightness
              left to spend on it. */}
          <span className="mt-1.5 block text-small leading-snug text-muted">
            {t(`feat.${c.key}_d`)}
          </span>
        </button>
      ))}
    </div>
  )
}
