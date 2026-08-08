import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * The indicator that travels between options instead of appearing on one.
 *
 * This is the iOS segmented control, and the thing it gets right is that the
 * selection is one object that moves rather than two states that swap. When
 * it swaps, nothing connects the tab you left to the tab you arrived at and
 * the change reads as a redraw. When it slides, the movement itself is what
 * tells you the two are alternatives. You can see the relationship.
 *
 * Measured from the DOM rather than computed from an index, because the
 * options are words of different lengths in two languages. Anything derived
 * from "one of four" would be wrong the moment "Check in" sits next to
 * "Board", and wrong differently in French.
 */
export function useSlider(activeKey) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)

  const measure = useCallback(() => {
    const host = ref.current
    const el = host?.querySelector('[data-active="true"]')
    if (!host || !el) return setBox(null)
    setBox({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight })
  }, [])

  // Layout effect, not effect: this runs before paint, so the indicator is
  // never briefly in the wrong place on the first render of a screen.
  useLayoutEffect(measure, [measure, activeKey])

  /**
   * Re-measure when the box changes size. The tab bar is fluid, the labels
   * change with the locale, and a web font landing after first paint reflows
   * every label under the indicator. All three used to leave it stranded.
   */
  useEffect(() => {
    const host = ref.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    for (const child of host.children) ro.observe(child)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => ro.disconnect()
  }, [measure])

  return { ref, box }
}

/**
 * The moving part. Absolutely positioned inside a `relative` host, sitting
 * under the labels.
 *
 * `ready` is what stops it flying in from the top-left corner on first paint:
 * until the first measurement lands there is nowhere honest to put it, so it
 * is not painted at all and the transition is suppressed for one frame.
 */
export function Slider({ box, className = '' }) {
  const seen = useRef(false)
  useEffect(() => {
    if (box) seen.current = true
  }, [box])

  if (!box) return null

  return (
    <span
      aria-hidden="true"
      /* The transition has to be inline, it depends on whether this is the
         first measurement, so a stylesheet cannot override it. The attribute
         gives the reduced-motion rule in index.css something to target. */
      data-slider=""
      className={`pointer-events-none absolute left-0 top-0 z-0 ${className}`}
      style={{
        width: box.width,
        height: box.height,
        transform: `translate3d(${box.left}px, ${box.top}px, 0)`,
        transition: seen.current
          ? 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1), width 420ms cubic-bezier(0.32, 0.72, 0, 1)'
          : 'none',
      }}
    />
  )
}
