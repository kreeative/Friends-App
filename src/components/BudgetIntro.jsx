import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../lib/i18n'
import { Spot, Tape } from './StickerKit'

/**
 * L'INTRO DU BUDGET, EN STORIES.
 *
 *   "The budget section should be actually funny and responsive. I think
 *    it's very weird, and we could make it 1,000 times better."
 *
 * C'etaient six ecrans de texte noir sur le fond rose pale, un titre et une
 * phrase chacun, sans une image: on lisait six fois la meme page. Les six
 * idees restent (l'etat d'esprit, le plan, le suivi, le chiffre, l'habitude,
 * la liberte), chacune sur son propre ecran de couleur avec un vrai sticker,
 * un mot au surligneur et la phrase sur une note scotchee.
 *
 * COMME UNE STORY. On touche la droite de l'ecran pour avancer, la gauche
 * pour revenir, on glisse, ou on appuie sur le bouton: les quatre font la
 * meme chose. Les barres du haut disent ou on en est et ramenent a un ecran.
 * Au clavier, les fleches et Echap.
 *
 * LES COULEURS SUIVENT LES REGLES DE CLAUDE.md.
 *
 *   rose #FF007A, turquoise #009DB9   titre en blanc et en tres grand (le
 *                                     blanc y fait 3,80:1 et 3,22:1, donc du
 *                                     grand texte seulement); la phrase est
 *                                     sur une note blanche, en encre
 *   jaune, rose pale                  titre en encre
 *
 * Jamais de noir sur le rose ni sur le turquoise. Le mot surligne passe a
 * l'encre sur sa bande jaune (blanche sur le jaune, ou le jaune ne se verrait
 * pas).
 *
 * APRES LA DERNIERE, LES COURS. Le bouton de la fin ne mene plus au
 * formulaire du plan: "After the introduction, the first thing you should see
 * is: Never done a budget before? Take these courses." Voir BudgetStart.
 */
const SLIDES = [
  { key: 'mindset', ground: 'pink', art: 'eyelips', tilt: -8 },
  { key: 'plan', ground: 'yellow', art: 'wallet', tilt: 7 },
  { key: 'track', ground: 'sea', art: 'pizza', tilt: -6 },
  { key: 'amplify', ground: 'blush', art: 'chaching', tilt: 5 },
  { key: 'habits', ground: 'pink', art: 'thumb', tilt: -5 },
  { key: 'freedom', ground: 'sea', art: 'unicorn', tilt: 6 },
]

/* Le fond, et ce qui se pose dessus. `dark` veut dire "le texte est blanc". */
const GROUNDS = {
  pink: { bg: '#FF007A', dark: true, tape: '0 157 185' },
  sea: { bg: '#009DB9', dark: true, tape: '255 0 122' },
  yellow: { bg: '#FFD60A', dark: false, tape: '255 0 122', mark: '#FFFFFF' },
  blush: { bg: 'rgb(var(--c-bg))', dark: false, tape: '0 157 185' },
}

/** Le titre, avec son mot au surligneur. Le mot absent du titre: pas de surligneur. */
function marked(title, mark) {
  const at = mark ? title.indexOf(mark) : -1
  if (at < 0) return title
  return (
    <>
      {title.slice(0, at)}
      <span className="marker text-ink">{mark}</span>
      {title.slice(at + mark.length)}
    </>
  )
}

export default function BudgetIntro({ onDone, onSkip }) {
  const { t } = useT()
  const trackRef = useRef(null)
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1
  const g = GROUNDS[SLIDES[i].ground]

  // The scroller is the source of truth. Reading it on scroll keeps the bars
  // honest during a flick, which a click-driven index cannot do.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth || 1
        setI(Math.max(0, Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / w))))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  const go = useCallback((n) => {
    const el = trackRef.current
    if (!el) return
    const to = Math.max(0, Math.min(SLIDES.length - 1, n))
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: to * el.clientWidth, behavior: still ? 'auto' : 'smooth' })
  }, [])

  /* Les fleches et Echap, tant que l'intro est ouverte. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(i + 1)
      else if (e.key === 'ArrowLeft') go(i - 1)
      else if (e.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go, onSkip])

  /* Toucher la gauche recule, toucher ailleurs avance. Sur la derniere, le
     toucher n'emmene nulle part: finir est un choix, c'est le bouton. */
  const tap = (n) => (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX - r.left < r.width * 0.3) go(n - 1)
    else if (n < SLIDES.length - 1) go(n + 1)
  }

  const ink = g.dark ? 'text-white' : 'text-ink'

  /**
   * Portalled to the body, and this is not optional.
   *
   * position:fixed resolves against the nearest ancestor with a transform,
   * filter or backdrop-filter, not against the viewport. The app shell is full
   * of both (the glass chrome uses backdrop-filter, the page wrapper animates
   * in with a transform), so a fixed inset-0 rendered in place inherited a
   * zero-height containing block and the whole carousel measured 0px tall with
   * the text present but unrenderable. Out at the body there is nothing above
   * it to capture the fixed positioning.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[100] h-dvh w-full overflow-hidden"
      style={{ background: g.bg }}
      role="dialog"
      aria-modal="true"
      aria-label={t('intro.label')}
      data-hook="budget-intro"
      data-step={i + 1}
    >
      <div
        ref={trackRef}
        /* min-h-0 n'est plus necessaire: le defileur remplit l'ecran en
           absolu, les deux barres se posent par-dessus. C'est ce qui laisse la
           couleur de chaque ecran passer sous elles pendant qu'on glisse. */
        className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {SLIDES.map((s, n) => {
          const sg = GROUNDS[s.ground]
          return (
            <section
              key={s.key}
              onClick={tap(n)}
              className="flex h-full w-full shrink-0 snap-center flex-col justify-center px-7 pb-36 pt-24 sm:px-10"
              style={{ background: sg.bg }}
              aria-label={t('intro.step', { n: n + 1, total: SLIDES.length })}
              aria-hidden={n === i ? undefined : 'true'}
              data-ground={s.ground}
            >
              <div className="mx-auto w-full max-w-[34rem]">
                {/* Recolle a chaque arrivee sur l'ecran: la cle change, le
                    sticker est remonte, son animation repart. */}
                <Spot
                  key={`${s.art}-${n === i}`}
                  name={s.art}
                  tilt={s.tilt}
                  delay={80}
                  eager
                  className="mb-6 block w-28 sm:w-36"
                />
                <h2
                  className={`text-[clamp(2.6rem,12vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.03em] ${
                    sg.dark ? 'text-white' : 'text-ink'
                  }`}
                  style={sg.mark ? { '--mk': sg.mark } : undefined}
                >
                  {marked(t(`intro.${s.key}_title`), t(`intro.${s.key}_mark`))}
                </h2>
                <div className="relative mt-8 max-w-[30rem] rotate-[-1deg] rounded-card bg-white p-5 shadow-[0_14px_30px_-12px_rgb(0_0_0/0.35)] sm:p-6">
                  <Tape className="-top-3 left-8" tilt={-6} tone={sg.tape} />
                  <p className="text-body text-ink">{t(`intro.${s.key}_body`)}</p>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {/* En haut: ou on en est, et la sortie. Par-dessus le defileur. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[40rem] items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {SLIDES.map((s, n) => (
              <button
                key={s.key}
                onClick={() => go(n)}
                aria-label={t('intro.step', { n: n + 1, total: SLIDES.length })}
                aria-current={n === i ? 'step' : undefined}
                className="flex-1 py-2"
              >
                {/* The track is the ground darkened, not lightened: white
                    against it is the difference that says how far you are,
                    and white over white at 40% was under 3:1. */}
                <span
                  className={`block h-1.5 rounded-pill transition-colors duration-300 ${
                    n <= i ? (g.dark ? 'bg-white' : 'bg-ink') : g.dark ? 'bg-black/25' : 'bg-ink/15'
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            onClick={onSkip}
            data-hook="intro-skip"
            className="press shrink-0 rounded-pill bg-white px-4 py-2 text-small font-semibold text-ink shadow-[0_4px_12px_-4px_rgb(0_0_0/0.25)]"
          >
            {t('intro.skip')}
          </button>
        </div>
      </div>

      {/* En bas: le bouton. Blanc sur le rose et le turquoise, rose ailleurs. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-7 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[34rem] items-center gap-3">
          {i > 0 && (
            <button
              onClick={() => go(i - 1)}
              aria-label={t('intro.back')}
              /* Solid white on the pink and the turquoise. A white chevron on
                 white at 20% over #009DB9 measured under the 3:1 a control
                 needs. */
              className={`press grid h-14 w-14 shrink-0 place-items-center rounded-pill ${
                g.dark ? 'bg-white text-ink' : 'bg-ink/[0.07] text-ink'
              }`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}
          <button
            data-hook="intro-next"
            className={`btn press flex-1 text-[1.1875rem] font-bold ${
              g.dark ? 'bg-white text-ink' : 'bg-accent text-on-accent'
            }`}
            onClick={() => (last ? onDone() : go(i + 1))}
          >
            {last ? t('intro.start') : t('intro.next')}
          </button>
        </div>
      </div>
      <span className={`sr-only ${ink}`} aria-live="polite">
        {t('intro.step', { n: i + 1, total: SLIDES.length })}
      </span>
    </div>,
    document.body,
  )
}
