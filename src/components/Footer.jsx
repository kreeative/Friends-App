import { Link } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { CONTACT_EMAIL, DOC_ORDER, LEGAL, OWNER } from '../legal/content'
import { useT } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import Lettering from './Lettering'
import ThemePicker from './ThemePicker'
import { Spot, cast } from './StickerKit'

/**
 * The real footer: what the thing is, where to go next, who owns it, and how
 * to reach them. The ownership notice matters here beyond convention: it is
 * the visible half of the IP position the licence and the legal pages set out.
 *
 * The theme picker lives here rather than taking a section of its own on the
 * home page. It is a preference, and preferences belong where preferences go.
 *
 * COMME CELUI DE TRUUS, DEPUIS LE 15 OCTOBRE.
 *
 *   "same for the footer", sur la capture du pied de page de truus.
 *
 * Un grand panneau de couleur pose dans la page, des pastilles blanches pour
 * les titres de colonne, des liens en gras, et le nom de la marque en geant en
 * bas, coupe par le bord, avec des stickers colles sur les lettres.
 *
 * LE PANNEAU EST LA TUILE DU LOGO, EN GRAND, A SA COULEUR EXACTE. Rose et
 * lettres jaunes en soleil, turquoise et lettres jaunes en mer. Et le
 * selecteur de theme est DANS ce panneau, donc choisir Mer repeint le pied de
 * page sous le doigt: l'apercu du choix est l'endroit ou on le fait.
 *
 * TOUT LE TEXTE DU PANNEAU EST BLANC ET GRAND.
 *
 * Il a fallu trois essais. L'encre sur #FF007A et #009DB9 passait le ratio
 * (4,98 et 5,86) et "ça donne mal aux yeux". Le blanc sur des tons plus
 * profonds, #D6006B et #0B6FAD, passait 5,16 et 5,40, et ce bleu n'etait pas
 * celui du logo: "c'est pas le même bleu". Donc les couleurs exactes de la
 * tuile, et le blanc dessus ne fait que 3,80:1 et 3,22:1. Ca passe pour un
 * grand texte (3:1 a partir de 18,66 px en gras) et pas en dessous, donc
 * chaque mot pose directement sur le panneau est en gras a 19 px au moins:
 * les liens, l'adresse, la phrase. Les petits textes sont dans des pastilles
 * blanches, a l'encre. La couleur est litterale parce que ce pied de page sert
 * aussi sous les pages legales, qui portent le theme de l'app. La regle est
 * dans CLAUDE.md.
 */
const GROUND = { sun: '#FF007A', sea: '#009DB9' }

/* Colles sur les lettres, de gauche a droite. Positions en pourcentages du
   lettrage, donc chaque sticker reste sur la meme lettre a toutes les
   largeurs. */
const ART = cast(['bro', 'pizza', 'cactus', 'wallet', 'turntable', 'popsicle'])
const SPOTS = [
  { at: [3, 4, 9.5], tilt: -12 },     // sur le R
  { at: [26, 30, 10], tilt: 9 },      // dans le c
  { at: [45.5, -6, 7], tilt: -6 },    // au-dessus du &
  { at: [57, 30, 9], tilt: 12 },      // sur le F
  { at: [74.5, 2, 10.5], tilt: -9 },  // entre e et n
  { at: [90, 12, 7.5], tilt: 8 },     // sur le s
]

/* Liens en gras sur le panneau, a 19 px: le seuil des grands textes, le seul
   que le blanc passe sur ces deux couleurs. Le soulignement arrive au survol
   et au focus, en epaisseur 2, pour qu'un lien se reconnaisse autrement que
   par sa couleur (1.4.1): ils sont tous du meme blanc. */
const LINK = 'text-[1.1875rem] font-bold leading-snug text-white underline-offset-4 decoration-2 hover:underline focus-visible:underline'

export default function Footer() {
  const { locale, setLocale } = useT()
  const { theme } = useTheme()
  const c = (LANDING[locale] ?? LANDING.en).footer
  const docs = LEGAL[locale] ?? LEGAL.en
  const at = CONTACT_EMAIL.indexOf('@')

  const product = [
    ['/how-it-works', c.links.how],
    ['/books', c.links.library],
    ['/etudes', c.links.studies],
    ['/aide', c.links.faq],
    /* Under Help rather than in the legal column: it is a thank-you, not a
       notice. */
    ['/merci', c.links.credits],
    ['/signin', c.links.signin],
  ]

  return (
    <footer className="mt-section px-2.5 pb-2 sm:px-4" data-hook="footer">
      <div
        data-hook="footer-panel"
        className="relative overflow-hidden rounded-[2rem] text-white transition-colors duration-500"
        style={{ backgroundColor: GROUND[theme] ?? GROUND.sun }}
      >
        <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pt-12 sm:px-6 md:pt-16">
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr]">
            <div>
              <p className="tag tag-flat">{c.movement}</p>
              <p className="mt-4 max-w-[22ch] text-[1.375rem] font-bold leading-[1.22] tracking-[-0.015em]">
                {c.tagline}
              </p>
            </div>

            <nav aria-label={c.product}>
              <h2 className="tag tag-flat">{c.product}</h2>
              <ul className="mt-4 space-y-2">
                {product.map(([to, label]) => (
                  <li key={to}>
                    <Link to={to} className={LINK}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label={c.legalHeading}>
              <h2 className="tag tag-flat">{c.legalHeading}</h2>
              <ul className="mt-4 space-y-2">
                {DOC_ORDER.map((s) => (
                  <li key={s}>
                    <Link to={`/legal/${s}`} className={LINK}>
                      {docs[s].title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="tag tag-flat">{c.contact}</h2>
              {/* Une coupure permise avant l'arobase, comme on coupe une adresse
                  dans un texte. A 19 px l'adresse fait 278 px d'un bloc. A
                  320 px la colonne en a 260, et a 640 la grille a deux
                  colonnes en donne 264: sans point de coupure, la premiere
                  fois elle elargissait la grille jusqu'au bord du panneau, la
                  seconde break-words la coupait n'importe ou. A partir de lg
                  la colonne s'elargit pour elle (1.2fr, sans minmax(0)), donc
                  elle reste sur une ligne: le <wbr> y est cache, parce que
                  Chromium coupe a un <wbr> meme sous white-space: nowrap
                  (mesure: deux lignes a 1440). */}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-4 block break-words text-[1.1875rem] font-bold leading-snug text-white underline-offset-4 decoration-2 hover:underline focus-visible:underline"
              >
                {at > 0 ? (
                  <>
                    {CONTACT_EMAIL.slice(0, at)}
                    <span className="lg:hidden">
                      <wbr />
                    </span>
                    {CONTACT_EMAIL.slice(at)}
                  </>
                ) : (
                  CONTACT_EMAIL
                )}
              </a>
              {/* La langue choisie est pleine, l'autre est blanche: les deux se
                  distinguent par le fond ET par aria-pressed, pas par une
                  nuance de rose qu'on ne verrait pas sur ce panneau. */}
              <div className="mt-5 flex gap-2">
                {[
                  ['en', 'EN'],
                  ['fr', 'FR'],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    aria-pressed={locale === code}
                    className={`press rounded-pill px-4 py-1.5 text-small font-bold ${
                      locale === code ? 'bg-[#111111] text-white' : 'bg-white text-[#111111]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* La couleur, sous la langue et de la meme forme: une pastille
                  pour titre, deux puces. C'etait une carte blanche a part,
                  sous les colonnes, et "c'est bizarre par rapport au reste du
                  design". Choisir Mer repeint toujours le panneau. */}
              <ThemePicker variant="chips" className="mt-8" />
            </div>
          </div>
        </div>

        {/**
         * LE NOM EN GEANT, QUI SORT PAR LE BAS.
         *
         * Le lettrage prend toute la largeur du panneau et la marge negative
         * en pourcentage (donc de la LARGEUR, c'est la regle des marges) le
         * fait depasser d'environ un sixieme de sa hauteur: le panneau coupe,
         * et on lit encore chaque lettre, comme chez truus.
         */}
        <div className="relative mx-3 mt-12 sm:mx-5 md:mt-16" style={{ marginBottom: '-3.6%' }} data-hook="footer-art">
          <Lettering className="footer-lettering" />
          {SPOTS.map((s, i) => (
            <Spot key={ART[i] ?? i} name={ART[i]} at={s.at} tilt={s.tilt} delay={i * 90} />
          ))}
        </div>
      </div>

      {/* "Fierement ivoirien" est dans la ligne du bas a toutes les largeurs.
          A partir de sm il etait aussi une pastille noire a bord blanc collee
          sur les lettres, c'est-a-dire un faux sticker: parti avec les
          badges. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 pb-3 pt-5 sm:px-6">
        <p className="text-small text-muted">
          © {new Date().getFullYear()} {OWNER}. {c.rights}
        </p>
        <p className="text-small text-muted">{c.built}</p>
      </div>
    </footer>
  )
}
