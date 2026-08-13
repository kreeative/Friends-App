import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  addPoint,
  emptyInk,
  eraseAt,
  startStroke,
  strokeStyle,
  toPath,
} from '../lib/ink'

/**
 * The writing surface. Just the surface: the tools live in ToolPalette.
 *
 * TWO SURFACES, ONE TRUTH.
 *
 * The strokes are the document; the canvas is a fast picture of them. Every
 * finished stroke lives in React state and gets saved as numbers, and the
 * canvas exists because painting a path per frame during a drag is smooth and
 * re-rendering an SVG tree per frame is not. So the live stroke is drawn
 * straight to the 2D context as it happens, and the whole picture is repainted
 * from the strokes whenever they change for any other reason: undo, redo,
 * erase, clear, resize.
 *
 * THE PAGE IS AS BIG AS THE SCREEN, AND IT IS FIXED ONCE.
 *
 * This used to be a 1000x620 box with a fixed aspect ratio, which on a phone
 * was a letterbox about two inches tall to write a diary in. Now the page
 * takes whatever the editor gives it, and its logical height is computed from
 * that at mount: width stays 1000 so the numbers stay readable, height becomes
 * whatever matches the real shape of the area.
 *
 * Computed once, not on every resize. If the page were re-proportioned when a
 * tablet rotated, every stroke already on it would move relative to the ruling
 * and to each other. A drawing has a shape; the window showing it can change
 * without the drawing changing. Rotating therefore rescales what is there,
 * which is the same thing the SVG in the grid does.
 *
 * PALM REJECTION.
 *
 * Two halves, and the CSS half is the one people actually notice. A tablet
 * reports the hand resting on the screen as an ordinary touch at the same
 * moment the stylus is drawing, so writing normally produced a stroke and a
 * blob under the wrist; the rule below is the one every drawing app uses, that
 * once a pen has been seen, touches stop being drawing tools. But the visible
 * symptom on an iPad was iOS raising its Copy / Look Up callout over the page,
 * because a resting palm reads as a long press. That is `.ink-surface` in
 * index.css, and -webkit-touch-callout is the declaration that fixes it.
 */

/** Snapshots kept. Thirty pages of strokes is smaller than one photograph. */
const HISTORY = 40

/** The logical width every page is measured in. Height follows the screen. */
const PAGE_W = 1000

/** Bounds on the derived height, so a freak layout cannot produce a sliver. */
const MIN_RATIO = 0.4
const MAX_RATIO = 3.2

/** How far the eraser reaches, in page units. */
const ERASER = 14

export default function InkCanvas({
  value,
  onChange,
  tool = 'pen',
  color = '#1B1B1F',
  erasing = false,
  disabled = false,
  ruled = true,
  historyRef,
}) {
  const ink = value ?? emptyInk(PAGE_W, 620)
  const strokes = ink.strokes ?? []

  const canvasRef = useRef(null)
  const boxRef = useRef(null)

  /**
   * The page's own height in logical units, fixed the first time the box has a
   * real size. Null until then, which is also the signal to compute it.
   *
   * Only a page with something on it keeps its stored height. A blank one
   * takes the screen's shape instead, and the distinction is the whole
   * feature: emptyInk() hands back a 1000x620 default, so seeding from
   * `value.h` unconditionally meant every new entry was silently a letterbox
   * again no matter how tall the editor was. Measured on a phone: the canvas
   * was 390x718 and the saved page was 620 tall.
   *
   * An entry that already has strokes must keep its own height, or reopening a
   * drawing on a differently-shaped screen would re-proportion the page under
   * marks that were placed on the old one.
   */
  const [pageH, setPageH] = useState(() => (value?.strokes?.length ? value.h : null))

  /* Live drawing state, in refs rather than state: these change on every
     pointermove and none of them belong in a render. */
  const drawing = useRef(null)
  const sawPen = useRef(false)

  const past = useRef([])
  const future = useRef([])
  const [depth, setDepth] = useState({ past: 0, future: 0 })
  const syncDepth = () => setDepth({ past: past.current.length, future: future.current.length })

  const page = { w: ink.w || PAGE_W, h: pageH ?? ink.h ?? 620 }

  /** Replace the strokes, remembering what they were. */
  const commit = useCallback(
    (next) => {
      past.current = [...past.current, strokes].slice(-HISTORY)
      future.current = []
      syncDepth()
      onChange({ ...ink, w: page.w, h: page.h, strokes: next })
    },
    [ink, strokes, onChange, page.w, page.h],
  )

  /**
   * Undo, redo and clear, handed upwards.
   *
   * The palette is a sibling floating over the canvas rather than a child of
   * it, so it cannot reach this component's history by props alone. An
   * imperative handle is the honest shape for that: these are commands, not
   * state, and lifting the whole undo stack into the editor would put a
   * hundred snapshots of stroke data into a parent that has no use for them.
   */
  useImperativeHandle(
    historyRef,
    () => ({
      canUndo: depth.past > 0,
      canRedo: depth.future > 0,
      undo() {
        const previous = past.current[past.current.length - 1]
        if (!previous) return
        past.current = past.current.slice(0, -1)
        future.current = [...future.current, strokes]
        syncDepth()
        onChange({ ...ink, strokes: previous })
      },
      redo() {
        const next = future.current[future.current.length - 1]
        if (!next) return
        future.current = future.current.slice(0, -1)
        past.current = [...past.current, strokes]
        syncDepth()
        onChange({ ...ink, strokes: next })
      },
      /* Clearing goes through commit, so the page before it is on the undo
         stack and a confirmed clear is still reversible. That is the whole of
         "keep history intact even after an accidental clear". */
      clear() {
        if (strokes.length === 0) return
        commit([])
      },
    }),
    [depth.past, depth.future, strokes, ink, onChange, commit],
  )

  // ---- painting -------------------------------------------------------------

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
    if (rect.width === 0 || rect.height === 0) return

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

    /* One transform, set once: page units in, device pixels out. Scaled by
       width alone so the drawing keeps its proportions; a rotation changes how
       much of the page is on screen rather than reshaping what is drawn. */
    const scale = (rect.width * dpr) / page.w
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    for (const s of strokes) paint(ctx, s)
    if (drawing.current && !drawing.current.erasing) paint(ctx, drawing.current)
  }, [strokes, paint, page.w])

  useEffect(() => {
    repaint()
  }, [repaint, pageH])

  /* The page's height, fixed on the first real measurement. */
  useEffect(() => {
    if (pageH != null) return
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (rect.width === 0) return

    const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, rect.height / rect.width))
    setPageH(Math.round(PAGE_W * ratio))
  }, [pageH])

  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => repaint())
    ro.observe(box)
    return () => ro.disconnect()
  }, [repaint])

  // ---- input ----------------------------------------------------------------

  function toPage(e) {
    const rect = boxRef.current.getBoundingClientRect()
    const scale = page.w / rect.width
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
    /* Stops the selection a resting palm would otherwise begin, before it
       begins. The CSS in .ink-surface covers the callout; this covers the
       drag. */
    e.preventDefault()
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
    e.preventDefault()
    const { x, y } = toPage(e)

    if (drawing.current.erasing) return rub(x, y)

    /**
     * Every sample the hardware took, not only the ones the browser had time
     * to deliver. An Apple Pencil reports at 240Hz while frames arrive at 60,
     * so three quarters of the points in a fast stroke live inside the
     * coalesced list, and a quick flick drawn without them comes out visibly
     * angular. This is most of what "responsive and fluid" means here; the
     * curve fitting in toPath does the rest.
     */
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events) {
      const p = ev === e.nativeEvent ? { x, y } : toPage(ev)
      addPoint(drawing.current, p.x, p.y, pressureOf(ev))
    }

    /* The live stroke only. Repainting the whole page on every move is fine at
       ten strokes and visibly slow at two hundred. */
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) paint(ctx, drawing.current)
  }

  function up() {
    const active = drawing.current
    drawing.current = null
    if (!active) return

    if (active.erasing) {
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

  return (
    <div
      ref={boxRef}
      className={`ink-surface relative h-full w-full overflow-hidden bg-white ${
        ruled ? 'ruled' : ''
      }`}
      style={{ '--rule': '2.25rem' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="ink-surface absolute inset-0 h-full w-full"
        style={{ cursor: disabled ? 'default' : erasing ? 'cell' : 'crosshair' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        /* Capture means pointerup lands here even when the hand has left the
           box, so there is deliberately no pointerleave handler: with one, a
           long line drawn past the edge would end halfway and start again on
           the way back. */
        onPointerCancel={up}
      />
    </div>
  )
}
