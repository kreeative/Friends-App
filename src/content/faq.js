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
      {
        id: 'notifs',
        title: 'Notifications et livres',
        items: [
          {
            q: 'Comment activer les notifications sur iPhone ?',
            a: [
              'Ouvre le site dans Safari, appuie sur le bouton Partager, puis « Sur l’écran d’accueil ». Ensuite ouvre l’application depuis cette icône, va dans Réglages et active « Me notifier sur cet appareil ».',
              'Cette étape n’est pas facultative et ne vient pas de nous : Apple bloque les notifications pour un site ouvert dans un onglet. Tant que l’application n’est pas sur l’écran d’accueil, l’interrupteur n’apparaît même pas.',
              'Sur Android et sur ordinateur, il n’y a rien à installer : l’interrupteur est directement dans Réglages.',
            ],
          },
          {
            q: 'C’est par appareil ou par compte ?',
            a: [
              'Par appareil, et même par navigateur. L’activer sur ton téléphone ne l’active pas sur ton ordinateur : ce sont deux abonnements séparés.',
              'C’est pour ça que la ligne dit « sur cet appareil » plutôt que « pour moi ».',
            ],
          },
          {
            q: 'À quoi sert « Afficher une notification test » ?',
            a: [
              'Il vérifie que ton appareil sait afficher une notification : que la permission est donnée, que l’application est bien installée, et que le système accepte de l’afficher. C’est là que ça coince presque toujours.',
              'Il ne vérifie pas qu’un vrai rappel arrivera : celui-là part du serveur et fait un autre trajet. Un test qui s’affiche ne prouve donc pas que tout fonctionne de bout en bout, et le bouton ne prétend pas le contraire.',
            ],
          },
          {
            q: 'Pourquoi vous ne les activez pas pour tout le monde ?',
            a: [
              'Parce que c’est impossible, et pas par choix. Un navigateur n’accepte d’activer les notifications qu’après un geste de la personne : il faut un vrai appui sur un vrai bouton, et la demande de permission doit venir juste après.',
              'Aucun site ne peut contourner ça, et c’est tant mieux : sinon la première page venue pourrait s’inviter sur ton écran verrouillé.',
            ],
          },
          {
            q: 'J’ai fermé la carte d’un ami, elle revient. Pourquoi ?',
            a: [
              'La croix veut dire « pas maintenant », pas « plus jamais ». Elle cache la carte pour toi seule, pendant une semaine. Si ton ami est toujours silencieux sept jours plus tard, c’est une semaine de silence de plus et la carte redemande.',
              'Avant, la croix n’avait pas de fin. Comme l’application ne relance jamais une deuxième alerte pour quelqu’un déjà silencieux, une seule croix retirait cette personne de ton fil pour toujours : plus elle se taisait, plus c’était définitif. C’était un défaut, pas une intention.',
              'Personne d’autre ne voit ta croix. La carte reste ouverte sur les écrans des autres membres du groupe.',
            ],
          },
          {
            q: 'J’ai payé un livre, pourquoi n’est-il pas arrivé ?',
            a: [
              'Va dans Réglages, section Achats, et appuie sur « Vérifier les achats ». Ça contrôle toute la chaîne : les clés de ce déploiement, si Stripe sait où envoyer un paiement terminé, si les paiements récents ont été livrés, et si les accès peuvent être enregistrés. Aucun secret n’est affiché.',
              'Si un achat manque, le bouton « Récupérer les livres que j’ai payés » demande directement à Stripe ce que tu as payé et te le rend. Il ne peut rien donner que tu n’aies pas payé.',
              'La bibliothèque essaie déjà toute seule, quelques secondes après un paiement. Ce bouton est le filet en dessous.',
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
      {
        id: 'notifs',
        title: 'Notifications and books',
        items: [
          {
            q: 'How do I turn notifications on, on an iPhone?',
            a: [
              'Open the site in Safari, tap Share, then "Add to Home Screen". Then open the app from that icon, go to Settings, and turn on "Notify me on this device".',
              'That step is not optional and it is not ours: Apple blocks notifications for a site opened in a browser tab. Until the app is on the home screen the switch does not even appear.',
              'On Android and on a computer there is nothing to install. The switch is simply there in Settings.',
            ],
          },
          {
            q: 'Is it per device or per account?',
            a: [
              'Per device, and in fact per browser. Turning it on on your phone does not turn it on on your laptop: those are two separate subscriptions.',
              'That is why the row says "on this device" rather than "for me".',
            ],
          },
          {
            q: 'What does "Show a test notification" actually check?',
            a: [
              'That your device will display one: that permission was granted, that the app is properly installed, and that the operating system is willing to paint it. That is where this almost always breaks.',
              'It does not check that a real reminder will arrive. That one comes from the server and travels a different route. So a test that appears is not proof the whole chain works, and the button does not claim otherwise.',
            ],
          },
          {
            q: 'Why not just turn them on for everyone?',
            a: [
              'Because it is impossible, not because we chose not to. A browser will only turn notifications on after a gesture from the person: a real tap on a real button, with the permission request immediately after it.',
              'No site can get around that, and that is a good thing. Otherwise any page you opened could put itself on your lock screen.',
            ],
          },
          {
            q: 'I closed a friend’s card and it came back. Why?',
            a: [
              'The cross means "not now", not "not ever". It hides the card for you alone, for a week. If your friend is still quiet seven days later, that is another week of silence and the card asks again.',
              'It used to have no end. Since the app never raises a second alert for somebody who is already quiet, one cross took that person off your rail permanently: the longer they stayed silent, the more permanent it got. That was a defect, not a decision.',
              'Nobody else sees your cross. The card stays open on every other member’s screen.',
            ],
          },
          {
            q: 'I paid for a book, why has it not arrived?',
            a: [
              'Go to Settings, the Purchases section, and press "Check purchases". It checks the whole chain: the keys on this deployment, whether Stripe knows where to send a completed payment, whether recent payments were delivered, and whether the records can be written. It never shows a secret.',
              'If a purchase is missing, "Get the books I paid for" asks Stripe directly what you have paid for and hands it over. It cannot give you anything you did not pay for.',
              'The library already tries this on its own, a few seconds after a payment. That button is the floor underneath it.',
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
