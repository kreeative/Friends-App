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
    /* A stable hook. These tiles carry their counts in their accessible name,
       so matching them by text alone is ambiguous with the app's own tab bar
       ("Journal" is both a pane here and a destination down there). */
    <div data-actionbar="" className="flex gap-2 sm:gap-3">
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={on}
            /**
             * The name, then the count, with a comma between them.
             *
             * The badge is a child of this button, so without this its text
             * ran into the label and the accessible name came out as
             * "0/6Enveloppes": the count first, glued to the word, which is
             * both the wrong order and, in some readers, one token. The badge
             * is hidden below and its meaning is carried here instead.
             */
            aria-label={item.badge ? `${item.label}, ${item.badge}` : item.label}
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
                  aria-hidden="true"
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

/**
 * Solid, not outlined.
 *
 * These sat at strokeWidth 1.7 and read as wireframes: at 24px a hairline
 * outline is mostly the hole in the middle, so the tile's colour barely
 * changes when the tile goes active and the shape has to be looked at rather
 * than recognised. A filled glyph is a silhouette, and a silhouette is what
 * the eye matches at that size.
 *
 * Filled also means the tile's inversion actually reads: ink tile, white
 * glyph, a solid block of it, instead of a white outline on a dark square.
 *
 * Holes are cut with fill-rule evenodd rather than a second colour, so a
 * glyph is still one colour and still inherits currentColor. Everything else
 * is composed from rects, circles and short paths instead of one long path,
 * because a composed shape can be reasoned about and a 400-character path
 * cannot.
 *
 * Not emoji, for the reason recorded above: an emoji is a different typeface
 * at a different weight in a colour nothing else on the page uses.
 */
const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      {children}
    </g>
  </svg>
)

export function TargetIcon() {
  return (
    <Svg>
      {/* Two annuli and a pip. The rings are cut, not stroked, so the whole
          mark is one filled shape. */}
      <path d="M12 2.9a9.1 9.1 0 1 0 0 18.2 9.1 9.1 0 0 0 0-18.2Zm0 2.6a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z" />
      <path d="M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Zm0 2.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z" />
      <circle cx="12" cy="12" r="1.9" />
    </Svg>
  )
}

export function CameraIcon() {
  return (
    <Svg>
      {/* Body with the viewfinder bump, lens knocked out of it. */}
      <path d="M9.9 3.9H14.1L15.9 6.2H19.4A2.6 2.6 0 0 1 22 8.8V17.5A2.6 2.6 0 0 1 19.4 20.1H4.6A2.6 2.6 0 0 1 2 17.5V8.8A2.6 2.6 0 0 1 4.6 6.2H8.1ZM12 9.7a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
    </Svg>
  )
}

export function PartyIcon() {
  return (
    <Svg>
      {/* A popper and what comes out of it. */}
      <path d="M3.4 20.6 9.1 8.8 15.4 15.1Z" />
      <circle cx="16.4" cy="6" r="1.3" />
      <circle cx="20.1" cy="10.2" r="1" />
      <circle cx="19.8" cy="5" r=".8" />
      <circle cx="13" cy="4.4" r=".9" />
    </Svg>
  )
}

export function ForwardIcon() {
  return (
    <Svg>
      <rect x="3" y="10.4" width="12" height="3.2" rx="1.6" />
      <path d="M13.4 5.9 20.9 12 13.4 18.1Z" />
    </Svg>
  )
}

/* --- the money screen's four -------------------------------------------- */

export function GaugeIcon() {
  return (
    <Svg>
      {/* A half-donut with a needle, which is the shape the pool card draws:
          the tile and the pane behind it are the same picture. */}
      <path d="M2.5 16.5a9.5 9.5 0 0 1 19 0H17.5a5.5 5.5 0 0 0-11 0Z" />
      <path d="M10.77 15.64 16.31 9.7 16.89 10.1 13.23 17.36Z" />
      <circle cx="12" cy="16.5" r="1.9" />
    </Svg>
  )
}

export function EnvelopeIcon() {
  return (
    <Svg>
      {/* Filled body, flap cut out of it as a chevron. An outlined envelope at
          this size is four hairlines and a V; this one is a block. */}
      <path d="M4.6 5H19.4A2.6 2.6 0 0 1 22 7.6V16.4A2.6 2.6 0 0 1 19.4 19H4.6A2.6 2.6 0 0 1 2 16.4V7.6A2.6 2.6 0 0 1 4.6 5ZM5.3 7.9 12 12.9 18.7 7.9V10.1L12 15.1 5.3 10.1Z" />
    </Svg>
  )
}

export function PlanIcon() {
  return (
    <Svg>
      {/* Three columns of different heights: planned beside actual. */}
      <rect x="3.3" y="12" width="4.3" height="7" rx="1.7" />
      <rect x="9.85" y="6.5" width="4.3" height="12.5" rx="1.7" />
      <rect x="16.4" y="9.2" width="4.3" height="9.8" rx="1.7" />
    </Svg>
  )
}

export function SuitcaseIcon() {
  return (
    <Svg>
      {/* A shared project is a trip more often than not, and the handle is
          cut out of the body rather than drawn on top of it, so the whole
          mark stays one filled shape. */}
      <path d="M9.4 3.6h5.2a2.3 2.3 0 0 1 2.3 2.3v1.3h1.9a2.6 2.6 0 0 1 2.6 2.6v7.8a2.6 2.6 0 0 1-2.6 2.6H5.2a2.6 2.6 0 0 1-2.6-2.6V9.8a2.6 2.6 0 0 1 2.6-2.6h1.9V5.9a2.3 2.3 0 0 1 2.3-2.3Zm0 2.2a.3.3 0 0 0-.3.3v1.1h5.8V6.1a.3.3 0 0 0-.3-.3Z" />
    </Svg>
  )
}

export function ListIcon() {
  return (
    <Svg>
      <circle cx="4.6" cy="7" r="1.7" />
      <circle cx="4.6" cy="12" r="1.7" />
      <circle cx="4.6" cy="17" r="1.7" />
      <rect x="8.6" y="5.9" width="11.8" height="2.2" rx="1.1" />
      <rect x="8.6" y="10.9" width="11.8" height="2.2" rx="1.1" />
      <rect x="8.6" y="15.9" width="11.8" height="2.2" rx="1.1" />
    </Svg>
  )
}
