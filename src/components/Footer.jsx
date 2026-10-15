import { Link } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { CONTACT_EMAIL, DOC_ORDER, LEGAL, OWNER } from '../legal/content'
import { useT } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import Lettering from './Lettering'
import ThemePicker from './ThemePicker'
import { Badge, Spot, cast } from './StickerKit'

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
 * LE PANNEAU EST LA TUILE DU LOGO, EN GRAND, UN TON PLUS PROFOND. Rose et
 * lettres jaunes en soleil, bleu et lettres jaunes en mer. Et le selecteur de
 * theme est DANS ce panneau, donc choisir Mer repeint le pied de page sous le
 * doigt: l'apercu du choix est l'endroit ou on le fait.
 *
 * TOUT LE TEXTE DU PANNEAU EST BLANC, ET C'EST POUR CA QUE LE TON EST PROFOND.
 *
 *   "il y a les écritures noires dans les couleurs rose foncé et bleu. C'est
 *    très limite, ça donne mal aux yeux."
 *
 * La premiere version posait de l'encre sur les couleurs exactes de la tuile,
 * #FF007A et #009DB9: 4,98:1 et 5,86:1, le ratio passait, et ca vibrait. Le
 * blanc sur ces deux-la tomberait a 3,80 et 3,22, sous les 4,5 d'un texte de
 * taille normale. Les tons profonds de la marque portent le blanc: #D6006B
 * 5,16:1 (le rose appuye des boutons) et #0B6FAD 5,40:1 (l'accent de mer). Le
 * jaune du lettrage y ressort mieux aussi: 3,33 et 3,48 contre 2,45 et 2,08.
 * La couleur est litterale parce que ce pied de page sert aussi sous les
 * pages legales, qui portent le theme de l'app. La regle est dans CLAUDE.md.
 */
const GROUND = { sun: '#D6006B', sea: '#0B6FAD' }

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

/* Liens en gras sur le panneau. Le soulignement arrive au survol et au focus,
   en epaisseur 2, pour qu'un lien se reconnaisse autrement que par sa couleur
   (1.4.1): ils sont tous du meme blanc. */
const LINK = 'text-body font-semibold text-white underline-offset-4 decoration-2 hover:underline focus-visible:underline'

export default function Footer() {
  const { locale, setLocale } = useT()
  const { theme } = useTheme()
  const c = (LANDING[locale] ?? LANDING.en).footer
  const docs = LEGAL[locale] ?? LEGAL.en

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
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-4 block break-words text-[1.125rem] font-bold leading-snug text-white underline-offset-4 decoration-2 hover:underline focus-visible:underline"
              >
                {CONTACT_EMAIL}
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
            </div>
          </div>

          {/* Sur une carte blanche: les pastilles du selecteur sont dessinees
              pour un fond clair, et c'est ici qu'on regarde le panneau changer
              de couleur. */}
          <div className="mt-10 inline-block rounded-[1.25rem] bg-white p-4 pr-5">
            <ThemePicker />
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
          {/* "Fierement ivoirien", colle sur les lettres a partir de sm, et dans
              la ligne du bas sur un telephone, ou le lettrage n'a pas la
              place de le porter lisiblement. Une seule des deux copies est
              affichee a une largeur donnee, donc un lecteur d'ecran la lit
              une fois. Assez haut pour ne jamais etre coupe par le bord: le
              bas du lettrage sort du panneau. */}
          <Badge
            tone="ink"
            decorative={false}
            at={[67, 65]}
            lg={[76, 64]}
            tilt={-7}
            className="hidden text-[clamp(0.75rem,1.1vw,0.9375rem)] sm:inline-flex"
          >
            {c.built}
          </Badge>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 pb-3 pt-5 sm:px-6">
        <p className="text-small text-muted">
          © {new Date().getFullYear()} {OWNER}. {c.rights}
        </p>
        <p className="text-small text-muted sm:hidden">{c.built}</p>
      </div>
    </footer>
  )
}
