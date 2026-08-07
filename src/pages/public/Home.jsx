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
         * Glass over the coloured ground, not a block of colour itself. The
         * page carries the theme; this sheet sits on it and bends it.
         */}
        <div className="lg relative max-w-[40rem] p-8 md:p-12">
          {/* No eyebrow. The headline is the first thing in the block now —
              a small grey qualifier above a statement this size only softens
              it, and the audience it named is said better by the page. */}
          <h1 className="max-w-[14ch] text-[clamp(2.5rem,6.5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
            {c.hero.title}
          </h1>
          <p className="mt-7 max-w-[44ch] text-[1.0625rem] leading-[1.6] text-ink/75">
            {c.hero.body}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {/* The accent, which is the theme's other colour: yellow when the
                ground is blue, pink when the ground is yellow. Either way the
                button is never the colour it is sitting on. */}
            <Link to="/signin" className="btn-primary press w-auto px-8">
              {c.hero.cta}
            </Link>
            <Link to="/how-it-works" className="btn-outline press w-auto px-8">
              {c.hero.secondary}
            </Link>
          </div>
          <p className="mt-5 text-small text-muted">{c.hero.note}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="lg grid gap-8 p-8 md:grid-cols-[1fr_1.5fr] md:p-12">
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
        <div className="lg relative px-6 py-16 text-center">
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
