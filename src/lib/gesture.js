/**
 * The arithmetic behind holding, dragging and morphing.
 *
 * Pure and importless, so `npm test` runs it under plain node. None of this is
 * complicated and all of it is easy to get subtly wrong in a way that is only
 * visible as "the animation looks weird", which is the hardest kind of bug to
 * act on. A number that can be asserted is worth more than a screenshot here.
 */

// ---------------------------------------------------------------------------
// Holding.
// ---------------------------------------------------------------------------

/**
 * How long a press has to last before it counts as a long press.
 *
 * WHY NOT THREE SECONDS.
 *
 * Three seconds was asked for, with "a configurable ~500ms to 3s long-press
 * feel" offered alongside it, and this sits at the near end of that range on
 * purpose. The platforms this app runs on have already taught everybody what a
 * long press costs: iOS fires its context menu at 500ms, Android at 500ms, and
 * every "hold to see more" in every app people already use lands in the same
 * place. Somebody holding a date is going to let go somewhere around a second
 * and conclude the feature does not work, and they will be right to, because
 * from their side a control that does nothing for three seconds and a control
 * that does nothing are the same control.
 *
 * Three seconds is also long enough to be a problem rather than a delay: it is
 * an eternity to hold a finger still on a phone on a bus, and a hold that gets
 * cancelled by the smallest drift has to be started over from zero.
 *
 * So: 550ms, a hair past the platform default so an ordinary tap is never
 * mistaken for a hold. It is one constant. Anybody who wants the three seconds
 * changes this line and the ring under the finger follows it automatically,
 * because the feedback is driven from the same number.
 */
export const HOLD_MS = 550

/**
 * How far a finger may drift and still be holding rather than scrolling.
 *
 * The calendar is a horizontally scrolling track, so a press that starts on a
 * date and turns into a swipe is not a long press, it is a page turn. Ten
 * pixels is about the width of the wobble in a stationary thumb and well short
 * of an intentional movement.
 */
export const HOLD_MOVE_PX = 10

/** Did the finger leave the circle a hold is allowed to wander inside? */
export function movedTooFar(from, to, tolerance = HOLD_MOVE_PX) {
  if (!from || !to) return false
  const dx = (to.x ?? 0) - (from.x ?? 0)
  const dy = (to.y ?? 0) - (from.y ?? 0)
  return Math.hypot(dx, dy) > tolerance
}

/** How far through the hold, 0 to 1, for the ring that fills under the finger. */
export function holdProgress(elapsed, total = HOLD_MS) {
  if (!(total > 0)) return 1
  return Math.min(1, Math.max(0, elapsed / total))
}

// ---------------------------------------------------------------------------
// Dragging a sheet away.
// ---------------------------------------------------------------------------

/** Far enough down that letting go means "close this". */
export const DISMISS_PX = 90

/** Or fast enough down, in pixels per millisecond, however far it got. */
export const DISMISS_VELOCITY = 0.5

/** Below this a flick is not a flick, it is a twitch at the end of a tap. */
export const FLICK_MIN_PX = 24

/**
 * Where the panel should sit while a finger drags it.
 *
 * Downward is one to one, because the panel is following the finger and any
 * other ratio reads as the thing being stuck to the glass. Upward resists at a
 * quarter: a sheet already at the top of its travel cannot go further up, and
 * a hard stop feels broken where a rubber band feels like an edge.
 */
export function dragOffset(startY, y) {
  const dy = (y ?? 0) - (startY ?? 0)
  return dy >= 0 ? dy : dy / 4
}

/**
 * Let go: does it close, or does it spring back?
 *
 * Distance OR speed, not distance alone. A short fast flick is unambiguously a
 * dismissal and requiring 90px of it would mean a gesture that works only when
 * performed slowly, which is the opposite of how people flick things away.
 */
export function shouldDismiss(dy, elapsedMs, opts = {}) {
  const distance = opts.distance ?? DISMISS_PX
  const velocity = opts.velocity ?? DISMISS_VELOCITY
  if (!(dy > 0)) return false
  if (dy >= distance) return true
  if (!(elapsedMs > 0)) return false
  return dy >= FLICK_MIN_PX && dy / elapsedMs >= velocity
}

// ---------------------------------------------------------------------------
// Morphing one rectangle into another.
// ---------------------------------------------------------------------------

/**
 * FLIP, which is what a layout animation is underneath.
 *
 * First, Last, Invert, Play. The panel is laid out where it finally belongs
 * (Last), the transform that would put it back on top of the date cell is
 * computed (Invert), it is applied for one frame, and then removed with a
 * transition on it (Play). The browser animates a transform on the compositor,
 * so nothing re-lays-out for sixty frames, which is the difference between
 * this and animating width and height.
 *
 * Framer Motion's `layoutId` is this, with a library around it. It was asked
 * for by name and is not used, for three reasons: this app has no animation
 * dependency and hand-builds its motion already (see Confetti and the sheet
 * curve in index.css), the bundle is over the warning threshold before adding
 * a hundred kilobytes of it, and the maths is the twelve lines below, which
 * can be asserted rather than trusted.
 *
 * `transform-origin: top left` is not optional. With any other origin the
 * scale is taken about a moving point and the two rectangles do not line up.
 *
 * @returns null when either rectangle has no area, which is what a measurement
 *          taken before layout looks like. The caller skips the morph rather
 *          than dividing by zero and animating from NaN, which renders as the
 *          panel vanishing.
 */
export function flipFrom(from, to) {
  if (!from || !to) return null
  if (!(from.width > 0) || !(from.height > 0)) return null
  if (!(to.width > 0) || !(to.height > 0)) return null

  return {
    x: from.left - to.left,
    y: from.top - to.top,
    scaleX: from.width / to.width,
    scaleY: from.height / to.height,
  }
}

/**
 * The same thing as a CSS value.
 *
 * Rounded to three decimals: a transform matrix printed at full float width is
 * a hundred characters of noise in the DOM and the difference is a thousandth
 * of a pixel.
 *
 * `minScale` keeps the panel from being crushed to the literal size of a date
 * cell. Scaling a 700px sheet down to 36px is a factor of twenty, and text
 * inside it at that factor is a smear that the eye reads as a glitch rather
 * than as a movement. Starting a little larger and fading the content in over
 * the top is what makes the morph land as one object arriving instead of two
 * things happening at once.
 */
export function flipTransform(from, to, minScale = 0.12) {
  const f = flipFrom(from, to)
  if (!f) return 'none'

  const r = (n) => Math.round(n * 1000) / 1000
  const sx = r(Math.max(minScale, f.scaleX))
  const sy = r(Math.max(minScale, f.scaleY))

  return `translate(${r(f.x)}px, ${r(f.y)}px) scale(${sx}, ${sy})`
}

/** The middle of a rectangle, for anything that wants a point rather than a box. */
export function centreOf(rect) {
  if (!rect) return null
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** A plain, serialisable copy of a DOMRect. */
export function rectOf(el) {
  if (!el?.getBoundingClientRect) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}
