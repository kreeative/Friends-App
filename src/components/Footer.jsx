import { Link } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { DOC_ORDER, LEGAL, OWNER } from '../legal/content'
import { useT } from '../lib/i18n'
import Wordmark from './Wordmark'
import ThemePicker from './ThemePicker'

/**
 * The real footer. Four columns on desktop, stacked on a phone, sitting on a
 * full-bleed sheet of glass so the page ends on a surface rather than a line.
 *
 * It carries the things a footer is actually for. What the thing is, where
 * to go next, who owns it, and how to reach them. The ownership notice
 * matters here beyond convention: it is the visible half of the IP position
 * the licence and the legal pages set out.
 *
 * The theme picker lives here rather than taking a section of its own on the
 * home page. It is a preference, and preferences belong where preferences go.
 */
export default function Footer() {
  const { locale, setLocale } = useT()
  const c = (LANDING[locale] ?? LANDING.en).footer
  const docs = LEGAL[locale] ?? LEGAL.en

  return (
    <footer className="footer-glass mt-section">
      <div className="mx-auto w-full max-w-5xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label={c.home}>
              <Wordmark size={104} />
            </Link>
            <p className="lede mt-6 max-w-[30ch]">{c.tagline}</p>
          </div>

          <nav aria-label={c.product}>
            <h2 className="eyebrow">{c.product}</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to="/how-it-works" className="nav-link">
                  {c.links.how}
                </Link>
              </li>
              <li>
                <Link to="/books" className="nav-link">
                  {c.links.library}
                </Link>
              </li>
              <li>
                <Link to="/etudes" className="nav-link">
                  {c.links.studies}
                </Link>
              </li>
              <li>
                <Link to="/aide" className="nav-link">
                  {c.links.faq}
                </Link>
              </li>
              <li>
                <Link to="/signin" className="nav-link">
                  {c.links.signin}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={c.legalHeading}>
            <h2 className="eyebrow">{c.legalHeading}</h2>
            <ul className="mt-4 space-y-2.5">
              {DOC_ORDER.map((s) => (
                <li key={s}>
                  <Link to={`/legal/${s}`} className="nav-link">
                    {docs[s].title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">{c.contact}</h2>
            <p className="mt-4 text-body text-muted">
              {/* Kept as a placeholder deliberately. See src/legal/content.js */}
              contact@richandfriends.xyz
            </p>
            <div className="mt-5 flex gap-2">
              {[
                ['en', 'EN'],
                ['fr', 'FR'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  aria-pressed={locale === code}
                  className={locale === code ? 'chip-accent press' : 'chip-quiet press'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-hairline pt-10">
          <ThemePicker />
        </div>

        <div className="mt-12 h-1 w-full rounded-pill bg-accent/80" aria-hidden="true" />

        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-small text-muted">
            © {new Date().getFullYear()} {OWNER}. {c.rights}
          </p>
          <p className="text-small text-muted">{c.built}</p>
        </div>
      </div>
    </footer>
  )
}
