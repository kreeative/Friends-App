/**
 * The moment a goal is actually done.
 *
 * Everything else in this app is deliberately quiet. This is the one event
 * worth interrupting for, and it is the only one: not opening a screen, not
 * saving a form, not a photo uploading. A goal you said you would do and then
 * did. If the app is ever going to make a noise, it is here.
 *
 * WHY THIS IS NOT canvas-confetti.
 *
 * That library is good and it is about 6kB gzipped, which is not the problem.
 * The problem is that it draws in its own palette and has no idea about the
 * theme, so every burst would be six party colours on a screen built from two,
 * and the app has already had that argument once with the emoji. Written here,
 * the particles are the theme's own accent, field and green, read from the CSS
 * variables at the moment they fire, so a burst in sea is teal and gold and a
 * burst in sun is magenta and gold without anything being passed down.
 *
 * It is also about a hundred lines. The physics is four multiplications.
 *
 * OUTSIDE REACT, ON PURPOSE.
 *
 * The canvas is appended to the body rather than rendered by a component,
 * because the check-in navigates to the board the instant it succeeds and a
 * component would be unmounted mid-flight. This survives the navigation and
 * plays over whatever arrives, which is the correct behaviour: the celebration
 * belongs to the event, not to the screen that happened to start it.
 *
 * Everything is cleaned up when the last particle dies: the loop is cancelled,
 * the canvas is removed from the document, and the array is dropped. A second
 * burst before the first has finished cancels the first rather than stacking a
 * second canvas on top of it.
 */

/**
 * Tuning, and it took measuring to get right.
 *
 * The first pass used a throw of about 22px per frame with gravity at 0.8, and
 * in a browser that produced a burst that never left the bottom third of the
 * screen and was gone in six hundred milliseconds. The arithmetic says why: a
 * throw decaying at 0.94 travels roughly v0/(1-decay) before drag alone stops
 * it, so 22 buys about 360px of rise before gravity is even counted, and
 * gravity at 0.8 against a drag floor of 0.8/0.06 means a piece falls at
 * thirteen pixels a frame within half a second.
 *
 * So the throw is now scaled to the viewport rather than fixed, and gravity is
 * lighter. On an 844px phone that is a rise of most of the screen and a fall
 * that takes two seconds, which is the difference between confetti and a
 * puff of dust at your ankles.
 */
export const GRAVITY = 0.42
export const DECAY = 0.945
export const TICKS = 220

/** How long a burst can run before it is stopped regardless, in ms. */
export const MAX_MS = 5000

/**
 * One piece of paper.
 *
 * `random` is injected so the maths can be tested with a sequence that does
 * not change between runs. Everything here is plain arithmetic: no canvas, no
 * document, nothing that needs a browser.
 */
export function makeParticle({ x, y, angle, spread, speed, color, random = Math.random }) {
  const theta = ((angle + spread * (random() - 0.5)) * Math.PI) / 180
  const power = speed * (0.55 + random() * 0.45)

  return {
    x,
    y,
    /* Screen coordinates, so up is negative. The angle is given in the way
       people describe it, degrees anticlockwise from east, and inverted once
       here rather than at every call site. */
    vx: Math.cos(theta) * power,
    vy: -Math.sin(theta) * power,
    tick: 0,
    color,
    /* A mix of shapes, because a field of identical rectangles reads as a
       pattern and a field of mixed ones reads as paper. */
    square: random() > 0.35,
    size: 6 + random() * 6,
    spin: (random() - 0.5) * 0.35,
    rotation: random() * Math.PI * 2,
    /* The wobble is what stops it looking like sparks falling in straight
       lines: each piece drifts sideways on its own phase and rate. */
    wobble: random() * Math.PI * 2,
    wobbleRate: 0.06 + random() * 0.06,
  }
}

/**
 * One frame of physics, in place.
 *
 * Drag first, then gravity, which is the order that gives a burst its shape:
 * the initial throw dies away fast and the fall takes over, rather than the
 * two fighting for the whole flight.
 */
export function step(p, gravity = GRAVITY, decay = DECAY) {
  p.vx *= decay
  p.vy *= decay
  p.vy += gravity
  p.wobble += p.wobbleRate

  p.x += p.vx + Math.sin(p.wobble) * 1.6
  p.y += p.vy
  p.rotation += p.spin
  p.tick += 1

  return p
}

/** 1 at birth, 0 when it is spent. Drives both the fade and the removal. */
export function life(p, ticks = TICKS) {
  return Math.max(0, 1 - p.tick / ticks)
}

/** Has this one finished, either by age or by leaving the bottom of the view? */
export function isDead(p, ticks = TICKS, height = Infinity) {
  return p.tick >= ticks || p.y > height + 40
}

/**
 * A short pulse, on the devices that have one.
 *
 * Deliberately not gated on prefers-reduced-motion. That preference is about
 * things moving in the visual field, which is a different sense and a
 * different problem; somebody who has asked for less animation has not asked
 * their phone to stop buzzing. It is gated on the API existing, which on
 * desktop and on iOS Safari it does not, and a missing vibrate is a silent
 * no-op rather than a thrown error.
 *
 * Three beats rather than one long buzz: a single 200ms pulse reads as a
 * notification, and this is a small congratulation.
 */
export function haptic(pattern = [50, 10, 150]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* Some engines throw when the document has never been interacted with.
       There is nothing to recover: the celebration is decorative. */
  }
}

/** The theme's own colours, read at the moment of firing. */
function palette() {
  const css = getComputedStyle(document.documentElement)
  const read = (name, fallback) => {
    const v = css.getPropertyValue(name).trim()
    return v ? `rgb(${v})` : fallback
  }
  return [
    read('--c-accent', 'rgb(255 0 110)'),
    read('--c-field', 'rgb(255 214 10)'),
    read('--c-green', 'rgb(21 128 61)'),
    read('--c-ink', 'rgb(169 28 84)'),
  ]
}

let running = null

/** Stop whatever is in flight and take its canvas out of the document. */
export function stopBurst() {
  if (!running) return
  cancelAnimationFrame(running.raf)
  clearTimeout(running.timer)
  running.canvas.remove()
  running = null
}

/**
 * Fire.
 *
 * Two origins near the bottom corners rather than one in the middle. A single
 * central burst reads as a firework and covers the middle of the screen, which
 * is where the sentence somebody is trying to read lives; two corner throws
 * arc up the sides and fall across everything, which is the shape of the real
 * thing and leaves the centre clearest at the moment it matters.
 */
export function burst({ count = 120, reduced = false } = {}) {
  if (typeof document === 'undefined') return
  /* Reduced motion gets the haptic and nothing that moves. The caller has
     already fired the haptic; this simply declines to draw. */
  if (reduced) return

  stopBurst()

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  /* pointer-events:none is the whole of "does not block other UI": the canvas
     covers the screen and every tap goes straight through it. */
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  ctx.scale(dpr, dpr)

  const colors = palette()
  const particles = []

  /**
   * Three throws, not one.
   *
   * Two from the bottom corners arcing inwards, which is the shape of the real
   * thing and leaves the middle of the screen clearest at the moment somebody
   * is reading it, and one weaker fountain from the centre so the gap between
   * the two arcs fills in rather than staying conspicuously empty.
   *
   * The speed is a fraction of the viewport height rather than a constant, so
   * the burst covers the same proportion of a small phone and a desktop
   * window instead of clearing one and dribbling on the other.
   */
  const throws = [
    { x: w * 0.06, y: h * 0.96, angle: 60, spread: 55, speed: h * 0.062, share: 0.38 },
    { x: w * 0.94, y: h * 0.96, angle: 120, spread: 55, speed: h * 0.062, share: 0.38 },
    { x: w * 0.5, y: h * 1.0, angle: 90, spread: 90, speed: h * 0.05, share: 0.24 },
  ]

  for (const t of throws) {
    const n = Math.round(count * t.share)
    for (let i = 0; i < n; i += 1) {
      particles.push(
        makeParticle({
          x: t.x,
          y: t.y,
          angle: t.angle,
          spread: t.spread,
          speed: Math.max(24, t.speed),
          color: colors[particles.length % colors.length],
        }),
      )
    }
  }

  const draw = () => {
    ctx.clearRect(0, 0, w, h)
    let alive = 0

    for (const p of particles) {
      if (isDead(p, TICKS, h)) continue
      alive += 1
      step(p)

      ctx.save()
      ctx.globalAlpha = Math.min(1, life(p) * 2.2)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color

      if (p.square) {
        /* Squashed on one axis and spun, which is what gives a flat rectangle
           the look of a piece of paper turning over in the air. */
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    if (alive === 0) return stopBurst()
    running.raf = requestAnimationFrame(draw)
  }

  running = {
    canvas,
    raf: requestAnimationFrame(draw),
    /* A hard stop as well as the natural one. If the tab is backgrounded
       mid-flight the frame loop pauses, and a canvas that quietly stays in the
       document forever is a leak nobody would ever notice. */
    timer: setTimeout(stopBurst, MAX_MS),
  }
}

/** Does this person want less of this? */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * The whole celebration, as one call.
 *
 * Haptic first: it is instant, and a buzz that lands a frame before the
 * confetti reads as the cause of it rather than as a coincidence.
 */
export function cheer() {
  haptic()
  burst({ reduced: prefersReducedMotion() })
}
