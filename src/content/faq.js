/**
 * L'aide, atteignable depuis les reglages et depuis le pied de page.
 *
 * CE QUI N'EST PAS ICI.
 *
 * Les questions sur la connexion bancaire ont ete retirees avec le bouton
 * qu'elles expliquaient : connecter un vrai compte demande l'acces payant de
 * Plaid, ce projet est sur le bac a sable, donc la fonctionnalite n'est
 * proposee nulle part. Une FAQ qui repond a des questions sur un bouton
 * inexistant envoie les gens le chercher.
 *
 * Elles sont dans l'historique git et reviennent avec le bouton.
 *
 * Rien ici ne s'adresse non plus a celui qui deploie l'application. Une
 * instruction que seul le proprietaire du projet peut suivre appartient a la
 * console, pas a une page que lisent les utilisateurs, et un test le verifie.
 *
 * UNE SEULE LANGUE PAR LECTEUR, LES DEUX ICI.
 *
 * Meme regle que studies.js : `fr` et `en` sont miroir l'un de l'autre, et un
 * test compare les deux question par question pour qu'une traduction ne puisse
 * pas perdre une entree en route.
 */

export const FAQ = {
  fr: {
    eyebrow: 'Aide',
    title: 'Questions fréquentes',
    lede: 'Ce qu’on nous demande le plus souvent, répondu en entier plutôt qu’à moitié.',
    groups: [
      {
        id: 'day',
        title: 'Au quotidien',
        items: [
          {
            q: 'Pourquoi un pourcentage et pas une série de jours ?',
            a: [
              'Parce qu’une série remet à zéro. Un mauvais jour efface trois semaines, et repartir de zéro coûte plus cher que la journée qu’on a réellement manquée : c’est le moment où les gens arrêtent.',
              'Ici le chiffre est une part de la période. Un jour manqué te coûte une fraction, jamais tout, donc recommencer n’a jamais l’air pire qu’abandonner.',
            ],
          },
          {
            q: 'Je pars en voyage ou j’ai des examens. Je perds tout ?',
            a: [
              'Non, à condition de le dire à l’avance. Une période déclarée absente sort complètement du calcul : elle ne compte ni comme réussie ni comme manquée.',
              'Être honnête sur une quinzaine difficile ne devrait rien coûter, donc ça ne coûte rien.',
            ],
          },
          {
            q: 'Combien d’e-mails vous m’envoyez ?',
            a: [
              'Trois sortes, une seule fois chacune par cycle : un avant l’ouverture de la fenêtre, un si personne ne t’a vu depuis deux semaines, et un trois jours avant l’anniversaire d’un ami.',
              'Ce n’est pas une intention, c’est une contrainte de la base de données : rien ne part sans réserver une ligne, et il n’y a qu’une ligne par sorte et par cycle.',
              'Celui des deux semaines part en dernier. Le groupe a une journée pour te faire signe avant, parce qu’un message d’un ami vaut mieux qu’un e-mail de nous.',
            ],
          },
        ],
      },
      {
        id: 'budget',
        title: 'Le budget',
        items: [
          {
            q: 'Est-ce que mes amis voient mon budget ?',
            a: [
              'Non, et ce n’est pas un réglage qu’on pourrait changer plus tard. Le reste de l’application est fait pour être vu par quelques personnes ; le budget est fait pour n’être vu par personne, et la base de données l’impose ligne par ligne.',
            ],
          },
          {
            q: 'Ma carte de crédit, je note quoi ?',
            a: [
              'L’achat, le jour de l’achat. Pas le remboursement : c’est le même argent qui bouge une deuxième fois entre deux endroits qui sont tous les deux à toi, et le noter deux fois fait dire à ton budget que tu vas mal alors que non.',
              'Le module « La carte de crédit » de la formation reprend ça en entier.',
            ],
          },
        ],
      },
    ],
  },

  en: {
    eyebrow: 'Help',
    title: 'Frequently asked questions',
    lede: 'What we get asked most, answered in full rather than halfway.',
    groups: [
      {
        id: 'day',
        title: 'Day to day',
        items: [
          {
            q: 'Why a percentage and not a streak?',
            a: [
              'Because a streak resets. One bad day wipes out three weeks, and starting from zero costs more than the day you actually missed: that is the moment people quit.',
              'Here the number is a share of the period. A missed day costs you a fraction, never everything, so restarting never looks worse than giving up.',
            ],
          },
          {
            q: 'I am travelling or I have exams. Do I lose everything?',
            a: [
              'No, as long as you say so in advance. A period declared away leaves the maths entirely: it counts neither as kept nor as missed.',
              'Being honest about a hard fortnight should cost nothing, so it costs nothing.',
            ],
          },
          {
            q: 'How many emails do you send me?',
            a: [
              'Three kinds, once each per cycle: one before the window opens, one if nobody has seen you for two weeks, and one three days before a friend’s birthday.',
              'It is not an intention, it is a database constraint: nothing sends without claiming a row, and there is only one row per kind per cycle.',
              'The two-week one goes last. The group gets a day to reach you first, because a message from a friend beats an email from us.',
            ],
          },
        ],
      },
      {
        id: 'budget',
        title: 'The budget',
        items: [
          {
            q: 'Can my friends see my budget?',
            a: [
              'No, and it is not a setting that could be changed later. The rest of the app is built to be seen by a few people; the budget is built to be seen by nobody, and the database enforces that row by row.',
            ],
          },
          {
            q: 'What do I log for my credit card?',
            a: [
              'The purchase, on the day of the purchase. Not the repayment: that is the same money moving a second time between two places that are both yours, and logging both makes your budget tell you that you are in trouble when you are not.',
              'The formation’s "The credit card" module covers this in full.',
            ],
          },
        ],
      },
    ],
  },
}

/** Every question, flattened. Used by the page meta and by the test. */
export function faqItems(locale) {
  const c = FAQ[locale] ?? FAQ.en
  return c.groups.flatMap((g) => g.items)
}
