import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { Mark } from '../../components/Wordmark'
import { BBLogo } from '../kit'

/**
 * The frame of the public Nerd pages (landing, pricing): its own
 * bar and its own footer, so /nerd never looks like a tab of Rich & Friends,
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
      <header className="sticky top-0 z-30 px-4 pt-4">
        <nav className="glass-strong mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-card px-3 py-2.5 sm:px-4">
          <Link to="/nerd" className="press flex min-w-0 items-center gap-2.5" aria-label={t('bb.nav.home')}>
            <BBLogo layout="line" className="h-10 w-auto shrink-0" pad={0.2} />
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link to="/nerd/tarifs" className="nav-link px-2 text-small font-semibold">
              {t('bb.pub.pricing')}
            </Link>
            <Link
              to={user ? '/nerd/app' : '/nerd/connexion'}
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <BBLogo layout="line" className="h-11 w-auto" pad={0.2} />
            <p className="text-small text-muted">{t('bb.line')}</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-small font-semibold text-ink">
            <li>
              <Link to="/" className="press inline-flex items-center gap-2" data-hook="bb-to-rf">
                <Mark size={24} />
                {t('bb.by')}
              </Link>
            </li>
            <li>
              <Link to="/legal/terms" className="underline decoration-ink/30 underline-offset-4">
                {locale === 'fr' ? 'Conditions' : 'Terms'}
              </Link>
            </li>
            <li>
              <Link to="/legal/privacy" className="underline decoration-ink/30 underline-offset-4">
                {locale === 'fr' ? 'Confidentialité' : 'Privacy'}
              </Link>
            </li>
            <li>
              <button type="button" className="underline decoration-ink/30 underline-offset-4" onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')} data-hook="bb-lang">
                {locale === 'fr' ? 'English' : 'Français'}
              </button>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  )
}
