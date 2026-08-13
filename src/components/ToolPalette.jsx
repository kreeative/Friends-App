import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { INK_COLORS, TOOL_NAMES } from '../lib/ink'
import { addRecent, clampSpot, defaultSpot, loadPalette, savePalette } from '../lib/palette'

/**
 * The tools, floating over the page.
 *
 * WHY IT FLOATS AND MOVES.
 *
 * A toolbar in the layout costs the page a strip of height forever, on the one
 * screen whose entire point is to be as big as the paper. Floating costs
 * nothing until it happens to be over the words, and the answer to that is not
 * a cleverer default position: it is letting somebody move it, because where
 * it should sit depends on which hand they write with and which way up the
 * tablet is. PencilKit reached the same conclusion.
 *
 * The position is kept per device rather than per account, for the same
 * reason: left-handed on an iPad in landscape is a different answer from the
 * same person on a phone. See lib/palette.js.
 *
 * DRAGGING WITHOUT A DRAG LIBRARY.
 *
 * Pointer events with capture, which is about fifteen lines and behaves the
 * same for a finger, a stylus and a mouse. The grip is its own handle rather
 * than the whole bar, because a bar you can drag from anywhere is a bar whose
 * buttons occasionally do not press: a two-pixel wobble during a tap becomes a
 * drag, and the tap never lands.
 */
export default function ToolPalette({
  tool,
  onTool,
  color,
  onColor,
  erasing,
  onErasing,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}) {
  const { t } = useT()
  const barRef = useRef(null)

  const [spot, setSpot] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [recent, setRecent] = useState([])
  const [ready, setReady] = useState(false)
  const [colorsOpen, setColorsOpen] = useState(false)

  /* Read once, then placed. Before the first measurement there is no sensible
     position, so the bar is rendered invisible for one frame rather than
     flashing at the top-left corner and jumping. */
  useLayoutEffect(() => {
    const saved = loadPalette()
    setCollapsed(saved.collapsed)
    setRecent(saved.recent)

    const box = barRef.current?.getBoundingClientRect()
    const size = { w: box?.width ?? 320, h: box?.height ?? 56, vw: window.innerWidth, vh: window.innerHeight }
    setSpot(saved.spot ? clampSpot(saved.spot, size) : defaultSpot(size))
    setReady(true)
  }, [])

  /* Rotating a tablet can put a saved position entirely off screen. Re-clamping
     on resize is what fetches it back; without it the toolbar is simply gone
     and there is no gesture that recovers it. */
  useEffect(() => {
    function onResize() {
      const box = barRef.current?.getBoundingClientRect()
      setSpot((s) =>
        clampSpot(s, {
          w: box?.width ?? 320,
          h: box?.height ?? 56,
          vw: window.innerWidth,
          vh: window.innerHeight,
        }),
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ---- dragging ---------------------------------------------------------------

  const drag = useRef(null)

  function grab(e) {
    const box = barRef.current.getBoundingClientRect()
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, w: box.width, h: box.height }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }

  function drift(e) {
    if (!drag.current) return
    const { dx, dy, w, h } = drag.current
    setSpot(
      clampSpot(
        { x: e.clientX - dx, y: e.clientY - dy },
        { w, h, vw: window.innerWidth, vh: window.innerHeight },
      ),
    )
  }

  function drop() {
    drag.current = null
  }

  /* Written from an effect rather than at the end of the drag, because a
     handler closes over the spot from the render that created it and would
     store the position from one frame before the finger lifted. This also
     covers collapsing and mixing a colour, so there is one place that writes
     and no way for the three to disagree. */
  useEffect(() => {
    if (ready && spot) savePalette({ spot, collapsed, recent })
  }, [spot, collapsed, recent, ready])

  function pickColor(next) {
    onColor(next)
    onErasing(false)
    if (!INK_COLORS.includes(next)) setRecent((r) => addRecent(r, next))
  }

  const swatches = [...INK_COLORS, ...recent.filter((c) => !INK_COLORS.includes(c))]

  // ---- collapsed --------------------------------------------------------------

  if (collapsed) {
    return (
      <div
        ref={barRef}
        className="ink-surface fixed z-[60] touch-none"
        style={{ left: spot?.x ?? 0, top: spot?.y ?? 0, visibility: ready ? 'visible' : 'hidden' }}
      >
        <button
          type="button"
          onPointerDown={grab}
          onPointerMove={drift}
          onPointerUp={drop}
          onPointerCancel={drop}
          /* One control, two jobs: press it to open, drag it to move. A
             collapsed palette that could not be moved would be a button
             somebody has to open before they can get it out of the way. */
          onClick={() => setCollapsed(false)}
          aria-label={t('ink.expand')}
          className="lg press flex h-12 w-12 items-center justify-center rounded-pill shadow-float"
          style={{ color }}
        >
          <PenGlyph />
        </button>
      </div>
    )
  }

  return (
    <div
      ref={barRef}
      className="ink-surface fixed z-[60] max-w-[min(94vw,30rem)] touch-none"
      style={{ left: spot?.x ?? 0, top: spot?.y ?? 0, visibility: ready ? 'visible' : 'hidden' }}
    >
      {/**
       * The colours, above the bar rather than beside it.
       *
       * Two rows of swatches is a lot of width and no height, which is the
       * shape a floating bar has spare. `bottom-full` puts it over the page
       * above the palette, which is where the palette is not, and it closes on
       * any pick so it never sits between somebody and their writing.
       */}
      {colorsOpen && (
        <div className="lg absolute bottom-full left-0 mb-2 w-max max-w-[min(90vw,22rem)] rounded-card p-2.5 shadow-float">
          <div className="flex flex-wrap items-center gap-2">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  pickColor(c)
                  setColorsOpen(false)
                }}
                aria-pressed={color === c && !erasing}
                aria-label={t('journal.ink_color')}
                title={c}
                className={`h-8 w-8 shrink-0 rounded-pill ring-1 ring-inset ring-ink/10 transition-transform ${
                  color === c && !erasing ? 'scale-110 ring-2 ring-ink' : ''
                }`}
                style={{ background: c }}
              />
            ))}

            {/**
             * Any colour at all, through the platform's own picker.
             *
             * A label wrapping the input rather than a button opening a hidden
             * one: the label is already the control, so it keeps the keyboard
             * behaviour and the tap target, and there is no synthetic click
             * for a browser to swallow.
             *
             * onInput rather than onChange, so the stroke colour follows the
             * wheel live on the platforms that stream it instead of only
             * arriving once the picker is dismissed.
             */}
            <label
              title={t('ink.custom_color')}
              className="press relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill ring-1 ring-inset ring-ink/15"
              style={{
                background:
                  'conic-gradient(#ff0057,#ffb300,#ffe600,#3ddc84,#00b7c3,#3b6cf6,#8b5cf6,#ff0057)',
              }}
            >
              <span className="h-3 w-3 rounded-pill bg-surface" aria-hidden="true" />
              <input
                type="color"
                value={color}
                onInput={(e) => pickColor(e.target.value)}
                aria-label={t('ink.custom_color')}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      )}

      <div className="lg flex items-center gap-0.5 rounded-pill p-1.5 shadow-float">
        {/* The grip. Its own target, so a wobble during a button press cannot
            turn that press into a drag. */}
        <button
          type="button"
          onPointerDown={grab}
          onPointerMove={drift}
          onPointerUp={drop}
          onPointerCancel={drop}
          aria-label={t('ink.move')}
          className="flex h-9 w-5 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
        >
          <svg width="6" height="18" viewBox="0 0 6 18" aria-hidden="true">
            <circle cx="1.5" cy="3" r="1.3" fill="currentColor" />
            <circle cx="1.5" cy="9" r="1.3" fill="currentColor" />
            <circle cx="1.5" cy="15" r="1.3" fill="currentColor" />
            <circle cx="4.5" cy="3" r="1.3" fill="currentColor" />
            <circle cx="4.5" cy="9" r="1.3" fill="currentColor" />
            <circle cx="4.5" cy="15" r="1.3" fill="currentColor" />
          </svg>
        </button>

        {/**
         * One row, and everything on it is visible.
         *
         * The colours used to sit here in a line, seven of them plus the
         * wheel, and they were most of the bar's width: on an iPad the Clear
         * button was pushed off the right-hand end into a sideways scroll with
         * nothing to say it was there, which is exactly the fault the old
         * inline toolbar had. A control you cannot see is a control that does
         * not exist.
         *
         * So the colours live behind a single well showing the current one,
         * which is what PencilKit does and for the same reason. The bar is now
         * eight fixed things wide and fits a 390px phone without scrolling.
         */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {TOOL_NAMES.map((name) => (
            <Tool
              key={name}
              on={tool === name && !erasing}
              label={t(`journal.tool_${name}`)}
              onClick={() => {
                onTool(name)
                onErasing(false)
              }}
            >
              <TipGlyph tool={name} />
            </Tool>
          ))}

          <Tool on={erasing} label={t('journal.eraser')} onClick={() => onErasing(!erasing)}>
            <EraserGlyph />
          </Tool>

          <Divider />

          {/* The well: what you are drawing with, and the way to everything
              else. */}
          <button
            type="button"
            onClick={() => setColorsOpen((v) => !v)}
            aria-expanded={colorsOpen}
            aria-label={t('journal.ink_color')}
            title={color}
            className={`press h-8 w-8 shrink-0 rounded-pill ring-1 ring-inset ring-ink/15 transition-transform ${
              colorsOpen ? 'scale-110' : ''
            }`}
            style={{ background: color }}
          />

          <Divider />

          <Tool on={false} disabled={!canUndo} label={t('journal.undo')} onClick={onUndo}>
            <UndoGlyph />
          </Tool>
          <Tool on={false} disabled={!canRedo} label={t('journal.redo')} onClick={onRedo}>
            <RedoGlyph />
          </Tool>
          <Tool on={false} label={t('journal.clear')} onClick={onClear}>
            <TrashGlyph />
          </Tool>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label={t('ink.collapse')}
          className="press flex h-9 w-6 shrink-0 items-center justify-center rounded-pill text-muted hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function Tool({ children, on, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-pill transition-colors disabled:opacity-30 ${
        on ? 'bg-ink text-surface' : 'text-ink hover:bg-ink/[0.08]'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink/10" />
}

/**
 * Drawn, not typed.
 *
 * An emoji arrow would be four different pictures on four platforms and none
 * of them is a curved arrow at 16px; on Android several of the ones this
 * toolbar needs render as a box. These are the shapes.
 */
function UndoGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7 5 3 9l4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 9h8a5 5 0 0 1 0 10H8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function RedoGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m13 5 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 9H9a5 5 0 0 0 0 10h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrashGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 5h12M7.5 5V3.5h3V5M4.5 5l.8 9.5h7.4L13.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EraserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 13.5 2 9l6-6 4.5 4.5-6 6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 13.5H14M4.2 6.8 8.7 11.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PenGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 14s1-3.5 2.5-5L11 2.5 13.5 5 7 11.5C5.5 13 2 14 2 14Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.5 9 7 11.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

/** A nib, a sharpened point, a chisel. */
function TipGlyph({ tool }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' }
  if (tool === 'marker') {
    return (
      <svg {...common}>
        <path d="M10.5 1.5 14.5 5.5 6 14H2v-4l8.5-8.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M2 10h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    )
  }
  if (tool === 'pencil') {
    return (
      <svg {...common}>
        <path d="M11 1.5 14.5 5 5.5 14H2v-3.5L11 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M9.5 3 13 6.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  return <PenGlyph />
}
