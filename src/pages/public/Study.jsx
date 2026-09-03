import { Link, Navigate, useParams } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { studyBySlug } from '../../content/studies'
import { MONTHLY_XOF, formatXof } from '../../lib/peers'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { fill } from '../../lib/fill'

/**
 * Une etude, en entier, lisible sans compte.
 *
 * LE POINT PAR PERSONNE.
 *
 * L'echantillon fait 92, ce qui est assez petit pour montrer chaque personne
 * plutot que d'en dessiner la moyenne. Le meme jeu de points, eclaire trois
 * fois sur trois questions, met la conclusion sous les yeux : l'outil est la,
 * l'envie est la, l'epargne ne suit pas. Un camembert dirait la meme chose en
 * la rendant abstraite.
 *
 * Les points sont derives de MONTHLY_XOF, pas d'un nombre ecrit a la main, donc
 * la troisieme grille ne peut pas mentir sur la distribution qui alimente
 * l'application elle-meme.
 */
export default function Study() {
  const { slug } = useParams()
  const { locale } = useT()
  const study = studyBySlug(slug)

  /* Une adresse inventee ou une etude retiree renvoie a la liste, qui existe
     toujours, plutot qu'a une page blanche. */
  if (!study) return <Navigate to="/etudes" replace />

  const c = (LANDING[locale] ?? LANDING.en).studies
  const w = study[locale] ?? study.en
  /**
   * A study has figures. An article does not, and this page had assumed every
   * entry was the first one.
   *
   * The stat panels, the dot panels and the quote wall are all specific to the
   * savings survey: they read st.hasApp, st.n and study.quotes by name. A
   * second entry without a survey behind it crashed on the first of those.
   * They are guarded now, so an entry that is prose is rendered as prose.
   *
   * That is not a missing feature. An article about a subject nobody has
   * surveyed should not have a number panel at the top, and inventing one to
   * fill the layout is exactly what the note at the top of studies.js exists
   * to prevent.
   */
  const st = study.stats ?? null
  /* Les montants sont formates ici et pas dans studies.js, parce que formatXof
     pose une espace fine insecable et un suffixe XOF : ecrit dans la prose, ce
     serait un chiffre dans un bloc de langue, ce que l'en-tete de studies.js
     interdit. Tout ce qui est un montant passe par la meme fonction, donc les
     medianes par sexe et par tranche s'ecrivent comme celle de l'echantillon. */
  /* Empty when there are no figures. An article carries no {markers}, so the
     fill map has nothing to do and must not be built by reading fields off a
     null: guarding the two blocks below was not enough, because this runs
     before either of them and crashed on the first amount it formatted. */
  const v = st
    ? {
        ...st,
        medianSavers: formatXof(st.medianSavers),
        womenMedian: formatXof(st.womenMedian),
        menMedian: formatXof(st.menMedian),
        coreMedianSavers: formatXof(st.coreMedianSavers),
      }
    : {}

  usePageMeta({ title: `${w.title} · Rich & Friends`, description: fill(w.dek, v) })

  const df = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const savers = MONTHLY_XOF.filter((x) => x > 0).length

  return (
    <article className="mx-auto w-full max-w-3xl animate-rise px-6 pb-20 pt-10 md:pt-14">
      <Link to="/etudes" className="chip press">{c.back}</Link>

      <header className="mt-6">
        <p className="eyebrow">{w.eyebrow}</p>
        <h1 className="display mt-3 text-[clamp(2.25rem,6vw,3.5rem)]">{w.title}</h1>
        <p className="lede mt-5 max-w-[52ch]">{fill(w.dek, v)}</p>
        <p className="mt-6 border-t border-hairline pt-4 text-small text-muted">
          {df.format(new Date(`${study.date}T12:00:00`))}
          {` · ${w.readTime}`}
        </p>
        {/* Dit avant qu'on lise les citations, pas apres. */}
        {w.langNote && <p className="mt-3 text-small text-muted">{w.langNote}</p>}
      </header>

      {/* Les deux chiffres qui ne devraient pas cohabiter. C'est toute
          l'etude ; le reste l'explique. */}
      {st && (
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="panel p-7" data-hook="study-stat">
          <p className="font-display text-[clamp(2.5rem,9vw,3.5rem)] leading-none text-ink [font-variant-numeric:tabular-nums]">
            {st.hasApp} %
          </p>
          <p className="lede mt-3 text-small">{c.stat_app}</p>
        </div>
        <div className="panel p-7" data-hook="study-stat">
          <p className="font-display text-[clamp(2.5rem,9vw,3.5rem)] leading-none text-accent [font-variant-numeric:tabular-nums]">
            {st.savesNothing} %
          </p>
          <p className="lede mt-3 text-small">{c.stat_zero}</p>
        </div>
      </div>
      )}

      {/* Un point par personne, trois fois. */}
      {st && (
      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-ink">{c.dots_title}</h2>
        <p className="lede mt-2 max-w-[52ch] text-small">{c.dots_note}</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <DotPanel label={c.dots_app} on={Math.round((st.hasApp / 100) * st.n)} n={st.n} />
          <DotPanel label={c.dots_goal} on={Math.round((st.hasAmbition / 100) * st.n)} n={st.n} />
          <DotPanel label={c.dots_save} on={savers} n={st.n} warn />
        </div>
      </section>
      )}

      {w.sections.map((sec) => (
        <section key={sec.h} className="mt-12">
          <h2 className="text-h2 font-semibold text-ink">{sec.h}</h2>
          {sec.p.map((para) => (
            <p key={para.slice(0, 24)} className="lede mt-4 max-w-[62ch]">{fill(para, v)}</p>
          ))}
        </section>
      ))}

      {/* Ce que les gens ont ecrit, a cote de ce qu'ils mettent de cote. */}
      {study.quotes?.length > 0 && (
      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-ink">{w.quotesTitle}</h2>
        <p className="lede mt-2 max-w-[52ch] text-small">{w.quotesNote}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {study.quotes.map((q) => (
            <li key={q.fr} className="panel flex flex-col gap-4 p-6" data-hook="study-quote">
              <blockquote className="text-body italic leading-relaxed text-ink">
                {`« ${q.fr} »`}
              </blockquote>
              <p className="flex flex-wrap items-center gap-2 text-label text-muted">
                <span>{fill(w.yearsOld, { n: q.age })}</span>
                {/* La couleur n'est jamais le seul signal : l'etiquette dit le
                    montant, ou le mot, dans les deux cas. */}
                <span
                  className={
                    q.saves === 0
                      ? 'rounded-pill bg-accent/15 px-2 py-0.5 font-semibold text-ink'
                      : 'rounded-pill bg-ink/[0.07] px-2 py-0.5 font-semibold text-ink'
                  }
                >
                  {q.saves === 0
                    ? w.savesNothingChip
                    : `${formatXof(q.saves)} ${w.perMonth}`}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* "Method" on a survey and "sources" on an article are the same block
          doing the same job: where this came from. The heading comes from the
          entry, so neither has to pretend to be the other. */}
      <section className="mt-12">
        <h2 className="text-h2 font-semibold text-ink">{w.methodTitle}</h2>
        {w.method.map((m) => (
          <p key={m.slice(0, 24)} className="lede mt-4 max-w-[62ch] text-small">{fill(m, v)}</p>
        ))}
      </section>

      <div className="mt-12 border-t border-hairline pt-8">
        <p className="lede max-w-[46ch]">{c.cta_line}</p>
        <Link to="/signin" className="btn-primary press mt-5 w-auto px-8">{c.cta}</Link>
      </div>
    </article>
  )
}

/**
 * Une grille de n points dont `on` sont allumes.
 *
 * `warn` colore les eteints en accent plutot qu'en gris : sur la troisieme
 * grille les points eteints sont les gens qui n'epargnent rien, et ce sont eux
 * le sujet. Sur les deux premieres ils ne sont que le complement.
 */
function DotPanel({ label, on, n, warn = false }) {
  return (
    <div className="panel p-5">
      <p className="eyebrow">{label}</p>
      <div
        className="mt-3 grid grid-cols-12 gap-1"
        role="img"
        aria-label={`${on} / ${n}`}
      >
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-full ${
              i < on ? 'bg-ink' : warn ? 'bg-accent' : 'bg-ink/15'
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-small text-muted [font-variant-numeric:tabular-nums]">
        {`${on} / ${n}`}
      </p>
    </div>
  )
}
