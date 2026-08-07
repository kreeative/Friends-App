import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { Mark } from '../../components/Wordmark'

/**
 * The front page: what this is, why groups go quiet, and the way in.
 *
 * Every block of words sits on glass. Nothing is set directly on the artwork
 * — the background is deliberately loud, and type over it would be a guess
 * that changes with whichever picture the theme happens to be showing.
 */
export default function Home() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en

  return (
    <>
      {/**
       * The hero has no container.
       *
       * It sat on a glass sheet for as long as the ground was the theme's
       * field colour — type over saturated yellow needed something between
       * the two. The ground is white now, so the sheet had nothing left to
       * bend: white-on-white, and all anyone could see was a rounded
       * rectangle with a shadow, boxing in the one statement on the site that
       * should own the whole page.
       *
       * Without it the headline can take the width it wants, and the page
       * opens on words rather than on a card.
       */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="stagger max-w-[54rem]">
          {/* No eyebrow. A small grey qualifier above a statement this size
              only softens it, and the audience it named is said better by
              the page itself. */}
          <h1
            style={{ '--i': 0 }}
            className="max-w-[13ch] text-[clamp(2.75rem,9vw,5.75rem)] font-bold leading-[0.94] tracking-[-0.02em] text-ink"
          >
            {c.hero.title}
          </h1>
          <p
            style={{ '--i': 1 }}
            className="mt-8 max-w-[46ch] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-[1.55] text-muted"
          >
            {c.hero.body}
          </p>

          <div style={{ '--i': 2 }} className="mt-10 flex flex-wrap items-center gap-3">
            {/* The accent is the theme's other colour: yellow when the type is
                blue, pink when the type is yellow-adjacent. Either way the
                button is never the colour it is sitting on. */}
            <Link to="/signin" className="btn-primary press w-auto px-9">
              {c.hero.cta}
            </Link>
            <Link to="/how-it-works" className="btn-outline press w-auto px-9">
              {c.hero.secondary}
            </Link>
          </div>
          <p style={{ '--i': 3 }} className="mt-6 text-small text-muted">
            {c.hero.note}
          </p>
        </div>
      </section>

      {/* Also unboxed. Two white rectangles in a row on a white page is not a
          hierarchy, it is a texture — a hairline separates these just as well
          and puts nothing on screen that is not information. */}
      <section className="mx-auto w-full max-w-5xl border-t border-hairline px-6 py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="eyebrow">{c.problem.eyebrow}</p>
            <Mark size={96} className="mt-7" />
          </div>
          <div>
            <h2 className="display max-w-[20ch] text-[clamp(1.625rem,3.6vw,2.5rem)]">
              {c.problem.title}
            </h2>
            <p className="lede mt-5 max-w-[52ch]">{c.problem.body}</p>
          </div>
        </div>
      </section>

      {/**
       * The one block of colour on the page, full width, and it is the last
       * thing you read. The palette had nowhere to land once the panels went
       * — the page was white with coloured type and that was all — so the
       * closing ask becomes the field itself, with black on it at 13.5:1.
       */}
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-card bg-field px-6 py-20 text-center">
          <h2 className="mx-auto max-w-[18ch] text-[clamp(1.875rem,5vw,3rem)] font-bold leading-[1.02] tracking-[-0.018em] text-on-field">
            {c.close.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[40ch] text-body text-on-field/75">{c.close.body}</p>
          <div className="mt-9 flex justify-center">
            {/* Black on the field, rather than the accent: in sun the accent
                is pink on yellow, which is the one pairing in the set that
                fails as a filled control. */}
            <Link
              to="/signin"
              className="btn press w-auto bg-on-field px-10 text-field hover:opacity-90"
            >
              {c.close.cta}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
