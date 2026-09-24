/**
 * Les visages des humeurs, redessines.
 *
 *   "I think the emotions are too [alike], especially their eyes and mouth.
 *    And last time when I meant animate them I meant everything on the
 *    sticker, so I'd like their eyes to be animated too."
 *   "Emotion sticker should redraw and fully animated according to the
 *    emotions they'd express."
 *
 * CE QUI N'ALLAIT PAS, ET C'ETAIT MESURABLE.
 *
 * Dix-huit humeurs partageaient TROIS paires d'yeux et TROIS bouches. Neuf
 * d'entre elles portaient exactement les memes yeux fermes. "Joyeux",
 * "Reconnaissant", "Serein" et "Nostalgique" etaient le meme visage sur quatre
 * silhouettes: la seule chose qui les distinguait etait la forme du corps et
 * l'etiquette dessous.
 *
 * Une grille d'humeurs ou il faut lire le mot pour savoir laquelle on regarde
 * n'est pas une grille d'humeurs, c'est une liste avec des decorations.
 *
 * MAINTENANT CHAQUE HUMEUR A SON VISAGE. Dix-huit paires distinctes, et le
 * test le verifie plutot que de l'esperer: deux humeurs qui finiraient par se
 * ressembler apres une modification se feraient voir tout de suite.
 *
 * LE REPERE. Tout est dessine dans une boite de 100x100. L'oeil gauche vit
 * autour de x=36, le droit autour de x=64, les deux autour de y=45. La bouche
 * vit entre y=58 et y=72. Ces nombres sont tenus par toutes les formes ici,
 * parce qu'un oeil de sourcil qui derive de trois unites sur une seule humeur
 * est ce qui fait qu'une face a l'air cassee sans qu'on sache dire pourquoi.
 */

/**
 * LES YEUX.
 *
 * Trait, pas remplissage, sauf la ou une pupille demande un disque. Le groupe
 * parent porte stroke, strokeWidth et les linecaps: les repeter sur chaque
 * chemin serait dix-huit endroits ou l'epaisseur peut diverger.
 *
 * Chaque entree est un fragment, donc chacune peut porter autant d'elements
 * qu'il lui en faut: un oeil ouvert, c'est un cercle et une pupille, et une
 * larme, c'est un oeil plus une goutte.
 */
export const EYES = {
  /**
   * DES FORMES PLEINES, PAS DES TRAITS FINS.
   *
   * C'est toute la difference avec ce qui etait dessine avant, et elle a ete
   * montree plutot que decrite: "you see those kind of eyes, that's exactly
   * what I want".
   *
   * L'ancienne serie etait tracee a 3.4 d'epaisseur sur des cercles evides:
   * des lunettes, pas des yeux. Le style demande est franc et massif. Un oeil
   * ouvert est un BLANC plein et une PUPILLE pleine, tous les deux gros; un
   * oeil ferme est un arc epais a bouts ronds. Rien n'est evide, rien n'est
   * cercle, et il n'y a pas de contour autour du blanc: il se pose
   * directement sur la couleur du corps.
   *
   * LES YEUX PORTENT L'EMOTION, PAS LA BOUCHE. Dans la reference, presque
   * toutes les bouches sont un petit trait; ce sont les yeux qui font la
   * difference entre l'ennui et la culpabilite. Ils sont donc GRANDS: le blanc
   * fait 19 unites de haut sur une boite de 100, la ou l'ancien cercle en
   * faisait 13.
   *
   * LA PUPILLE EST CE QUI REGARDE. La deplacer dans le blanc suffit a changer
   * l'emotion sans rien redessiner d'autre, et c'est ce que fait la reference:
   * l'ennui regarde en haut, la culpabilite regarde de cote.
   */

  /* Fermes et contents: deux arcs epais qui bombent vers le BAS. La forme la
     plus courante de la reference, et celle que l'ancienne version avait a
     l'envers. */
  joy: (
    <>
      <path d="M25 41q10 12 20 0" strokeWidth="6" strokeLinecap="round" />
      <path d="M55 41q10 12 20 0" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  /* Les memes, plus plats: la douceur plutot que le rire. */
  archSoft: (
    <>
      <path d="M26 43q9 7 18 0" strokeWidth="6" strokeLinecap="round" />
      <path d="M56 43q9 7 18 0" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  /* Deux traits droits et epais. Le repos complet. */
  rest: (
    <>
      <path d="M26 45h18" strokeWidth="6" strokeLinecap="round" />
      <path d="M56 45h18" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  /* Grands ouverts, pupilles au milieu. */
  wide: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="46" r="5.6" fill="#141216" stroke="none" />
      <circle cx="65" cy="46" r="5.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Ouverts avec un eclat: la pupille porte un petit blanc en haut a gauche. */
  sparkle: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="46" r="5.6" fill="#141216" stroke="none" />
      <circle cx="65" cy="46" r="5.6" fill="#141216" stroke="none" />
      <circle cx="32.6" cy="43.4" r="1.9" fill="#FFFFFF" stroke="none" />
      <circle cx="62.6" cy="43.4" r="1.9" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Enormes et brillants: ca monte aux yeux sans encore tomber. */
  glossy: (
    <>
      <ellipse cx="35" cy="46" rx="10.5" ry="12.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="10.5" ry="12.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="47" r="6.4" fill="#141216" stroke="none" />
      <circle cx="65" cy="47" r="6.4" fill="#141216" stroke="none" />
      <circle cx="31.8" cy="43.4" r="2.5" fill="#FFFFFF" stroke="none" />
      <circle cx="61.8" cy="43.4" r="2.5" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Les pupilles EN HAUT. L'ennui, qui regarde le plafond. */
  lookUp: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="41" r="5.6" fill="#141216" stroke="none" />
      <circle cx="65" cy="41" r="5.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Les pupilles DE COTE. On ne soutient pas le regard. */
  away: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="39.4" cy="44.6" r="5.6" fill="#141216" stroke="none" />
      <circle cx="69.4" cy="44.6" r="5.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Les pupilles EN BAS. On regarde ses pieds. */
  down: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="51" r="5.6" fill="#141216" stroke="none" />
      <circle cx="65" cy="51" r="5.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Petits et rentres: on se fait discret. Le blanc retrecit avec la pupille,
     sinon c'est un grand oeil avec un petit point, qui est de la surprise. */
  small: (
    <>
      <ellipse cx="37" cy="46" rx="6" ry="7" fill="#FFFFFF" stroke="none" />
      <ellipse cx="63" cy="46" rx="6" ry="7" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="46" r="3.4" fill="#141216" stroke="none" />
      <circle cx="63" cy="46" r="3.4" fill="#141216" stroke="none" />
    </>
  ),
  /**
   * MI-CLOS: UNE PAUPIERE PLEINE POSEE SUR L'OEIL.
   *
   * Pas un oeil coupe en deux par un trait. La paupiere est une forme opaque
   * de la couleur de l'encre qui RECOUVRE le haut du blanc, ce qui est
   * exactement ce que fait la reference et ce qui donne le regard lourd.
   */
  half: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="47" r="5.6" fill="#141216" stroke="none" />
      <circle cx="65" cy="47" r="5.6" fill="#141216" stroke="none" />
      <path d="M25 46a10 12 0 0 1 20 0Z" fill="#141216" stroke="none" />
      <path d="M55 46a10 12 0 0 1 20 0Z" fill="#141216" stroke="none" />
    </>
  ),
  /* La meme paupiere, inclinee vers le nez: la colere. */
  angry: (
    <>
      <ellipse cx="35" cy="47" rx="9.5" ry="11" fill="#FFFFFF" stroke="none" />
      <ellipse cx="65" cy="47" rx="9.5" ry="11" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="49" r="5.4" fill="#141216" stroke="none" />
      <circle cx="65" cy="49" r="5.4" fill="#141216" stroke="none" />
      <path d="M24 34l22 10v-12h-22Z" fill="#141216" stroke="none" />
      <path d="M76 34l-22 10v-12h22Z" fill="#141216" stroke="none" />
    </>
  ),
  /**
   * DES CHEVRONS QUI POINTENT VERS LE NEZ, PAS DES CROIX.
   *
   * La premiere version dessinait deux traits qui se croisent par oeil, donc
   * un X. Regarde a l'ecran: un X sur les yeux, c'est le personnage ASSOMME de
   * n'importe quel dessin anime, pas quelqu'un de tendu. "Stresse" annoncait
   * "mort", et "Blesse" aussi.
   *
   * Un chevron, lui, est un oeil SERRE: les deux paupieres se rejoignent en
   * pointe, et la pointe va vers le nez comme dans la reference.
   */
  squint: (
    <>
      <path d="M27 39l15 7-15 7" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M73 39l-15 7 15 7" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /* Coins EXTERIEURS tombants: le visage abattu. C'est le SENS de la pente qui
     nomme l'emotion, pas sa courbure, et ces deux-la ont deja ete inversees
     une fois. */
  droop: (
    <>
      <path d="M25 49q10-9 20-4" strokeWidth="6" strokeLinecap="round" />
      <path d="M75 49q-10-9-20-4" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  /* Un ferme serre, un plisse: on encaisse. Le plisse est un chevron et pas
     une croix, pour la raison ecrite sur `squint`. */
  wince: (
    <>
      <path d="M25 41q10 11 20 0" strokeWidth="6" strokeLinecap="round" />
      <path d="M73 39l-15 7 15 7" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /* Fermes, et une larme pleine qui pend. */
  tear: (
    <>
      <path d="M25 42q10 10 20 0" strokeWidth="6" strokeLinecap="round" />
      <path d="M55 42q10 10 20 0" strokeWidth="6" strokeLinecap="round" />
      <path d="M65 52c3 4.2 4.5 6.6 4.5 8.6a4.5 4.5 0 0 1-9 0c0-2 1.5-4.4 4.5-8.6Z"
            fill="#141216" stroke="none" className="mf-tear" />
    </>
  ),
  /* Ondules: le mal au coeur. */
  queasy: (
    <>
      <path d="M25 44q5-6 10 0t10 0" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M55 44q5-6 10 0t10 0" strokeWidth="5.5" strokeLinecap="round" />
    </>
  ),
  /**
   * UN OEIL OUVERT ET UNE SPIRALE.
   *
   * C'est exactement la reference, et c'est aussi ce qui marche: l'asymetrie
   * porte l'incomprehension, et la spirale n'a plus besoin de se lire toute
   * seule puisque l'autre oeil dit deja que quelque chose ne tourne pas rond.
   *
   * La spirale est PLEINE et epaisse, comme le reste: les deux essais traces
   * finement d'avant se remplissaient a 56px et rendaient un gros point.
   */
  swirl: (
    <>
      <ellipse cx="35" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="35" cy="46" r="5.6" fill="#141216" stroke="none" />
      <ellipse cx="65" cy="46" rx="9.5" ry="11.5" fill="#FFFFFF" stroke="none" />
      <path d="M65 38.5a7.5 7.5 0 1 1-6.6 4.4" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M65 42.6a3.4 3.4 0 1 0 2.4 5.8" strokeWidth="4.2" strokeLinecap="round" />
    </>
  ),
  /* Deux gros points pleins. Le degre zero, pour l'humeur qui l'est. */
  dots: (
    <>
      <circle cx="35" cy="46" r="5" fill="#141216" stroke="none" />
      <circle cx="65" cy="46" r="5" fill="#141216" stroke="none" />
    </>
  ),
  /* Deux traits fins et hauts, tres ecartes: la douceur attentive. */
  soft: (
    <>
      <path d="M26 44q9 9 18 0" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M56 44q9 9 18 0" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M27 37q8-4 16 0" strokeWidth="3" strokeLinecap="round" />
      <path d="M57 37q8-4 16 0" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
}

export const MOUTHS = {
  /* Grand, ouvert, plein. */
  grin: <path d="M34 60q16 17 32 0q-16 7-32 0Z" fill="#141216" stroke="#141216" strokeWidth="2" />,
  /* Un sourire trace, franc mais ferme. */
  smile: <path d="M36 62q14 12 28 0" />,
  /* Petit sourire. La douceur. */
  softSmile: <path d="M40 64q10 7 20 0" />,
  /* Droite. */
  flat: <path d="M38 65h24" />,
  /* Tombante. */
  frown: <path d="M37 69q13-11 26 0" />,
  /* Tombante et large: ca ne se retient plus. */
  bigFrown: <path d="M34 71q16-15 32 0" />,
  /* Ondulee. Le menton qui tremble, avant les larmes. */
  wobble: <path d="M35 66q4-5 7.5 0t7.5 0t7.5 0t7.5 0" />,
  /* Ronde et ouverte: la surprise. */
  o: <ellipse cx="50" cy="65" rx="7" ry="8.5" fill="#141216" stroke="none" />,
  /* Serree, dents visibles. La tension. */
  grit: (
    <>
      <path d="M36 61h28v8H36Z" />
      <path d="M43 61v8" />
      <path d="M50 61v8" />
      <path d="M57 61v8" />
    </>
  ),
  /* Un coin releve. Le doute. */
  smirk: <path d="M38 67q11 5 23-5" />,
  /* Minuscule. On n'a pas grand-chose a dire. */
  tiny: <path d="M45 66h10" />,
  /* En zigzag: la rage dessinee, pas mimee. */
  zigzag: <path d="M35 66l6-5 5 5 5-5 5 5 5-5 4 5" />,
}

/**
 * QUEL VISAGE POUR QUELLE HUMEUR.
 *
 * Ici et pas dans MOODS, parce que MOODS est la liste que la base et les
 * traductions connaissent, et parce que c'est cette table-ci que le test
 * compare a elle-meme pour garantir que deux humeurs ne portent pas le meme
 * visage. Une humeur ajoutee au catalogue et oubliee ici ne prend pas le
 * visage d'une autre en silence: elle n'en a pas, et le test le dit.
 *
 * `fx` est ce qui BOUGE quand on la touche, feature par feature. C'est la
 * demande: "I meant everything on the sticker, I'd like their eyes to be
 * animated too". Le corps garde son propre geste (MOOD_MOTION), les yeux et
 * la bouche ont maintenant le leur, et les trois jouent ensemble.
 */
export const FACES = {
  joyful: { eyes: 'joy', mouth: 'grin', fx: { eyes: 'fx-squeeze', mouth: 'fx-open' } },
  energized: { eyes: 'sparkle', mouth: 'smile', fx: { eyes: 'fx-flash', mouth: 'fx-open' } },
  excited: { eyes: 'wide', mouth: 'o', fx: { eyes: 'fx-widen', mouth: 'fx-gasp' } },
  grateful: { eyes: 'archSoft', mouth: 'softSmile', fx: { eyes: 'fx-blink', mouth: 'fx-lift' } },
  serene: { eyes: 'rest', mouth: 'smile', fx: { eyes: 'fx-settle', mouth: 'fx-lift' } },
  neutral: { eyes: 'dots', mouth: 'flat', fx: { eyes: 'fx-blink', mouth: 'fx-nudge' } },
  nostalgic: { eyes: 'away', mouth: 'softSmile', fx: { eyes: 'fx-glance', mouth: 'fx-lift' } },
  sensitive: { eyes: 'glossy', mouth: 'wobble', fx: { eyes: 'fx-well', mouth: 'fx-tremble' } },
  /* `half` est la paupiere lourde, gardee pour une humeur qui la merite plus
     que l'ennui: l'ennui regarde ailleurs, il ne ferme pas les yeux. */
  bored: { eyes: 'lookUp', mouth: 'flat', fx: { eyes: 'fx-glancedown', mouth: 'fx-nudge' } },
  sick: { eyes: 'queasy', mouth: 'wobble', fx: { eyes: 'fx-roll', mouth: 'fx-tremble' } },
  confused: { eyes: 'swirl', mouth: 'smirk', fx: { eyes: 'fx-spin', mouth: 'fx-nudge' } },
  insecure: { eyes: 'small', mouth: 'tiny', fx: { eyes: 'fx-shrinkface', mouth: 'fx-shrinkface' } },
  stressed: { eyes: 'squint', mouth: 'grit', fx: { eyes: 'fx-tense', mouth: 'fx-clench' } },
  angry: { eyes: 'angry', mouth: 'zigzag', fx: { eyes: 'fx-tense', mouth: 'fx-clench' } },
  discouraged: { eyes: 'half', mouth: 'frown', fx: { eyes: 'fx-droop', mouth: 'fx-fall' } },
  sad: { eyes: 'tear', mouth: 'bigFrown', fx: { eyes: 'fx-cry', mouth: 'fx-fall' } },
  /* `droop` et `soft` restent au vocabulaire sans porteur pour l'instant: une
     forme dessinee et non attribuee ne coute rien, une humeur sans visage si. */
  hurt: { eyes: 'wince', mouth: 'flat', fx: { eyes: 'fx-squeeze', mouth: 'fx-tremble' } },
  guilty: { eyes: 'down', mouth: 'tiny', fx: { eyes: 'fx-glancedown', mouth: 'fx-nudge' } },
}

export const faceOf = (id) => FACES[id] ?? null

/**
 * Le visage d'une humeur, anime ou au repos.
 *
 * `playing` porte les classes d'animation sur les DEUX groupes plutot que sur
 * le svg entier, ce qui est toute la difference entre "le sticker bouge" et
 * "le visage fait l'emotion".
 *
 * Les classes sont des chaines ENTIERES dans la table ci-dessus. Tailwind lit
 * le texte des sources, donc `fx-${quelquechose}` ne produit aucune classe au
 * build; ce sont des classes a nous dans index.css, mais la regle du projet
 * vaut quand meme et elle vaut deux fois pour une table.
 */
export default function MoodGlyph({ mood, playing = false }) {
  const face = faceOf(mood?.id)
  const eyes = EYES[face?.eyes] ?? EYES.dots
  const mouth = MOUTHS[face?.mouth] ?? MOUTHS.flat

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path
        d={mood.path}
        fill={mood.color}
        stroke={mood.color}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <g
        fill="none"
        stroke="#141216"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className={`mf-eyes ${playing ? face?.fx?.eyes ?? '' : ''}`}>{eyes}</g>
        <g className={`mf-mouth ${playing ? face?.fx?.mouth ?? '' : ''}`}>{mouth}</g>
      </g>
    </svg>
  )
}
