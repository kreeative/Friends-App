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
      <section className="relative mx-auto w-full max-w-5xl animate-rise px-6 pb-20 pt-10 md:pb-24 md:pt-14">
        {/**
         * The hero is a block of the theme's field colour rather than a white
         * panel with a small coloured button on it. Colour used as a sliver
         * is decoration; colour used at this size is the page's voice, which
         * is the whole point of a two-colour theme.
         *
         * Everything inside is black — 13.5:1 on yellow, 6.5:1 on blue — so
         * the loudest surface on the site is also its most legible one.
         */}
        <div className="relative max-w-[40rem] rounded-card bg-field p-8 text-on-field md:p-12">
          <p className="text-label font-bold uppercase tracking-[0.16em] text-on-field/70">
            {c.hero.eyebrow}
          </p>
          <h1 className="mt-5 max-w-[14ch] text-[clamp(2.5rem,6.5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em] text-on-field">
            {c.hero.title}
          </h1>
          <p className="mt-7 max-w-[44ch] text-[1.0625rem] leading-[1.6] text-on-field/80">
            {c.hero.body}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {/* Inverted: black pill on the field, so the primary action is the
                one thing here that is not the field colour. */}
            <Link
              to="/signin"
              className="press inline-flex items-center rounded-pill bg-on-field px-8 py-3.5 text-body font-bold text-field no-underline"
            >
              {c.hero.cta}
            </Link>
            <Link
              to="/how-it-works"
              className="press inline-flex items-center rounded-pill px-8 py-3.5 text-body font-bold text-on-field no-underline"
              style={{ boxShadow: 'inset 0 0 0 2px rgb(var(--c-on-field) / 0.35)' }}
            >
              {c.hero.secondary}
            </Link>
          </div>
          <p className="mt-5 text-small text-on-field/70">{c.hero.note}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="panel grid gap-8 p-8 md:grid-cols-[1fr_1.5fr] md:p-12">
          <div>
            <p className="eyebrow">{c.problem.eyebrow}</p>
            <Mark size={96} className="mt-7" />
          </div>
          <div>
            <h2 className="display max-w-[20ch] text-[clamp(1.625rem,3.6vw,2.375rem)]">
              {c.problem.title}
            </h2>
            <p className="lede mt-5 max-w-[52ch]">{c.problem.body}</p>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="panel relative px-6 py-16 text-center">
          <h2 className="display mx-auto max-w-[18ch] text-[clamp(1.875rem,5vw,2.75rem)]">
            {c.close.title}
          </h2>
          <p className="lede mx-auto mt-4 max-w-[40ch]">{c.close.body}</p>
          <div className="mt-8 flex justify-center">
            <Link to="/signin" className="btn-primary press w-auto px-10">
              {c.close.cta}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
