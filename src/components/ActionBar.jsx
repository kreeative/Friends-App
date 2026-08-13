/**
 * The check-in's four jobs, as a row of quick actions.
 *
 * The screen was one long form: every goal with a counter, then a photo
 * gallery, then a person to celebrate, then a text field, then Submit. Four
 * unrelated things stacked into a single column, so the shortest possible
 * check-in, "yes, twice, done", still meant scrolling past three sections
 * nobody had asked for. The length of the page was the argument against using
 * it daily.
 *
 * One action per job, and only the chosen one is on screen.
 *
 * THE LABEL SITS UNDER THE TILE, NOT INSIDE IT.
 *
 * The first version put the icon, the word and the badge inside one card, which
 * meant the card had to be as wide as the longest word. "Objectifs" and
 * "Féliciter" then set the width of all four, four of them did not fit on a
 * 320px screen, and the only fix available was cutting words down to
 * "Objecti…".
 *
 * A square tile with the word underneath, the way every banking app's action
 * row does it, removes that constraint entirely. The tile is the tap target and
 * stays a fixed comfortable size; the word is free text below it that wraps to
 * a second line rather than being cut. Nothing truncates at any width this app
 * runs at, and the row is shorter than it was.
 *
 * TILES CARRY THEIR OWN STATE.
 *
 * This is what makes hiding three quarters of a form safe. A bar that hides
 * content leaves the reader no way to know whether the hidden parts are done,
 * half-filled or untouched, so each tile says: how many goals are logged, how
 * many photos are attached, whether a celebration has gone out. Submit then
 * never sends anything invisible.
 */
export default function ActionBar({ items, value, onChange }) {
  return (
    <div className="flex gap-2 sm:gap-3">
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={on}
            className="press group flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span
              /* Ink when active, paper when not. The same active treatment as
                 the period filter and the day badge, rather than a fourth idea
                 about what "selected" looks like in this app. */
              className={`relative flex h-14 w-14 items-center justify-center rounded-[1.15rem] transition-[background-color,color,box-shadow] duration-200 ${
                on
                  ? 'bg-ink text-white shadow-float'
                  : 'border border-hairline bg-[rgb(var(--glass-tint))] text-muted shadow-raised group-hover:text-ink'
              }`}
            >
              {item.icon}

              {/* On the corner of the tile, so the word underneath stays a
                  word. A count up here reads as a state of the thing rather
                  than as part of its name. */}
              {item.badge && (
                <span
                  className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-pill px-1 text-[0.625rem] font-semibold leading-none [font-variant-numeric:tabular-nums] ring-2 ring-[rgb(var(--c-bg))] ${
                    item.done ? 'bg-green text-white' : 'bg-accent text-on-accent'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </span>

            <span
              className={`text-center text-label font-semibold leading-tight transition-colors ${
                on ? 'text-ink' : 'text-muted group-hover:text-ink'
              }`}
            >
              {item.label}
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
