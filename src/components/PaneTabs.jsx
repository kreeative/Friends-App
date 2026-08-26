import { useEffect, useRef } from 'react'

/**
 * The budget's sections, as a row of pills instead of a column of rows.
 *
 * WHAT THIS REPLACES, AND WHY IT KEPT FAILING BEFORE.
 *
 * ActionBar's own note records three shapes tried on this screen. Five 56px
 * squares in a row left 48px of tile on a 320px phone. A two-column grid
 * orphaned the fifth item. Full-width rows fixed both and then ran into the
 * one thing a column cannot fix: eight of them is six hundred pixels of
 * navigation before any content, so every pane opened below the fold.
 *
 * The fault in all three was the same assumption, that the whole set has to be
 * on screen at once. A pill row does not need to be. It scrolls sideways, so
 * eight items cost one line whatever the count, twenty would too, and the
 * label sits at its natural width rather than being squeezed into a column
 * fraction. That is why this can be a row when the old bar could not.
 *
 * The selected pill is scrolled into view on mount and on every change, so
 * arriving on a pane that lives off the right edge does not look like arriving
 * on no pane at all.
 *
 * `data-actionbar` is kept even though this is not the ActionBar. Every probe
 * in the suite finds these by that hook, and the hook names what the thing is
 * for rather than what it looks like this month, which is the entire argument
 * in CLAUDE.md for keying to data attributes.
 */
export default function PaneTabs({ items, value, onChange }) {
  const strip = useRef(null)
  const active = useRef(null)

  useEffect(() => {
    const el = active.current
    const box = strip.current
    if (!el || !box) return
    /* Only the strip scrolls, never the page. `scrollIntoView` on a child
       inside a horizontally scrolling container will happily scroll the
       document too, which on arriving at the budget would yank the hero card
       off the top of the screen. */
    const left = el.offsetLeft - (box.clientWidth - el.clientWidth) / 2
    box.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [value])

  return (
    <div
      ref={strip}
      data-actionbar=""
      data-tabs=""
      /* Bleeds to both screen edges: the shell pads by 6, so the negative
         margin lets the strip run to the glass and the padding puts the first
         and last pill back on the text column. A row that stops short of the
         edge reads as a row that has ended. */
      className="-mx-6 overflow-x-auto overscroll-x-contain px-6 py-1
                 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max gap-2">
        {items.map((item) => {
          const on = item.id === value
          return (
            <button
              key={item.id}
              ref={on ? active : null}
              type="button"
              onClick={() => onChange(item.id)}
              aria-pressed={on}
              className={`press flex shrink-0 items-center gap-2 rounded-pill px-4 py-2.5
                          transition-[background-color,box-shadow] duration-200 ${
                /**
                 * A WASH of the accent when selected, not the accent itself.
                 *
                 * Solid #FF006E carries white at 3.83:1 and this label is 14px
                 * at 600, which needs 4.5. The same arithmetic that stopped the
                 * old rows going solid pink stops the pills, so the fill stays
                 * a tint, the ink stays ink, and the ring carries the state.
                 */
                on
                  ? 'border border-transparent bg-accent/[0.18] shadow-float ring-2 ring-inset ring-accent/50'
                  : 'border border-hairline bg-[rgb(var(--glass-tint))] shadow-raised'
              }`}
            >
              {/* Ink in both states. Tinting the selected glyph with the accent
                  was tried and it disappears in sea, where the accent is
                  #FFD60A: a yellow glyph on a pale wash is 1.4:1. The wash and
                  the ring carry the state; the glyph just has to be legible. */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]">
                {item.icon}
              </span>
              {/* A span holding exactly the label, because that is what the
                  suite's openPane matches on. */}
              <span className="whitespace-nowrap text-small font-semibold leading-none text-ink">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
