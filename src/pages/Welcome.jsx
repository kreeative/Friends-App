import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Wordmark from '../components/Wordmark'
import { useT } from '../lib/i18n'
import { SLIDES, soloKeyFor } from '../lib/onboarding'
import { isMissingColumn, isNetworkError } from '../lib/dberr'


/**
 * The first screen of the app, for somebody who has just signed up.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO.
 *
 * A form. Name your group, pick a weekday, pick an hour, create. That is the
 * right first screen for somebody who arrived with three friends already
 * waiting, and the wrong one for everybody else, which is most people. The
 * budget and your own goals both work perfectly well alone and neither was
 * reachable until you had invented a group to hold them.
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
 * THE CARD IS GONE, AND THE POSTER COLOUR WENT WITH IT.
 *
 * Asked for in one line: "pour le ui des slides d'entree supprimer les
 * rectangles". The rectangle was a white card holding the words in the middle
 * of a saturated page, and it could not simply be deleted, because it was not
 * decoration. It was the contrast fix.
 *
 * The page used to be the brand tile's own ground, #FF007A under sun and
 * #009DB9 under sea. White measures 4.30:1 on that pink and 3.22:1 on that
 * teal, both under the 4.5 body copy needs, so the paragraphs could not sit on
 * the colour and the card is where they went instead.
 *
 * Take the card away and the words have to land somewhere legible, so the
 * ground is now the app's own: the same near-white every other screen is read
 * on, with the ink and the muted grey that go with it. Nothing about the type
 * changed, which is what was asked. The colour has not left the screen either,
 * it moved into the things that are colour rather than the thing behind the
 * reading: the logo, the accent button, the dots.
 *
 * Three consequences, all of them in the markup below and each one a control
 * that was white BECAUSE the ground was dark:
 *
 *   the dots      white and white/40 would be invisible; they are ink now
 *   the buttons   a white fill on near-white is not a button. The primary is
 *                 the app's accent button, which this screen could not use
 *                 before precisely because the pink was the page
 *   Skip          white underlined type, now muted like every other quiet
 *                 control in the product
 *
 * Scroll-snap rather than a transform and a drag handler, exactly as
 * BudgetIntro does. The browser owns the physics, the momentum
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
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/**
       * The stickers are gone from this screen.
       *
       * They are decoration on a poster and noise behind a modal. This is the
       * first thing anybody sees and it asks a question in three steps; a
       * scattering of unicorns and coins around the card competes with the one
       * thing on it. They stay everywhere else, where there is no card in the
       * middle to compete with.
       *
       * The z-30 below is kept: nothing overlaps the column now, but the
       * layering is what keeps the header above the swipe track.
       */}
      <div className="relative z-30 flex min-h-0 flex-1 flex-col">
        {/* The logo centred, with Skip taken out of the flow so it cannot
            push the logo off the middle. Wordmark sizes itself from `size`
            and ignores a height class, so the tile has to be asked for at
            the size it should be rather than constrained afterwards. */}
        <header className="relative shrink-0 px-6 pt-6">
          {/**
           * The real lettering, and it sits ON the ground now rather than in a
           * square on it.
           *
           * This was replaced with white type for a round, on the theory that
           * the artwork's own pink square was the problem. It was not: the
           * square was invisible until BRAND.sun and the artwork disagreed
           * about which pink they were. They agree now, so the tile has no
           * edge to show and the hand-drawn name is back, which is a better
           * logo than the same words set in the body face.
           *
           * `flat` drops the raised shadow, which is the only other thing that
           * would have given the tile away.
           */}
          <div className="flex justify-center">
            <Wordmark size={132} flat />
          </div>
          {/* Skip goes where "continue on my own" goes. It is the same
              decision, and a Skip that dumped somebody on the group form
              would be a third answer to a two-answer question. */}
          <button
            onClick={goSolo}
            disabled={busy}
            /* Muted and underlined, like every other quiet control in the app.
               It was white because the page was pink; on the near-white ground
               white type is not quiet, it is gone. */
            className="press absolute right-6 top-1/2 -translate-y-1/2 text-small font-semibold text-muted underline underline-offset-4 disabled:opacity-50"
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
              {/**
               * No card. The words sit on the page, which is why the page had
               * to become something words can sit on. See the note at the top.
               *
               * The box is still here as a layout box and only that: it
               * centres the column and caps its width. It paints nothing, has
               * no radius and casts no shadow, so there is no rectangle.
               */}
              <div className="mx-auto my-auto w-full max-w-content">
                {/**
                 * The glyph above the step label is gone.
                 *
                 * Three of them were a pink line drawing at the top of a white
                 * card, above a label that already says which step this is.
                 * The card has one job per slide and the drawing was not it.
                 *
                 * The step becomes a badge rather than an eyebrow: a pill says
                 * "1 of 3" as a piece of state, where uppercase grey type at
                 * the top of a card reads as a section heading for the
                 * paragraph under it.
                 */}
                {/**
                 * The label is ink, not accent, and that was already wrong
                 * before this screen changed.
                 *
                 * Measured off the paint: #FF007A on its own 12% tint is
                 * 2.92:1 at 13px, where 4.5 is the bar. It failed on the white
                 * card too, at much the same number, so this is a fix rather
                 * than a consequence of removing the card. The pill keeps the
                 * pink; only the four characters inside it move to ink, which
                 * is 14:1 on that tint.
                 */}
                <span className="inline-block rounded-pill bg-accent/[0.12] px-3 py-1 text-label font-semibold uppercase tracking-[0.06em] text-ink">
                  {t('welcome.step', { n: n + 1, total: SLIDES.length })}
                </span>
                <h1 className="text-safe mt-3 text-h1 font-extrabold leading-tight text-ink">
                  {t(n === 0 ? 'welcome.hi' : `welcome.${key}_title`)}
                </h1>
                <p className="text-safe mt-2 max-w-[34ch] text-body leading-relaxed text-muted">
                  {t(n === 0 ? 'welcome.hi_body' : `welcome.${key}_body`)}
                </p>

                {/**
                 * "You can start a group later" belongs here, not under the
                 * buttons where it began.
                 *
                 * Two reasons, and they agree. Editorially it is the end of
                 * this slide's sentence: keep it to yourself, and it is not a
                 * door closing. And at 14px it is body copy, which on the
                 * poster colour measures 4.30:1 under sun and 3.22:1 under
                 * sea, both under the 4.5 it needs. On the card it is the
                 * same muted grey as every hint in the app, at 4.82:1.
                 */}
                {key === 'solo' && (
                  <p className="mt-4 max-w-[34ch] text-small text-muted">
                    {t('welcome.solo_note')}
                  </p>
                )}
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
                  /* Ink, not white. A dot is a graphic and needs 3:1 against
                     what is behind it (1.4.11); white on the near-white ground
                     is 1.06:1, which is a dot nobody can see. The inactive one
                     is the same ink at 25%, so which slide is showing is
                     carried by width as well as by tone. */
                  className={`h-2 rounded-pill transition-all duration-300 ease-settle ${
                    n === i ? 'w-6 bg-ink' : 'w-2 bg-ink/25'
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
                {/* The app's own accent button, which this screen could not
                    use while the pink WAS the page. A white fill on the
                    near-white ground would be an invisible button. */}
                <button className="btn-primary press w-full" onClick={() => navigate('/start')}>
                  {t('welcome.cta_group')}
                </button>
                {/**
                 * The second answer: outlined, not glass.
                 *
                 * `btn-ghost` was the obvious pick and it was measured at
                 * 1.03:1 against this page. It is exactly the trap written up
                 * in CLAUDE.md: backdrop-filter blurs what is behind the
                 * element, and over a flat ground it returns that same flat
                 * colour, so glass on a plain near-white page is a button with
                 * no visible edge at all. It works everywhere else in the app
                 * because everywhere else there is something behind it.
                 *
                 * So the edge is drawn instead of blurred. Ink at 60% composites
                 * to about rgb(133, 122, 127) on this ground, which clears the
                 * 3:1 that 1.4.11 asks of a control's boundary; the app's own
                 * .btn-outline is 18% and measures nearer 1.4:1, which is a
                 * line you can only find if you know it is there.
                 */}
                <button
                  className="btn press w-full border-[1.5px] border-ink/60 text-ink hover:bg-ink/[0.04]"
                  onClick={goSolo}
                  disabled={busy}
                >
                  {busy ? t('welcome.saving') : t('welcome.cta_solo')}
                </button>
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
