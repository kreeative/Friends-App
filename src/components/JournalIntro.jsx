import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * Two slides at the top of an empty journal.
 *
 * A banner rather than the full-screen carousel the budget intro uses, and
 * that is the whole design decision here. The budget screen is meaningless
 * before somebody has entered a plan, so it is worth stopping them to explain
 * it. A journal is not: the box is there, you write in it, everybody already
 * knows how. Taking over the screen to explain journalling to somebody who
 * just tapped "Journal" would be a lecture in the way of the thing.
 *
 * So it sits above the grid, it is two slides rather than six, and it is
 * dismissible from the first frame. What it is actually for is the second
 * slide: the blank page is the hard part of journalling and a few prompts is
 * the difference between writing something and closing the app.
 *
 * Dismissal is stored on the profile rather than in localStorage, so putting
 * it away on a phone also puts it away on a laptop.
 */
const SLIDES = ['why', 'prompts']

export default function JournalIntro({ onDismiss, onPickPrompt }) {
  const { t } = useT()
  const trackRef = useRef(null)
  const [i, setI] = useState(0)

  /* The scroller is the source of truth, so the dots stay honest during a
     flick rather than only when a button is pressed. Same approach as
     BudgetIntro and WeekStrip. */
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

  const prompts = ['gratitude', 'goals', 'weight', 'tomorrow']

  return (
    <section className="lg relative mt-6 overflow-hidden p-5 sm:p-6">
      <button
        onClick={onDismiss}
        className="absolute right-4 top-4 z-10 rounded-pill px-2 py-1 text-small text-muted transition-colors hover:text-ink"
      >
        {t('journal.intro_dismiss')}
      </button>

      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
      >
        <div className="w-full shrink-0 snap-center pr-8">
          <p className="eyebrow">{t('journal.intro_eyebrow')}</p>
          <h3 className="mt-2 text-h2 text-ink">{t('journal.why_title')}</h3>
          <ul className="mt-4 space-y-2.5">
            {['clarity', 'reflection', 'checkin'].map((k) => (
              <li key={k} className="flex gap-3 text-body text-muted">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" />
                <span>{t(`journal.why_${k}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full shrink-0 snap-center pr-8">
          <p className="eyebrow">{t('journal.intro_eyebrow')}</p>
          <h3 className="mt-2 text-h2 text-ink">{t('journal.prompts_title')}</h3>
          {/**
           * Tappable, not decorative. A prompt somebody has to retype is a
           * prompt somebody reads and then closes the app; tapping one opens
           * the editor with it already in the box, which is the entire point
           * of having them written down here.
           */}
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((k) => (
              <button
                key={k}
                onClick={() => onPickPrompt?.(t(`journal.prompt_${k}`))}
                className="press rounded-pill bg-ink/[0.06] px-3.5 py-2 text-left text-small text-ink transition-colors hover:bg-ink/[0.1]"
              >
                {t(`journal.prompt_${k}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        {SLIDES.map((s, n) => (
          <button
            key={s}
            onClick={() => go(n)}
            aria-label={t('journal.intro_slide', { n: n + 1 })}
            aria-current={i === n}
            className={`h-1.5 rounded-pill transition-all ${
              i === n ? 'w-6 bg-accent' : 'w-1.5 bg-ink/20'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
