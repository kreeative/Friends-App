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
 * dessinees a la main) et un ecran d'accueil en collage (des photos
 * scotchees, un mot surligne).
 *
 * Base Club avait aussi un badge rond qui tourne. Il a ete fait, jaune,
 * "START NOW · IT'S FREE" autour d'une fleche, et retire: "Ca aussi enlève je
 * n'aime pas". C'etait une chose dessinee en code de plus, comme les badges a
 * mots plus bas.
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
 * 1. Rien ne couvre une ligne de texte courant. Un sticker se pose sur du
 *    vide, un bord, un coin de padding, ou sur le lettrage geant, qui est
 *    lui-meme une image. C'est mesure: la sonde compare chaque ligne de texte
 *    peinte avec et sans le decor, a 320, 390, 820, 1180 et 1440 px.
 *    Une exception, demandee: le titre du hero. "Des stickers autour du
 *    texte, un peu sur le texte", comme sur les references, donc la ils
 *    mordent sur le coin d'une lettre. La sonde y mesure l'encre que le decor
 *    prend a chaque mot et a chaque lettre, avec un plafond (voir Home.jsx).
 * 2. Tout est decoratif. aria-hidden, alt vide, rien qui depende de le voir:
 *    les mots des bandes de scotch sont deja ecrits en entier sur la page.
 * 3. Rien ne bouge tout seul plus de cinq secondes (WCAG 2.2.2). Les stickers
 *    se collent une fois en arrivant, puis ne bougent que sous la souris.
 *    Sous prefers-reduced-motion, rien du tout.
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
 * Sans `at`, il reste dans le flux (une icone de ligne) ou se place par
 * `className`, et sa taille vient de `className`. `style` s'ajoute a la pose,
 * pour une position qui ne s'ecrit pas en pourcentages de la scene.
 */
export function Spot({ name, at, lg, tilt = 0, delay = 0, className = '', style, eager = false }) {
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
      style={{ ...place(at, lg, tilt, delay), ...style }}
    />
  )
}

/*
 * IL N'Y A PLUS DE BADGE A MOTS DANS CE KIT, ET C'EST VOULU.
 *
 *   "j'aime pas cette sorte de écriture en mode bouton. Et puis il y a un
 *    contour blanc autour du bouton, genre tu veux créer l'effet sticker,
 *    mais c'est pas vraiment des stickers, c'est des choses que tu as
 *    craftées."
 *
 * Il y en avait cinq: trois pastilles au-dessus du titre, une ronde dans le
 * panneau jaune, une noire sur le lettrage du pied de page. Des formes de
 * couleur en capitales, avec un bord blanc de 3 px pour se faire passer pour
 * des stickers. Le bord blanc decoupe appartient aux vrais stickers, les PNG
 * du dossier; rien de dessine en code ne le porte. La regle est dans
 * CLAUDE.md.
 */
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
  /* Il y avait aussi `loop`, une fleche a boucle qui allait du badge rond au
     bouton principal. Elle est partie avec le badge: elle ne partait plus de
     rien. */
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
 * regle en un seul endroit (.tape). Par defaut le turquoise du logo,
 * #009DB9: "le bleu que tu as pris et le bleu qui est sur le logo, c'est pas
 * le même bleu".
 */
export function Tape({ className = '', tilt = -6, tone = '0 157 185' }) {
  return (
    <span
      aria-hidden="true"
      className={`tape ${className}`}
      style={{ '--tilt': `${tilt}deg`, '--tape': tone }}
    />
  )
}
