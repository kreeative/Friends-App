/**
 * The formation: six short lessons on how to build a budget.
 *
 * WRITTEN HERE, NOT COPIED.
 *
 * The ask was to take inspiration from McGill's free personal finance course.
 * Inspiration is the operative word: what follows is original text covering the
 * same ground that any decent introduction covers, and McGill Personal Finance
 * Essentials is credited at the end as further reading because it is genuinely
 * free and genuinely good. Nothing here is lifted from it, and the app does not
 * claim any affiliation with it.
 *
 * WHY THIS IS DATA AND NOT SIX COMPONENTS.
 *
 * Every lesson has exactly the same shape, so the shape belongs in one place
 * and the words belong in another. It also means the whole course is
 * translatable by editing one file, and that a seventh lesson is an object
 * rather than a route.
 *
 * The prose is deliberately short. This sits inside a budgeting app, not a
 * textbook, and a lesson that takes longer to read than the budget takes to fix
 * is a lesson nobody finishes. Two minutes each, six lessons, and every one of
 * them ends in something to actually do.
 *
 * Accented French, and the app's own curly apostrophe. The ASCII rule in
 * CLAUDE.md is about SQL travelling through a clipboard into a Postgres editor;
 * this is app copy rendered from a UTF-8 bundle, and unaccented French on
 * screen reads as a bug.
 *
 * `pane` is the part of the budget the lesson is about, so the end of a lesson
 * can be a button that opens it rather than an instruction to go and find it.
 * Reading about envelopes and then being dropped back at a table of contents is
 * how a course becomes something you did once.
 */

export const LESSONS = [
  {
    id: 'where',
    minutes: 2,
    pane: 'log',
    fr: {
      title: 'Où va ton argent',
      summary: 'Avant de décider quoi que ce soit, il faut regarder.',
      body: [
        'Presque personne ne sait où passe son argent. Ce n’est pas un défaut de caractère, c’est une question de format : une carte de débit ne laisse aucune trace dans la mémoire, et trente petites dépenses se retiennent beaucoup moins bien qu’une grosse.',
        'La première étape n’est donc pas de couper quoi que ce soit. C’est de noter, pendant un mois complet, tout ce qui sort. Un mois, parce que le loyer, l’électricité et l’abonnement annuel ne tombent pas tous la même semaine.',
        'Au bout de trente jours, tu auras un chiffre par catégorie. Ce chiffre est presque toujours une surprise, et c’est la surprise qui fait le travail : personne ne change une habitude qu’il croit déjà sous contrôle.',
      ],
      takeaway: 'Note tout pendant trente jours. Ne coupe rien avant la fin.',
    },
    en: {
      title: 'Where your money goes',
      summary: 'Before deciding anything, look.',
      body: [
        'Almost nobody knows where their money goes. That is not a character flaw, it is a format problem: a debit card leaves no trace in memory, and thirty small purchases are much harder to recall than one large one.',
        'So the first step is not to cut anything. It is to write down everything that leaves, for one full month. A month, because rent, electricity and the annual subscription do not all land in the same week.',
        'After thirty days you will have a number per category. That number is almost always a surprise, and the surprise is what does the work: nobody changes a habit they believe is already under control.',
      ],
      takeaway: 'Log everything for thirty days. Cut nothing until the end.',
    },
  },
  {
    id: 'buckets',
    minutes: 2,
    pane: 'plan',
    fr: {
      title: 'Besoins, envies, engagements',
      summary: 'Trois piles, et une seule sur laquelle tu peux agir ce soir.',
      body: [
        'Une dépense tombe dans une de trois piles. Les engagements sont déjà promis à quelqu’un d’autre : loyer, prêt, assurance, abonnement en cours. Les besoins sont ce qui te garde en vie et au travail : nourriture, transport, médicaments. Les envies sont tout le reste.',
        'La distinction utile n’est pas morale, elle est pratique : les trois piles ont des délais différents. Une envie se change ce soir. Un besoin se change en changeant d’habitude, sur des semaines. Un engagement se change en résiliant quelque chose, parfois avec trois mois de préavis.',
        'C’est pour cela qu’un budget qui commence par « je vais moins sortir » échoue si souvent. La pile la plus visible est la plus petite, et la plus grosse est celle que personne ne regarde parce qu’elle est déjà signée.',
      ],
      takeaway: 'Regarde tes engagements en premier. C’est là que se cachent les grosses sommes.',
    },
    en: {
      title: 'Needs, wants, commitments',
      summary: 'Three piles, and only one you can really act on tonight.',
      body: [
        'Every expense falls into one of three piles. Commitments are already promised to somebody else: rent, loan, insurance, a running subscription. Needs keep you alive and working: food, transport, medication. Wants are everything else.',
        'The useful distinction is not a moral one, it is a timing one. A want changes tonight. A need changes by changing a habit, over weeks. A commitment changes by cancelling something, sometimes with three months of notice.',
        'That is why a budget starting with "I will go out less" fails so often. The most visible pile is the smallest one, and the biggest is the one nobody looks at because it is already signed.',
      ],
      takeaway: 'Look at your commitments first. That is where the large numbers hide.',
    },
  },
  {
    id: 'fifty',
    minutes: 2,
    pane: 'envelopes',
    fr: {
      title: 'La règle 50 / 30 / 20',
      summary: 'Un point de départ, pas une loi.',
      body: [
        'Une répartition souvent citée : la moitié de ce qui rentre pour les besoins et les engagements, trente pour cent pour les envies, vingt pour cent pour l’épargne et le remboursement des dettes.',
        'Son intérêt n’est pas la précision des chiffres. C’est qu’elle donne une forme à viser quand on part de rien, et qu’elle rend un déséquilibre visible en dix secondes : si le logement seul prend quarante pour cent, aucune discipline sur les cafés ne rattrapera l’écart.',
        'Elle ne marche pas partout. Dans une ville où le loyer prend la moitié du revenu à lui seul, viser 50 est une source de culpabilité plutôt qu’un plan. Prends-la comme un miroir : là où tu t’en écartes beaucoup, il y a une question à poser.',
      ],
      takeaway: 'Compare ta répartition à 50 / 30 / 20 une fois. Puis fixe la tienne.',
    },
    en: {
      title: 'The 50 / 30 / 20 rule',
      summary: 'A starting shape, not a law.',
      body: [
        'A commonly quoted split: half of what comes in for needs and commitments, thirty percent for wants, twenty percent for savings and paying down debt.',
        'Its value is not the precision of the numbers. It is that it gives you a shape to aim at when you are starting from nothing, and that it makes an imbalance visible in ten seconds: if housing alone takes forty percent, no amount of discipline about coffee closes the gap.',
        'It does not work everywhere. In a city where rent alone takes half your income, aiming at 50 is a source of guilt rather than a plan. Treat it as a mirror: wherever you are far off it, there is a question worth asking.',
      ],
      takeaway: 'Compare your split to 50 / 30 / 20 once. Then set your own.',
    },
  },
  {
    id: 'first',
    minutes: 2,
    pane: 'savings',
    fr: {
      title: 'Paie-toi en premier',
      summary: 'Ce qui reste à la fin du mois, c’est zéro. Toujours.',
      body: [
        'Épargner ce qui reste ne marche pas, parce qu’il ne reste jamais rien. La dépense s’ajuste toujours à ce qui est disponible, et ce qui est disponible, c’est tout ce qu’il y a sur le compte.',
        'La solution tient en une inversion : le montant part le jour de la paie, pas le dernier jour du mois. Une fois qu’il est parti, le budget se fait avec ce qui reste, et la tête s’adapte à ce chiffre en un ou deux mois.',
        'Commence petit. Vingt-cinq dollars qui partent tous les mois pendant deux ans battent deux cents dollars qui partent trois fois puis s’arrêtent. Le montant compte moins que le fait que ce soit automatique.',
      ],
      takeaway: 'Fixe un montant, même petit, et fais-le partir le jour de la paie.',
    },
    en: {
      title: 'Pay yourself first',
      summary: 'What is left at the end of the month is zero. It always is.',
      body: [
        'Saving what is left does not work, because nothing is ever left. Spending expands to fit what is available, and what is available is whatever is in the account.',
        'The fix is one inversion: the money leaves on payday, not on the last day of the month. Once it is gone, the budget runs on what remains, and your head adjusts to that number within a month or two.',
        'Start small. Twenty-five dollars leaving every month for two years beats two hundred dollars leaving three times and then stopping. The amount matters less than the fact that it is automatic.',
      ],
      takeaway: 'Pick an amount, however small, and make it leave on payday.',
    },
  },
  {
    id: 'cushion',
    minutes: 2,
    pane: 'savings',
    fr: {
      title: 'Le coussin d’urgence',
      summary: 'Trois mois de dépenses, disponibles tout de suite.',
      body: [
        'Un coussin d’urgence n’est pas un placement. Son travail est d’absorber un choc : une perte d’emploi, une réparation, un billet d’avion à prendre le jour même. Il doit donc être disponible immédiatement, et il ne doit pas pouvoir baisser tout seul.',
        'La cible habituelle est de trois mois de dépenses, pas de revenus. La nuance est importante : ce que tu dois pouvoir tenir, c’est ton train de vie, et il est presque toujours plus bas que ton salaire.',
        'Avant le coussin, une seule chose passe devant : une dette à taux élevé. Une carte de crédit à vingt pour cent coûte plus cher que n’importe quel compte d’épargne ne rapporte, donc l’ordre est dette chère, puis coussin, puis le reste.',
      ],
      takeaway: 'Vise trois mois de dépenses. Garde-les séparés et accessibles.',
    },
    en: {
      title: 'The emergency cushion',
      summary: 'Three months of spending, available immediately.',
      body: [
        'An emergency cushion is not an investment. Its job is to absorb a shock: losing work, a repair, a flight you have to take the same day. So it has to be available immediately, and it must not be able to go down on its own.',
        'The usual target is three months of spending, not of income. That distinction matters: what you need to be able to cover is your way of living, and that is almost always lower than your salary.',
        'One thing comes before the cushion: expensive debt. A credit card at twenty percent costs more than any savings account pays, so the order is expensive debt, then the cushion, then everything else.',
      ],
      takeaway: 'Aim for three months of spending. Keep it separate and reachable.',
    },
  },
  {
    id: 'compound',
    minutes: 2,
    pane: 'savings',
    fr: {
      title: 'Le temps fait le travail',
      summary: 'Les intérêts composés récompensent la durée plus que le montant.',
      body: [
        'Un intérêt composé est un intérêt qui gagne lui-même des intérêts. Sur un an, la différence est invisible. Sur vingt ans, elle est plus grande que tout ce que tu auras versé.',
        'Une façon rapide de le sentir : à sept pour cent par an, une somme double en une dizaine d’années. Autrement dit, mille dollars placés à vingt-cinq ans valent plusieurs fois ce que les mêmes mille dollars valent placés à quarante-cinq.',
        'La conclusion pratique n’est pas de chercher un meilleur rendement. C’est de commencer plus tôt, même avec presque rien, parce que la variable qui compte le plus est la seule que personne ne peut racheter plus tard.',
      ],
      takeaway: 'Commencer tôt vaut mieux que commencer gros.',
    },
    en: {
      title: 'Time does the work',
      summary: 'Compound interest rewards duration more than size.',
      body: [
        'Compound interest is interest that earns interest of its own. Over one year the difference is invisible. Over twenty it is larger than everything you paid in.',
        'A quick way to feel it: at seven percent a year, a sum roughly doubles in about a decade. Which means a thousand dollars invested at twenty-five is worth several times what the same thousand dollars is worth invested at forty-five.',
        'The practical conclusion is not to hunt for a better return. It is to start earlier, even with almost nothing, because the variable that matters most is the one nobody can buy back later.',
      ],
      takeaway: 'Starting early beats starting big.',
    },
  },
]

/**
 * Further reading, credited rather than reproduced.
 *
 * Real, free, and the thing the ask pointed at. Named as somebody else's work,
 * with no logo, no excerpt and no implied endorsement in either direction.
 */
export const FURTHER = {
  fr: {
    label: 'Pour aller plus loin',
    body: 'McGill Personal Finance Essentials est un cours en ligne gratuit et sans publicité, offert par l’Université McGill. Les six leçons ci-dessus ont été écrites pour cette application et ne viennent pas de ce cours.',
  },
  en: {
    label: 'Further reading',
    body: 'McGill Personal Finance Essentials is a free online course with no advertising, offered by McGill University. The six lessons above were written for this app and are not taken from it.',
  },
}

/** The lesson, in the reader's language, falling back rather than blanking. */
export function lessonIn(lesson, locale) {
  return lesson?.[locale] ?? lesson?.fr ?? null
}

/** How far through the course somebody is. */
export function progress(readIds = []) {
  const read = new Set(readIds)
  const done = LESSONS.filter((l) => read.has(l.id)).length
  return { done, total: LESSONS.length, pct: Math.round((done / LESSONS.length) * 100) }
}

/**
 * The next lesson worth opening.
 *
 * The first unread one in order, or null when the course is finished. In order
 * rather than by any cleverer rule, because the six build on each other: the
 * cushion lesson assumes you know what "three months of spending" means, and
 * that is the lesson before it.
 */
export function nextLesson(readIds = []) {
  const read = new Set(readIds)
  return LESSONS.find((l) => !read.has(l.id)) ?? null
}
