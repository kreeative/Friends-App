import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import PreviewCard from '../../components/PreviewCard'

export default function How() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en

  /* From the page's own content and the reader's own language, like About
     does, rather than from a table of English strings kept somewhere else
     that would drift the first time this copy is edited. */
  usePageMeta({
    title: `${c.steps.eyebrow} · Rich & Friends`,
    /* The three step headings, not just the section title. "Three moving
       parts, and no fourth." is thirty-four characters, which is a true
       sentence and a thin search result; naming the three parts is what
       somebody scanning a results page actually needs. */
    description: `${c.steps.title} ${c.steps.items.map((i) => i.title).join('. ')}.`,
  })

  return (
    <>
      <section className="mx-auto w-full max-w-5xl animate-rise px-6 pb-12 pt-10 md:pt-14">
        <div className="panel p-8 md:p-11">
          <p className="eyebrow">{c.steps.eyebrow}</p>
          <h1 className="display mt-4 max-w-[18ch] text-[clamp(2.25rem,5.5vw,3.25rem)]">
            {c.steps.title}
          </h1>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {c.steps.items.map((s) => (
            <div key={s.n} className="panel p-7">
              <p className="text-small font-semibold text-muted">{s.n}</p>
              <span className="mt-3 block h-1 w-8 rounded-pill bg-accent" aria-hidden="true" />
              <h2 className="mt-5 text-h2 font-semibold text-ink">{s.title}</h2>
              <p className="lede mt-3 text-small">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 py-12 md:grid-cols-2 md:items-center">
        <div className="panel p-8 md:p-10">
          <p className="eyebrow">{c.different.eyebrow}</p>
          <div className="mt-8 space-y-7">
            {c.different.items.map((d) => (
              <div key={d.title}>
                <h2 className="text-h2 font-semibold text-ink">{d.title}</h2>
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
