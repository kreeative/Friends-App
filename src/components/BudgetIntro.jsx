import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../lib/i18n'

/**
 * The six slides somebody sees once, before the money screen has anything on
 * it to look at.
 *
 * Swipeable rather than button-only, because a card carousel that cannot be
 * dragged is a slideshow, and on a phone the thumb tries to drag it first.
 * Implemented with scroll-snap rather than a transform and a drag handler:
 * the browser then owns the physics, the momentum matches every other
 * scroller on the device, and it stays keyboard and screen-reader reachable
 * for free. The dots follow the scroll position rather than driving it, so
 * flicking, tapping Next and tabbing all agree about which slide is showing.
 */
const SLIDES = ['mindset', 'plan', 'track', 'amplify', 'habits', 'freedom']

export default function BudgetIntro({ onDone, onSkip }) {
  const { t } = useT()
  const trackRef = useRef(null)
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1

  // The scroller is the source of truth. Reading it on scroll keeps the dots
  // honest during a flick, which a click-driven index cannot do.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth || 1
        setI(Math.max(0, Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / w))))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  const go = (n) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  /**
   * Portalled to the body, and this is not optional.
   *
   * position:fixed resolves against the nearest ancestor with a transform,
   * filter or backdrop-filter, not against the viewport. The app shell is full
   * of both (the glass chrome uses backdrop-filter, the page wrapper animates
   * in with a transform), so a fixed inset-0 rendered in place inherited a
   * zero-height containing block and the whole carousel measured 0px tall with
   * the text present but unrenderable. Out at the body there is nothing above
   * it to capture the fixed positioning.
   */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex h-dvh w-full flex-col bg-bg">
      <div className="flex justify-end px-6 pt-6">
        <button className="text-small text-muted underline" onClick={onSkip}>
          {t('intro.skip')}
        </button>
      </div>

      <div
        ref={trackRef}
        /* min-h-0 is load-bearing. A flex child defaults to min-height:auto,
           which refuses to shrink below its content and, in a column flex
           parent, collapses a flex-1 scroller to nothing.

           The scrollbar is hidden by .no-scrollbar in index.css rather than an
           arbitrary variant here: the earlier attempt wrote a bare declaration
           block into the class list, which is not valid Tailwind, and the junk
           class took the rest of the string down with it. */
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
      >
        {SLIDES.map((key, n) => (
          <section
            key={key}
            className="flex w-full shrink-0 snap-center flex-col justify-center px-8"
            aria-label={`${n + 1} / ${SLIDES.length}`}
          >
            <div className="mx-auto w-full max-w-content">
              <div className="eyebrow">{t('intro.step', { n: n + 1, total: SLIDES.length })}</div>
              <h2 className="mt-4 text-hero leading-none text-ink">{t(`intro.${key}_title`)}</h2>
              <p className="lede mt-6 max-w-[34ch]">{t(`intro.${key}_body`)}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="px-8 pb-12 pt-6">
        <div className="mx-auto w-full max-w-content">
          {/* Dots are buttons, not decoration. They are the only way back to a
              slide for somebody who is not dragging. */}
          <div className="mb-6 flex justify-center gap-2">
            {SLIDES.map((key, n) => (
              <button
                key={key}
                onClick={() => go(n)}
                aria-label={t('intro.step', { n: n + 1, total: SLIDES.length })}
                aria-current={n === i}
                className={`h-2 rounded-pill transition-all duration-300 ${
                  n === i ? 'w-6 bg-accent' : 'w-2 bg-ink/20'
                }`}
              />
            ))}
          </div>

          <button
            className="btn-primary press w-full"
            onClick={() => (last ? onDone() : go(i + 1))}
          >
            {last ? t('intro.start') : t('intro.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
