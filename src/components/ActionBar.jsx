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
 * THE LABEL IS BACK INSIDE THE CARD, AND THIS TIME IT FITS.
 *
 * The first version put icon, word and badge inside one card in a ROW of
 * four, so the card had to be as wide as the longest word: "Objectifs" and
 * "Feliciter" set the width of all four, four did not fit on a 320px screen,
 * and the only fix was cutting words to "Objecti...". The word moved
 * underneath a square tile to escape that.
 *
 * A two-column grid removes the constraint the row imposed. Each card is half
 * the screen rather than a fifth of it, which is 131px at 320px, so the word
 * fits inside again with room to wrap rather than truncate.
 *
 * TILES CARRY THEIR OWN STATE.
 *
 * This is what makes hiding three quarters of a form safe. A bar that hides
 * content leaves the reader no way to know whether the hidden parts are done,
 * half-filled or untouched, so each tile says: how many goals are logged, how
 * many photos are attached, whether a celebration has gone out. Submit then
 * never sends anything invisible.
 */
/**
 * FULL-WIDTH ROWS.
 *
 * Three shapes have been tried here and each one was the previous one's
 * problem solved badly.
 *
 * Five 56px squares in a row put 48px of tile on a 320px phone, barely over
 * the 44px tap minimum, with the glyph at 24px and the label at 11px beneath
 * it. A two-column grid fixed the size and introduced a new fault: five items
 * do not divide by two, so the last card spanned both columns and was half
 * icon, half void.
 *
 * A single column of rows has neither problem. Every item is the full width
 * of the screen whatever the count, so nothing is ever an orphan and there is
 * no special case in this file for an odd number. The badge sits at its own
 * size, the label reads at body size beside it rather than under it, and the
 * count goes to the far right where a count belongs.
 *
 * It is also shorter per item than the stacked card was: a row needs the
 * badge's height and its padding, where a card needed the badge, the gap and
 * a line of type below it. Five rows come to roughly what three rows of cards
 * did.
 */
export default function ActionBar({ items, value, onChange }) {
  return (
    /* A stable hook. These rows carry their counts in their accessible name,
       so matching them by text alone is ambiguous with the app's own tab bar,
       where a pane and a destination can share a word. */
    <div data-actionbar="" className="flex flex-col gap-2">
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={on}
            className={`press group flex w-full min-w-0 items-center gap-3 rounded-3xl p-3 text-left transition-[background-color,color,box-shadow] duration-200 ${
              /**
               * Selected is a PINK card, not a dark one.
               *
               * It was bg-ink, and ink became a near-black, so the selected
               * row turned into a black slab: the heaviest thing on a screen
               * whose job is to be read past.
               *
               * A WASH of the accent, not the accent itself. Solid #FF006E
               * carries white at 3.83:1 and this label is 16px at 600, which
               * needs 4.5, so a pop-pink row could only take dark text and
               * would read as a warning. The tint leaves the label where it
               * is and lets the ring and the filled glyph carry the state.
               *
               * A TRANSPARENT border on the active row, not no border. The
               * inactive rows carry a 1px hairline, so an active row without
               * one is 2px shorter and every row below it jumps 2px the
               * moment you change tabs.
               */
              on
                ? 'border border-transparent bg-accent/[0.14] shadow-float ring-2 ring-inset ring-accent/45'
                : 'border border-hairline bg-[rgb(var(--glass-tint))] shadow-raised'
            }`}
          >
            <span
              /**
               * The badge the glyph sits in: neutral, not accent.
               *
               * A tint of the theme's accent, not a grey. Grey was tried and
               * it read as a colour borrowed from another app: on a screen
               * whose whole palette is one hue, a slate square is the thing
               * your eye stops on for the wrong reason.
               */
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.875rem] [&>svg]:h-[1.6rem] [&>svg]:w-[1.6rem] ${
                on ? 'bg-accent text-on-accent' : 'bg-accent/15 text-ink'
              }`}
            >
              {item.icon}
            </span>

            <span
              className="min-w-0 flex-1 truncate text-body font-semibold leading-tight text-ink"
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

/* CameraIcon and PartyIcon were the two tiles on the Bravo screen's action
   bar. That screen is gone: proof and praise are sections on the goals page
   now, and a section has a heading rather than a tile. Removed for the same
   reason ForwardIcon was, recorded above: an exported glyph with no caller is
   the start of a sprite sheet. */

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

export function PiggyIcon() {
  return (
    <Svg>
      {/* Body, snout, ear and trotters, with the coin slot and the eye cut out
          of the same shape. A piggy bank rather than a bag with a currency mark
          on it: the mark would be wrong in half the currencies this app
          supports, and a glyph that has to be redrawn per locale is not a
          glyph. */}
      <path d="M14.4 5.6a7.6 7.6 0 0 1 5.5 4.1l1.9.6a.9.9 0 0 1 .6.9v2.6a.9.9 0 0 1-.9.9h-1.3a7.7 7.7 0 0 1-2 2.4v2a.9.9 0 0 1-.9.9h-1.9a.9.9 0 0 1-.9-.9v-.9a10.3 10.3 0 0 1-3.6 0v.9a.9.9 0 0 1-.9.9H7.9a.9.9 0 0 1-.9-.9v-2A7.4 7.4 0 0 1 4.2 13H3.4a1.4 1.4 0 0 1-1.4-1.4V9.9a1 1 0 0 1 1.6-.8l.9.6a7.5 7.5 0 0 1 2.7-3l-1-2.5a.7.7 0 0 1 .9-.9l3 1.2a10 10 0 0 1 1.9-.2ZM9.6 9.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm5 .6h-2.4a.9.9 0 0 0 0 1.8h2.4a.9.9 0 0 0 0-1.8Z" />
    </Svg>
  )
}

export function ScaleIcon() {
  return (
    <Svg>
      {/* Two columns of unequal height on a shared baseline, which is exactly
          the picture the pane draws: you against a published figure. Distinct
          from PlanIcon's three bars by being two, and by carrying the rule. */}
      <rect x="3.4" y="9.6" width="6" height="8.2" rx="1.6" />
      <rect x="14.6" y="5.4" width="6" height="12.4" rx="1.6" />
      <rect x="2" y="19.2" width="20" height="2.2" rx="1.1" />
    </Svg>
  )
}

export function BookIcon() {
  return (
    <Svg>
      {/* A closed book seen from the spine side, with the pages cut out as a
          band. Not an open book: at 24px two facing pages come out as a shape
          nobody recognises without looking twice. */}
      <path d="M6.3 2.6h11.4A2.3 2.3 0 0 1 20 4.9v14.2a2.3 2.3 0 0 1-2.3 2.3H6.3A2.3 2.3 0 0 1 4 19.1V4.9a2.3 2.3 0 0 1 2.3-2.3Zm.5 2.2a.6.6 0 0 0-.6.6v11.9h11.6V5.4a.6.6 0 0 0-.6-.6h-1.9v6.3l-2.2-1.6-2.2 1.6V4.8Z" />
    </Svg>
  )
}

/**
 * A bin. Filled shapes rather than a stroked outline, like every other icon in
 * this file, so it sits at the same weight as its neighbours at 16px.
 *
 * The lid is a separate bar with a handle above it: at small sizes a one-piece
 * bin silhouette reads as a plain cup, and the gap is what makes it a bin.
 */
export function TrashIcon() {
  return (
    <Svg>
      <rect x="9" y="2.6" width="6" height="2.1" rx="1.05" />
      <rect x="3.6" y="5.4" width="16.8" height="2.2" rx="1.1" />
      <path d="M5.9 9.2h12.2l-.9 10.1a2.2 2.2 0 0 1-2.2 2H9a2.2 2.2 0 0 1-2.2-2L5.9 9.2Z" />
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
