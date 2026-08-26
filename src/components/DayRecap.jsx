import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { localeTag, useT } from '../lib/i18n'
import { money } from '../lib/money'
import { dragOffset, flipTransform, rectOf, shouldDismiss } from '../lib/gesture'
import { MoodBadge } from './MoodBoard'

/**
 * One day, in full, grown out of the square you held.
 *
 * The panel under the calendar answers "what happened on Tuesday" in about
 * five lines, which is the right size for something permanently open under a
 * strip of dates. It has to stay that size: it sits on the dashboard, and a
 * panel that grows to forty lines when you tap a busy day pushes everything
 * below it off the screen.
 *
 * So the detail is here, and it arrives from the date you pressed rather than
 * from the bottom of the screen. That is not decoration. A sheet that slides
 * up from the edge is a new place; a card that grows out of the tile under
 * your thumb is the same object, larger, and the difference is whether the
 * reader has to work out where they now are.
 *
 * HOW THE MORPH WORKS.
 *
 * FLIP, in about fifteen lines, in src/lib/gesture.js. The panel is laid out
 * where it finally belongs, the transform that would put it back on top of the
 * date cell is computed and applied for one frame, and then removed with a
 * transition on it. Only transform and opacity animate, so the compositor
 * carries the whole thing and nothing re-lays-out for the duration.
 *
 * Framer Motion's `layoutId` is this with a library around it. See flipFrom for
 * why it is not a dependency here.
 *
 * WHY THE PROOF IS THE POINT.
 *
 * A photograph, a link or a note is attached to a check-in and was only ever
 * visible from the group's proof gallery, filed under the goal. Nobody thinks
 * in goals when they are looking back. They think in days: what did I do on
 * the Tuesday I remember being hard.
 *
 * Portalled to the body for the reason every overlay in this app is: the page
 * wrapper keeps an animated transform forever, which makes it the containing
 * block for anything positioned fixed inside it. See components/ui.jsx.
 */

/**
 * Long enough to read as one movement, short enough not to be waited on.
 *
 * Matched by the transition on the panel below. Kept here rather than in the
 * stylesheet because the exit has to be timed in JavaScript: the component
 * cannot unmount until the morph back into the tile has finished, and a
 * duration that lived in two places would eventually disagree.
 */
const MORPH_MS = 380
const CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const OUTCOME_TONE = {
  done: 'chip-green',
  partial: 'chip-accent',
  missed: 'chip-quiet',
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" {...stroke}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
)

/** Movement is a preference, not a given. */
const stillness = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** A titled block, or nothing at all when there is nothing to put in it. */
function Part({ title, children }) {
  if (!children) return null
  return (
    <section className="pt-7 first:pt-0">
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function DayRecap({
  open,
  origin = null,
  date,
  isFuture = false,
  mood = null,
  goals = [],
  outcomes = new Map(),
  entries = [],
  currency = 'CAD',
  onClose,
}) {
  const { t, locale } = useT()
  const tag = localeTag(locale)

  /**
   * closed, coming in, sitting there, going out.
   *
   * A fourth state rather than rendering straight from `open`, because the
   * component cannot unmount the moment the parent says to: the morph back
   * into the tile takes 380ms and there is nothing to animate once the panel
   * is gone. `open` still owns the decision; this owns the timing.
   */
  const [phase, setPhase] = useState('closed')
  const panel = useRef(null)
  const exiting = useRef(null)

  /* How far the finger has dragged the panel down, and where it started. */
  const [drag, setDrag] = useState(0)
  const dragFrom = useRef(null)

  useEffect(() => {
    if (open && phase === 'closed') {
      setDrag(0)
      setPhase('in')
      return
    }
    if (!open && (phase === 'in' || phase === 'idle')) {
      setPhase('out')
      if (exiting.current) window.clearTimeout(exiting.current)
      exiting.current = window.setTimeout(
        () => setPhase('closed'),
        stillness() ? 0 : MORPH_MS,
      )
    }
  }, [open, phase])

  useEffect(() => () => exiting.current && window.clearTimeout(exiting.current), [])

  /**
   * Invert, then play.
   *
   * Measured and applied in a layout effect so the panel is never painted at
   * full size for even one frame before being put back on the tile, which is
   * exactly the flash this is meant to avoid. The second half waits for a
   * frame, because setting a transform and removing it in the same tick is
   * one style computation and animates nothing.
   */
  useLayoutEffect(() => {
    const el = panel.current
    if (phase !== 'in' || !el) return

    const to = rectOf(el)
    const from = origin
    const still = stillness()

    if (!still && from) {
      el.style.transition = 'none'
      el.style.transform = flipTransform(from, to)
      el.style.opacity = '0.4'
      /* Read back, so the browser commits the frame above before the frame
         below replaces it. Without it the two are coalesced and there is no
         movement at all, which is the classic way a FLIP silently does
         nothing. */
      void el.offsetWidth
    }

    const id = window.requestAnimationFrame(() => {
      if (!panel.current) return
      panel.current.style.transition = still
        ? 'opacity 140ms linear'
        : `transform ${MORPH_MS}ms ${CURVE}, opacity ${Math.round(MORPH_MS * 0.55)}ms linear`
      panel.current.style.transform = 'none'
      panel.current.style.opacity = '1'
      setPhase('idle')
    })

    return () => window.cancelAnimationFrame(id)
  }, [phase, origin])

  /** And back into the tile it came from. */
  useLayoutEffect(() => {
    const el = panel.current
    if (phase !== 'out' || !el) return

    const still = stillness()
    if (still) {
      el.style.transition = 'opacity 120ms linear'
      el.style.opacity = '0'
      return
    }

    el.style.transition = `transform ${MORPH_MS}ms ${CURVE}, opacity ${MORPH_MS}ms linear`
    /* Dragged away rather than dismissed: it leaves the way the finger was
       already taking it. Morphing back up into a tile from under a thumb that
       is pushing it down is the animation arguing with the gesture. */
    el.style.transform = dragFrom.current?.dismissed
      ? `translateY(${Math.max(drag, 40)}px) translateY(100%)`
      : flipTransform(origin, rectOf(el))
    el.style.opacity = '0'
  }, [phase, origin, drag])

  const close = useCallback(() => onClose?.(), [onClose])

  useEffect(() => {
    if (phase === 'closed') return
    const onKey = (e) => e.key === 'Escape' && close()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [phase, close])

  if (phase === 'closed' || !date) return null

  const fmt = (cents) => money(cents, currency, locale)

  const total = (kind) =>
    entries.filter((e) => e.kind === kind).reduce((sum, e) => sum + (e.amount_cents || 0), 0)
  const spent = total('expense')
  const earned = total('income')

  const heading = date.toLocaleDateString(tag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const yearLabel =
    date.getFullYear() === new Date().getFullYear() ? null : String(date.getFullYear())

  const empty = !mood && goals.length === 0 && entries.length === 0

  /* --- swipe down to dismiss ------------------------------------------- */
  /**
   * WHY THE POINTER IS NOT CAPTURED HERE UNTIL THE DRAG IS REAL.
   *
   * The close button lives inside the drag handle, because the whole header
   * is the handle and a four-pixel grabber is a target most thumbs miss.
   * Capturing on pointerdown retargets the following mouse events to the
   * element that captured, so both ends of the press land on the header and
   * the browser issues the click there instead of on the button inside it.
   * The close button stopped closing anything, and nothing anywhere threw.
   *
   * So capture waits until the finger has actually travelled. A tap on the
   * button never reaches that threshold and behaves like an ordinary button;
   * a drag captures on its first few pixels and keeps receiving events even
   * after the finger leaves the header.
   */
  const CAPTURE_AFTER = 4

  const onGrabDown = (e) => {
    if (e.button != null && e.button !== 0) return
    dragFrom.current = { y: e.clientY, at: Date.now(), dismissed: false, held: false }
  }

  const onGrabMove = (e) => {
    const from = dragFrom.current
    if (!from) return

    const dy = dragOffset(from.y, e.clientY)

    if (!from.held && Math.abs(e.clientY - from.y) > CAPTURE_AFTER) {
      from.held = true
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        /* Uncapturable pointer. pointerup on the header still ends the drag. */
      }
      if (panel.current) panel.current.style.transition = 'none'
    }

    if (from.held) setDrag(dy)
  }

  const onGrabUp = (e) => {
    const from = dragFrom.current
    if (!from) return

    /* Never moved: that was a tap on the header, not a drag. Whatever was
       under it, a button or nothing, gets to be a tap. */
    if (!from.held) {
      dragFrom.current = null
      return
    }

    const dy = dragOffset(from.y, e.clientY)
    if (shouldDismiss(dy, Date.now() - from.at)) {
      dragFrom.current = { ...from, dismissed: true }
      setDrag(dy)
      close()
      return
    }

    dragFrom.current = null
    if (panel.current) {
      panel.current.style.transition = `transform ${MORPH_MS}ms ${CURVE}`
    }
    setDrag(0)
  }

  /* The drag rides on top of whatever the morph is doing, so it is only
     written while the panel is sitting still. During the two morphs the
     transform belongs to the effects above. */
  const panelStyle = phase === 'idle' && drag !== 0 ? { transform: `translateY(${drag}px)` } : undefined

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ease-settle"
      style={{ opacity: phase === 'in' || phase === 'out' ? 0 : 1 }}
      onClick={close}
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('recap.title')}
        onClick={(e) => e.stopPropagation()}
        style={panelStyle}
        /* origin at the top left, because that is the corner FLIP measures
           from. Any other origin and the two rectangles do not line up. */
        className="flex max-h-[92dvh] w-full origin-top-left flex-col overflow-hidden rounded-t-3xl bg-surface will-change-transform"
      >
        {/* The whole header is the drag handle, not only the four-pixel bar.
            A grabber that small is a target most thumbs miss, and everything
            in this strip is either the handle or the close button anyway. */}
        <div
          className="shrink-0 cursor-grab touch-none select-none px-5 pt-3 active:cursor-grabbing"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        >
          <div className="mx-auto h-1 w-10 rounded-pill bg-ink/15" aria-hidden="true" />
          <div className="mx-auto mt-3 flex w-full max-w-content items-start gap-3 pb-4">
            <button
              type="button"
              onClick={close}
              aria-label={t('ui.close')}
              className="press -ml-2 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <CloseIcon />
            </button>
            {/* The date is the title. A heading reading "The day" over a sheet
                about one particular day is a label for the component rather
                than for what is in it, so the name of the day gets the size
                and the component's name is only the accessible one. */}
            <div className="min-w-0 flex-1">
              <h2 className="text-h2 leading-tight text-ink first-letter:uppercase">{heading}</h2>
              {yearLabel && <p className="mt-0.5 text-small text-muted">{yearLabel}</p>}
            </div>
          </div>
        </div>

        {/* The contents arrive a beat after the box does. Fading them in over
            a shape that is still growing is what makes the morph land as one
            object arriving rather than as two things happening at once. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] transition-opacity"
          style={{
            opacity: phase === 'idle' ? 1 : 0,
            transitionDuration: `${Math.round(MORPH_MS * 0.6)}ms`,
            transitionDelay: phase === 'idle' ? `${Math.round(MORPH_MS * 0.35)}ms` : '0ms',
          }}
        >
          <div className="mx-auto w-full max-w-content">
            {empty ? (
              <p className="py-6 text-body text-muted">
                {isFuture ? t('recap.future') : t('recap.nothing')}
              </p>
            ) : (
              <>
                {/* The mood first, because it is the frame the rest is read
                    in. Asking how somebody was before what they got done is
                    the order this whole product argues for. */}
                <Part title={t('recap.mood')}>
                  {mood ? (
                    <p className="flex items-center gap-3 text-body text-ink">
                      <MoodBadge id={mood} size={28} />
                      {t(`mood.${mood}`)}
                    </p>
                  ) : null}
                </Part>

                <Part title={t('recap.goals')}>
                  {goals.length ? (
                    <ul className="lg divide-y divide-hairline px-5">
                      {goals.map((g) => {
                        const item = outcomes.get(g.id)
                        return (
                          <li key={g.id} className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0 flex-1 text-body text-ink">
                                {g.commitment}
                              </span>
                              {item ? (
                                <span
                                  className={`${OUTCOME_TONE[item.outcome] ?? 'chip-quiet'} shrink-0`}
                                >
                                  {item.outcome === 'done'
                                    ? t('board.did_it')
                                    : item.outcome === 'partial'
                                      ? t('board.partly')
                                      : t('board.not_this_week')}
                                </span>
                              ) : (
                                !isFuture && (
                                  <span className="shrink-0 text-small text-muted/70">
                                    {t('week.not_recorded')}
                                  </span>
                                )
                              )}
                            </div>

                            {/* The evidence. Only for a day that was actually
                                recorded: "no proof attached" under a goal
                                nobody has checked in on yet is a complaint
                                about something that was never due. */}
                            {item && <Proof item={item} t={t} />}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </Part>

                <Part title={t('recap.money')}>
                  {entries.length ? (
                    <>
                      {/* Three figures, not two. The pair on the strip leaves
                          the reader subtracting, and the answer to "was this
                          a day that cost me" is the difference. */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          [t('money.spent'), spent, ''],
                          [t('money.kind_income'), earned, earned > 0 ? '+' : ''],
                          [t('recap.net'), earned - spent, earned - spent > 0 ? '+' : ''],
                        ].map(([label, cents, sign]) => (
                          <div key={label} className="rounded-inner bg-ink/[0.035] px-3 py-3">
                            <div className="text-small font-semibold text-muted">{label}</div>
                            <div className="mt-1 break-words font-display text-body font-semibold leading-tight text-ink [font-variant-numeric:tabular-nums]">
                              {sign}
                              {fmt(Math.abs(cents))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <ul className="lg mt-3 divide-y divide-hairline px-5">
                        {entries.map((e) => (
                          <li key={e.id} className="flex items-baseline justify-between gap-3 py-3">
                            <span className="min-w-0 flex-1 text-body text-ink">
                              <span className="block truncate">
                                {e.note ||
                                  (e.kind === 'income'
                                    ? t('money.kind_income')
                                    : t(`money.cat_${e.category ?? 'other'}`))}
                              </span>
                              {e.note && e.kind === 'expense' && (
                                <span className="block text-small text-muted">
                                  {t(`money.cat_${e.category ?? 'other'}`)}
                                </span>
                              )}
                            </span>
                            <span
                              className={`shrink-0 text-body font-semibold [font-variant-numeric:tabular-nums] ${
                                e.excluded ? 'text-muted line-through' : 'text-ink'
                              }`}
                            >
                              {e.kind === 'income' ? '+' : ''}
                              {fmt(e.amount_cents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </Part>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Whatever was attached to a check-in, in whatever form it took.
 *
 * The columns are read defensively rather than switched on the goal's
 * proof_type. A goal moved from photo to link in March still has February's
 * photographs hanging off it, so what is on the row is the only reliable
 * account of what the proof actually is. It is also what makes this survive a
 * database where migration 28 has not been run: those columns come back
 * undefined and the block simply does not draw.
 */
function Proof({ item, t }) {
  const note = String(item.evidence ?? '').trim()
  const link = item.link_url ?? null
  const photo = item.photo_url ?? null

  if (!note && !link && !photo) {
    return <p className="mt-2 text-small text-muted/70">{t('recap.no_proof')}</p>
  }

  return (
    <div className="mt-3 space-y-3">
      {photo && (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="w-full rounded-inner bg-ink/[0.04] object-cover"
          style={{ maxHeight: '18rem' }}
        />
      )}
      {note && <p className="whitespace-pre-wrap text-small text-ink">{note}</p>}
      {link && (
        /* rel is not optional here. The proof is a URL somebody typed, and
           without noopener the page it opens gets a handle on this one. */
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-block max-w-full truncate text-small font-semibold text-ink underline underline-offset-2"
        >
          {t('recap.proof_link')}
        </a>
      )}
    </div>
  )
}
