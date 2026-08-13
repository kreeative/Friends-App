import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import {
  INK_COLORS,
  TOOL_NAMES,
  TOOLS,
  addPoint,
  emptyInk,
  eraseAt,
  isBlank,
  startStroke,
  strokeStyle,
  toPath,
} from '../lib/ink'

/**
 * Writing by hand.
 *
 * TWO SURFACES, ONE TRUTH.
 *
 * The strokes are the document; the canvas is a fast picture of them. Every
 * finished stroke lives in React state and gets saved as numbers, and the
 * canvas exists because painting a path per frame during a drag is smooth and
 * re-rendering an SVG tree per frame is not. So the live stroke is drawn
 * straight to the 2D context as it happens, and the whole picture is repainted
 * from the strokes whenever the strokes change for any other reason: undo,
 * redo, erase, clear, resize.
 *
 * WHY A HISTORY ARRAY RATHER THAN A DIFF.
 *
 * Undo has to cover four different operations (a stroke, an erase, a clear,
 * and a redo of any of them), and a page of handwriting is a few hundred
 * numbers. Keeping thirty whole snapshots of that is smaller than one photo of
 * it, and it is about ten lines instead of an inverse operation per action.
 *
 * PALM REJECTION.
 *
 * A tablet reports the hand resting on the screen as an ordinary touch, at the
 * same moment the stylus is drawing, so writing normally produces a stroke and
 * a large blob under the wrist. The rule here is the same one every drawing
 * app uses: once a pen has been seen on this canvas, touches are no longer
 * drawing tools. Nothing is rejected on a device with no stylus, so a finger
 * still writes on a phone.
 */

/** Snapshots kept. Thirty pages of strokes is smaller than one photograph. */
const HISTORY = 30

/** The page. Wider than tall, and 8.5:5.3 is roughly a notebook turned over. */
const PAGE_W = 1000
const PAGE_H = 620

/** How far the eraser reaches, in page units. */
const ERASER = 14

export default function InkCanvas({ value, onChange, disabled = false }) {
  const { t } = useT()

  const ink = value ?? emptyInk(PAGE_W, PAGE_H)
  const strokes = ink.strokes ?? []

  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(INK_COLORS[0])
  const [erasing, setErasing] = useState(false)

  const canvasRef = useRef(null)
  const boxRef = useRef(null)

  /* Live drawing state, in refs rather than state: these change on every
     pointermove and none of them belong in a render. */
  const drawing = useRef(null)
  const sawPen = useRef(false)

  /* Undo and redo. Refs because nothing renders from them except the two
     buttons, whose enabled-ness is mirrored into state below. */
  const past = useRef([])
  const future = useRef([])
  const [depth, setDepth] = useState({ past: 0, future: 0 })
  const syncDepth = () => setDepth({ past: past.current.length, future: future.current.length })

  /** Replace the strokes, remembering what they were. */
  const commit = useCallback(
    (next) => {
      past.current = [...past.current, strokes].slice(-HISTORY)
      future.current = []
      syncDepth()
      onChange({ ...ink, w: PAGE_W, h: PAGE_H, strokes: next })
    },
    [ink, strokes, onChange],
  )

  // ---- painting -------------------------------------------------------------

  /** One stroke onto a context, in page coordinates. */
  const paint = useCallback((ctx, stroke) => {
    const d = toPath(stroke.p)
    if (!d) return
    const st = strokeStyle(stroke)
    ctx.save()
    ctx.globalAlpha = st.opacity
    ctx.strokeStyle = st.color
    ctx.lineWidth = st.width
    ctx.lineCap = st.cap
    ctx.lineJoin = 'round'
    ctx.stroke(new Path2D(d))
    ctx.restore()
  }, [])

  /**
   * The whole page, from the strokes.
   *
   * Also the resize handler. The canvas is sized in device pixels to whatever
   * the layout gives it, and the context is scaled so everything below can
   * keep working in page coordinates and never think about either.
   */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return

    const rect = box.getBoundingClientRect()
    if (rect.width === 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.floor(rect.width * dpr)
    const h = Math.floor(rect.height * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    /* One transform, set once: page units in, device pixels out. */
    const scale = (rect.width * dpr) / PAGE_W
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    for (const s of strokes) paint(ctx, s)
    if (drawing.current) paint(ctx, drawing.current)
  }, [strokes, paint])

  useEffect(() => {
    repaint()
  }, [repaint])

  /* The canvas is fluid, so a rotation or a keyboard opening changes its size
     and the picture has to be redrawn at the new scale. ResizeObserver rather
     than a window listener because the box also changes when the sheet around
     it does, which a window resize never fires for. */
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => repaint())
    ro.observe(box)
    return () => ro.disconnect()
  }, [repaint])

  // ---- input ----------------------------------------------------------------

  /** Screen to page. One rect read per event, which is what the browser caches. */
  function toPage(e) {
    const rect = boxRef.current.getBoundingClientRect()
    const scale = PAGE_W / rect.width
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
  }

  /**
   * How hard.
   *
   * A mouse and a plain finger both report 0.5 by convention, and some engines
   * report 0 for a finger that is genuinely down, which would draw a stroke at
   * the thinnest possible weight. Anything at or below zero is treated as "no
   * information" and gets the middle.
   */
  function pressureOf(e) {
    if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure
    return e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5
  }

  /** Is this pointer allowed to draw? See palm rejection above. */
  function accepts(e) {
    if (e.pointerType === 'pen') {
      sawPen.current = true
      return true
    }
    return !sawPen.current
  }

  function down(e) {
    if (disabled || !accepts(e)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)

    const { x, y } = toPage(e)

    if (erasing) {
      drawing.current = { erasing: true, changed: false, before: strokes }
      rub(x, y)
      return
    }

    const stroke = startStroke({ tool, color })
    addPoint(stroke, x, y, pressureOf(e))
    drawing.current = stroke
    repaint()
  }

  /** Take out whatever the eraser is over, without a history entry per frame. */
  function rub(x, y) {
    const next = eraseAt(strokes, x, y, ERASER)
    if (next.length === strokes.length) return
    drawing.current.changed = true
    /* Straight to the parent, not through commit: one drag across five words
       is one undo step, so the snapshot is taken once at pointerdown and the
       intermediate states are not recorded. */
    onChange({ ...ink, strokes: next })
  }

  function move(e) {
    if (!drawing.current || disabled) return
    const { x, y } = toPage(e)

    if (drawing.current.erasing) return rub(x, y)

    /**
     * Every sample the hardware took, not just the ones the browser had time
     * to deliver. A stylus reports at 120Hz or more while frames arrive at 60,
     * so half the points of a fast stroke are inside the coalesced list and a
     * quick flick drawn without them comes out visibly angular.
     */
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events) {
      const p = ev === e.nativeEvent ? { x, y } : toPage(ev)
      addPoint(drawing.current, p.x, p.y, pressureOf(ev))
    }

    /* The live stroke only. Repainting the whole page on every move is fine at
       ten strokes and visibly slow at two hundred. */
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) paint(ctx, drawing.current)
  }

  function up() {
    const active = drawing.current
    drawing.current = null
    if (!active) return

    if (active.erasing) {
      /* The strokes are already gone; this is only the undo entry, and only if
         the drag actually took something. */
      if (active.changed) {
        past.current = [...past.current, active.before].slice(-HISTORY)
        future.current = []
        syncDepth()
      }
      return
    }

    /* A tap with no travel is a dot, which is a legitimate mark. A pointerdown
       that produced nothing at all is not. */
    if (active.p.length === 0) return repaint()
    commit([...strokes, active])
  }

  // ---- the buttons ----------------------------------------------------------

  function undo() {
    const previous = past.current[past.current.length - 1]
    if (!previous) return
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, strokes]
    syncDepth()
    onChange({ ...ink, strokes: previous })
  }

  function redo() {
    const next = future.current[future.current.length - 1]
    if (!next) return
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, strokes]
    syncDepth()
    onChange({ ...ink, strokes: next })
  }

  function clear() {
    if (isBlank(ink)) return
    commit([])
  }

  return (
    <div className="space-y-3">
      {/**
       * The page.
       *
       * touch-action:none is what makes writing possible at all: without it a
       * drag on a touch screen scrolls the sheet instead of drawing, and the
       * first stroke anybody attempts throws the page down. It is set inline
       * rather than as a class because it must not be purged.
       */}
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-card border border-hairline bg-white"
        style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, touchAction: 'none' }}
      >
        {/* Ruled, faintly. An unlined white box invites a drawing; a ruled one
            invites writing, and this is a journal. Pure CSS so it costs
            nothing and never appears in the saved strokes. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 43px, rgb(15 23 42 / 0.07) 43px 44px)',
          }}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: disabled ? 'default' : erasing ? 'cell' : 'crosshair' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          /* Capture means pointerup lands here even when the finger has left
             the box, so there is deliberately no pointerleave handler: with
             one, dragging a long line past the edge would end the stroke
             halfway and start a new one on the way back. */
          onPointerCancel={up}
        />

        {isBlank(ink) && !drawing.current && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-small text-muted">
            {t('journal.draw_here')}
          </p>
        )}
      </div>

      {/**
       * The toolbar, in two rows.
       *
       * It was one scrolling row, and on a 390px phone that put the eraser off
       * the right-hand edge with nothing to say it was there: three tips, six
       * colours and an eraser is about four hundred pixels of controls in
       * three hundred and forty of sheet. A sideways scroller is the correct
       * answer for a gallery, where more of the same thing continues, and the
       * wrong one for a toolbar, where the hidden control is a different tool
       * you cannot know to look for.
       *
       * So: what you are drawing with on one row, what colour on the next.
       * That is also the division every drawing app already uses, which means
       * nobody has to learn this one.
       */}
      <div className="flex items-center gap-2">
        {TOOL_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setTool(name)
              setErasing(false)
            }}
            aria-pressed={tool === name && !erasing}
            title={t(`journal.tool_${name}`)}
            className={`press flex h-10 items-center gap-1.5 rounded-pill px-3 text-small font-semibold transition-colors ${
              tool === name && !erasing
                ? 'bg-ink text-surface'
                : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]'
            }`}
          >
            <TipIcon tool={name} />
            {/* The label appears once there is room for all four buttons to
                carry one. Below that the silhouettes do the work and the
                title attribute carries the name. */}
            <span className="hidden sm:inline">{t(`journal.tool_${name}`)}</span>
          </button>
        ))}

        {/* Pushed to the far end, because it is the one button here that takes
            marks away rather than making them. */}
        <button
          type="button"
          onClick={() => setErasing((v) => !v)}
          aria-pressed={erasing}
          title={t('journal.eraser')}
          className={`press ml-auto flex h-10 items-center gap-1.5 rounded-pill px-3 text-small font-semibold transition-colors ${
            erasing ? 'bg-ink text-surface' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]'
          }`}
        >
          <EraserIcon />
          <span className="hidden sm:inline">{t('journal.eraser')}</span>
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        {INK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setColor(c)
              setErasing(false)
            }}
            aria-pressed={color === c && !erasing}
            aria-label={t('journal.ink_color')}
            title={c}
            className={`press h-8 w-8 shrink-0 rounded-pill transition-transform ${
              color === c && !erasing ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={depth.past === 0}
          className="press rounded-pill bg-ink/[0.06] px-4 py-2 text-small font-semibold text-ink transition-colors hover:bg-ink/[0.1] disabled:opacity-40"
        >
          {t('journal.undo')}
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={depth.future === 0}
          className="press rounded-pill bg-ink/[0.06] px-4 py-2 text-small font-semibold text-ink transition-colors hover:bg-ink/[0.1] disabled:opacity-40"
        >
          {t('journal.redo')}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={isBlank(ink)}
          className="press ml-auto rounded-pill px-4 py-2 text-small font-semibold text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          {t('journal.clear')}
        </button>
      </div>
    </div>
  )
}

/**
 * Three tips, drawn rather than typed.
 *
 * An emoji would be four different pictures on four platforms and none of them
 * would be a pencil at 16px. These are the silhouettes: a nib, a sharpened
 * point, a chisel.
 */
function TipIcon({ tool }) {
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
  return (
    <svg {...common}>
      <path d="M2 14s1-3.5 2.5-5L11 2.5 13.5 5 7 11.5C5.5 13 2 14 2 14Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.5 9 7 11.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 13.5 2 9l6-6 4.5 4.5-6 6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 13.5H14M4.2 6.8 8.7 11.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
