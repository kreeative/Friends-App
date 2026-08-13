/**
 * The check-in's four jobs, as a row of tiles.
 *
 * The screen was one long form: every goal with a counter, then a photo
 * gallery, then a person to celebrate, then a text field, then Submit. Four
 * unrelated things stacked into a single column, so the shortest possible
 * check-in, "yes, twice, done", still meant scrolling past three sections
 * nobody had asked for. The length of the page was the argument against using
 * it daily.
 *
 * One tile per job, and only the chosen one is on screen. That is the same
 * total content, minus the obligation to scroll through the parts you are not
 * doing today.
 *
 * TILES CARRY THEIR OWN STATE.
 *
 * This is the thing that makes hiding content safe. A tab bar that hides three
 * quarters of a form leaves the reader with no way to know whether the hidden
 * parts are done, half-filled or untouched, so each tile says: how many goals
 * are logged, how many photos are attached, whether there is a celebration
 * waiting to send. Submit then never sends anything invisible.
 *
 * All four always visible, never a scroll. A tile clipped at the right edge is
 * a tile nobody presses, which is the mistake the period filter made when it
 * was five words wide. They share the width equally and the label truncates on
 * the narrowest phones rather than the last tile sliding off. The overflow
 * stays as the floor, for a fifth tile or a much longer translation.
 */
export default function ActionBar({ items, value, onChange }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={on}
            /* Ink when active, paper when not. The same active treatment as the
               period filter and the day badge, rather than a fourth idea about
               what "selected" looks like in this app. */
            className={`press flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1.5 rounded-card px-1.5 py-3.5 transition-[background-color,color,box-shadow] duration-200 ${
              on
                ? 'bg-ink text-white shadow-float'
                : 'border border-hairline bg-[rgb(var(--glass-tint))] text-muted hover:text-ink'
            }`}
          >
            <span className={on ? 'text-white' : 'text-muted'}>{item.icon}</span>
            {/* Truncating rather than widening. On a 320px screen four tiles
                at a comfortable width do not fit, and the choice is between a
                shortened word and a fourth tile half off the edge. A word you
                can still recognise beats a button you cannot see. */}
            <span className="w-full truncate text-center text-label font-bold">{item.label}</span>
            {/* Reserved whether or not there is a badge, so the tiles are the
                same height and the row does not jump as answers come in. */}
            <span
              className={`h-4 text-[0.625rem] font-bold leading-4 [font-variant-numeric:tabular-nums] ${
                on ? 'text-white/70' : 'text-muted/70'
              }`}
            >
              {item.badge ?? ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* Drawn, one stroke weight, so they inherit the tile's colour and sit at the
   same weight as the type under them. Not emoji: an emoji is a different
   typeface at a different weight in a colour nothing else on the page uses,
   which is why they came out of the budget banner. */

export function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="8.2" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
        <path d="M3 8.5h3.2L8 6h8l1.8 2.5H21v11H3z" strokeLinecap="round" />
        <circle cx="12" cy="13.5" r="3.4" />
      </g>
    </svg>
  )
}

export function PartyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20l4.6-10.4L15 16z" />
        <path d="M14 4.5v2M18.5 6.2l-1.4 1.4M20 11h-2" />
      </g>
    </svg>
  )
}

export function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h14" />
        <path d="M13 6.5l5.5 5.5L13 17.5" />
      </g>
    </svg>
  )
}
