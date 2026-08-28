/**
 * Les questions qui etaient ecrites en gros sur un ecran que personne ne lit.
 *
 * POURQUOI CETTE PAGE EXISTE.
 *
 * Le panneau d'import bancaire portait deux paves gris de six lignes chacun,
 * au-dessus du bouton, sur l'ecran budget de tout le monde. Les deux disaient
 * quelque chose de vrai et de necessaire, et les deux etaient trop longs pour
 * etre lus la ou ils etaient : un mur de texte au-dessus d'un bouton se saute,
 * il ne se lit pas.
 *
 * Donc le panneau garde UNE ligne par sujet et le detail vit ici, ou quelqu'un
 * vient quand il se pose la question.
 *
 * CE QUI N'EST PAS ICI.
 *
 * Rien qui s'adresse a celui qui deploie l'application. "Mets PLAID_ENV sur
 * production dans Vercel" etait affiche a chaque utilisateur, ce qui est une
 * instruction que personne d'autre que le proprietaire du projet ne peut
 * suivre. Elle part dans la console, ou l'operateur la voit et ou personne
 * d'autre n'a a la lire.
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
        id: 'bank',
        title: 'Connecter sa banque',
        items: [
          {
            q: 'Quelles banques peuvent être connectées ?',
            a: [
              'Les banques du Canada, des États-Unis, du Royaume-Uni et d’une partie de l’Europe. C’est la couverture de Plaid, le service qui fait la connexion, et elle s’arrête là.',
              'Les banques ivoiriennes n’en font pas partie. Le mobile money non plus, ni Orange, ni MTN, ni Wave, ni Moov. Aucun identifiant ne marchera pour ces comptes-là : ce n’est pas une question de mot de passe, c’est que la connexion n’existe pas.',
              'Si c’est ton cas, la saisie à la main reste le chemin, et elle marche partout.',
            ],
          },
          {
            q: 'Mes identifiants sont bons et la connexion est refusée. Pourquoi ?',
            a: [
              'Si l’application affiche « Mode test », c’est normal et ça ne vient pas de toi : dans cet environnement de démonstration, les vrais identifiants bancaires et les vrais numéros de téléphone sont refusés d’office. Le message parle d’identifiants incorrects parce que c’est le seul message qu’il connaît, pas parce que les tiens le sont.',
              'Sans « Mode test », vérifie d’abord que ta banque fait partie des pays couverts plus haut.',
            ],
          },
          {
            q: 'Est-ce que vous voyez mon mot de passe bancaire ?',
            a: [
              'Non. Tu le tapes dans une fenêtre qui appartient à Plaid, pas à nous, et il ne passe jamais par nos serveurs.',
              'Ce qu’on garde de la connexion est une clé d’accès, rangée dans une table que ton propre navigateur ne peut pas lire. Ce n’est pas un réglage prudent, c’est écrit dans la base : la table n’a aucune règle d’accès, donc personne n’y accède sauf le serveur qui appelle Plaid.',
            ],
          },
          {
            q: 'Pourquoi certaines transactions ne sont pas importées ?',
            a: [
              'Les virements entre tes propres comptes sont écartés, et c’est voulu. Déplacer de l’argent d’un compte à l’autre n’est pas une dépense, et compter le remboursement de ta carte en plus des achats qu’il règle les compterait deux fois.',
              'Sont écartées aussi les opérations encore en attente chez ta banque, qui arriveront une fois validées, et celles dans une autre devise que celle de ton budget, parce qu’on préfère ne rien afficher plutôt qu’un montant converti à un taux inventé.',
              'Le nombre et la raison sont affichés après chaque import. Rien n’est écarté en silence.',
            ],
          },
          {
            q: 'Si je supprime une transaction importée, est-ce qu’elle revient ?',
            a: [
              'Non. L’application se souvient de celles qu’elle a déjà traitées, y compris de celles que tu as supprimées, donc l’import suivant les laisse tranquilles.',
            ],
          },
          {
            q: 'Que se passe-t-il si je déconnecte ma banque ?',
            a: [
              'La clé d’accès est révoquée chez Plaid puis effacée chez nous, et l’application ne peut plus rien lire de ton compte.',
              'Les transactions que cette banque avait importées sont supprimées en même temps : déconnecter défait l’import. C’est irréversible.',
              'Ce que tu as saisi toi-même n’est pas touché, même une dépense notée pour le même commerce le même jour.',
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
        id: 'bank',
        title: 'Connecting a bank',
        items: [
          {
            q: 'Which banks can be connected?',
            a: [
              'Banks in Canada, the United States, the United Kingdom and part of Europe. That is the coverage of Plaid, the service that makes the connection, and it stops there.',
              'Ivorian banks are not in it. Neither is mobile money: not Orange, not MTN, not Wave, not Moov. No login will work for those accounts. It is not a password problem, the connection simply does not exist.',
              'If that is you, entering transactions by hand is still the way, and it works everywhere.',
            ],
          },
          {
            q: 'My details are correct and the connection is refused. Why?',
            a: [
              'If the app says "Test mode", this is expected and it is not you: in that demonstration environment, real bank credentials and real phone numbers are refused outright. The message talks about incorrect credentials because that is the only message it has, not because yours are.',
              'Without "Test mode", check first that your bank is in one of the countries listed above.',
            ],
          },
          {
            q: 'Can you see my bank password?',
            a: [
              'No. You type it into a window that belongs to Plaid, not to us, and it never passes through our servers.',
              'What we keep from the connection is an access key, held in a table your own browser cannot read. That is not a cautious setting, it is written into the database: the table has no access rules at all, so nothing reaches it except the server that calls Plaid.',
            ],
          },
          {
            q: 'Why are some transactions not imported?',
            a: [
              'Transfers between your own accounts are left out, deliberately. Moving money from one account to another is not spending, and counting your card repayment as well as the purchases it settles would count them twice.',
              'Also left out: entries still pending at your bank, which arrive once they post, and entries in a currency other than your budget’s, because showing nothing beats showing an amount converted at a rate we would have to invent.',
              'The count and the reason appear after every import. Nothing is dropped in silence.',
            ],
          },
          {
            q: 'If I delete an imported transaction, does it come back?',
            a: [
              'No. The app remembers the ones it has already handled, including the ones you deleted, so the next import leaves them alone.',
            ],
          },
          {
            q: 'What happens if I disconnect my bank?',
            a: [
              'The access key is revoked at Plaid and then deleted here, and the app can no longer read anything from your account.',
              'The transactions that bank had imported are deleted at the same time: disconnecting undoes the import. This cannot be undone.',
              'Anything you typed yourself is untouched, even a spend you logged for the same shop on the same day.',
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
