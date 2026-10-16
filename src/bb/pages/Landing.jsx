import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Spot, Tape, cast } from '../../components/StickerKit'
import { headline, useLineEnd } from '../../components/Headline'
import { perMonth } from '../../lib/bb/plans'
import { BBLogo } from '../kit'
import PublicFrame from './PublicFrame'

/**
 * richandfriends.xyz/bb: the public page of Beauty & Brain.
 *
 * What it promises, in the order a student asks: what is it (the line and
 * the logo), how it works (three steps), why it works (the six techniques of
 * section 3, one sentence each), why trust it (your course, not the
 * internet: every fact points at its slide), the Beauty half, and the price.
 *
 * Decoration is the real sticker art and the tape (CLAUDE.md). Stickers hang
 * on the headline's words, the one place they may touch text; everywhere
 * else they sit in the margins of cards, over nothing that is read.
 */
const TITLE_ART = cast(['lips', 'cloudguy'])
const STEP_ART = cast(['thumb', 'fire', 'daisy'])
const CLOSE_ART = cast(['koi', 'unicorn'])

export default function Landing() {
  const { t, locale } = useT()
  const { user } = useAuth()
  usePageMeta({ title: `Beauty & Brain · ${t('bb.line')}`, description: t('bb.land.lede') })
  const title = useRef(null)
  const heading = t('bb.land.title')
  useLineEnd(title, heading)
  const start = user ? '/bb/app' : '/bb/connexion?next=/bb/start'

  const steps = [1, 2, 3].map((n) => ({ n, title: t(`bb.land.how_${n}_t`), body: t(`bb.land.how_${n}_b`) }))
  const science = [1, 2, 3, 4, 5, 6].map((n) => ({ n, title: t(`bb.land.sci_${n}_t`), body: t(`bb.land.sci_${n}_b`) }))

  return (
    <PublicFrame>
      <section data-hook="bb-hero" className="mx-auto w-full max-w-6xl px-6 pb-14 pt-10 md:pb-20 md:pt-14">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div className="stagger">
            <h1
              ref={title}
              style={{ '--i': 0 }}
              data-hook="bb-hero-title"
              className="relative mt-6 max-w-[12ch] text-[clamp(2.75rem,10vw,5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ink md:mt-10"
            >
              {headline(heading, t('bb.land.mark'), {
                /* Les levres au-dessus du P, sur la marge du haut, la
                   plus grande partie hors de l'encre. */
                first: <Spot name={TITLE_ART[0]} tilt={-12} delay={300} eager style={{ left: '-0.34em', top: '-1.02em', width: '1em' }} />,
                /* La tete dans les nuages APRES le point final, sur la meme
                   ligne: au-dessus, elle tombait sur "besoin". */
                last: <Spot name={TITLE_ART[1]} tilt={10} delay={520} eager style={{ left: 'calc(100% + 0.06em)', top: '0.42em', width: '0.86em' }} />,
              })}
            </h1>
            <p style={{ '--i': 1 }} className="mt-8 max-w-[46ch] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-[1.55] text-muted">
              {t('bb.land.lede')}
            </p>
            <div style={{ '--i': 2 }} className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={start} className="btn press w-auto bg-[#FF007A] px-8 text-[1.1875rem] font-bold text-white hover:opacity-90" data-hook="bb-cta">
                {user ? t('bb.pub.open') : t('bb.pub.start_free')}
              </Link>
              <Link to="/bb/tarifs" className="btn-outline press w-auto px-8">
                {t('bb.pub.see_pricing')}
              </Link>
            </div>
            <p style={{ '--i': 3 }} className="mt-5 text-small text-muted">
              {t('bb.land.note')}
            </p>
          </div>

          <div className="relative mx-auto mt-14 w-full max-w-[26rem] lg:mt-0" data-hook="bb-hero-logo">
            <div className="relative rotate-[-2deg]">
              <BBLogo layout="stacked" tile="pink" className="w-full drop-shadow-[0_18px_30px_rgb(255_0_122/0.25)]" pad={0.12} />
              <Tape className="-top-3 left-8" tilt={-8} />
              <Tape className="-bottom-3 right-10" tilt={6} tone="255 214 10" />
            </div>
            <Spot name="cat" tilt={-10} delay={700} className="absolute -bottom-10 -left-6 w-24 sm:-left-12 sm:w-28" />
            <Spot name="eyelips" tilt={12} delay={820} className="absolute -right-4 -top-10 w-20 sm:-right-8 sm:w-24" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14" data-hook="bb-how">
        <h2 className="text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">{t('bb.land.how_title')}</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.n} className="lg relative p-6 pt-8">
              <span aria-hidden="true" className="block text-[2.5rem] font-bold leading-none text-[#FF007A]">
                {s.n}
              </span>
              <h3 className="mt-3 text-[1.25rem] font-semibold leading-snug text-ink">{s.title}</h3>
              <p className="mt-2 text-body text-muted">{s.body}</p>
              <Spot name={STEP_ART[i]} tilt={[8, -9, 10][i]} delay={200 + i * 120} className="absolute -right-3 -top-6 w-14" />
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14" data-hook="bb-science">
        <h2 className="text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">{t('bb.land.science_title')}</h2>
        <p className="lede mt-3 max-w-[56ch]">{t('bb.land.science_lede')}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {science.map((s) => (
            <li key={s.n} className="lg p-5">
              <h3 className="text-body font-bold text-ink">
                <span className="marker" style={{ '--mk': s.n % 2 ? '#BDEBF3' : '#FFD0E6' }}>
                  {s.title}
                </span>
              </h3>
              <p className="mt-2 text-small text-muted">{s.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14" data-hook="bb-grounded">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">{t('bb.land.grounded_title')}</h2>
            <p className="mt-4 max-w-[52ch] text-body text-muted">{t('bb.land.grounded_body')}</p>
          </div>
          <figure className="lg p-6" aria-label={t('bb.land.grounded_title')}>
            <p className="text-small font-semibold text-muted">{t('bb.bank.from_prof')}</p>
            <blockquote className="mt-2 border-l-4 border-[#009DB9] pl-3 text-body text-ink">
              {locale === 'fr' ? '« L’osmose est le passage de l’eau à travers une membrane semi-perméable, du milieu le moins concentré vers le plus concentré. »' : '“Osmosis is the movement of water across a semi-permeable membrane, from the less concentrated side to the more concentrated one.”'}
            </blockquote>
            <span className="mt-4 inline-flex items-center gap-1 rounded-pill border border-[#009DB9]/50 bg-[#E6F6F9] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink">
              {t('bb.land.grounded_chip')}
            </span>
            <div className="mt-5 rounded-inner border-2 border-dashed border-ink/25 bg-[#FFF8D6] px-3 py-2">
              <p className="text-[0.8125rem] font-bold uppercase tracking-[0.02em] text-ink">{t('bb.ses.outside')}</p>
            </div>
          </figure>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14" data-hook="bb-beauty">
        <div className="relative rounded-card bg-[#FFE3F0] px-6 py-8 md:px-10 md:py-10">
          <h2 className="text-[clamp(1.75rem,3.2vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">{t('bb.land.beauty_title')}</h2>
          <p className="mt-3 max-w-[52ch] text-body text-ink">{t('bb.land.beauty_body')}</p>
          <Spot name="daisy" tilt={10} delay={300} className="absolute -right-3 -top-8 hidden w-20 sm:block md:-right-6 md:w-24" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14" data-hook="bb-price-teaser">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lg p-6">
            <p className="eyebrow">{t('bb.price.free')}</p>
            <p className="mt-2 text-h2 text-ink">{t('bb.price.free_price')}</p>
            <p className="mt-2 text-small text-muted">{t('bb.price.f_free_1')}</p>
          </div>
          <div className="lg p-6">
            <p className="eyebrow">{t('bb.price.plus_semester')}</p>
            <p className="mt-2 text-h2 text-ink">{t('bb.price.about_month', { amount: perMonth('plus_semester', locale) })}</p>
            <p className="mt-2 text-small text-muted">{t('bb.price.pick')}</p>
          </div>
        </div>
        <Link to="/bb/tarifs" className="btn-outline press mt-6 w-auto px-8">
          {t('bb.pub.see_pricing')}
        </Link>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10" data-hook="bb-close">
        <div className="relative overflow-visible rounded-card bg-[#FF007A] px-6 py-10 md:px-12 md:py-14">
          <h2 className="max-w-[18ch] text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1] text-white">{t('bb.land.close_title')}</h2>
          <p className="mt-4 max-w-[40ch] text-[1.1875rem] font-bold leading-[1.45] text-white">{t('bb.land.close_body')}</p>
          <Link to={start} className="btn press mt-8 w-auto bg-white px-8 text-[1.1875rem] font-bold text-[#FF007A] hover:opacity-90">
            {user ? t('bb.pub.open') : t('bb.pub.start_free')}
          </Link>
          <Spot name={CLOSE_ART[0]} tilt={-8} delay={300} className="absolute -bottom-8 right-6 hidden w-24 sm:block md:w-28" />
          <Spot name={CLOSE_ART[1]} tilt={9} delay={420} className="absolute -top-10 right-24 hidden w-20 md:block" />
        </div>
      </section>
    </PublicFrame>
  )
}
