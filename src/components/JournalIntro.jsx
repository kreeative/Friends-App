import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../lib/i18n'

/**
 * Why anybody would write anything down, in four screens.
 *
 * This was a banner above the grid, on the argument that a journal needs no
 * explaining: the box is there, you write in it, everybody knows how. That is
 * still true of the mechanics and it was the wrong call about the rest. The
 * mechanics are not what stops people; the blank page is, and a banner that
 * has to be swiped sideways in a 200px strip is not where somebody reads three
 * reasons and decides.
 *
 * So it takes the screen, exactly as the budget intro does, and it uses the
 * same machinery rather than a second implementation of the same idea.
 *
 * FOUR SLIDES, NOT THREE.
 *
 * Three of them are the reasons. The fourth is the prompts, and it is the one
 * that earns the deck: a person who has just agreed that writing is a good
 * idea is looking at an empty page thirty seconds later, and four tappable
 * openings is the difference between a first entry and a closed app. Tapping
 * one starts the page with it already in the box.
 *
 * Scroll-snap rather than a transform and a drag handler, for the reasons in
 * BudgetIntro: the browser owns the physics, the momentum matches every other
 * scroller on the device, and it stays keyboard and screen-reader reachable
 * for free. The dots follow the scroll rather than driving it, so flicking,
 * tapping Next and tabbing all agree about which slide is showing.
 */
const PILLARS = ['clarity', 'success', 'refuge']
const SLIDES = [...PILLARS, 'prompts']

const PROMPTS = ['gratitude', 'goals', 'weight', 'tomorrow']

export default function JournalIntro({ onSkip, onStart }) {
  const { t } = useT()
  const trackRef = useRef(null)
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1

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

  /* The page behind must not scroll under a horizontal flick that the browser
     decides was vertical, and Escape is the way out of anything full-screen. */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onSkip?.()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onSkip])

  const go = (n) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  /**
   * Portalled to the body, and this is not optional.
   *
   * position:fixed resolves against the nearest ancestor with a transform,
   * filter or backdrop-filter, not against the viewport. The app shell has
   * both: the glass chrome uses backdrop-filter and the page wrapper animates
   * in with a transform. Rendered in place, a fixed inset-0 deck inherits a
   * containing block the size of a card. Fourth component in this repo to need
   * the same fix.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-dvh w-full flex-col bg-bg"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex shrink-0 justify-end px-6 pt-6">
        <button className="press text-small text-muted underline underline-offset-4" onClick={onSkip}>
          {t('intro.skip')}
        </button>
      </div>

      <div
        ref={trackRef}
        /* min-h-0 is load-bearing. A flex child defaults to min-height:auto,
           which refuses to shrink below its content and, in a column flex
           parent, collapses a flex-1 scroller to nothing. */
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
      >
        {PILLARS.map((key, n) => (
          <section
            key={key}
            className="flex w-full shrink-0 snap-center flex-col justify-center px-8"
            aria-label={t('intro.step', { n: n + 1, total: SLIDES.length })}
          >
            <div className="mx-auto w-full max-w-content">
              <span className="block h-14 w-14 text-accent">
                <PillarGlyph name={key} />
              </span>
              <div className="eyebrow mt-7">{t('intro.step', { n: n + 1, total: SLIDES.length })}</div>
              <h2 className="mt-3 text-h1 leading-tight text-ink">{t(`journal.pillar_${key}_title`)}</h2>
              <p className="lede mt-5 max-w-[34ch]">{t(`journal.pillar_${key}_body`)}</p>
            </div>
          </section>
        ))}

        {/* The last one, and the only one you can act on. */}
        <section
          className="flex w-full shrink-0 snap-center flex-col justify-center px-8"
          aria-label={t('intro.step', { n: SLIDES.length, total: SLIDES.length })}
        >
          <div className="mx-auto w-full max-w-content">
            <div className="eyebrow">{t('intro.step', { n: SLIDES.length, total: SLIDES.length })}</div>
            <h2 className="mt-3 text-h1 leading-tight text-ink">{t('journal.prompts_title')}</h2>
            <p className="lede mt-4 max-w-[34ch]">{t('journal.prompts_body')}</p>

            {/* Tappable, not decorative. A prompt somebody has to retype is a
                prompt somebody reads and then closes the app. */}
            <div className="mt-6 flex flex-col gap-2">
              {PROMPTS.map((key) => (
                <button
                  key={key}
                  onClick={() => onStart?.(`${t(`journal.prompt_${key}`)}\n\n`)}
                  className="press rounded-inner bg-ink/[0.05] px-4 py-3 text-left text-body text-ink transition-colors hover:bg-ink/[0.1]"
                >
                  {t(`journal.prompt_${key}`)}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="shrink-0 px-8 pb-10 pt-6">
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
            onClick={() => (last ? onStart?.('') : go(i + 1))}
          >
            {last ? t('journal.intro_start') : t('intro.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * One drawn mark per reason.
 *
 * A slide with nothing but two paragraphs is a slide people swipe past
 * without reading, and these three are the argument. Drawn rather than emoji
 * for the reason the mood grid settled once already: an emoji is four
 * different pictures on four platforms and sits at a different weight from
 * everything around it.
 */
function PillarGlyph({ name }) {
  const common = {
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    className: 'h-full w-full',
  }

  /* Clarity: a tangle resolving into one straight line. */
  if (name === 'clarity') {
    return (
      <svg {...common}>
        <path d="M6 14c4-5 8 5 12 0s8 5 12 0 8 4 12 0" opacity="0.45" />
        <path d="M6 24c4-3 8 3 12 0s8 2 12 0 8 1 12 0" opacity="0.7" />
        <path d="M6 34h36" />
      </svg>
    )
  }

  /* Success: a step you can climb again, with the rise marked. */
  if (name === 'success') {
    return (
      <svg {...common}>
        <path d="M6 40h10V26H6zM19 40h10V16H19zM32 40h10V6H32z" opacity="0.55" />
        <path d="M6 22 19 12l13 8 10-8" />
        <path d="M42 12V4h-8" />
      </svg>
    )
  }

  /* Refuge: a roof with a closed door under it. */
  return (
    <svg {...common}>
      <path d="M6 22 24 8l18 14" />
      <path d="M10 20v20h28V20" />
      <path d="M19 40V28h10v12" />
      <circle cx="26.5" cy="34" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
