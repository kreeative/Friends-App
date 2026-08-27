import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Mark } from '../../components/Wordmark'

/**
 * The front page: what this is, why groups go quiet, and the way in.
 *
 * Every block of words sits on glass. Nothing is set directly on the artwork
 *, the background is deliberately loud, and type over it would be a guess
 * that changes with whichever picture the theme happens to be showing.
 */
export default function Home() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en

  /* The one page whose title is the product's name alone. Everything else on
     the site is "<page> · Rich & Friends"; the home page being that too would
     put the name in twice for no reader's benefit. */
  usePageMeta({ title: 'Rich & Friends', description: c.hero.body })

  return (
    <>
      {/**
       * The hero has no container.
       *
       * It sat on a glass sheet for as long as the ground was the theme's
       * field colour. Type over saturated yellow needed something between
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
            className="max-w-[13ch] text-[clamp(2.75rem,9vw,5.75rem)] font-semibold leading-[0.94] tracking-[-0.03em] text-ink"
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

      {/**
       * THE MANIFESTO. One sentence, alone, with nothing to compete with it.
       *
       * It is the only place on the site where a single line gets the whole
       * width and a size normally reserved for a heading. That is the point of
       * a manifesto: it is not information, it is the thing the rest of the
       * page is arguing for, so it gets read at a different speed.
       *
       * No quotation marks. Nobody is being quoted; the app is saying it.
       * Punctuation that implies a source the page cannot name reads as a
       * testimonial with the name filed off.
       */}
      <section className="mx-auto w-full max-w-5xl border-t border-hairline px-6 py-20 md:py-28">
        <p
          data-hook="manifesto"
          className="mx-auto max-w-[26ch] text-center font-display text-[clamp(1.5rem,4.4vw,2.75rem)]
                     font-semibold leading-[1.12] tracking-[-0.02em] text-ink"
        >
          {c.manifesto}
        </p>
      </section>

      {/**
       * THE THREE PILLARS.
       *
       * Money is one of three here rather than the whole story, and that is
       * what makes this page agree with the app: the sections below it talk
       * about groups going quiet and about check-ins, which a page that opened
       * on budgeting alone would have contradicted three screens later.
       *
       * Each pillar names a part of the app that actually exists. A pillar
       * that does not resolve to a screen is a slogan, and this page has one
       * of those already, on purpose, at the top.
       */}
      <section
        id="lifestyle"
        className="mx-auto w-full max-w-5xl border-t border-hairline px-6 py-16 md:py-20"
      >
        <p className="eyebrow">{c.pillars.eyebrow}</p>
        <h2 className="display mt-7 max-w-[20ch] text-[clamp(1.625rem,3.6vw,2.5rem)]">
          {c.pillars.title}
        </h2>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {c.pillars.items.map((item) => (
            <li
              key={item.n}
              data-pillar={item.n}
              /* rounded-3xl with a light border, as asked. The tint is on the
                 numeral's tile rather than on the card: a full card of colour
                 three times in a row is a page of blocks, and the text on it
                 would have to be re-measured against three grounds. */
              className="glass-card flex flex-col rounded-3xl border p-6"
            >
              {/**
               * A solid tile per pillar, one in each brand colour, and the
               * numeral is INK on all three.
               *
               * The first version tinted the tile and coloured the numeral to
               * match: pink on pale pink measured 3.10:1 at 16px bold, which
               * is not large text and needs 4.5. Ink on all three is 4.98,
               * 8.81 and 14.90 against pink, blue and yellow, and the colour
               * moves to the tile where it can be solid enough to actually
               * read as a touch of the brand rather than as a wash.
               *
               * THE PINK IS LITERAL HERE, NOT --c-accent, AND THAT IS WHY.
               *
               * These borrowed the accent token, and the accent then went from
               * #FF007A to #E60070 so the primary button could carry WHITE at
               * 4.57:1. Black on that deeper pink is 4.14:1, so the numerals
               * silently dropped under the bar the moment the button changed.
               * The button's pink and the tile's pink are answering opposite
               * questions -- one needs white on it, one needs black -- so they
               * are two colours and no longer one token.
               */}
              <span
                aria-hidden="true"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.tone}
                            font-display text-body font-bold text-[#111111] [font-variant-numeric:tabular-nums]`}
              >
                {item.n}
              </span>
              <h3 className="mt-5 text-body font-bold leading-snug text-ink">{item.title}</h3>
              <p className="mt-2.5 text-small leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Also unboxed. Two white rectangles in a row on a white page is not a
          hierarchy, it is a texture, a hairline separates these just as well
          and puts nothing on screen that is not information. */}
      {/**
       * THE ANSWER, IN THE SHAPE OF THE QUESTION.
       *
       * The eyebrow asks why WE do not reach our goals and the heading used to
       * reply that other apps do not fail for want of features. Nobody arrives
       * on this page wondering why software fails, and an answer aimed at a
       * different question reads as evasion however true it is.
       *
       * Three reasons about people, and under each one the thing this app does
       * about it. The reason and the remedy are on the same row deliberately:
       * split across two sections they become a complaint and a brochure.
       */}
      <section
        id="finances"
        className="mx-auto w-full max-w-5xl border-t border-hairline px-6 py-16 md:py-20"
      >
        <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="eyebrow">{c.problem.eyebrow}</p>
            <h2 className="display mt-7 max-w-[16ch] text-[clamp(1.625rem,3.6vw,2.5rem)]">
              {c.problem.title}
            </h2>
            <Mark size={72} className="mt-8 hidden md:block" />
          </div>

          <ul className="space-y-8">
            {c.problem.reasons.map((r) => (
              <li key={r.why} data-reason="">
                <h3 className="max-w-[30ch] text-body font-bold leading-snug text-ink">{r.why}</h3>
                <p className="mt-2 max-w-[52ch] text-small leading-relaxed text-muted">{r.body}</p>
                {/* The remedy, marked by a rule in the accent rather than by a
                    word like "solution". A label would make each of these a
                    little sales pitch; a line just says the sentence after it
                    is a different kind of sentence. */}
                <p className="mt-3 max-w-[52ch] border-l-2 border-mark pl-4 text-small leading-relaxed text-ink">
                  {r.fix}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/**
       * The one block of colour on the page, full width, and it is the last
       * thing you read. The palette had nowhere to land once the panels went
       * (the page was white with coloured type and that was all) so the
       * closing ask becomes the field itself, with black on it at 13.5:1.
       */}
      <section id="mouvement" className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-card bg-field px-6 py-20 text-center">
          <h2 className="mx-auto max-w-[18ch] text-[clamp(1.875rem,5vw,3rem)] font-semibold leading-[1.02] tracking-[-0.024em] text-on-field">
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
