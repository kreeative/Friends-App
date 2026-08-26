/**
 * The formation: six modules on running a zero-based budget.
 *
 * The French is the copy as supplied, with two dictation slips corrected:
 * module 4 said "vends immédiatement 10 % à 20 % vers ton compte d'épargne",
 * where "vends" (sell) is not what moving money to savings is called, and its
 * exercise said "un virement automatique automatique". Both are typing, not
 * intent, and leaving them in would have shipped them.
 *
 * WHY THIS IS DATA AND NOT SIX COMPONENTS.
 *
 * Every module has exactly the same shape, so the shape belongs in one place
 * and the words belong in another. A seventh module is an object rather than a
 * route, and the whole course is translatable by editing one file.
 *
 * THE SHAPE OF A MODULE.
 *
 *   concept   one line: what this is about. Sits under the title.
 *   body      the teaching, as separate points rather than a wall.
 *   exercise  the thing to actually go and do. Every module ends in one,
 *             because a lesson that ends in agreement changes nothing.
 *
 * Accented French and the app's own curly apostrophe. The ASCII rule in
 * CLAUDE.md is about SQL travelling through a clipboard into a Postgres
 * editor; this is app copy from a UTF-8 bundle, and unaccented French on
 * screen reads as a bug.
 *
 * `pane` is the part of the budget the module is about, so a module can end in
 * a button that opens it. A course that ends by returning you to a table of
 * contents is a course you did once.
 */

export const LESSONS = [
  {
    id: 'where',
    minutes: 2,
    pane: 'envelopes',
    fr: {
      title: 'Où va ton argent ?',
      concept: 'La clarté avant la décision.',
      body: [
        'Pour reprendre le contrôle de tes finances, il ne faut pas commencer par te priver, mais par observer.',
        'La plupart des gens ne savent pas exactement où passent leurs petites dépenses quotidiennes. L’objectif de cette première étape est de faire un audit transparent de tes entrées et sorties d’argent.',
        'La méthode du budget à base zéro : chaque dollar a un rôle. Revenus moins dépenses égale zéro. Si tu as 1 000 $ qui rentrent, 1 000 $ doivent être attribués, que ce soit au loyer, à la nourriture ou à l’épargne.',
      ],
      exercise: 'Note 100 % de tes transactions pendant 7 jours, sans te juger.',
    },
    en: {
      title: 'Where your money goes',
      concept: 'Clarity before decisions.',
      body: [
        'Taking back control of your money does not start with going without. It starts with looking.',
        'Most people do not know where their small daily spending actually goes. The job of this first step is an honest audit of what comes in and what leaves.',
        'The zero-based budget: every dollar has a job. Income minus spending equals zero. If 1,000 comes in, 1,000 gets assigned, whether to rent, to food or to savings.',
      ],
      exercise: 'Log 100 % of your transactions for 7 days, without judging any of them.',
    },
  },
  {
    id: 'buckets',
    minutes: 2,
    pane: 'plan',
    fr: {
      title: 'Besoins, envies et engagements',
      concept: 'Faire la distinction entre ce qui est vital et ce qui est optionnel.',
      body: [
        'Les engagements et les besoins sont tes charges fixes indispensables : loyer, électricité, transport principal, épicerie de base. Tu dois les honorer chaque mois.',
        'Les envies sont les sorties, les abonnements, les vêtements, les cafés à emporter. Ce sont des plaisirs légitimes, mais ajustables.',
        'La clé n’est pas de supprimer tes envies, mais de les budgétiser à l’avance pour culpabiliser zéro.',
      ],
      exercise: 'Classe tes 3 plus grosses dépenses du mois dernier en « besoin » ou « envie ».',
    },
    en: {
      title: 'Needs, wants, commitments',
      concept: 'Telling apart what is vital and what is optional.',
      body: [
        'Commitments and needs are the fixed costs you cannot skip: rent, electricity, the transport you depend on, basic groceries. They have to be honoured every month.',
        'Wants are going out, subscriptions, clothes, coffee. They are legitimate pleasures, and they are the adjustable ones.',
        'The point is not to cut your wants. It is to budget for them in advance, so that spending on them costs you no guilt at all.',
      ],
      exercise: 'Sort your three biggest expenses from last month into "need" or "want".',
    },
  },
  {
    id: 'fifty',
    minutes: 2,
    pane: 'envelopes',
    fr: {
      title: 'La règle du 50 / 30 / 20',
      concept: 'Une formule simple pour équilibrer ton revenu net.',
      body: [
        '50 % pour les besoins : charges fixes, logement, factures.',
        '30 % pour les envies : loisirs, sorties, style de vie, projets plaisir.',
        '20 % pour les objectifs financiers : épargne de précaution, remboursement de dettes, investissement.',
        'Si tes besoins dépassent 50 %, par exemple avec un loyer élevé, ajuste temporairement à 60 / 20 / 20 sans te décourager.',
      ],
      exercise: 'Calcule la répartition de ton dernier salaire selon ces trois pourcentages.',
    },
    en: {
      title: 'The 50 / 30 / 20 rule',
      concept: 'A simple formula for balancing your take-home pay.',
      body: [
        '50 % for needs: fixed costs, housing, bills.',
        '30 % for wants: leisure, going out, lifestyle, the fun projects.',
        '20 % for financial goals: the emergency cushion, paying down debt, investing.',
        'If your needs come to more than 50 %, a high rent for instance, move temporarily to 60 / 20 / 20 rather than giving up on the whole thing.',
      ],
      exercise: 'Work out how your last pay split across those three percentages.',
    },
  },
  {
    id: 'first',
    minutes: 2,
    pane: 'savings',
    fr: {
      title: 'Se payer en premier',
      concept: 'Inverser la logique classique de l’épargne.',
      body: [
        'L’erreur classique : mettre de côté ce qu’il reste à la fin du mois. Il ne reste jamais rien.',
        'La méthode des pros : dès que ton salaire arrive, envoie immédiatement 10 % à 20 % vers ton compte d’épargne automatisé.',
        'Tu apprends ainsi à vivre avec le reste, sans avoir l’impression de te restreindre.',
      ],
      exercise: 'Configure un virement automatique le jour même de ta paie.',
    },
    en: {
      title: 'Pay yourself first',
      concept: 'Turning the usual logic of saving around.',
      body: [
        'The classic mistake: put aside whatever is left at the end of the month. Nothing is ever left.',
        'What works instead: the moment your pay lands, send 10 % to 20 % straight to an automated savings account.',
        'You then learn to live on the rest, without ever feeling like you are going without.',
      ],
      exercise: 'Set up an automatic transfer for the day you get paid.',
    },
  },
  {
    id: 'cushion',
    minutes: 2,
    pane: 'savings',
    fr: {
      title: 'Le coussin de sécurité',
      concept: 'Construire ta sérénité financière face aux imprévus.',
      body: [
        'Un fonds d’urgence sert à couvrir les vrais imprévus, une panne de voiture, une perte de revenu, une facture médicale, sans avoir à t’endetter.',
        'Objectif initial : accumuler 1 000 $ le plus rapidement possible.',
        'Objectif à terme : l’équivalent de 3 à 6 mois de charges fixes.',
        'Ce compte doit rester accessible rapidement, mais séparé de ton compte courant pour ne pas le dépenser par tentation.',
      ],
      exercise: 'Définis le montant cible de ton fonds d’urgence.',
    },
    en: {
      title: 'The emergency cushion',
      concept: 'Building calm in the face of what you did not plan for.',
      body: [
        'An emergency fund covers the genuine surprises, a car repair, lost income, a medical bill, without you having to borrow.',
        'First target: get to 1,000 as fast as you can.',
        'Longer target: three to six months of fixed costs.',
        'The account has to stay quick to reach and separate from your day-to-day one, or you will spend it without meaning to.',
      ],
      exercise: 'Decide the number you are aiming at for your emergency fund.',
    },
  },
  {
    id: 'compound',
    minutes: 2,
    pane: 'savings',
    fr: {
      title: 'Le temps fait le travail',
      concept: 'La puissance des intérêts composés et de la régularité.',
      body: [
        'L’épargne et l’investissement ne sont pas un sprint, mais un marathon.',
        'La régularité, mettre 50 $ par mois chaque mois, bat la recherche du coup de chance.',
        'Plus tu commences tôt, plus le temps travaille pour toi grâce à la capitalisation.',
        'Une vision long terme transforme les petites habitudes quotidiennes en liberté future.',
      ],
      exercise: 'Choisis une seule habitude financière à tenir pendant les 30 prochains jours.',
    },
    en: {
      title: 'Time does the work',
      concept: 'The power of compounding, and of showing up.',
      body: [
        'Saving and investing are not a sprint. They are a marathon.',
        'Consistency, 50 a month every month, beats hunting for the lucky break.',
        'The earlier you start, the more of the work compounding does for you.',
        'A long view is what turns small daily habits into freedom later.',
      ],
      exercise: 'Pick one money habit and hold it for the next 30 days.',
    },
  },
]

/** The module, in the reader's language, falling back rather than blanking. */
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
 * The next module worth opening.
 *
 * The first unread one in order, or null when the course is finished. In order
 * rather than by any cleverer rule, because the six build on each other: the
 * cushion module assumes you know what "three to six months of fixed costs"
 * means, and that is the module before it.
 */
export function nextLesson(readIds = []) {
  const read = new Set(readIds)
  return LESSONS.find((l) => !read.has(l.id)) ?? null
}
