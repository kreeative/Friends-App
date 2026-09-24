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
  /* Fermes et RELEVES aux coins. Le contentement, et l'inverse exact de ce
     qui etait dessine avant: l'ancien `closed` courbait vers le BAS, qui est
     la forme d'un oeil triste, sur les neuf humeurs les plus heureuses. */
  joy: (
    <>
      <path d="M29 48q7-9 14 0" />
      <path d="M57 48q7-9 14 0" />
    </>
  ),
  /* A peine clos, presque droits. Le repos plutot que le rire. */
  rest: (
    <>
      <path d="M30 46h12" />
      <path d="M58 46h12" />
    </>
  ),
  /* Paupieres basses et douces: on regarde sans forcer. */
  soft: (
    <>
      <path d="M30 44q6 5 12 0" />
      <path d="M58 44q6 5 12 0" />
      <path d="M30 41q6-3 12 0" />
      <path d="M58 41q6-3 12 0" />
    </>
  ),
  /* Grands ouverts. La pupille est un disque plein, le tour un cercle trace. */
  wide: (
    <>
      <circle cx="36" cy="45" r="6.5" />
      <circle cx="64" cy="45" r="6.5" />
      <circle cx="36" cy="45" r="2.6" fill="#141216" stroke="none" />
      <circle cx="64" cy="45" r="2.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Ouverts avec un eclat. L'eclat est un petit disque CLAIR pose sur la
     pupille, pas un trou: un trou prendrait la couleur du corps et changerait
     d'aspect d'une humeur a l'autre. */
  sparkle: (
    <>
      <circle cx="36" cy="45" r="6.5" fill="#141216" stroke="none" />
      <circle cx="64" cy="45" r="6.5" fill="#141216" stroke="none" />
      <circle cx="38.4" cy="42.6" r="2.1" fill="#FFFFFF" stroke="none" />
      <circle cx="66.4" cy="42.6" r="2.1" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Deux points. Le degre zero, pour l'humeur qui est le degre zero. */
  dots: (
    <>
      <circle cx="36" cy="45" r="2.4" fill="#141216" stroke="none" />
      <circle cx="64" cy="45" r="2.4" fill="#141216" stroke="none" />
    </>
  ),
  /* Mi-clos, lourds. La paupiere coupe l'oeil en haut. */
  half: (
    <>
      <path d="M29 45h14" />
      <path d="M57 45h14" />
      <path d="M30 41q6-4 12 0" />
      <path d="M58 41q6-4 12 0" />
    </>
  ),
  /**
   * Coins EXTERIEURS tombants: le visage abattu.
   *
   * CES DEUX-LA ETAIENT A L'ENVERS, et ca s'est vu en les regardant:
   * "Discouraged" avait l'air furieux et "Angry" avait l'air inquiet. C'est le
   * SENS de la pente qui nomme l'emotion, pas sa courbure, et une pente
   * inversee ne rend pas un dessin un peu moins bon, elle rend l'autre
   * emotion.
   *
   * Ici l'oeil gauche part BAS a l'exterieur (29,48) et monte vers le nez.
   */
  droop: (
    <>
      <path d="M29 48q7-4 13-6" />
      <path d="M71 48q-7-4-13-6" />
    </>
  ),
  /* Coins INTERIEURS tombants: les sourcils fronces vers le nez. La colere.
     L'oeil gauche part HAUT a l'exterieur (29,41) et descend vers le nez. */
  angry: (
    <>
      <path d="M29 41q7 3 13 7" />
      <path d="M71 41q-7 3-13 7" />
      <circle cx="36" cy="51" r="2.2" fill="#141216" stroke="none" />
      <circle cx="64" cy="51" r="2.2" fill="#141216" stroke="none" />
    </>
  ),
  /* Plisses. La tension, qui n'est pas la colere: rien ne pointe vers le bas,
     tout est serre. */
  squint: (
    <>
      <path d="M30 42l12 6" />
      <path d="M70 42l-12 6" />
    </>
  ),
  /* Un oeil ouvert et une larme dessous. La goutte est une forme pleine, pas
     un cercle: une larme ronde est une bulle. */
  tear: (
    <>
      <path d="M29 44q7 6 14 0" />
      <path d="M57 44q7 6 14 0" />
      <path d="M64 53c2.4 3.3 3.6 5.2 3.6 6.8a3.6 3.6 0 0 1-7.2 0c0-1.6 1.2-3.5 3.6-6.8Z"
            fill="#141216" stroke="none" className="mf-tear" />
    </>
  ),
  /* Des spirales. L'etourdissement, et la seule forme ici qui ne ressemble a
     rien d'anatomique, ce qui est exactement ce qu'on veut dire. */
  /**
   * DEPAREILLES, ET PAS EN SPIRALE.
   *
   * Deux essais en spirale, tous les deux regardes a 56px et tous les deux
   * rates. Le premier bouclait sur 5 unites avec un trait de 3.4: les tours se
   * touchaient, la spirale se remplissait, et ca se lisait comme un gros
   * point. Le deuxieme, plus large et a un tour et demi, se lisait comme un
   * oeil ecarquille avec une boucle dedans, donc comme de la surprise.
   *
   * Le probleme n'etait pas le dessin, c'etait le procede: une spirale demande
   * du detail fin, et il n'y a pas de detail fin a cette taille.
   *
   * L'ASYMETRIE, ELLE, SURVIT A N'IMPORTE QUELLE TAILLE. Un oeil grand ouvert
   * et un oeil plisse sous un sourcil releve: c'est ce que fait un visage qui
   * ne comprend pas, et ca se lit a 16px comme a 160.
   */
  swirl: (
    <>
      <path d="M29 38q7-4 13 0" />
      <path d="M31 46h10" />
      <circle cx="64" cy="45" r="6.5" />
      <circle cx="64" cy="45" r="2.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Les pupilles poussees sur le cote. On regarde ailleurs. */
  away: (
    <>
      <circle cx="36" cy="45" r="6" />
      <circle cx="64" cy="45" r="6" />
      <circle cx="39.4" cy="45" r="2.4" fill="#141216" stroke="none" />
      <circle cx="67.4" cy="45" r="2.4" fill="#141216" stroke="none" />
    </>
  ),
  /* Les pupilles en bas. On regarde ses pieds. */
  down: (
    <>
      <circle cx="36" cy="44" r="6" />
      <circle cx="64" cy="44" r="6" />
      <circle cx="36" cy="48.4" r="2.6" fill="#141216" stroke="none" />
      <circle cx="64" cy="48.4" r="2.6" fill="#141216" stroke="none" />
    </>
  ),
  /* Petits, rentres. On se fait discret. */
  small: (
    <>
      <circle cx="38" cy="46" r="3.2" />
      <circle cx="62" cy="46" r="3.2" />
    </>
  ),
  /* Un ferme serre, un plisse: on encaisse. */
  wince: (
    <>
      <path d="M29 45q7-7 14 0" />
      <path d="M58 42l11 6" />
    </>
  ),
  /* Brillants et hauts: ca monte aux yeux sans encore tomber. */
  glossy: (
    <>
      <circle cx="36" cy="45" r="7" fill="#141216" stroke="none" />
      <circle cx="64" cy="45" r="7" fill="#141216" stroke="none" />
      <circle cx="33.6" cy="42.4" r="2.6" fill="#FFFFFF" stroke="none" />
      <circle cx="61.6" cy="42.4" r="2.6" fill="#FFFFFF" stroke="none" />
      <circle cx="38.8" cy="47.4" r="1.4" fill="#FFFFFF" stroke="none" />
      <circle cx="66.8" cy="47.4" r="1.4" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Un oeil plus ferme que l'autre, et les deux de travers. Le mal au coeur. */
  queasy: (
    <>
      <path d="M29 45q7-6 14 0" />
      <path d="M57 46h14" />
      <path d="M58 41q6-3 12 0" />
    </>
  ),
}

/**
 * LES BOUCHES.
 *
 * Une bouche OUVERTE est une forme pleine et pas un trait: un sourire large
 * dessine au trait est un trait, et il lui manque precisement ce qui fait
 * qu'on le lit comme un rire.
 */
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
  grateful: { eyes: 'soft', mouth: 'softSmile', fx: { eyes: 'fx-blink', mouth: 'fx-lift' } },
  serene: { eyes: 'rest', mouth: 'smile', fx: { eyes: 'fx-settle', mouth: 'fx-lift' } },
  neutral: { eyes: 'dots', mouth: 'flat', fx: { eyes: 'fx-blink', mouth: 'fx-nudge' } },
  nostalgic: { eyes: 'away', mouth: 'softSmile', fx: { eyes: 'fx-glance', mouth: 'fx-lift' } },
  sensitive: { eyes: 'glossy', mouth: 'wobble', fx: { eyes: 'fx-well', mouth: 'fx-tremble' } },
  bored: { eyes: 'half', mouth: 'flat', fx: { eyes: 'fx-droop', mouth: 'fx-nudge' } },
  sick: { eyes: 'queasy', mouth: 'wobble', fx: { eyes: 'fx-roll', mouth: 'fx-tremble' } },
  confused: { eyes: 'swirl', mouth: 'smirk', fx: { eyes: 'fx-spin', mouth: 'fx-nudge' } },
  insecure: { eyes: 'small', mouth: 'tiny', fx: { eyes: 'fx-shrinkface', mouth: 'fx-shrinkface' } },
  stressed: { eyes: 'squint', mouth: 'grit', fx: { eyes: 'fx-tense', mouth: 'fx-clench' } },
  angry: { eyes: 'angry', mouth: 'zigzag', fx: { eyes: 'fx-tense', mouth: 'fx-clench' } },
  discouraged: { eyes: 'droop', mouth: 'frown', fx: { eyes: 'fx-droop', mouth: 'fx-fall' } },
  sad: { eyes: 'tear', mouth: 'bigFrown', fx: { eyes: 'fx-cry', mouth: 'fx-fall' } },
  hurt: { eyes: 'wince', mouth: 'wobble', fx: { eyes: 'fx-squeeze', mouth: 'fx-tremble' } },
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
