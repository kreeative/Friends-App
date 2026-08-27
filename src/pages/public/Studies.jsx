import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { STUDIES } from '../../content/studies'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { fill } from '../../lib/fill'

/**
 * Ce que l'app a appris, publie pour tout le monde.
 *
 * "Une section autres comme une newsletter ou quoi, ou on pourra publier ca de
 * facon bien propre et claire a titre informatif pour tous."
 *
 * Publique, sans compte. Une etude qui demande une inscription pour etre lue
 * n'est pas une publication, c'est un formulaire de capture, et l'argument de
 * cette page est justement qu'elle est verifiable.
 *
 * Une seule etude pour l'instant, et la page l'assume : pas de grille a trois
 * colonnes avec deux trous dedans, pas de "bientot". Une liste qui grandit.
 */
export default function Studies() {
  const { locale } = useT()
  const c = (LANDING[locale] ?? LANDING.en).studies

  usePageMeta({ title: `${c.title} · Rich & Friends`, description: c.body })

  const df = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long',
  })

  return (
    <section className="mx-auto w-full max-w-5xl animate-rise px-6 pb-20 pt-10 md:pt-14">
      <div className="panel p-8 md:p-11">
        <p className="eyebrow">{c.eyebrow}</p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end">
          <h1 className="display max-w-[18ch] text-[clamp(2.25rem,5.5vw,3.25rem)]">{c.title}</h1>
          <p className="lede max-w-[46ch]">{c.body}</p>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {STUDIES.map((s) => {
          const w = s[locale] ?? s.en
          return (
            <article key={s.slug} className="panel flex flex-col p-7" data-study={s.slug}>
              <span className="h-1.5 w-12 rounded-pill bg-accent" aria-hidden="true" />
              <p className="mt-5 text-small text-muted">
                {df.format(new Date(`${s.date}T12:00:00`))}
                {` · ${w.readTime}`}
              </p>
              <h2 className="mt-2 text-h2 font-semibold text-ink">{w.title}</h2>
              <p className="lede mt-3 flex-1 text-small">{fill(w.dek, s.stats)}</p>
              <Link to={`/etudes/${s.slug}`} className="chip-accent press mt-6 self-start">
                {c.read}
              </Link>
            </article>
          )
        })}
      </div>

      {/* Ce que la section est, dit une fois. Une page qui publie des chiffres
          doit dire d'ou ils viennent avant qu'on les lise, pas apres. */}
      <p className="lede mt-10 max-w-[52ch] text-small">{c.note}</p>
    </section>
  )
}
