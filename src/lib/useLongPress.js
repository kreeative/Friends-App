import { useCallback, useEffect, useRef, useState } from 'react'
import { HOLD_MS, movedTooFar } from './gesture'

/**
 * Hold a thing to open it, without breaking tapping it.
 *
 * Returns props to spread onto the element, plus whether it is being held
 * right now so the element can show it.
 *
 * WHAT MAKES THIS HARDER THAN A setTimeout.
 *
 * A calendar cell already does two things. It is a tap target that selects a
 * date, and it lives inside a horizontally scrolling track. Both of those are
 * gestures that begin exactly the same way a hold does, with a finger landing
 * on the cell, and the difference only appears later.
 *
 *   A SWIPE is a hold that moved. Cancelled on the first pointermove past ten
 *   pixels, otherwise paging the calendar with your thumb on a date opens the
 *   date instead of turning the page.
 *
 *   A TAP is a hold that ended early. That still has to select the date, so
 *   the timer is cleared on pointerup and the click is allowed through.
 *
 *   A HOLD THAT FIRED must NOT then also select the date, because letting go
 *   still produces a click and the sheet would open on one day while the strip
 *   quietly moved to another underneath it. There is no way to cancel a click
 *   that has not happened yet, so the fact that one is coming is remembered and
 *   the next click is swallowed.
 *
 * Pointer events rather than touch and mouse separately: one code path covers
 * a finger, a mouse, a stylus and a trackpad, and this app already commits to
 * them in the ink canvas.
 *
 * The pointer is captured for the duration, so a finger that slides off the
 * cell still delivers its pointerup here and the timer is always cleared. It
 * is what stops a hold from being left running when the finger leaves.
 */
export function useLongPress(onLongPress, { ms = HOLD_MS, enabled = true } = {}) {
  const [holding, setHolding] = useState(false)

  const timer = useRef(null)
  const start = useRef(null)
  const fired = useRef(false)
  const dragged = useRef(false)

  const stop = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
    setHolding(false)
  }, [])

  /* A component can unmount mid-hold: a date in a month that scrolled away, or
     the whole card collapsing. The timer has to go with it. */
  useEffect(() => stop, [stop])

  if (!enabled) return { holding: false, handlers: {} }

  const onPointerDown = (e) => {
    /* Left button and touches only. A right click is a context menu, and a
       middle click on a date is not a gesture anybody is making. */
    if (e.button != null && e.button !== 0) return

    fired.current = false
    dragged.current = false
    start.current = { x: e.clientX, y: e.clientY }
    setHolding(true)

    /**
     * Held now, read later.
     *
     * `currentTarget` is only meaningful while the event is being dispatched;
     * the DOM sets it back to null the moment the handler returns. Reading it
     * inside a timeout half a second later gives null, and the card that was
     * meant to grow out of this square instead appeared from nowhere. It cost
     * an hour to find because nothing throws: the morph simply does not
     * happen, which looks exactly like a transition that was not applied.
     */
    const el = e.currentTarget

    try {
      el.setPointerCapture?.(e.pointerId)
    } catch {
      /* Not every pointer can be captured. The move and up handlers still
         fire; they just stop arriving once the finger leaves the element,
         which pointerleave below already covers. */
    }

    timer.current = window.setTimeout(() => {
      timer.current = null
      fired.current = true
      setHolding(false)
      onLongPress?.(el)
    }, ms)
  }

  const onPointerMove = (e) => {
    if (!start.current) return
    if (!movedTooFar(start.current, { x: e.clientX, y: e.clientY })) return
    dragged.current = true
    stop()
  }

  return {
    holding,
    /**
     * Should the click that follows this press be thrown away?
     *
     * Read at click time rather than cleared on pointerup, because the order
     * is pointerup then click and clearing it in between would let the click
     * through every time.
     *
     * TWO PRESSES DO NOT DESERVE A CLICK, AND THE SECOND IS THE SUBTLE ONE.
     *
     * A press that FIRED already opened the card. Selecting as well would move
     * the strip to whichever date the finger happened to be over, so the card
     * would be about one day and the calendar would be highlighting another.
     *
     * A press that DRAGGED was a swipe: the reader was paging the calendar and
     * happened to start the gesture on top of a date. Capturing the pointer is
     * what makes this need saying. Without capture, a mouseup that landed on a
     * different element than the mousedown produces no click on either, and
     * the swipe selected nothing by accident. Capture retargets the mouse
     * events back to the captured element, so both ends of the gesture arrive
     * on the cell and the browser issues a click that nobody asked for: paging
     * the calendar with a thumb quietly changed the selected day.
     */
    consumedClick: () => {
      const consume = fired.current || dragged.current
      fired.current = false
      dragged.current = false
      return consume
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerCancel: stop,
      onPointerLeave: stop,
      /* Long-pressing on a phone raises the system callout over the app's own
         gesture. The CSS in index.css stops the selection; this stops the
         menu on the platforms that use a real contextmenu event for it. */
      onContextMenu: (e) => e.preventDefault(),
    },
  }
}
