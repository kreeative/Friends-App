import { Link, Navigate, useParams } from 'react-router-dom'
import { DOC_ORDER, LAST_UPDATED, LEGAL, APP_NAME } from '../legal/content'
import { useT } from '../lib/i18n'
import Footer from '../components/Footer'

/**
 * Public on purpose. Someone has to be able to read the terms before they
 * agree to them, so these routes sit outside the auth gate.
 */
export default function Legal() {
  const { slug } = useParams()
  const { locale, setLocale, t } = useT()

  const docs = LEGAL[locale] ?? LEGAL.en
  const doc = docs[slug]

  if (!doc) return <Navigate to="/legal/terms" replace />

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto w-full max-w-content px-6 pb-24 pt-14">
        <header className="animate-rise">
          <Link to="/" className="text-small text-muted transition-colors hover:text-ink">
            ← {APP_NAME}
          </Link>

          <h1 className="mt-8 text-h1 text-ink">{doc.title}</h1>
          <p className="lede mt-3">{doc.intro}</p>

          <p className="mt-4 text-small text-muted">
            {locale === 'fr' ? 'Dernière mise à jour' : 'Last updated'} · {LAST_UPDATED}
          </p>
        </header>

        <nav className="mt-8 flex flex-wrap gap-2" aria-label={doc.title}>
          {DOC_ORDER.map((s) => (
            <Link
              key={s}
              to={`/legal/${s}`}
              className={s === slug ? 'chip-accent' : 'chip-quiet'}
              aria-current={s === slug ? 'page' : undefined}
            >
              {docs[s].title}
            </Link>
          ))}
          <button onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')} className="chip-quiet">
            {locale === 'fr' ? 'English' : 'Français'}
          </button>
        </nav>

        <article className="mt-section space-y-10">
          {doc.sections.map((section) => (
            <section key={section.h} className="space-y-3">
              <h2 className="text-h2 text-ink">{section.h}</h2>
              {section.p.map((para, i) => (
                <p key={i} className="text-body text-muted">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </article>
      </div>
      <Footer />
    </div>
  )
}

/** Small print for the bottom of the sign-in screen. */
export function LegalLinks() {
  const { locale } = useT()
  const docs = LEGAL[locale] ?? LEGAL.en

  return (
    <p className="text-center text-small text-muted">
      {DOC_ORDER.map((s, i) => (
        <span key={s}>
          {i > 0 && <span className="px-2 text-muted/50">·</span>}
          <Link to={`/legal/${s}`} className="underline underline-offset-4 hover:text-ink">
            {docs[s].title}
          </Link>
        </span>
      ))}
    </p>
  )
}
