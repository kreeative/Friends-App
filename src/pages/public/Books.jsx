import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'

export default function Books() {
  const { locale } = useT()
  const c = (LANDING[locale] ?? LANDING.en).library

  return (
    <section className="mx-auto w-full max-w-5xl animate-rise px-6 pb-20 pt-10 md:pt-14">
      <div className="panel p-8 md:p-11">
        <p className="eyebrow">{c.eyebrow}</p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end">
          <h1 className="display max-w-[18ch] text-[clamp(2.25rem,5.5vw,3.25rem)]">{c.title}</h1>
          <p className="lede max-w-[46ch]">{c.body}</p>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {c.books.map((b) => (
          <article key={b.title} className="panel flex flex-col p-7">
            <span className="h-1.5 w-12 rounded-pill bg-accent" aria-hidden="true" />
            <h2 className="mt-5 text-h2 font-bold text-ink">{b.title}</h2>
            <p className="mt-2 text-small text-muted">{b.sub}</p>
            <p className="lede mt-4 flex-1 text-small">{b.line}</p>
          </article>
        ))}
      </div>

      <div className="mt-10">
        <Link to="/signin" className="btn-primary press w-auto px-8">
          {c.cta}
        </Link>
      </div>
    </section>
  )
}
