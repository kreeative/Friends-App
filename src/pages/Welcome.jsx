import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { SLIDES, soloKeyFor } from '../lib/onboarding'
import { isMissingColumn, isNetworkError } from '../lib/dberr'
import Stickers from '../components/Stickers'
import Wordmark from '../components/Wordmark'

/**
 * The first screen of the app, for somebody who has just signed up.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO.
 *
 * A form. Name your group, pick a weekday, pick an hour, create. That is the
 * right first screen for somebody who arrived with three friends already
 * waiting, and the wrong one for everybody else, which is most people. The
 * journal, the budget and your own goals all work perfectly well alone and
 * none of them were reachable until you had invented a group to hold them.
 * The app's own answer to "what can I do here" was "find some friends first".
 *
 * So the first screen says what the app is, in three slides, and then asks a
 * question with two real answers instead of one.
 *
 * THE SECOND ANSWER IS NOT A SKIP.
 *
 * "Continue on my own" is a choice that is remembered, not a dismissal. That
 * distinction is the whole feature: without a flag the app cannot tell
 * somebody who chose to be alone from somebody who abandoned signing up, so
 * it would put the same form in front of both of them every morning. See
 * supabase/30_solo_mode.sql and landing() in src/lib/onboarding.js.
 *
 * THE BACKGROUND IS THE THEME'S, NOT A COLOUR.
 *
 * `bg-bg` already resolves to #FFF5F7 under sun and #F0F9FF under sea, which
 * is the soft pink and the pale blue this screen wanted. Hard-coding either
 * one would give half the audience a background that fights every card,
 * button and sticker on top of it, and would stop following the theme the
 * moment somebody changed it.
 *
 * Scroll-snap rather than a transform and a drag handler, exactly as
 * JournalIntro and BudgetIntro do. The browser owns the physics, the momentum
 * matches every other scroller on the device, and it stays keyboard and
 * screen-reader reachable for nothing. The dots follow the scroll rather than
 * driving it, so flicking, tapping Next and tabbing all agree about which
 * slide is showing.
 *
 * Not a portal, unlike the other two decks: this is a route rather than an
 * overlay, so there is no transformed ancestor to escape.
 */
export default function Welcome() {
  const { t } = useT()
  const navigate = useNavigate()
  const { user, profile, updateProfile } = useAuth()

  const trackRef = useRef(null)
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
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

  const go = (n) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  /**
   * Chose to go it alone.
   *
   * Written to the profile so the choice follows the person to their laptop,
   * and mirrored into this device's storage first.
   *
   * THE LOCAL WRITE IS NOT BELT AND BRACES, IT IS THE FALLBACK.
   *
   * If migration 30 has not been run the column does not exist, the update
   * fails with PGRST204, and without somewhere else to put the answer the app
   * would ask this same question on every load and never accept the reply.
   * That is the worst possible failure for this particular screen: a person
   * who has said "no thanks" being asked again tomorrow, and the day after.
   *
   * So it is stored locally either way, before the request goes out, and the
   * navigation happens whatever the server says. A choice this cheap must
   * never be blocked on a round trip.
   */
  async function goSolo() {
    if (busy) return
    setBusy(true)

    const key = soloKeyFor(user?.id)
    try {
      if (key) localStorage.setItem(key, '1')
    } catch {
      /* Private mode. The profile write below is the real record anyway. */
    }

    /**
     * One write, through updateProfile.
     *
     * It already does the update AND puts the returned row into the auth
     * context, which is what makes the app decide on the new answer without
     * waiting for a refetch: by the time the route changes, landing() is
     * looking at solo_mode true and there is no frame in which the deck
     * comes back.
     *
     * This was briefly an explicit supabase.update() as well, which sent the
     * same PATCH twice for one tap. The context was already doing the job.
     */
    let error = null
    if (updateProfile) {
      ;({ error } = await updateProfile({ solo_mode: true }))
      /* One retry, and only for a request that never arrived. A refusal is
         not going to become an acceptance. */
      if (isNetworkError(error)) ({ error } = await updateProfile({ solo_mode: true }))
    }

    /* A missing column is migration 30 not having been run, and the local flag
       above already covers it. Nothing is surfaced either way: this screen's
       job is to get out of the way, and an error box under a button somebody
       pressed to skip setup is the opposite of that. The choice is honoured on
       this device regardless, which is what stops the deck asking again. */
    if (error && !isMissingColumn(error, 'solo_mode')) {
      /* Left deliberately silent. See above. */
    }

    setBusy(false)
    navigate('/', { replace: true })
  }

  return (
    <div
      /**
       * h-dvh, not min-h-dvh, and this is the difference between the two CTAs
       * being on screen and being below the fold.
       *
       * With min-h the column grows to whatever its children want, so on a
       * 568px phone the header, the slide and the footer summed to 719px, the
       * page scrolled, and the primary button of an onboarding deck was
       * somewhere under the bottom edge. A fixed viewport height plus a
       * shrinkable track means the SLIDE gives up the space instead of the
       * page taking it, and the header and the buttons are always where they
       * were put.
       */
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Stickers set="welcome" />

      {/* Above the stickers, which sit at z-20 and deliberately overlap the
          column. Everything readable or tappable has to clear them. */}
      <div className="relative z-30 flex min-h-0 flex-1 flex-col">
        {/* The logo centred, with Skip taken out of the flow so it cannot
            push the logo off the middle. Wordmark sizes itself from `size`
            and ignores a height class, so the tile has to be asked for at
            the size it should be rather than constrained afterwards. */}
        <header className="relative shrink-0 px-6 pt-6">
          <div className="flex justify-center">
            <Wordmark size={60} />
          </div>
          {/* Skip goes where "continue on my own" goes. It is the same
              decision, and a Skip that dumped somebody on the group form
              would be a third answer to a two-answer question. */}
          <button
            onClick={goSolo}
            disabled={busy}
            className="press absolute right-6 top-1/2 -translate-y-1/2 text-small text-muted underline underline-offset-4 disabled:opacity-50"
          >
            {t('welcome.skip')}
          </button>
        </header>

        <div
          ref={trackRef}
          /* min-h-0 is load-bearing. A flex child defaults to min-height:auto,
             refuses to shrink below its content, and in a column flex parent
             collapses a flex-1 scroller to nothing. */
          className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
        >
          {SLIDES.map((key, n) => (
            <section
              key={key}
              /* The slide scrolls inside itself rather than pushing the page.
                 On a short screen with the text at its longest, something has
                 to give, and it should be the part somebody is reading rather
                 than the part they are meant to press. */
              className="flex w-full shrink-0 snap-center flex-col overflow-y-auto px-8 py-4"
              aria-label={t('welcome.step', { n: n + 1, total: SLIDES.length })}
            >
              {/* my-auto rather than justify-center on the parent. Both
                  centre the slide when it fits; only this one degrades
                  properly when it does not. Auto margins collapse to zero
                  once the content is taller than the box, so a long slide on
                  a short phone starts at the top and scrolls, instead of
                  being centred and clipped at BOTH ends with the heading
                  half off the top. */}
              <div className="mx-auto my-auto w-full max-w-content">
                <span className="block h-16 w-16 text-accent">
                  <SlideGlyph name={key} />
                </span>
                <div className="eyebrow mt-7">
                  {t('welcome.step', { n: n + 1, total: SLIDES.length })}
                </div>
                <h1 className="mt-3 text-h1 leading-tight text-ink">
                  {t(n === 0 ? 'welcome.hi' : `welcome.${key}_title`)}
                </h1>
                <p className="lede mt-5 max-w-[34ch]">
                  {t(n === 0 ? 'welcome.hi_body' : `welcome.${key}_body`)}
                </p>
              </div>
            </section>
          ))}
        </div>

        <div className="shrink-0 px-8 pb-8 pt-5">
          <div className="mx-auto w-full max-w-content">
            {/* Dots are buttons, not decoration. They are the only way back to
                a slide for somebody who is not dragging. */}
            <div className="mb-6 flex justify-center gap-2">
              {SLIDES.map((key, n) => (
                <button
                  key={key}
                  onClick={() => go(n)}
                  aria-label={t('welcome.step', { n: n + 1, total: SLIDES.length })}
                  aria-current={n === i}
                  className={`h-2 rounded-pill transition-all duration-300 ease-settle ${
                    n === i ? 'w-6 bg-accent' : 'w-2 bg-ink/20'
                  }`}
                />
              ))}
            </div>

            {/**
             * One button until the end, then two.
             *
             * The choice appears on the last slide and not before, because
             * the third slide is the one that explains that going alone is a
             * real option. Offering both buttons on slide one asks somebody
             * to decide between two things neither of which has been
             * described yet, and the honest answer to that is to guess.
             */}
            {last ? (
              <div className="animate-rise space-y-3">
                <button className="btn-primary press w-full" onClick={() => navigate('/start')}>
                  {t('welcome.cta_group')}
                </button>
                <button
                  className="btn-ghost press w-full"
                  onClick={goSolo}
                  disabled={busy}
                >
                  {busy ? t('welcome.saving') : t('welcome.cta_solo')}
                </button>
                <p className="pt-1 text-center text-small text-muted">{t('welcome.solo_note')}</p>
              </div>
            ) : (
              <button className="btn-primary press w-full" onClick={() => go(i + 1)}>
                {t('welcome.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * One drawn mark per slide.
 *
 * A slide with nothing but two paragraphs is a slide people swipe past
 * without reading. Drawn rather than emoji for the reason the mood grid
 * settled once already: an emoji is four different pictures on four platforms
 * and sits at a different weight from everything around it. These inherit the
 * accent colour and the type's own scale.
 */
function SlideGlyph({ name }) {
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

  /* Welcome: the three things the app holds, stacked as one. */
  if (name === 'welcome') {
    return (
      <svg {...common}>
        <path d="M8 12h32M8 24h32M8 36h20" opacity="0.4" />
        <path d="m30 33 4 4 8-9" />
        <circle cx="8" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="8" cy="24" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  /* Together: four, facing in. */
  if (name === 'together') {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="5.5" />
        <circle cx="32" cy="16" r="5.5" />
        <circle cx="16" cy="32" r="5.5" opacity="0.55" />
        <circle cx="32" cy="32" r="5.5" opacity="0.55" />
        <path d="M21 21 27 27" />
      </svg>
    )
  }

  /* Solo: one, with a closed book and a private mark. */
  return (
    <svg {...common}>
      <path d="M12 8h20a4 4 0 0 1 4 4v28H16a4 4 0 0 1-4-4V8Z" />
      <path d="M12 32h24" opacity="0.5" />
      <circle cx="24" cy="20" r="4" />
      <path d="M24 24v4" />
    </svg>
  )
}
