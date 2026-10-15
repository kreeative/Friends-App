import { useRef } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { CHALLENGE_DAYS, CHALLENGE_ID, challengeCopy } from '../../content/challenge'
import { cleanCode, invitePath, rememberChallenge } from '../../lib/pendingJoin'
import { LockupInline } from '../../components/Wordmark'
import { Sparkle, Spot, Tape, cast } from '../../components/StickerKit'
import { headline, useLineEnd } from '../../components/Headline'

/**
 * LA PAGE DU DEFI 21 MATINS, CELLE DU LIEN DE LA VIDEO.
 *
 *   "hey guys, am I the only one who love having everything planned but
 *    sometimes lack of discipline? Well, I create this app. Let's take a 21
 *    days challenge of Miracle Morning. Here's how you can join the group."
 *
 * /defi (ou /challenge): ce que le defi demande chaque matin, comment ca
 * marche, et "Lancer mon defi", qui ouvre le formulaire de creation deja
 * regle sur le defi (apres la connexion, pour qui n'en a pas).
 *
 * Un lien AVEC un code (/defi?join=CODE, l'ancien format) n'est pas pour
 * cette page: c'est une invitation, et il part vers /join/CODE, la page qui
 * nomme le groupe (src/pages/Invite.jsx).
 *
 * `bare`: la page sans le cadre public (barre et pied de page), pour une
 * personne connectee, dont les liens du cadre menent a des pages qui
 * n'existent pas de son cote.
 *
 * Les regles de pose sont celles de l'accueil (CLAUDE.md): de vrais stickers
 * et rien de dessine en code pour s'y faire passer; sur le titre, accroches
 * aux mots avec le meme plafond d'encre; ailleurs, sur aucun mot.
 */
/* Sur le titre: la marguerite, un soleil du matin, sur le premier mot; le
   nuage qui baille au bout de la premiere ligne; FIRE au bout de la phrase. */
const TITLE_ART = cast(['daisy', 'cloudguy', 'fire'])
/* Colles aux coins de l'apercu: la carpe koi pour le silence, celui qui
   s'entraine pour le sport. */
const CARD_ART = cast(['koi', 'baller'])
/* Devant chaque etape, dans sa propre colonne. */
const STEP_ART = cast(['thumb', 'leaf', 'unicorn'])

/* Les fonds pastel des cartes d'objectifs, a l'encre (plus de 15:1). Ecrits
   en entier: Tailwind lit le texte source. */
const GROUNDS = ['bg-[#FFE0EF]', 'bg-[#E0F3F7]', 'bg-[#FFF7CE]']
const TILTS = [-1.5, 1.2, -0.8, 1.6]

function browserStore() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function Challenge({ bare = false }) {
  const { locale, t } = useT()
  const copy = challengeCopy(locale)
  const c = copy.page
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const code = cleanCode(params.get('join'))

  usePageMeta({ title: `${c.eyebrow} · Rich & Friends`, description: c.body })

  const title = useRef(null)
  useLineEnd(title, c.title)

  /**
   * UN LIEN AVEC UN CODE EST UNE INVITATION, PAS UNE PRESENTATION.
   *
   * /defi?join=CODE ouvrait cette page: le style de l'accueil, un titre
   * general, et "Rejoindre le defi" meme pour quelqu'un qui en faisait deja
   * partie. "It doesn't send you to a page saying, hey, join this group."
   * Le code va maintenant a la page d'invitation (src/pages/Invite.jsx), qui
   * nomme le groupe. Ici ne reste que le defi lui-meme, et "Lancer mon defi".
   */
  if (code) return <Navigate to={invitePath(code)} replace />

  function go() {
    if (!user) {
      rememberChallenge(CHALLENGE_ID, browserStore())
      navigate('/signin')
      return
    }
    navigate(`/start?challenge=${CHALLENGE_ID}`)
  }

  const cta = c.start
  const note = c.note_start

  const button = (where) => (
    <button
      type="button"
      onClick={go}
      data-hook={`challenge-${where}`}
      className="btn-primary press w-auto px-9 text-[1.1875rem] font-bold"
    >
      {cta}
    </button>
  )

  const page = (
    <div data-hook="challenge">
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:pb-20 md:pt-14">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div className="stagger">
            {/* Le titre de l'accueil, memes stickers accroches aux mots, meme
                plafond d'encre (30 % d'une lettre, 12 % d'un mot). Pas
                d'etiquette au-dessus: la marguerite monte de 0,7 em au-dessus
                de la premiere ligne et la couvrait a 1440. Le nom du defi est
                dans le titre de l'onglet et sur les boutons. */}
            <h1
              ref={title}
              style={{ '--i': 1 }}
              data-hook="challenge-title"
              className="relative mt-6 max-w-[14ch] md:mt-10 text-[clamp(2.75rem,8.5vw,4.5rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ink lg:text-[clamp(3.25rem,5.4vw,4.25rem)]"
            >
              {headline(c.title, c.mark, {
                first: (
                  <Spot
                    name={TITLE_ART[0]}
                    tilt={-12}
                    delay={300}
                    eager
                    style={{ left: '-0.22em', top: '-0.92em', width: '1.05em' }}
                  />
                ),
                last: (
                  <Spot
                    name={TITLE_ART[2]}
                    tilt={-8}
                    delay={560}
                    eager
                    style={{ left: 'calc(100% + 0.04em)', top: '0.22em', width: '1.4em' }}
                  />
                ),
              })}
              {/* Pas plus de 0,4 em apres la fin de la ligne, comme le pouce de
                  l'accueil: a 0,65 em il sortait de l'ecran de 2 px a 360. */}
              <Spot
                name={TITLE_ART[1]}
                tilt={9}
                delay={430}
                eager
                className="absolute"
                style={{ left: 'calc(var(--line-end, 100%) - 0.45em)', top: '-0.9em', width: '0.85em' }}
              />
            </h1>

            <p
              style={{ '--i': 2 }}
              className="mt-8 max-w-[46ch] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-[1.55] text-muted"
            >
              {c.body}
            </p>

            <div style={{ '--i': 3 }} className="mt-10 flex flex-wrap items-center gap-3">
              {button('top')}
            </div>
            <p style={{ '--i': 4 }} className="mt-5 max-w-[46ch] text-small text-muted">
              {note}
            </p>
          </div>

          {/**
           * L'APERCU: ce que la personne verra chaque matin. Le compteur de ses
           * 21 jours et la carte "Objectif du jour", avec les memes mots que
           * l'app. Du decor (aria-hidden): tout ce qu'il dit est ecrit en
           * clair dans la liste juste en dessous.
           *
           * Les couleurs sont ecrites en dur et pas prises au theme: la page
           * publique porte des jetons neutres, et la carte doit avoir le jaune
           * de l'app. Encre sur jaune, la seule couleur vive ou le noir reste.
           */}
          <div className="relative mx-auto mt-20 w-full max-w-[26rem] px-1 pb-16 pt-6 sm:px-9 lg:mt-0">
            <div aria-hidden="true" className="relative" style={{ transform: 'rotate(2deg)' }} data-hook="challenge-preview">
              <Tape className="-top-2.5 left-8" tilt={-8} />
              <Tape className="-top-2.5 right-10" tilt={6} tone="255 0 122" />
              <div className="rounded-[1.75rem] bg-white p-5 shadow-[0_18px_40px_rgb(17_17_17/0.14)] sm:p-6">
                <p className="text-label font-semibold uppercase tracking-[0.14em] text-[#5A5A5A]">
                  {t('challenge.day', { n: 3, total: CHALLENGE_DAYS })}
                </p>
                <Dots done={2} today={3} />
                <div className="mt-5 rounded-[1.25rem] bg-[#FFD60A] p-4 text-[#111111]">
                  <span className="block text-label font-semibold uppercase tracking-[0.14em] text-[#111111]/70">
                    {c.preview_eyebrow}
                  </span>
                  <p className="mt-1.5 text-[1.375rem] font-semibold leading-[1.15] tracking-[-0.02em]">
                    {copy.goals[1].title}
                  </p>
                  <span className="mt-3.5 inline-flex rounded-pill bg-[#111111] px-5 py-2.5 text-small font-semibold text-[#FFD60A]">
                    {c.preview_done}
                  </span>
                </div>
              </div>
              <Spot name={CARD_ART[0]} tilt={-10} delay={680} className="absolute -bottom-12 -left-3 w-[4.5rem] sm:-left-12 sm:w-24" />
              <Spot name={CARD_ART[1]} tilt={9} delay={800} className="absolute -right-2 -top-16 w-[3.75rem] sm:-right-9 sm:w-[4.5rem]" />
            </div>
            <Sparkle className="absolute bottom-2 right-10 w-5 text-[#009DB9]" />
          </div>
        </div>
      </section>

      {/**
       * CE QUE L'APP DEMANDE CHAQUE MATIN. Les huit objectifs, dans l'ordre ou
       * la carte du jour les pose. Le titre de chaque carte est exactement le
       * texte de l'objectif dans l'app, pour que la personne reconnaisse ce
       * qu'elle a lu ici.
       */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        <p className="tag">{c.list_eyebrow}</p>
        <h2 className="display mt-6 max-w-[30ch] text-[clamp(1.625rem,3.6vw,2.5rem)]">{c.list_title}</h2>
        <ol data-hook="challenge-goals" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {copy.goals.map((g, i) => (
            <li
              key={g.title}
              className={`lean flex flex-col rounded-[1.5rem] p-6 ${GROUNDS[i % GROUNDS.length]}`}
              style={{ '--tilt': `${TILTS[i % TILTS.length]}deg` }}
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-white font-display text-small font-extrabold text-[#111111] [font-variant-numeric:tabular-nums]"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-[1.1875rem] font-bold leading-snug text-[#111111]">{g.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-[#111111]">{g.why}</p>
            </li>
          ))}
        </ol>
      </section>

      {/**
       * COMMENT CA MARCHE. Trois etapes, un sticker devant chacune dans sa
       * propre colonne: il ne peut donc rien couvrir.
       */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        <p className="tag">{c.steps_eyebrow}</p>
        <ol data-hook="challenge-steps" className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {c.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <Spot name={STEP_ART[i]} tilt={i % 2 ? 8 : -8} className="mt-1 w-14 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-[1.1875rem] font-bold leading-snug text-ink">
                  <span className="text-muted">{i + 1}. </span>
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[34ch] text-small leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/**
       * LE BOUTON, UNE DEUXIEME FOIS, apres avoir tout lu. Sur le jaune, a
       * l'encre. La source de la methode en dessous, en clair: le defi
       * s'inspire d'un livre et ne se presente pas comme lie a son auteur.
       */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-6">
        <div className="rounded-[1.75rem] bg-[#FFD60A] px-6 py-10 text-[#111111] md:px-12 md:py-12">
          <h2 className="max-w-[20ch] text-[clamp(1.625rem,3.6vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-[#111111]">
            {c.title}
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">{button('bottom')}</div>
          <p className="mt-5 max-w-[52ch] text-small text-[#111111]">{note}</p>
        </div>
        <p data-hook="challenge-credit" className="mt-6 max-w-[70ch] text-small text-muted">
          {c.credit}
        </p>
      </section>
    </div>
  )

  if (!bare) return page

  /* Connecte: la meme page sur le meme fond, avec seulement le logo pour
     revenir a l'app. */
  return (
    <div data-surface="public" className="ground relative min-h-dvh">
      <header className="mx-auto w-full max-w-6xl px-6 pt-5">
        <Link to="/" aria-label={t('challenge.back')}>
          <LockupInline size={38} />
        </Link>
      </header>
      {page}
    </div>
  )
}

/**
 * Les 21 cases, dans l'apercu. Faites: pleines, avec une coche. Aujourd'hui:
 * un anneau epais. A venir: un anneau pale. La forme change avec l'etat, pas
 * seulement la couleur (WCAG 1.4.1).
 */
function Dots({ done, today }) {
  return (
    <div className="mt-3 grid grid-cols-7 gap-1.5">
      {Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
        const n = i + 1
        if (n <= done) {
          return (
            <span key={n} className="flex aspect-square items-center justify-center rounded-pill bg-[#FF007A]">
              <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          )
        }
        if (n === today) return <span key={n} className="aspect-square rounded-pill border-[3px] border-[#FF007A]" />
        return <span key={n} className="aspect-square rounded-pill border-2 border-dashed border-[#111111]/45" />
      })}
    </div>
  )
}
