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
   * TROIS FOIS REDESSINES, ET LA TROISIEME EN AYANT ENFIN REGARDE DE PRES.
   *
   * Les deux premieres fois j'ai lu sa reference dans une vignette de 60px de
   * haut et j'ai devine. La bonne facon etait de charger son image, de
   * decouper les visages et de les agrandir quatre fois, ce qui prend une
   * minute et repond a tout. Ce qui suit vient de cette mesure-la.
   *
   * LES DEUX CONSTRUCTIONS DU STYLE:
   *
   * 1. UN OEIL OUVERT EST DEUX CERCLES BLANCS QUI SE CHEVAUCHENT, avec une
   *    encoche la ou ils se rencontrent. Pas deux ellipses separees posees
   *    loin l'une de l'autre: un seul massif blanc au milieu du visage.
   *
   * 2. LA PUPILLE EST ENORME ET HAUTE, et elle DEBORDE du blanc par le haut.
   *    C'est ce debordement qui donne le regard, et c'est la premiere chose
   *    que j'avais ratee: une petite pupille centree dans un grand blanc est
   *    un oeil de poupee, pas ce regard-la.
   *
   * 3. UN OEIL FERME EST UN PETIT U CREUX, pas un arc. Les cotes montent
   *    presque droit et le fond est rond, donc les bouts pointent vers le
   *    HAUT. Et il est PETIT: quatorze unites de large sur cent, pose haut.
   *
   * TOUT EST COMPACT ET CENTRE. Dans la reference, les yeux occupent la
   * moitie de la largeur du corps et se touchent presque; les miens etaient
   * ecartes jusqu'aux bords, ce qui donne un visage etale au lieu d'un visage.
   */

  /* Les deux blancs qui se chevauchent, avec l'encoche au milieu. Dessines
     AVANT les pupilles pour que celles-ci passent par-dessus. */
  wide: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="42" r="8" fill="#141216" stroke="none" />
      <circle cx="63" cy="42" r="8" fill="#141216" stroke="none" />
    </>
  ),
  /* Les pupilles encore plus haut: l'ennui regarde le plafond. */
  lookUp: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="39.5" r="8" fill="#141216" stroke="none" />
      <circle cx="63" cy="39.5" r="8" fill="#141216" stroke="none" />
    </>
  ),
  /* De cote. On ne soutient pas le regard. */
  away: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="42" cy="43" r="8" fill="#141216" stroke="none" />
      <circle cx="68" cy="43" r="8" fill="#141216" stroke="none" />
    </>
  ),
  /* En bas. On regarde ses pieds. */
  down: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="52" r="8" fill="#141216" stroke="none" />
      <circle cx="63" cy="52" r="8" fill="#141216" stroke="none" />
    </>
  ),
  /* Avec un eclat sur la pupille. */
  sparkle: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="42" r="8" fill="#141216" stroke="none" />
      <circle cx="63" cy="42" r="8" fill="#141216" stroke="none" />
      <circle cx="33.6" cy="38.8" r="2.7" fill="#FFFFFF" stroke="none" />
      <circle cx="59.6" cy="38.8" r="2.7" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Plus gros encore, et deux eclats: ca monte aux yeux. */
  glossy: (
    <>
      <circle cx="38" cy="47" r="14" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="14" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="43" r="9" fill="#141216" stroke="none" />
      <circle cx="63" cy="43" r="9" fill="#141216" stroke="none" />
      <circle cx="33" cy="39" r="3.2" fill="#FFFFFF" stroke="none" />
      <circle cx="59" cy="39" r="3.2" fill="#FFFFFF" stroke="none" />
      <circle cx="40.5" cy="46" r="1.7" fill="#FFFFFF" stroke="none" />
      <circle cx="66.5" cy="46" r="1.7" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Petits: on se fait discret. Les blancs se separent, ce qui est la seule
     facon de retrecir sans que l'encoche devienne un trait. */
  small: (
    <>
      <circle cx="40" cy="47" r="7.5" fill="#FFFFFF" stroke="none" />
      <circle cx="60" cy="47" r="7.5" fill="#FFFFFF" stroke="none" />
      <circle cx="40" cy="44.5" r="4.6" fill="#141216" stroke="none" />
      <circle cx="60" cy="44.5" r="4.6" fill="#141216" stroke="none" />
    </>
  ),
  /* La paupiere lourde: une forme PLEINE qui recouvre le haut du blanc. */
  half: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="44" r="8" fill="#141216" stroke="none" />
      <circle cx="63" cy="44" r="8" fill="#141216" stroke="none" />
      <path d="M25 44a13 13 0 0 1 26 0Z" fill="#141216" stroke="none" />
      <path d="M49 44a13 13 0 0 1 26 0Z" fill="#141216" stroke="none" />
    </>
  ),
  /* La meme paupiere inclinee vers le nez: la colere. */
  angry: (
    <>
      <circle cx="38" cy="48" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="48" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="47" r="7.5" fill="#141216" stroke="none" />
      <circle cx="63" cy="47" r="7.5" fill="#141216" stroke="none" />
      <path d="M24 33l27 13v-13H24Z" fill="#141216" stroke="none" />
      <path d="M76 33L49 46V33h27Z" fill="#141216" stroke="none" />
    </>
  ),
  /**
   * UN OEIL, UNE SPIRALE, ET LA SPIRALE EST DE COULEUR.
   *
   * C'est ce que fait la reference, et c'est ce qui la rend lisible: une
   * spirale noire sur blanc se confond avec une pupille, une spirale orange ne
   * se confond avec rien.
   */
  swirl: (
    <>
      <circle cx="38" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="47" r="13" fill="#FFFFFF" stroke="none" />
      <circle cx="36" cy="43" r="8" fill="#141216" stroke="none" />
      <path d="M62 38.5a8.5 8.5 0 1 1-7.4 5a4.6 4.6 0 1 0 3.2 7.4"
            fill="none" stroke="#F08A2C" strokeWidth="4.4" strokeLinecap="round" />
    </>
  ),

  /* --- et les yeux fermes: des petits U creux, poses haut --------------- */

  /* Le U de base. Les cotes montent presque droit, le fond est rond, donc les
     bouts pointent vers le haut. C'est la forme la plus courante de la
     reference et celle que j'avais dessinee en arc plat deux fois de suite. */
  joy: (
    <>
      <path d="M31 39c0 8.5 12 8.5 12 0" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M57 39c0 8.5 12 8.5 12 0" strokeWidth="4.6" strokeLinecap="round" />
    </>
  ),
  /* Le meme, moins creux: la douceur. */
  archSoft: (
    <>
      <path d="M31 40c0 6 12 6 12 0" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M57 40c0 6 12 6 12 0" strokeWidth="4.6" strokeLinecap="round" />
    </>
  ),
  /* Deux traits droits: le repos complet. */
  rest: (
    <>
      <path d="M31 44h12" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M57 44h12" strokeWidth="4.6" strokeLinecap="round" />
    </>
  ),
  /* Deux gros points. Le degre zero. */
  dots: (
    <>
      <circle cx="38" cy="45" r="5" fill="#141216" stroke="none" />
      <circle cx="62" cy="45" r="5" fill="#141216" stroke="none" />
    </>
  ),
  /* Coins exterieurs tombants: le visage abattu. */
  droop: (
    <>
      <path d="M30 48q7-8 14-3" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M70 48q-7-8-14-3" strokeWidth="4.6" strokeLinecap="round" />
    </>
  ),
  /* Des chevrons pointe vers le nez: l'oeil SERRE. Pas une croix, qui est le
     personnage assomme de n'importe quel dessin anime. */
  squint: (
    <>
      <path d="M30 39l13 6-13 6" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 39l-13 6 13 6" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /* Un ferme, un serre: on encaisse. */
  wince: (
    <>
      <path d="M31 39c0 8.5 12 8.5 12 0" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M70 39l-13 6 13 6" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /* Fermes, et une larme pleine qui pend sous l'oeil droit. */
  tear: (
    <>
      <path d="M31 40c0 7.5 12 7.5 12 0" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M57 40c0 7.5 12 7.5 12 0" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M63 50c2.7 3.8 4 6 4 7.8a4 4 0 0 1-8 0c0-1.8 1.3-4 4-7.8Z"
            fill="#141216" stroke="none" className="mf-tear" />
    </>
  ),
  /* Ondules: le mal au coeur. */
  queasy: (
    <>
      <path d="M30 43q3.5-5 7 0t7 0" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M56 43q3.5-5 7 0t7 0" strokeWidth="4.2" strokeLinecap="round" />
    </>
  ),
  /* Attentifs: le U avec un sourcil haut au-dessus. */
  soft: (
    <>
      <path d="M31 41c0 7 12 7 12 0" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M57 41c0 7 12 7 12 0" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M30 33q7-3.5 14 0" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M56 33q7-3.5 14 0" strokeWidth="2.8" strokeLinecap="round" />
    </>
  ),
}

export const MOUTHS = {
  /* Grand, ouvert, plein. */
  /* LARGE ET TRACEE, PAS UNE MASSE PLEINE. Dans la reference aucune bouche
     n'est un aplat: ce sont toutes des courbes larges et fines, bien plus
     larges que le groupe des yeux, posees juste dessous. Une bouche pleine
     tire l'oeil vers le bas du visage et vole la vedette aux yeux, qui sont
     censes porter l'emotion. */
  /* LES BOUCHES DESCENDENT SOUS LES YEUX.
     Les blancs font 13 de rayon a cy=47, donc ils finissent a y=60. Les
     bouches partaient a 55: elles traversaient l'oeil. "Energise" se lisait
     comme un visage ecrase, et c'etait ca. Tout ce qui est large commence
     maintenant sous 62. */
  grin: <path d="M25 64q25 17 50 0" strokeWidth="4.4" strokeLinecap="round" />,
  /* Un sourire trace, franc mais ferme. */
  smile: <path d="M28 65q22 14 44 0" strokeWidth="4.2" strokeLinecap="round" />,
  /* Petit sourire. La douceur. */
  softSmile: <path d="M34 66q16 9 32 0" strokeWidth="4.2" strokeLinecap="round" />,
  /* Droite. */
  flat: <path d="M41 67h18" strokeWidth="4.2" strokeLinecap="round" />,
  /* Tombante. */
  frown: <path d="M37 69q13-11 26 0" />,
  /* Tombante et large: ca ne se retient plus. */
  bigFrown: <path d="M34 71q16-15 32 0" />,
  /* Ondulee. Le menton qui tremble, avant les larmes. */
  wobble: <path d="M35 68q4-5 7.5 0t7.5 0t7.5 0t7.5 0" strokeWidth="3.8" />,
  /* Ronde et ouverte: la surprise. */
  o: <ellipse cx="50" cy="71" rx="6.4" ry="7.6" fill="#141216" stroke="none" />,
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
