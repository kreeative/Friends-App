import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { Mark } from '../../components/Wordmark'
import Cover from '../../components/Cover'

/**
 * The front page: what this is, why groups go quiet, and the way in.
 *
 * Everything that used to sit below — how it works, the books, the theme —
 * has its own page now. A home page's job is to be enough to decide with,
 * not to contain the site.
 */
export default function Home() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en

  return (
    <>
      <Cover>
        <div className="cover-panel animate-rise max-w-[36rem]">
          <p className="eyebrow">{c.hero.eyebrow}</p>
          <h1 className="display mt-4 max-w-[16ch] text-[clamp(2.25rem,6vw,3.75rem)]">
            {c.hero.title}
          </h1>
          {/* ink at 80% rather than muted: this is the one block of type with
              a photograph under it, and muted grey has no margin to spend. */}
          <p className="mt-5 max-w-[44ch] text-[1.0625rem] text-ink/80">{c.hero.body}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/signin" className="btn-primary press w-auto px-8">
              {c.hero.cta}
            </Link>
            <Link to="/how-it-works" className="btn-outline press w-auto px-8">
              {c.hero.secondary}
            </Link>
          </div>
          <p className="mt-4 text-small text-ink/70">{c.hero.note}</p>
        </div>
      </Cover>

      <div className="mx-auto mt-16 w-full max-w-5xl px-6" aria-hidden="true">
        <span className="block h-1.5 w-full rounded-pill bg-accent/90" />
      </div>

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
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

      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="panel px-6 py-16 text-center">
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
