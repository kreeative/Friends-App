import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { Mark } from '../../components/Wordmark'
import { BBLogo, PILL } from '../kit'

/**
 * The frame of the public Hakkilo pages (landing, pricing): its own
 * bar and its own footer, so /hakkilo never looks like a tab of Rich & Friends,
 * and a line in the footer that says who made it, with the way to the
 * other product.
 *
 * The bar's button is ink on glass, not white on pink: at the size a nav
 * button is set, white on the pink would be small text at 3.80:1.
 */
export default function PublicFrame({ children }) {
  const { t, locale, setLocale } = useT()
  const { user } = useAuth()
  return (
    <div className="ground relative min-h-dvh overflow-x-clip" data-hook="bb-public">
      {/* A solid bar on its own ground, out to the screen's edge, as in the
          app (BBShell): glass over this flat page was a window, and on an
          iPhone "Retour aux tarifs" showed half under the bar once the
          checkout had scrolled a little. */}
      <header
        className="sticky top-0 z-30 bg-bg px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[50vh] before:bg-bg"
        data-hook="bb-public-bar"
      >
        <nav className="glass-strong mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-card px-3 py-2.5 sm:px-4">
          <Link to="/hakkilo" className="press flex min-w-0 items-center gap-2.5" aria-label={t('bb.nav.home')}>
            <BBLogo layout="line" className="h-10 w-auto shrink-0" pad={0.2} />
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link to="/hakkilo/tarifs" className="nav-link px-2 text-small font-semibold">
              {t('bb.pub.pricing')}
            </Link>
            <Link
              to={user ? '/hakkilo/app' : '/hakkilo/connexion'}
              className="btn-ghost press w-auto min-h-[2.75rem] px-4 py-2 text-small font-semibold"
              data-hook="bb-nav-signin"
            >
              {user ? t('bb.pub.open') : t('bb.pub.signin')}
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-hairline bg-surface/60 px-6 py-10">
        {/* Side by side from lg only, the row of pills on one line: as
            pills it is wider than the underlined words were, and at 820 and
            1440 it broke with "English" alone on a second line. */}
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BBLogo layout="line" className="h-11 w-auto shrink-0" pad={0.2} />
            <div>
              <p className="text-small text-ink">{t('bb.line')}</p>
              <p className="text-small text-muted">{t('bb.meaning')}</p>
            </div>
          </div>
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small font-semibold text-ink lg:shrink-0 lg:flex-nowrap">
            <li>
              <Link to="/" className="press flex items-center gap-2" data-hook="bb-to-rf">
                <Mark size={24} />
                {t('bb.by')}
              </Link>
            </li>
            <li>
              <Link to="/legal/terms" className={PILL}>
                {locale === 'fr' ? 'Conditions' : 'Terms'}
              </Link>
            </li>
            <li>
              <Link to="/legal/privacy" className={PILL}>
                {locale === 'fr' ? 'Confidentialité' : 'Privacy'}
              </Link>
            </li>
            <li>
              <button type="button" className={PILL} onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')} data-hook="bb-lang">
                {locale === 'fr' ? 'English' : 'Français'}
              </button>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  )
}
