import { Link, useLocation } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { DOC_ORDER, LEGAL, OWNER } from '../legal/content'
import { useT } from '../lib/i18n'
import Wordmark from './Wordmark'

/**
 * The real footer. Four columns on desktop, stacked on a phone, sitting on a
 * full-bleed sheet of glass so the page ends on a surface rather than a line.
 *
 * It carries the things a footer is actually for — what the thing is, where to
 * go next, who owns it, and how to reach them. The ownership notice matters
 * here beyond convention: it is the visible half of the IP position the
 * licence and the legal pages set out.
 *
 * The wordmark sits on its own black badge, same as in the nav. That is not
 * decoration: the yellow colourway measures 1.4:1 on a white page, so black
 * under it is the only way it can appear in light mode at all.
 */
export default function Footer() {
  const { locale, setLocale } = useT()
  const { pathname } = useLocation()
  const c = (LANDING[locale] ?? LANDING.en).footer
  const docs = LEGAL[locale] ?? LEGAL.en

  // The footer also renders on the legal pages, where #how and #books are not
  // on the page — a bare fragment there would look broken. Prefix with the
  // home route unless we are already on it.
  const home = pathname === '/' ? '' : '/'

  return (
    <footer className="footer-glass mt-section">
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <span className="brand-badge">
              <Wordmark variant="yellow" width={132} />
            </span>
            <p className="mt-7 max-w-[30ch] font-title text-[1.0625rem] italic leading-relaxed text-muted">
              {c.tagline}
            </p>
          </div>

          <nav aria-label={c.product}>
            <h2 className="eyebrow">{c.product}</h2>
            <ul className="mt-5 space-y-3">
              <li>
                <a href={`${home}#how`} className="nav-link">
                  {c.links.how}
                </a>
              </li>
              <li>
                <a href={`${home}#books`} className="nav-link">
                  {c.links.library}
                </a>
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
            <ul className="mt-5 space-y-3">
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
            <p className="mt-5 text-body text-muted">
              {/* Kept as a placeholder deliberately — see src/legal/content.js */}
              contact@richandfriends.xyz
            </p>
            <div className="mt-6 flex gap-2">
              {[
                ['en', 'EN'],
                ['fr', 'FR'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  aria-pressed={locale === code}
                  className={locale === code ? 'chip-pink press' : 'chip-quiet press'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The four colours again, quietly, as the last rule on the page. */}
        <div className="mt-16 flex gap-1.5" aria-hidden="true">
          <span className="h-1 flex-[3] rounded-pill bg-pink" />
          <span className="h-1 flex-[2] rounded-pill bg-green" />
          <span className="h-1 flex-1 rounded-pill bg-yellow" />
          <span className="h-1 flex-1 rounded-pill bg-blue" />
        </div>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-small text-muted">
            © {new Date().getFullYear()} {OWNER}. {c.rights}
          </p>
          <p className="text-small text-muted">{c.built}</p>
        </div>
      </div>
    </footer>
  )
}
