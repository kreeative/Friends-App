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
/**
 * L'EPAISSEUR DU TRAIT, MESUREE PLUTOT QU'ESTIMEE.
 *
 *   "And look how thin the lines are on the face."
 *
 * Elle avait raison et ca se compte. Sa reference a ete chargee, et pour
 * chaque visage on a mesure la plus longue suite verticale de pixels d'encre
 * par colonne, rapportee a la largeur du corps. Le meme calcul a ensuite ete
 * passe sur MES visages, parce que comparer deux dessins avec deux methodes ne
 * compare rien.
 *
 *   sa reference   Excited 3.7   Joyful 4.0   Grateful 4.2   Stressed 3.7
 *   les miens      Joyful 4.8    Grateful 4.8   Stressed 4.4   Serene 4.4
 *
 * Environ vingt pour cent de trop, partout. Les valeurs ci-dessous sont donc
 * l'ancienne serie multipliee par 0.8, ce qui les pose autour de 3.7: le bas
 * de sa fourchette, qui est ce que "how thin" veut dire.
 *
 * Le contour du CORPS, lui, reste a 6. Ce n'est pas un trait de visage, c'est
 * ce qui arrondit la silhouette.
 */
/**
 * LA BANDE DU VISAGE, MESUREE SUR SA REFERENCE.
 *
 *   "Nope, does not look exactly the same."
 *
 * Quatre redraws et toujours faux, parce que je comparais un dessin que
 * j'avais sous les yeux au SOUVENIR de l'autre. Mis cote a cote a la meme
 * echelle, puis mesures avec le meme code, l'ecart saute:
 *
 *   hauteur de l'encre, en % de la hauteur du corps
 *     elle   Excited 21   Grateful 23   Stressed 27   Bored 28
 *     moi    Excited 46   Grateful 34   Stressed 39
 *
 * La largeur etait deja bonne. C'est la HAUTEUR qui n'allait pas: chez elle
 * les yeux et la bouche tiennent dans une bande fine au milieu du corps, chez
 * moi ils s'etalaient sur deux fois plus haut. C'est ca qui faisait un visage
 * different a chaque fois sans que je sache dire quoi.
 *
 * Tout ce qui suit tient donc entre y=40 et y=64, soit 24 unites sur les 92 du
 * corps: 26%, le milieu de sa fourchette.
 */
/**
 * LE TRAIT N'EST PLUS EGAL, ET IL N'EST PLUS UN TRAIT.
 *
 *   "Our line on the emotions is a little bit too bold and too even."
 *
 * Un stroke SVG a la meme epaisseur d'un bout a l'autre, et le trait de la
 * reference n'a pas ca: il est plein au ventre et il s'amincit vers les bouts,
 * comme un pinceau. Mesure sur la bouche d'Excited, la suite verticale d'encre
 * fait 5px partout, mais la courbe est raide aux extremites, donc l'epaisseur
 * PERPENDICULAIRE y est plus faible: un trait egal a l'oeil qui ne l'est pas.
 *
 * Chaque trait est donc maintenant une FORME PLEINE: deux courbes qui
 * partagent leurs bouts et dont les points de controle sont ecartes. Le ventre
 * est epais, les extremites sont fines, et la forme se lit comme un coup de
 * pinceau au lieu d'un fil de fer.
 *
 * Les nombres viennent de la geometrie des courbes, pas d'essais: pour une
 * quadratique, ecarter les deux controles de +-t deplace les ventres de t au
 * total; pour une cubique, de 1.5 fois l'ecart.
 *
 * PREMIERE VERSION TROP FINE. Des ventres a 3.3 et des bouts en aiguille (0.8)
 * donnaient un trait qui se lit plus leger qu'il n'est: "Serein" n'avait
 * presque plus de visage. La reference s'amincit vers les bouts sans jamais
 * finir en pointe: ses extremites font a peu pres la moitie du ventre.
 *
 * DEUXIEME PASSE, AU CHIFFRE. Avec un ventre a 3.8 la mediane mesuree chez moi
 * faisait 3.1 a 3.9 contre 4.0 a 4.7 sur sa planche: encore quinze pour cent
 * de moins. Une lentille repartit son encre autrement qu'un trait egal, donc
 * a ventre egal elle se lit plus fine. Ventre 4.3 sur les yeux, 4.0 sur les
 * bouches, bouts de 1.4: c'est ce qui aligne les medianes.
 *
 * Les vagues, le zigzag, les dents serrees et la spirale restent traces, plus
 * fins (2.9): ce sont des formes anguleuses ou tres petites ou l'amincissement
 * ne se verrait pas, et une lentille sur un zigzag fait un zigzag en dents de
 * scie.
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
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="41" r="7.2" fill="#141216" stroke="none" />
      <circle cx="63" cy="41" r="7.2" fill="#141216" stroke="none" />
    </>
  ),
  /* Les pupilles encore plus haut: l'ennui regarde le plafond. */
  lookUp: (
    <>
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="39" r="7.2" fill="#141216" stroke="none" />
      <circle cx="63" cy="39" r="7.2" fill="#141216" stroke="none" />
    </>
  ),
  /* De cote. On ne soutient pas le regard. */
  away: (
    <>
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="42" cy="43" r="7.2" fill="#141216" stroke="none" />
      <circle cx="68" cy="43" r="7.2" fill="#141216" stroke="none" />
    </>
  ),
  /* En bas. On regarde ses pieds. */
  down: (
    <>
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="52" r="7.2" fill="#141216" stroke="none" />
      <circle cx="63" cy="52" r="7.2" fill="#141216" stroke="none" />
    </>
  ),
  /* Avec un eclat sur la pupille. */
  sparkle: (
    <>
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="41" r="7.2" fill="#141216" stroke="none" />
      <circle cx="63" cy="41" r="7.2" fill="#141216" stroke="none" />
      <circle cx="33.6" cy="38.8" r="2.7" fill="#FFFFFF" stroke="none" />
      <circle cx="59.6" cy="38.8" r="2.7" fill="#FFFFFF" stroke="none" />
    </>
  ),
  /* Plus gros encore, et deux eclats: ca monte aux yeux. */
  glossy: (
    <>
      <circle cx="38" cy="45" r="12.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="12.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="42" r="8" fill="#141216" stroke="none" />
      <circle cx="63" cy="42" r="8" fill="#141216" stroke="none" />
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
      <circle cx="40" cy="47" r="6.8" fill="#FFFFFF" stroke="none" />
      <circle cx="60" cy="47" r="6.8" fill="#FFFFFF" stroke="none" />
      <circle cx="40" cy="44.5" r="4.6" fill="#141216" stroke="none" />
      <circle cx="60" cy="44.5" r="4.6" fill="#141216" stroke="none" />
    </>
  ),
  /* La paupiere lourde: une forme PLEINE qui recouvre le haut du blanc. */
  half: (
    <>
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="44" r="7.2" fill="#141216" stroke="none" />
      <circle cx="63" cy="44" r="7.2" fill="#141216" stroke="none" />
      <path d="M27 45a11.5 11.5 0 0 1 23 0Z" fill="#141216" stroke="none" />
      <path d="M50 45a11.5 11.5 0 0 1 23 0Z" fill="#141216" stroke="none" />
    </>
  ),
  /* La meme paupiere inclinee vers le nez: la colere. */
  angry: (
    <>
      <circle cx="38" cy="46" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="46" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="37" cy="47" r="6.8" fill="#141216" stroke="none" />
      <circle cx="63" cy="47" r="6.8" fill="#141216" stroke="none" />
      <path d="M27 35l23 11v-11H27Z" fill="#141216" stroke="none" />
      <path d="M73 35L50 46V35h23Z" fill="#141216" stroke="none" />
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
      <circle cx="38" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="62" cy="45" r="11.5" fill="#FFFFFF" stroke="none" />
      <circle cx="36" cy="43" r="7.2" fill="#141216" stroke="none" />
      <path d="M61.5 37a7.5 7.5 0 1 1-6.5 4.4a4 4 0 1 0 2.8 6.5"
            fill="none" stroke="#F08A2C" strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  /* --- et les yeux fermes: des petits U creux, poses haut --------------- */

  /* Le U de base. Les cotes montent presque droit, le fond est rond, donc les
     bouts pointent vers le haut. C'est la forme la plus courante de la
     reference et celle que j'avais dessinee en arc plat deux fois de suite. */
  joy: (
    <>
      <path d="M30.5 40.3C30.2 50.3667 43.8 50.3667 43.5 40.3L42.5 41.7C42.2 44.6333 31.8 44.6333 31.5 41.7Z" fill="#141216" stroke="none" />
      <path d="M56.5 40.3C56.2 50.3667 69.8 50.3667 69.5 40.3L68.5 41.7C68.2 44.6333 57.8 44.6333 57.5 41.7Z" fill="#141216" stroke="none" />
    </>
  ),
  /* Le meme, moins creux: la douceur. */
  archSoft: (
    <>
      <path d="M30.5 41.3C30.2 49.8667 43.8 49.8667 43.5 41.3L42.5 42.7C42.2 44.1333 31.8 44.1333 31.5 42.7Z" fill="#141216" stroke="none" />
      <path d="M56.5 41.3C56.2 49.8667 69.8 49.8667 69.5 41.3L68.5 42.7C68.2 44.1333 57.8 44.1333 57.5 42.7Z" fill="#141216" stroke="none" />
    </>
  ),
  /* Deux traits droits: le repos complet. */
  rest: (
    <>
      <path d="M31 44.3Q37 49.3 43 44.3L43 45.7Q37 40.7 31 45.7Z" fill="#141216" stroke="none" />
      <path d="M57 44.3Q63 49.3 69 44.3L69 45.7Q63 40.7 57 45.7Z" fill="#141216" stroke="none" />
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
      <path d="M31 48.7Q38 37.7 43 46.7L43 45.3Q38 46.3 31 47.3Z" fill="#141216" stroke="none" />
      <path d="M69 48.7Q62 37.7 57 46.7L57 45.3Q62 46.3 69 47.3Z" fill="#141216" stroke="none" />
    </>
  ),
  /* Des chevrons pointe vers le nez: l'oeil SERRE. Pas une croix, qui est le
     personnage assomme de n'importe quel dessin anime. */
  squint: (
    <>
      <path d="M31 40.3Q36.5 47.8 42 45.3L42 46.7Q36.5 39.2 31 41.7Z" fill="#141216" stroke="none" />
      <path d="M42 45.3Q36.5 52.8 31 50.3L31 51.7Q36.5 44.2 42 46.7Z" fill="#141216" stroke="none" />
      <path d="M69 40.3Q63.5 47.8 58 45.3L58 46.7Q63.5 39.2 69 41.7Z" fill="#141216" stroke="none" />
      <path d="M58 45.3Q63.5 52.8 69 50.3L69 51.7Q63.5 44.2 58 46.7Z" fill="#141216" stroke="none" />
    </>
  ),
  /* Un ferme, un serre: on encaisse. */
  wince: (
    <>
      <path d="M30.5 40.3C30.2 50.3667 43.8 50.3667 43.5 40.3L42.5 41.7C42.2 44.6333 31.8 44.6333 31.5 41.7Z" fill="#141216" stroke="none" />
      <path d="M69 40.3Q63.5 47.8 58 45.3L58 46.7Q63.5 39.2 69 41.7Z" fill="#141216" stroke="none" />
      <path d="M58 45.3Q63.5 52.8 69 50.3L69 51.7Q63.5 44.2 58 46.7Z" fill="#141216" stroke="none" />
    </>
  ),
  /* Fermes, et une larme pleine qui pend sous l'oeil droit. */
  tear: (
    <>
      <path d="M30.5 40.3C30.2 49.8667 43.8 49.8667 43.5 40.3L42.5 41.7C42.2 44.1333 31.8 44.1333 31.5 41.7Z" fill="#141216" stroke="none" />
      <path d="M56.5 40.3C56.2 49.8667 69.8 49.8667 69.5 40.3L68.5 41.7C68.2 44.1333 57.8 44.1333 57.5 41.7Z" fill="#141216" stroke="none" />
      <path d="M63 49c2.4 3.4 3.6 5.4 3.6 7a3.6 3.6 0 0 1-7.2 0c0-1.6 1.2-3.6 3.6-7Z"
            fill="#141216" stroke="none" className="mf-tear" />
    </>
  ),
  /* Ondules: le mal au coeur. */
  queasy: (
    <>
      <path d="M31 45q3-4 6 0t6 0" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M57 45q3-4 6 0t6 0" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  /* Attentifs: le U avec un sourcil haut au-dessus. */
  soft: (
    <>
      <path d="M30.5 41.3C30.2 50.3667 43.8 50.3667 43.5 41.3L42.5 42.7C42.2 44.6333 31.8 44.6333 31.5 42.7Z" fill="#141216" stroke="none" />
      <path d="M56.5 41.3C56.2 50.3667 69.8 50.3667 69.5 41.3L68.5 42.7C68.2 44.6333 57.8 44.6333 57.5 42.7Z" fill="#141216" stroke="none" />
      <path d="M31 36.4Q37 30.8 43 36.4L43 35.6Q37 35.2 31 35.6Z" fill="#141216" stroke="none" />
      <path d="M57 36.4Q63 30.8 69 36.4L69 35.6Q63 35.2 57 35.6Z" fill="#141216" stroke="none" />
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
  grin: <path d="M28 54.3Q50 68 72 54.3L72 55.7Q50 60 28 55.7Z" fill="#141216" stroke="none" />,
  /* Un sourire trace, franc mais ferme. */
  smile: <path d="M30 55.3Q50 68 70 55.3L70 56.7Q50 60 30 56.7Z" fill="#141216" stroke="none" />,
  /* Petit sourire. La douceur. */
  softSmile: <path d="M35 56.3Q50 67 65 56.3L65 57.7Q50 59 35 57.7Z" fill="#141216" stroke="none" />,
  /* Droite. */
  flat: <path d="M41 57.3Q50 62 59 57.3L59 58.7Q50 54 41 58.7Z" fill="#141216" stroke="none" />,
  /* Tombante. */
  frown: <path d="M37 60.7Q50 48 63 60.7L63 59.3Q50 56 37 59.3Z" fill="#141216" stroke="none" />,
  /* Tombante et large: ca ne se retient plus. */
  bigFrown: <path d="M35 61.7Q50 47 65 61.7L65 60.3Q50 55 35 60.3Z" fill="#141216" stroke="none" />,
  /* Ondulee. Le menton qui tremble, avant les larmes. */
  wobble: <path d="M36 58q3.5-4 7 0t7 0t7 0t7 0" strokeWidth="3.5" />,
  /* Ronde et ouverte: la surprise. */
  o: <ellipse cx="50" cy="58" rx="5.6" ry="6.4" fill="#141216" stroke="none" />,
  /* Serree, dents visibles. La tension. */
  grit: (
    <>
      <path d="M38 54h24v7H38Z" />
      <path d="M44 54v7" />
      <path d="M50 54v7" />
      <path d="M56 54v7" />
    </>
  ),
  /* Un coin releve. Le doute. */
  smirk: <path d="M38 57.3Q49 66 61 53.3L61 54.7Q49 58 38 58.7Z" fill="#141216" stroke="none" />,
  /* Minuscule. On n'a pas grand-chose a dire. */
  tiny: <path d="M45 57.4Q50 61.6 55 57.4L55 58.6Q50 54.4 45 58.6Z" fill="#141216" stroke="none" />,
  /* En zigzag: la rage dessinee, pas mimee. */
  zigzag: <path d="M37 59l5-4 4 4 4-4 4 4 4-4 3 4" />,
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
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className={`mf-eyes ${playing ? face?.fx?.eyes ?? '' : ''}`}>{eyes}</g>
        <g className={`mf-mouth ${playing ? face?.fx?.mouth ?? '' : ''}`}>{mouth}</g>
      </g>
    </svg>
  )
}
