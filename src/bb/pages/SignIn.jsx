import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { AuthForm } from '../../pages/SignIn'
import { Spot, Tape } from '../../components/StickerKit'
import { BBLogo } from '../kit'
import { rememberReturn, Splash } from '../boot'

/**
 * /nerd/connexion: the Rich & Friends sign-in form, under the Beauty & Brain
 * logo. One account for both products (section 1.1), so it is literally the
 * same form (AuthForm in src/pages/SignIn.jsx): Google, or a code by email,
 * with the email first inside TikTok and Instagram, where Google refuses its
 * own sign-in.
 *
 * Before leaving for Google the way back is remembered (`?next`, else the
 * app), because the provider returns to the site root.
 */
export default function SignInPage() {
  const { t } = useT()
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/nerd') ? params.get('next') : '/nerd/app'
  usePageMeta({ title: `${t('bb.signin.title')} · Nerd`, description: t('bb.signin.body') })

  if (loading) return <Splash />
  if (user) return <Navigate to={next} replace />

  return (
    <div className="ground relative min-h-dvh overflow-hidden" data-hook="bb-signin">
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-content flex-col justify-center px-6 pb-16 pt-14 sm:max-w-[28rem]">
        <div className="relative">
          <div className="sm:lg sm:lg-frost sm:p-8">
            <BBLogo layout="stacked" className="w-44" pad={0.1} />
            <h1 className="mt-8 text-[clamp(2.25rem,10vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">{t('bb.signin.title')}</h1>
            <p className="lede mt-3 max-w-[34ch]">{t('bb.signin.body')}</p>
            <div className="animate-rise mt-8 space-y-3">
              <AuthForm beforeGoogle={() => rememberReturn(next)} />
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none hidden sm:block">
            <Tape className="-top-3 left-10" tilt={-7} tone="255 214 10" />
            <Spot name="lips" tilt={-12} delay={500} className="absolute -bottom-12 -left-12 w-24" />
            <Spot name="cloudguy" tilt={10} delay={620} className="absolute -right-12 top-[30%] w-20" />
          </div>
        </div>
      </main>
    </div>
  )
}
