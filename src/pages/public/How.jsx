import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import PreviewCard from '../../components/PreviewCard'

export default function How() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en

  return (
    <>
      <section className="mx-auto w-full max-w-5xl animate-rise px-6 pb-12 pt-14 md:pt-20">
        <p className="eyebrow">{c.steps.eyebrow}</p>
        <h1 className="display mt-5 max-w-[18ch] text-[clamp(2.25rem,6vw,3.5rem)]">
          {c.steps.title}
        </h1>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {c.steps.items.map((s) => (
            <div key={s.n} className="panel p-7">
              <p className="text-small font-bold text-muted">{s.n}</p>
              <span className="mt-3 block h-1 w-8 rounded-pill bg-accent" aria-hidden="true" />
              <h2 className="mt-5 text-h2 font-bold text-ink">{s.title}</h2>
              <p className="lede mt-3 text-small">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <div>
          <p className="eyebrow">{c.different.eyebrow}</p>
          <div className="mt-8 space-y-7">
            {c.different.items.map((d) => (
              <div key={d.title}>
                <h2 className="text-h2 font-bold text-ink">{d.title}</h2>
                <p className="lede mt-2 max-w-[44ch]">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
        <PreviewCard />
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <Link to="/signin" className="btn-primary press w-auto px-10">
          {c.hero.cta}
        </Link>
      </section>
    </>
  )
}
