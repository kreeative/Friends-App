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
        <div className="panel relative max-w-[38rem] p-8 md:p-11">
          <p className="eyebrow">{c.hero.eyebrow}</p>
          <h1 className="display mt-4 max-w-[15ch] text-[clamp(2.25rem,6vw,3.75rem)]">
            {c.hero.title}
          </h1>
          <p className="lede mt-6 max-w-[42ch] text-[1.0625rem]">{c.hero.body}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/signin" className="btn-primary press w-auto px-8">
              {c.hero.cta}
            </Link>
            <Link to="/how-it-works" className="btn-outline press w-auto px-8">
              {c.hero.secondary}
            </Link>
          </div>
          <p className="mt-4 text-small text-muted">{c.hero.note}</p>
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
