/* Extension explicite : ce fichier est charge par node dans studies.test.mjs,
   qui ne resout pas les imports sans extension comme le fait Vite. Meme
   convention que schedule.js, savings.js et les autres modules testes. */
import { MONTHLY_XOF, SURVEY, byAgeBand, byOutcome, bySex, medianSavers } from '../lib/peers.js'

/**
 * Ce que le site publie en dehors du produit lui-meme.
 *
 * Une etude est un texte court avec des chiffres dedans, lisible sans compte,
 * partageable par son adresse. C'est la reponse a "on pourra publier ca de
 * facon bien propre et claire a titre informatif pour tous".
 *
 * LES CHIFFRES NE SONT PAS ECRITS DANS LE TEXTE.
 *
 * Ils viennent de src/lib/peers.js, qui est la meme source que la comparaison
 * dans l'application. Une page publique qui annonce 41 % pendant que l'app en
 * calcule 40 est pire que pas de page du tout, et c'est exactement ce qui
 * arrive quand un pourcentage est recopie a la main dans un fichier de contenu.
 * Donc rien ici n'est recopie : `stats` est derive, et le texte porte des
 * marqueurs {n} que la page remplit.
 *
 * DEUX LANGUES, UN SEUL JEU DE FAITS.
 *
 * `fr` et `en` ne contiennent que de la prose. Tout ce qui est un nombre est
 * dans `stats`, en dehors des deux, pour qu'une traduction ne puisse pas
 * emporter un chiffre avec elle.
 */

/** Derive, jamais recopie. Voir la note ci-dessus. */
const zeros = MONTHLY_XOF.filter((v) => v === 0).length
const { women, men } = bySex()
const { zero: zeroGroup, saving: savingGroup } = byOutcome()
const bands = byAgeBand()
const band = (id) => bands.find((b) => b.id === id)

export const SAVINGS_STUDY_STATS = {
  n: SURVEY.n,
  hasApp: SURVEY.hasAppPct,
  savesNothing: Math.round((zeros / MONTHLY_XOF.length) * 100),
  savers: MONTHLY_XOF.length - zeros,
  hasAmbition: SURVEY.hasAmbitionPct,
  medianAge: SURVEY.medianAge,
  medianSavers: medianSavers(),
  difficulty: SURVEY.difficultyMedian,
  share1820: SURVEY.share1820,
  shareLocal: SURVEY.shareLocal,
  /* La part de ceux qui ont une ambition et n'epargnent rien. Le seul chiffre
     de cette page qui ne sort pas de peers.js, parce qu'il croise deux
     questions dont une seule y est stockee. Compte a la main sur l'export du
     formulaire : 26 personnes sur les 62 qui ont declare une ambition. */
  ambitionButZero: 42,

  /* --- qui epargne ---------------------------------------------------------
     Tout ce bloc est calcule depuis RESPONDENTS. Rien n'est recopie, donc la
     page publique ne peut pas annoncer un ecart que les donnees ne portent
     plus. Voir la note en haut du fichier. */
  womenN: women.n,
  womenSavePct: women.savePct,
  womenSavers: women.savers,
  womenMedian: women.medianSavers,
  menN: men.n,
  menSavePct: men.savePct,
  menSavers: men.savers,
  menMedian: men.medianSavers,
  /* L'ecart en points de pourcentage, calcule et pas soustrait a la main. */
  gapPoints: women.savePct - men.savePct,
  /* Test exact de Fisher sur le tableau 15/32 contre 23/22 : p = 0,0898. Ecrit
     en "fois sur 100" plutot qu'en "p = 0,09" pour deux raisons. La virgule
     decimale change entre le francais et l'anglais, et un nombre qui traverse
     une traduction est exactement ce que ce fichier interdit. Et "9 fois sur
     100" se lit sans savoir ce qu'est une valeur p. */
  fisherPer100: 9,
  /* Les deux groupes notent la difficulte pareil. C'est un resultat nul, et il
     est publie parce qu'il ferme l'explication la plus facile. */
  hardPct: women.hardPct,
  difficultyZero: zeroGroup.difficulty,
  difficultySaving: savingGroup.difficulty,
  /* La tranche qui porte l'echantillon, et les trois qui ne portent rien. */
  coreN: band('18-20').n,
  coreZeroPct: band('18-20').zeroPct,
  coreMedianSavers: band('18-20').medianSavers,
  bandYoungN: band('15-17').n,
  bandMidN: band('21-24').n,
  bandOldN: band('25+').n,

  /* Les devises. 5 au total ; 6 reponses passent par un taux arrondi, les
     autres sont en francs CFA ou en euros, donc au taux fixe. */
  currencies: 5,
  fxGuessed: 6,
}

/**
 * Les citations. Mot pour mot, avec ce que la meme personne a declare mettre
 * de cote, parce que c'est l'ecart entre les deux qui dit quelque chose.
 *
 * Pas de nom, pas d'initiale, pas de ville. Le formulaire ne demandait rien de
 * tout ca et une page publique n'a pas a rendre identifiable quelqu'un qui a
 * repondu a un lien.
 */
export const SAVINGS_QUOTES = [
  { fr: 'Je veux quitter la maison familiale et quitter le pays.', age: 19, saves: 0 },
  { fr: 'Me lancer dans l’événementiel et acheter du matériel pour mon contenu TikTok.', age: 21, saves: 0 },
  { fr: 'Créer ma propre entreprise.', age: 19, saves: 0 },
  { fr: 'Survivre décembre à Abidjan, c’est chaud.', age: 18, saves: 5000 },
  { fr: 'M’acheter de nouvelles affaires sans avoir à compter sur l’argent de mes parents.', age: 17, saves: 20000 },
  { fr: 'Investir à la BRVM et pouvoir bien en profiter dans 10 ans qu’avec ça.', age: 20, saves: 35000 },
]

export const STUDIES = [
  {
    slug: 'epargner-en-tant-que-jeune',
    /* L'adresse d'avant. Le titre disait "a 19 ans", ce qui est l'age median
       de l'echantillon et pas son sujet : l'etude parle de ce que c'est que
       d'epargner quand on est jeune, pas de ce qui se passe une annee precise.
       L'ancienne adresse reste servie plutot que de casser un lien deja
       partage. Voir studyBySlug. */
    aliases: ['epargner-a-19-ans'],
    date: '2026-08-27',
    /* Le sondage a ete pose en francais a un public francophone, et le corps
       de l'etude est en francais dans les deux langues. La page anglaise le
       dit au lieu de faire semblant. */
    lang: 'fr',
    stats: SAVINGS_STUDY_STATS,
    quotes: SAVINGS_QUOTES,

    fr: {
      eyebrow: 'Étude · août 2026',
      title: 'Épargner en tant que jeune',
      dek: '{n} réponses, en majorité ivoiriennes. Ils ont déjà les applications. Ils ont déjà les ambitions. 4 sur 10 ne mettent rien de côté.',
      readTime: '6 min',
      sections: [
        {
          h: 'Le problème n’est pas l’outil',
          p: [
            'C’est le seul résultat qui compte vraiment, et il tient en 2 chiffres qui ne devraient pas cohabiter. {hasApp} % ont déjà une application pour gérer leur argent : mobile money, appli bancaire. L’accès n’est pas le frein.',
            'Donner à quelqu’un un endroit où ranger son argent ne le fait pas épargner. Cet endroit, il l’a déjà. Ce qui manque est ailleurs.',
          ],
        },
        {
          h: 'Ce n’est pas non plus un manque d’envie',
          p: [
            '{hasAmbition} % déclarent une ambition précise liée à leur épargne, et la plupart ont pris la peine de l’écrire alors que le champ était facultatif. Ce ne sont pas des vœux vagues : monter une boîte, payer ses études, investir à la BRVM, quitter le pays.',
            'Et c’est là que ça se resserre. Parmi ceux qui ont une ambition, {ambitionButZero} % n’épargnent rien. Des gens qui savent exactement pour quoi ils économiseraient, et qui n’économisent pas.',
          ],
        },
        {
          h: 'Les femmes épargnent plus souvent',
          p: [
            'C’est le seul écart net de tout le sondage. {womenSavePct} % des {womenN} femmes mettent quelque chose de côté, contre {menSavePct} % des {menN} hommes. {gapPoints} points d’écart, sur une question à laquelle tout le monde a répondu.',
            'Avec sa marge, parce que {n} personnes ne suffisent pas à trancher : un écart au moins aussi grand apparaîtrait environ {fisherPer100} fois sur 100 même si femmes et hommes étaient réellement identiques. C’est juste au-delà du seuil habituel de 5 sur 100. Fortement suggestif, donc, et pas démontré.',
            'Et l’inverse existe aussi, en plus faible. Parmi ceux qui épargnent, la médiane des hommes est {menMedian}, celle des femmes {womenMedian}. Mais cet écart-là repose sur {womenSavers} femmes et {menSavers} hommes, et il est entièrement dans le bruit. Plus de femmes épargnent ; on ne peut pas dire qui épargne le plus.',
            'Ce qui ne bouge pas d’un groupe à l’autre : la difficulté. Femmes et hommes donnent la même médiane de {difficulty} sur 10, et exactement la même part, {hardPct} %, met 7 ou plus. L’écart de comportement n’est pas un écart de difficulté ressentie, ce qui ferme l’explication la plus facile.',
          ],
        },
        {
          h: 'L’âge, lui, ne sépare rien',
          p: [
            '{share1820} % de l’échantillon a entre 18 et 20 ans, et cette tranche répond comme l’ensemble : {coreZeroPct} % n’épargnent rien, et les épargnants sont à {coreMedianSavers} par mois. Sur les {coreN} personnes qui portent réellement ce sondage, l’âge ne fait pas de différence visible.',
            'Les 3 autres tranches comptent {bandYoungN}, {bandMidN} et {bandOldN} personnes. On peut calculer une médiane sur {bandOldN} personnes. On ne peut pas en tirer une conclusion, et cette page ne le fera pas : elles sont là pour dire qui a répondu, pas pour porter un résultat.',
          ],
        },
        {
          h: 'À quel point c’est dur',
          p: [
            'Sur une échelle de 1 à 10, la médiane est {difficulty}, et {hardPct} % mettent 7 ou plus. L’écart va dans le sens attendu : ceux qui n’épargnent rien donnent une médiane de {difficultyZero}, ceux qui épargnent donnent {difficultySaving}.',
            'Chez les {savers} qui mettent quelque chose de côté, la médiane est {medianSavers} par mois.',
          ],
        },
      ],
      quotesTitle: 'Pour quoi ils épargneraient',
      quotesNote: 'Leurs mots, non retouchés. L’étiquette indique ce que cette même personne a déclaré mettre de côté par mois.',
      savesNothingChip: 'épargne 0',
      perMonth: 'par mois',
      yearsOld: '{n} ans',
      methodTitle: 'Méthode',
      method: [
        '{n} réponses, formulaire en ligne, 26 et 27 août 2026. Âge médian {medianAge} ans, {share1820} % entre 18 et 20 ans, {shareLocal} % ivoiriens, {womenN} femmes et {menN} hommes.',
        'Échantillon de convenance, non représentatif : recruté par partage, donc biaisé vers l’entourage et vers les gens à l’aise avec un formulaire en ligne. À lire comme un ordre de grandeur, pas comme une statistique nationale.',
        'Les montants étaient en texte libre, dans {currencies} devises. Tout a été ramené en francs CFA. Le franc CFA est arrimé à l’euro à 655,957, ce taux est exact ; les 3 autres devises sont des arrondis et {fxGuessed} réponses en dépendent.',
        'Les comparaisons entre groupes portent sur les mêmes {n} réponses, sans pondération ni exclusion. Aucun montant n’a été écarté, y compris les 2 réponses à 1 000 000 : les retirer ne change pas le sens de l’écart entre femmes et hommes, qui tient à la part qui épargne et pas au niveau des montants.',
      ],
    },

    en: {
      eyebrow: 'Study · August 2026',
      title: 'Saving young',
      dek: '{n} responses, mostly Ivorian. They already have the apps. They already have the ambitions. 4 in 10 set nothing aside.',
      readTime: '6 min',
      /* Dit une fois, en haut de la version anglaise. Traduire un sondage
         francophone mot pour mot donnerait des citations qui ne sont plus ce
         que les gens ont ecrit. */
      langNote: 'The survey was run in French with a French-speaking audience. The quotes below are left in the words people actually used.',
      sections: [
        {
          h: 'The problem is not the tool',
          p: [
            'This is the only result that really matters, and it is 2 figures that should not sit together. {hasApp} % already have an app for managing money: mobile money, a banking app. Access is not the blocker.',
            'Giving somebody a place to put their money does not make them save. They already have that place. What is missing is somewhere else.',
          ],
        },
        {
          h: 'It is not a lack of wanting either',
          p: [
            '{hasAmbition} % name a specific ambition tied to their saving, and most wrote it down even though the field was optional. These are not vague wishes: start a business, pay for school, invest on the regional exchange, leave the country.',
            'And this is where it tightens. Among those with an ambition, {ambitionButZero} % save nothing. People who know exactly what they would be saving for, not saving.',
          ],
        },
        {
          h: 'Women save more often',
          p: [
            'It is the one clear gap in the whole survey. {womenSavePct} % of the {womenN} women put something aside, against {menSavePct} % of the {menN} men. {gapPoints} points, on a question everybody answered.',
            'With its margin, because {n} people are not enough to settle it: a gap at least this large would turn up about {fisherPer100} times in 100 even if women and men were really identical. That is just past the usual line of 5 in 100. Strongly suggestive, then, and not proven.',
            'The reverse exists too, more weakly. Among those who save, the men’s median is {menMedian} and the women’s is {womenMedian}. But that gap rests on {womenSavers} women and {menSavers} men, and it sits entirely inside the noise. More women save; which of them saves more is not something this sample can say.',
            'What does not move between women and men is the difficulty. Both give the same median of {difficulty} out of 10, and exactly the same share, {hardPct} %, say 7 or more. The gap in behaviour is not a gap in how hard it feels, which closes off the easiest explanation.',
          ],
        },
        {
          h: 'Age separates nothing',
          p: [
            '{share1820} % of the sample is 18 to 20, and that band answers like the whole: {coreZeroPct} % save nothing, and the ones who save are at {coreMedianSavers} a month. Across the {coreN} people who actually carry this survey, age makes no visible difference.',
            'The other 3 bands hold {bandYoungN}, {bandMidN} and {bandOldN} people. You can compute a median over {bandOldN} people. You cannot draw a conclusion from it, and this page will not: those bands are here to say who answered, not to carry a result.',
          ],
        },
        {
          h: 'How hard it is',
          p: [
            'On a scale of 1 to 10 the median is {difficulty}, and {hardPct} % say 7 or more. The gap runs the way you would expect: those who save nothing give a median of {difficultyZero}, those who save give {difficultySaving}.',
            'Among the {savers} who do put something aside, the median is {medianSavers} a month.',
          ],
        },
      ],
      quotesTitle: 'What they would be saving for',
      quotesNote: 'Their words, untouched. The tag shows what that same person said they set aside each month.',
      savesNothingChip: 'saves 0',
      perMonth: 'a month',
      yearsOld: '{n}',
      methodTitle: 'Method',
      method: [
        '{n} responses, online form, 26 and 27 August 2026. Median age {medianAge}, {share1820} % aged 18 to 20, {shareLocal} % Ivorian, {womenN} women and {menN} men.',
        'A convenience sample, not a representative one: recruited by sharing a link, so it leans toward people nearby and people comfortable with an online form. Read it as an order of magnitude, not as a national statistic.',
        'Amounts were free text in {currencies} currencies, all converted to CFA francs. The CFA franc is pegged to the euro at exactly 655.957; the other 3 rates are rounded, and {fxGuessed} answers depend on them.',
        'The group comparisons use the same {n} responses, unweighted and with nothing dropped. No amount was excluded, including the 2 answers of 1 000 000: removing them does not change the direction of the gap between women and men, which rests on the share who save rather than on the size of the amounts.',
      ],
    },
  },
  /**
   * UN ARTICLE, PAS UNE ETUDE, ET LA DIFFERENCE EST VOLONTAIRE.
   *
   * Il n'y a pas de `stats` ici et pas de `quotes`. Aucun sondage n'a ete fait
   * sur ce sujet, donc il n'y a aucun chiffre a deriver, et la note en haut de
   * ce fichier interdit d'en recopier un a la main. Un pourcentage invente
   * pour remplir un panneau serait exactement la faute que tout le reste de ce
   * fichier est construit pour empecher.
   *
   * Study.jsx rend les panneaux de chiffres et le mur de citations seulement
   * quand ils existent, donc cette entree s'affiche comme du texte.
   *
   * POURQUOI CE TEXTE EXISTE.
   *
   * "Les regles ne devraient pas etre taboues vu que ca nous affecte dans la
   * societe dans laquelle on vit." L'application a un suivi de cycle prive
   * depuis la migration 51, et une note sur la semaine a venir sur l'accueil.
   * Les deux sont des outils. Un outil ne dit pas pourquoi il existe, et le
   * silence autour du sujet est precisement ce qui transforme quelque chose de
   * mensuel et previsible en une surprise chaque mois.
   */
  {
    slug: 'les-regles-ne-sont-pas-un-detail',
    date: '2026-09-03',
    lang: 'fr',

    /**
     * `figures`, DELIBERATELY NOT `stats`.
     *
     * `stats` is the savings survey's derived block, and Study.jsx draws its
     * two number panels and its three dot grids from it by reading hasApp, n
     * and hasAmbition by name. An article that set `stats` would get a panel
     * announcing "undefined %" above its first paragraph. These feed the
     * {markers} in the prose and nothing else.
     *
     * THE RULE AT THE TOP OF THIS FILE STILL APPLIES, FOR A SECOND REASON.
     *
     * There, numbers live outside `fr` and `en` because they are derived from
     * peers.js and a hand-copied percentage would drift from the app. Here
     * they are somebody else's published findings, so there is nothing to
     * drift from, but a figure written into two language blocks can still
     * drift from ITSELF: change 71.1 in the French and not the English and the
     * site quietly says two things. One number, two translations of the
     * sentence around it.
     *
     * EVERY VALUE BELOW IS A PUBLISHED RESULT, NOT AN ESTIMATE. Each one is
     * attributed in `sources`, and the key names say which study it came from
     * so a marker cannot be filled from the wrong paper.
     *
     * NUMBERS, NOT STRINGS, BECAUSE THE SEPARATOR IS PART OF THE LANGUAGE.
     *
     * Written out they would have to be "71,1" in the French and "71.1" in the
     * English, which puts a figure back inside the two language blocks and
     * reintroduces exactly the drift this arrangement exists to prevent. Held
     * as numbers, the value is stored once and Study.jsx formats it for the
     * locale it is rendering, so the decimal comma and the thousands space are
     * a rendering detail rather than a second copy of the data.
     */
    figures: {
      /* Armour et al. 2019, systematic review and meta-analysis. */
      armourStudies: 38,
      armourN: 21573,
      armourPain: 71.1,
      armourMissed: 20.1,
      armourFocus: 40.9,
      /* Schoep et al. 2019, nationwide cross-sectional survey, Netherlands. */
      schoepN: 32748,
      schoepPresent: 80.7,
      schoepDays: 8.9,
      schoepAbsent: 13.8,
      /* Jang, Zhang and Elfenbein 2025, meta-analysis. */
      jangArticles: 102,
      jangN: 3943,
    },

    /**
     * Where each figure came from, printed under the piece.
     *
     * Asked for in those words: use what is published and cite it. A DOI
     * rather than a publisher's page, because a DOI resolves from anywhere and
     * outlives whichever host is serving the PDF this year.
     */
    sources: [
      {
        id: 'armour',
        cite: 'Armour M, Parry K, Manohar N, Holmes K, Ferfolja T, Curry C, MacMillan F, Smith CA (2019). The Prevalence and Academic Impact of Dysmenorrhea in 21,573 Young Women: A Systematic Review and Meta-Analysis. Journal of Women’s Health 28(8), 1161-1171.',
        url: 'https://doi.org/10.1089/jwh.2018.7615',
      },
      {
        id: 'schoep',
        cite: 'Schoep ME et al. (2019). Productivity loss due to menstruation-related symptoms: a nationwide cross-sectional survey among 32 748 women. BMJ Open 9(6), e026186.',
        url: 'https://doi.org/10.1136/bmjopen-2018-026186',
      },
      {
        id: 'jang',
        cite: 'Jang D, Zhang J, Elfenbein HA (2025). Menstrual cycle effects on cognitive performance: A meta-analysis. PLOS ONE.',
        url: 'https://doi.org/10.1371/journal.pone.0318576',
      },
      /* Cited in the language it was published in, like the three above.
         Translating a title or an issuing body is how a reference stops being
         findable, and it is why this block sits outside `fr` and `en`: a
         citation is not prose and must not be localised. */
      {
        id: 'who',
        cite: 'World Health Organization. Menstrual health (fact sheet).',
        url: 'https://www.who.int/news-room/fact-sheets/detail/menstrual-health',
      },
    ],

    fr: {
      eyebrow: 'Article',
      title: 'Les règles ne sont pas un détail privé',
      dek: 'Ça arrive tous les mois, c\u2019est prévisible, et ça change ce qu\u2019une semaine permet de faire. Le seul truc qui est vraiment privé, c\u2019est le silence autour.',
      readTime: '5 min',
      langNote: null,
      sections: [
        {
          h: 'Ce que le silence coûte',
          p: [
            'On planifie un semestre, un lancement, une période d\u2019examens comme si les semaines étaient interchangeables. Elles ne le sont pas, et pour à peu près la moitié des gens elles ne l\u2019ont jamais été. Il y a des jours où la concentration est facile à trouver et des jours où elle coûte cher, et ce n\u2019est pas une question de motivation.',
            'Ce n\u2019est pas une impression. Une revue systématique de {armourStudies} études, portant sur {armourN} jeunes femmes, trouve des règles douloureuses chez {armourPain} % d\u2019entre elles. {armourFocus} % déclarent que ça dégrade leur travail en cours ou leur concentration, et {armourMissed} % ont déjà manqué des cours pour cette raison. Ces chiffres tiennent aussi bien dans les pays riches que dans les autres.',
            'Côté travail, une enquête nationale auprès de {schoepN} femmes aux Pays-Bas donne l\u2019autre moitié du tableau : {schoepPresent} % disent avoir déjà travaillé ou étudié en étant diminuées, ce qui représente environ {schoepDays} jours de productivité perdus par an, contre {schoepAbsent} % qui se sont absentées. Autrement dit, l\u2019essentiel du coût ne se voit pas, parce qu\u2019il est payé par des gens qui sont venus quand même.',
            'Le problème n\u2019est pas le corps. Le problème est qu\u2019on n\u2019a pas le droit d\u2019en parler dans les endroits où les plannings se décident, alors on planifie contre soi-même et on appelle ça de la discipline quand ça casse.',
          ],
        },
        {
          /**
           * La nuance qui empeche ce texte de dire une betise.
           *
           * La pente facile serait "ton cerveau marche moins bien une semaine
           * par mois", et c\u2019est exactement ce que les donnees ne disent pas.
           * Ecrire l\u2019inverse serait reprendre le stereotype qu\u2019on pretend
           * combattre, avec un air de rigueur en plus.
           */
          h: 'Ce qui change, et ce qui ne change pas',
          p: [
            'Il faut être précis, parce que le sujet a servi trop longtemps à dire aux femmes qu\u2019elles étaient moins fiables. Une méta-analyse de {jangArticles} publications, {jangN} participantes au total, ne trouve aucun effet robuste du cycle sur les performances cognitives : ni l\u2019attention, ni la mémoire, ni le raisonnement ne bougent de façon systématique d\u2019une phase à l\u2019autre.',
            'Donc l\u2019argument n\u2019est pas que tu penses moins bien. Tu penses pareil. Ce qui change, c\u2019est la douleur, la fatigue et la place qu\u2019elles prennent, et une journée où une partie de ton attention part ailleurs n\u2019est pas une journée où tu es devenue moins capable. C\u2019est une journée où la même tâche coûte plus cher.',
            'La différence compte, parce que les deux versions mènent à des décisions opposées. La première sert à exclure quelqu\u2019un d\u2019une décision importante. La deuxième sert à mettre la décision importante un autre jour.',
          ],
        },
        {
          h: 'Nommer une chose, ce n\u2019est pas s\u2019excuser',
          p: [
            'Il y a une différence entre "je suis fatiguée, désolée" et "cette semaine-là je mets les tâches lourdes en début de semaine". La première est une excuse, et une excuse demande une permission. La deuxième est une décision de planification, et une décision de planification ne demande rien à personne.',
            'C\u2019est tout ce que le suivi de cycle sert à faire ici. Pas un journal de symptômes, pas une note sur ton humeur. Une phase, et une phrase sur ce qu\u2019elle fait à une semaine de travail.',
          ],
        },
        {
          h: 'Pourquoi ça reste privé quand même',
          p: [
            'Rien de tout ça n\u2019est partagé avec ton groupe. Les tables du cycle ont leurs propres règles d\u2019accès, écrites pour que personne d\u2019autre ne puisse les lire : pas de vue partagée, pas de statistique de groupe, pas de signal "qui a une semaine difficile". Ce n\u2019est pas un réglage à assouplir plus tard, c\u2019est la fonctionnalité.',
            'Sortir un sujet du tabou et le rendre public sont deux choses différentes. Tu peux planifier autour de quelque chose sans le raconter, et c\u2019est exactement l\u2019écart que cette application essaie de tenir : le dire à soi-même, dans un endroit où personne d\u2019autre ne regarde.',
          ],
        },
      ],
      methodTitle: 'D\u2019où ça vient',
      method: [
        'Aucun chiffre de cette page ne vient de nous. Les autres textes de cette section reposent sur notre propre sondage ; celui-ci n\u2019en a pas, donc tout ce qui est avancé ici est repris d\u2019études publiées, listées ci-dessous avec leur DOI pour que ça se vérifie sans nous croire sur parole.',
        'Ce sont des ordres de grandeur, pas des lois. Les enquêtes citées sont déclaratives et recrutées en ligne, ce qui attire davantage les personnes concernées par le sujet, et la revue sur la douleur agrège des études aux définitions variables. La régularité d\u2019un pays à l\u2019autre est ce qui rend le tableau crédible, pas la décimale.',
        'Ce qui est décrit du produit est vérifiable dans le dépôt : le suivi de cycle et ses règles d\u2019accès sont dans supabase/51_calendar_and_cycle.sql, et la note sur la semaine à venir est dans src/components/CycleHeadsUp.jsx.',
      ],
      sourcesTitle: 'Les sources',
    },

    en: {
      eyebrow: 'Article',
      title: 'A period is not a private detail',
      dek: 'It happens every month, it is predictable, and it changes what a week can hold. The only genuinely private part is the silence around it.',
      readTime: '5 min',
      langNote: null,
      sections: [
        {
          h: 'What the silence costs',
          p: [
            'People plan a term, a launch, an exam period as though the weeks were interchangeable. They are not, and for roughly half of everyone they never have been. Some days concentration is easy to find and some days it is expensive, and that is not a question of motivation.',
            'This is not an impression. A systematic review of {armourStudies} studies, covering {armourN} young women, finds painful periods in {armourPain} % of them. {armourFocus} % say it degrades their classroom work or concentration, and {armourMissed} % have missed school or university because of it. The figures hold in wealthy countries and poorer ones alike.',
            'At work, a nationwide survey of {schoepN} women in the Netherlands gives the other half of the picture: {schoepPresent} % report having worked or studied while impaired, worth roughly {schoepDays} days of lost productivity a year, against {schoepAbsent} % who took time off. Most of the cost is invisible, because it is paid by people who turned up anyway.',
            'The body is not the problem. The problem is that it cannot be said out loud in the rooms where plans get made, so people plan against themselves and call it a discipline failure when it breaks.',
          ],
        },
        {
          h: 'What changes, and what does not',
          p: [
            'This needs saying precisely, because the subject has been used for too long to tell women they were less reliable. A meta-analysis of {jangArticles} papers, {jangN} participants in total, finds no robust effect of the cycle on cognitive performance: attention, memory and reasoning do not systematically shift from one phase to another.',
            'So the argument is not that you think less well. You think the same. What changes is pain, tiredness and the room they take up, and a day when part of your attention is elsewhere is not a day when you became less capable. It is a day when the same task costs more.',
            'The difference matters, because the two versions lead to opposite decisions. The first is used to keep somebody out of an important decision. The second is used to put the important decision on another day.',
          ],
        },
        {
          h: 'Naming a thing is not apologising for it',
          p: [
            'There is a difference between "I am tired, sorry" and "that week I put the heavy work at the front". The first is an excuse, and an excuse asks for permission. The second is a scheduling decision, and a scheduling decision asks nobody for anything.',
            'That is all the cycle tracker is for here. Not a symptom log, not a note about your mood. A phase, and a sentence about what it does to a working week.',
          ],
        },
        {
          h: 'Why it stays private anyway',
          p: [
            'None of it is shared with your group. The cycle tables have their own access rules, written so that nobody else can read them: no shared view, no group statistic, no "who is having a rough week" signal. That is not a default to be relaxed later, it is the feature.',
            'Taking a subject out of the taboo and making it public are two different things. You can plan around something without narrating it, and that gap is exactly what this app is trying to hold: saying it to yourself, somewhere nobody else is looking.',
          ],
        },
      ],
      methodTitle: 'Where this comes from',
      method: [
        'None of the figures on this page are ours. The other pieces in this section rest on our own survey; this one has none, so everything claimed here is taken from published studies, listed below with their DOI so it can be checked without taking our word for it.',
        'These are orders of magnitude, not laws. The surveys cited are self-reported and recruited online, which draws in more people who have a stake in the subject, and the pain review pools studies with varying definitions. What makes the picture credible is that it repeats from country to country, not the decimal place.',
        'What it says about the product is checkable in the repository: the cycle tracker and its access rules are in supabase/51_calendar_and_cycle.sql, and the note about the week ahead is in src/components/CycleHeadsUp.jsx.',
      ],
      sourcesTitle: 'Sources',
    },
  },
]

/**
 * Une etude par son adresse, actuelle ou ancienne.
 *
 * Renommer une etude change son adresse, et une adresse deja partagee ne doit
 * pas cesser de marcher parce qu'on a trouve un meilleur titre. Les anciennes
 * sont listees dans `aliases` et menent a la meme page.
 */
export function studyBySlug(slug) {
  return (
    STUDIES.find((s) => s.slug === slug)
    ?? STUDIES.find((s) => (s.aliases ?? []).includes(slug))
    ?? null
  )
}
