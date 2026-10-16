import { useT } from '../lib/i18n'
import { BBLogo } from './kit'

/**
 * Small pieces the router and the pages share, kept apart from BBApp.jsx so
 * a page importing them does not import the router that imports the page.
 *
 * RETURN_KEY: the OAuth return lands on the site root (redirectTo is the
 * origin, the one address the provider is sure to accept), so the sign-in
 * page remembers where to come back to, and BBReturn in App.jsx goes there.
 */
export const RETURN_KEY = 'bb.return'

export function rememberReturn(path) {
  try {
    localStorage.setItem(RETURN_KEY, path && path.startsWith('/bb') ? path : '/bb/app')
  } catch {
    /* private mode: the student lands on the R&F home and taps back to /bb */
  }
}

/** The waiting screen: the logo on its own pink, like the R&F splash. */
export function Splash() {
  const { t } = useT()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FF007A]" data-hook="bb-splash">
      <BBLogo layout="stacked" tile="pink" className="w-[min(52vw,260px)]" pad={0.04} />
      <p className="sr-only" role="status">
        {t('bb.loading')}
      </p>
    </main>
  )
}
