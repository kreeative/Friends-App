import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Spot, Tape, cast } from '../../components/StickerKit'
import { BBLogo } from '../kit'
import PublicFrame from './PublicFrame'

/**
 * richandfriends.xyz/hakkilo/go: the page behind the link in a TikTok or
 * Instagram bio (section 12, phase 3).
 *
 * Someone arriving from a video gives a page about three seconds, on a
 * phone, often inside the app's own browser. So: the promise in one line,
 * the button above the fold at 390 px, three reasons, one picture of what a
 * question looks like (with the chip that says which slide it comes from,
 * the whole point), and the button again. No pricing table, no science
 * section: the main landing page has those, one tap away.
 *
 * ?from=tiktok or ?from=instagram only changes the greeting. Sign-in inside
 * those apps' browsers is handled by the sign-in page (AuthForm), which
 * says how to open the real browser when Google refuses a webview.
 *
 * Stickers sit beside the logo tile and in the margins of the cards, over
 * nothing that is read (CLAUDE.md).
 */
const ART = cast(['fire', 'thumb', 'daisy'])

export default function Go() {
  const { t } = useT()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const from = ['tiktok', 'instagram'].includes(params.get('from')) ? params.get('from') : null
  usePageMeta({ title: `Hakkilo · ${t('bb.go.title')}`, description: t('bb.go.lede') })
  const start = user ? '/hakkilo/app' : '/hakkilo/connexion?next=/hakkilo/start'
  const reasons = [1, 2, 3].map((n) => ({ n, title: t(`bb.go.r${n}_t`), body: t(`bb.go.r${n}_b`) }))

  return (
    <PublicFrame>
      <section className="mx-auto w-full max-w-5xl px-6 pb-10 pt-8 md:pb-16 md:pt-14" data-hook="bb-go-hero">
        <div className="md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-10">
          <div>
            <p className="eyebrow">{from ? t(`bb.go.hi_${from}`) : t('bb.go.hi')}</p>
            <h1 className="mt-3 max-w-[14ch] text-[clamp(2.375rem,9vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ink" data-hook="bb-go-title">
              {t('bb.go.title')}
            </h1>
            <p className="mt-5 max-w-[42ch] text-[1.0625rem] leading-[1.55] text-ink">{t('bb.go.lede')}</p>
            <Link to={start} className="btn press mt-7 bg-ink font-bold text-white hover:opacity-90 sm:w-auto sm:px-10" data-hook="bb-go-cta">
              {user ? t('bb.pub.open') : t('bb.pub.start_free')}
            </Link>
            <p className="mt-3 text-small text-ink">{t('bb.go.free')}</p>
          </div>
          <div className="relative mx-auto mt-12 w-full max-w-[18rem] md:mt-0 md:max-w-[22rem]" data-hook="bb-go-logo">
            <div className="relative rotate-[2deg]">
              <BBLogo layout="stacked" className="w-full drop-shadow-[0_18px_30px_rgb(17_17_17/0.18)]" pad={0.12} />
              <Tape className="-top-3 right-8" tilt={7} tone="255 214 10" />
            </div>
            <Spot name="lips" tilt={-12} delay={300} eager className="absolute -bottom-8 -left-8 w-20 sm:w-24" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-8" data-hook="bb-go-reasons">
        <ol className="grid gap-5 md:grid-cols-3">
          {reasons.map((r, i) => (
            <li key={r.n} className="lg relative p-6 pt-7">
              <span aria-hidden="true" className="block text-[2rem] font-bold leading-none text-ink">
                {r.n}
              </span>
              <h2 className="mt-2 text-[1.1875rem] font-bold leading-snug text-ink">{r.title}</h2>
              <p className="mt-1.5 text-body text-ink">{r.body}</p>
              <Spot name={ART[i]} tilt={[8, -9, 10][i]} delay={200 + i * 120} className="absolute -right-3 -top-6 w-14" />
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-8" data-hook="bb-go-demo">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{t('bb.go.demo_title')}</h2>
            <p className="mt-3 max-w-[46ch] text-body text-ink">{t('bb.go.demo_body')}</p>
          </div>
          <figure className="lg p-5" aria-label={t('bb.go.demo_title')}>
            <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.02em] text-muted">{t('bb.go.demo_kicker')}</p>
            <p className="mt-2 text-body text-ink">{t('bb.go.demo_stem')}</p>
            <ul className="mt-3 space-y-1.5">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className={`flex items-start gap-2.5 rounded-inner border-2 px-3 py-2 text-small text-ink ${n === 2 ? 'border-[#1E7B34] bg-[#E4F5D9]' : 'border-ink/15 bg-surface'}`}>
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-ink/[0.07] text-[0.75rem] font-bold">
                    {String.fromCharCode(64 + n)}
                  </span>
                  <span className="min-w-0 flex-1">
                    {t(`bb.go.demo_o${n}`)}
                    {n === 2 && <span className="ml-1.5 font-bold">✓ {t('bb.ses.right')}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <span className="mt-3 inline-flex items-center gap-1 rounded-pill border border-ink/30 bg-surface px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink">{t('bb.go.demo_chip')}</span>
          </figure>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20 pt-8" data-hook="bb-go-close">
        <div className="relative rounded-card bg-[#CFC2FF] px-6 py-9 md:px-12 md:py-12">
          <h2 className="max-w-[20ch] text-[clamp(1.625rem,4vw,2.5rem)] font-bold leading-[1.12] text-ink">{t('bb.go.close')}</h2>
          <Link to={start} className="btn press mt-7 bg-ink font-bold text-white hover:opacity-90 sm:w-auto sm:px-10" data-hook="bb-go-cta-2">
            {user ? t('bb.pub.open') : t('bb.pub.start_free')}
          </Link>
          <p className="mt-4 text-body font-bold text-ink">
            <Link to="/hakkilo" className="underline underline-offset-4">
              {t('bb.go.more')}
            </Link>
          </p>
        </div>
      </section>
    </PublicFrame>
  )
}
