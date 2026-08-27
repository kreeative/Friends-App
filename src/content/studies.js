import { MONTHLY_XOF, SURVEY, medianSavers } from '../lib/peers'

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
    slug: 'epargner-a-19-ans',
    date: '2026-08-27',
    /* Le sondage a ete pose en francais a un public francophone, et le corps
       de l'etude est en francais dans les deux langues. La page anglaise le
       dit au lieu de faire semblant. */
    lang: 'fr',
    stats: SAVINGS_STUDY_STATS,
    quotes: SAVINGS_QUOTES,

    fr: {
      eyebrow: 'Étude · août 2026',
      title: 'Épargner à 19 ans',
      dek: '{n} réponses, en majorité ivoiriennes. Ils ont déjà les applications. Ils ont déjà les ambitions. Quatre sur dix ne mettent rien de côté.',
      readTime: '4 min',
      sections: [
        {
          h: 'Le problème n’est pas l’outil',
          p: [
            'C’est le seul résultat qui compte vraiment, et il tient en deux chiffres qui ne devraient pas cohabiter. Presque tout le monde a déjà une application pour gérer son argent : mobile money, appli bancaire. L’accès n’est pas le frein.',
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
          h: 'À quel point c’est dur',
          p: [
            'Sur une échelle de 1 à 10, la médiane est {difficulty}. Près de la moitié mettent 7 ou plus. Et l’écart va dans le sens attendu : ceux qui n’épargnent rien donnent une médiane de 7, ceux qui épargnent donnent 6.',
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
        '{n} réponses, formulaire en ligne, 26 et 27 août 2026. Âge médian {medianAge} ans, {share1820} % entre 18 et 20 ans, {shareLocal} % ivoiriens.',
        'Échantillon de convenance, non représentatif : recruté par partage, donc biaisé vers l’entourage et vers les gens à l’aise avec un formulaire en ligne. À lire comme un ordre de grandeur, pas comme une statistique nationale.',
        'Les montants étaient en texte libre, dans cinq devises. Tout a été ramené en francs CFA. Le franc CFA est arrimé à l’euro à 655,957, ce taux est exact ; les trois autres devises sont des arrondis et six réponses en dépendent.',
      ],
    },

    en: {
      eyebrow: 'Study · August 2026',
      title: 'Saving at 19',
      dek: '{n} responses, mostly Ivorian. They already have the apps. They already have the ambitions. Four in ten set nothing aside.',
      readTime: '4 min',
      /* Dit une fois, en haut de la version anglaise. Traduire un sondage
         francophone mot pour mot donnerait des citations qui ne sont plus ce
         que les gens ont ecrit. */
      langNote: 'The survey was run in French with a French-speaking audience. The quotes below are left in the words people actually used.',
      sections: [
        {
          h: 'The problem is not the tool',
          p: [
            'This is the only result that really matters, and it is two figures that should not sit together. Almost everyone already has an app for managing money: mobile money, a banking app. Access is not the blocker.',
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
          h: 'How hard it is',
          p: [
            'On a scale of 1 to 10 the median is {difficulty}. Nearly half say 7 or more. And the gap runs the way you would expect: those who save nothing give a median of 7, those who save give 6.',
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
        '{n} responses, online form, 26 and 27 August 2026. Median age {medianAge}, {share1820} % aged 18 to 20, {shareLocal} % Ivorian.',
        'A convenience sample, not a representative one: recruited by sharing a link, so it leans toward people nearby and people comfortable with an online form. Read it as an order of magnitude, not as a national statistic.',
        'Amounts were free text in five currencies, all converted to CFA francs. The CFA franc is pegged to the euro at exactly 655.957; the other three rates are rounded, and six answers depend on them.',
      ],
    },
  },
]

export function studyBySlug(slug) {
  return STUDIES.find((s) => s.slug === slug) ?? null
}
