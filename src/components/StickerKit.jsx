import { useId } from 'react'
import { Link } from 'react-router-dom'
import { pickStickers, stickerSrc } from '../lib/art'
/* La pointe de chaque fleche, calculee sur sa courbe. Dans lib/ pour que node
   la teste: "Tes flèches sont mal dessinées", voir arrow.js. */
import { head } from '../lib/arrow'

/**
 * LE KIT DE COLLAGE DE LA VITRINE.
 *
 *   "The home page of rich and friends could look funnier and cooler with
 *    more stickers and stuff like that same for the footer"
 *
 * Avec quatre references: le pied de page de truus (le nom en geant, des
 * stickers poses dessus, des pastilles blanches pour les titres), For Purpose
 * Co. (une couronne de stickers autour du titre), Base Club (des fleches
 * dessinees a la main et un badge rond qui tourne) et un ecran d'accueil en
 * collage (des photos scotchees, un mot surligne).
 *
 * Le rail de Stickers.jsx ne pouvait pas faire ca. Sa regle est de poser le
 * decor A COTE du texte, dans la marge, et il n'existe que sur un telephone
 * parce qu'a 1440 px il n'y a plus de marge (la note y est). Ici le decor est
 * DANS la composition: colle au coin d'une carte, au bout d'une bande, sur les
 * lettres du logo. C'est un autre outil, dans un autre fichier, et le rail
 * garde sa regle pour les autres pages.
 *
 * TROIS REGLES, LES MEMES PARTOUT.
 *
 * 1. Rien ne couvre un mot. Un sticker se pose sur du vide, un bord, un coin
 *    de padding, ou sur le lettrage geant, qui est lui-meme une image. C'est
 *    mesure: le probe compare les boites de chaque sticker a celles de chaque
 *    ligne de texte peinte, a 320, 390, 820, 1180 et 1440 px.
 * 2. Tout est decoratif. aria-hidden, alt vide, rien qui depende de le voir:
 *    les mots portes par un badge sont deja ecrits en entier sur la page.
 * 3. Rien ne bouge tout seul plus de cinq secondes (WCAG 2.2.2). Les stickers
 *    se collent une fois en arrivant; le badge rond fait un tour en arrivant
 *    et ne tourne ensuite que sous la souris ou le focus. Sous
 *    prefers-reduced-motion, rien du tout.
 */

/**
 * Les noms voulus, completes si l'art a ete renomme.
 *
 * Meme garantie que les jeux de Stickers.jsx: un nom disparu est remplace par
 * un sticker qui existe plutot que de laisser un trou dans la composition.
 */
export function cast(names) {
  return pickStickers(names, names.length)
}

/**
 * La position d'un element pose, en pourcentages de sa scene.
 *
 * `at` vaut pour le telephone et la tablette, `lg` pour un ecran large quand
 * la composition change de forme. Les deux passent par des variables CSS: une
 * seule regle, .at dans index.css, choisit selon la largeur.
 */
function place(at, lg, tilt, delay) {
  const style = { '--tilt': `${tilt}deg`, '--d': `${delay}ms` }
  if (at) {
    style['--x'] = `${at[0]}%`
    style['--y'] = `${at[1]}%`
    if (at[2] != null) style['--w'] = `${at[2]}%`
  }
  if (lg) {
    style['--lx'] = `${lg[0]}%`
    style['--ly'] = `${lg[1]}%`
    if (lg[2] != null) style['--lw'] = `${lg[2]}%`
  }
  return style
}

/**
 * Un sticker du dossier, pose.
 *
 * Sans `at`, il reste dans le flux (une icone de ligne, un sticker dans un
 * titre) et sa taille vient de `className`.
 */
export function Spot({ name, at, lg, tilt = 0, delay = 0, className = '', eager = false }) {
  const src = stickerSrc(name)
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable="false"
      loading={eager ? 'eager' : 'lazy'}
      data-sticker={name}
      className={`spot ${at ? 'at' : ''} ${className}`}
      style={place(at, lg, tilt, delay)}
    />
  )
}

/**
 * Un sticker qui porte des mots: forme pleine, bord blanc decoupe, ombre.
 *
 * PAS DE NOIR SUR LE ROSE NI SUR LE BLEU.
 *
 *   "Le noir sur des couleurs sombres ou trop saturées ça donne mal aux yeux"
 *
 * La premiere version mettait de l'encre sur #FF007A (4,98:1) et sur #38BDF8
 * (8,81:1). Les deux passaient le ratio et les deux vibraient: "très limite".
 * Le rose et le bleu qui portent des mots sont donc les tons PROFONDS, en
 * blanc: #D6006B 5,16:1, #0B6FAD 5,40:1. Le jaune garde l'encre (13,4:1), le
 * noir porte du blanc (18,9:1). La regle est dans CLAUDE.md.
 *
 * Classes ecrites en entier: Tailwind lit le texte source et ne construit pas
 * `bg-${tone}`.
 */
const TONE = {
  pink: 'bg-[#D6006B] text-white',
  sky: 'bg-[#0B6FAD] text-white',
  yellow: 'bg-[#FFD60A] text-[#111111]',
  ink: 'bg-[#111111] text-white',
  white: 'bg-white text-[#111111]',
}

/* En entier aussi: `badge-${shape}` ne serait pas trouve dans le texte, et la
   regle serait retiree de la feuille a la compilation. */
const SHAPE = { pill: 'badge-pill', round: 'badge-round', tag: 'badge-tag' }

/**
 * `decorative` a false quand le badge est le seul endroit ou ses mots sont
 * ecrits a cette largeur: il est alors lu, comme n'importe quel texte.
 */
export function Badge({ children, tone = 'pink', shape = 'pill', at, lg, tilt = 0, delay = 0, className = '', decorative = true }) {
  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      data-badge={shape}
      className={`badge ${SHAPE[shape] ?? SHAPE.pill} ${TONE[tone] ?? TONE.pink} ${at ? 'at' : ''} ${className}`}
      style={place(at, lg, tilt, delay)}
    >
      {children}
    </span>
  )
}

/**
 * Les traits a la main, en currentColor, poses par leur parent.
 *
 * Aucun tiret: un bout de trait rond sur un tiret de longueur nulle peint un
 * point, et ces chemins sont tous continus.
 */
const DOODLES = {
  /* Un arc vers la droite: une seule courbe, donc une seule direction
     d'arrivee, et la pointe posee dessus. */
  swoop: {
    box: '0 0 100 50',
    d: `M7 42C22 18 50 7 88 15${head([50, 7], [88, 15], 14)}`,
  },
  /* Une fleche qui fait une boucle avant de partir a gauche, comme celles de
     Base Club. Elle arrive de la droite, tourne une fois, et finit sur sa
     pointe en bas a gauche. */
  loop: {
    box: '0 0 124 56',
    d: `M116 44C100 50 82 46 76 34C70 22 82 10 92 18C102 26 90 42 72 44C52 46 30 38 12 30${head([30, 38], [12, 30], 13)}`,
  },
}

export function Doodle({ kind, className = '', style, width = 3.5 }) {
  const doodle = DOODLES[kind]
  if (!doodle) return null
  return (
    <svg
      viewBox={doodle.box}
      aria-hidden="true"
      focusable="false"
      className={`doodle ${className}`}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={doodle.d} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Une etincelle a quatre branches, pleine. */
export function Sparkle({ className = '', style }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`doodle ${className}`} style={style}>
      <path fill="currentColor" d="M12 0c.9 7.3 4.7 11.1 12 12-7.3.9-11.1 4.7-12 12-.9-7.3-4.7-11.1-12-12C7.3 11.1 11.1 7.3 12 0z" />
    </svg>
  )
}

/**
 * Un morceau de scotch. Translucide, bords en dents de scie.
 *
 * `tone` en canaux RGB, comme les jetons de index.css, pour que l'opacite se
 * regle en un seul endroit (.tape).
 */
export function Tape({ className = '', tilt = -6, tone = '56 189 248' }) {
  return (
    <span
      aria-hidden="true"
      className={`tape ${className}`}
      style={{ '--tilt': `${tilt}deg`, '--tape': tone }}
    />
  )
}

/**
 * Le badge rond qui tourne, comme celui de Base Club. C'est un vrai lien.
 *
 * Son nom accessible est `label`, le meme que le bouton principal: le texte
 * en cercle est repete pour remplir le tour et ne se lit pas a voix haute. Le
 * cercle de texte tourne une fois en arrivant, puis seulement sous la souris
 * ou au focus clavier (voir la regle 3 en haut du fichier).
 *
 * textLength force le texte a faire exactement le tour, quelle que soit la
 * langue: "Commence · c'est gratuit" et "Start now · it's free" n'ont pas la
 * meme longueur et aucun des deux ne doit laisser de trou ni se chevaucher.
 */
export function SpinBadge({ text, label, to = '/signin', at, lg, tilt = 0, delay = 0, className = '' }) {
  const id = `spin${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const R = 70
  return (
    <Link
      to={to}
      aria-label={label}
      data-hook="spin-badge"
      className={`spin-badge press ${at ? 'at' : ''} ${className}`}
      style={place(at, lg, tilt, delay)}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className="block h-full w-full">
        <defs>
          <path id={id} d={`M100 ${100 - R}a${R} ${R} 0 1 1 0 ${2 * R}a${R} ${R} 0 1 1 0 ${-2 * R}`} />
        </defs>
        <circle cx="100" cy="100" r="96" fill="#FFD60A" stroke="#111111" strokeWidth="4" />
        <g className="spin-ring">
          <text fontSize="19" fontWeight="800" fill="#111111" letterSpacing="1" style={{ textTransform: 'uppercase' }}>
            <textPath href={`#${id}`} textLength={Math.floor(2 * Math.PI * R) - 4} lengthAdjust="spacing">
              {text}
            </textPath>
          </text>
        </g>
        {/* La fleche, qui ne tourne pas: elle dit ou va le lien. Sa pointe
            passe par head(), comme les autres: deux traits a 40 degres de la
            tige, plutot qu'un angle droit pose sur son bout. */}
        <path
          d={`M70 130L126 74${head([70, 130], [126, 74], 30, 40)}`}
          fill="none"
          stroke="#111111"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}
