/**
 * Les mots, expliques la ou ils sont employes.
 *
 * "Can you add in the module some part where words are explained like
 * inflation etc."
 *
 * POURQUOI UN FICHIER SEPARE DES LECONS
 *
 * Parce qu'un mot sert dans plusieurs lecons et parfois dans plusieurs cours.
 * "Inflation" est defini dans Investir 101 et employe dans Budget 101; ecrire
 * la definition aux deux endroits, c'est en avoir deux, et deux definitions
 * du meme mot divergent au premier reglage. La lecon ne porte donc que la
 * LISTE des mots qu'elle emploie, et le texte vit ici.
 *
 * LA DEFINITION N'EMPLOIE PAS DE MOT QUI AURAIT BESOIN D'UNE DEFINITION
 *
 * C'est la seule regle de redaction, et c'est celle qui fait la difference
 * entre un lexique et un dictionnaire qui renvoie a lui-meme. Quand un terme
 * en appelle vraiment un autre, l'autre est dans la meme liste, a la meme
 * page, et le test le verifie.
 *
 * UNE PHRASE, DEUX AU PLUS
 *
 * Un lexique se lit en diagonale au moment ou le mot bloque. Un paragraphe
 * par entree ne se lit pas: il se saute, et le mot reste inconnu.
 *
 * `only` LIMITE UNE ENTREE A CERTAINES REGIONS
 *
 * Le CELI n'existe qu'au Canada et le PEA qu'en France. Les montrer partout
 * ferait un lexique dont la moitie ne concerne pas le lecteur, ce qui est
 * exactement le reproche fait a un cours qui recite des plafonds. La region
 * est deja choisie en tete du cours; le lexique s'en sert.
 */

/**
 * @typedef {{
 *   term: {fr: string, en: string},
 *   short: {fr: string, en: string},
 *   only?: string[],
 * }} Entry
 */

/** @type {Record<string, Entry>} */
export const GLOSSARY = {
  /* --- ce que fait le temps ------------------------------------------------ */
  inflation: {
    term: { fr: 'Inflation', en: 'Inflation' },
    short: {
      fr: 'La hausse générale des prix. Le même montant achète un peu moins chaque année, même si le solde à l’écran ne bouge pas.',
      en: 'The general rise in prices. The same amount buys a little less each year, even though the balance on screen has not moved.',
    },
  },
  'interets-composes': {
    term: { fr: 'Intérêts composés', en: 'Compound interest' },
    short: {
      fr: 'Les intérêts rapportent à leur tour des intérêts. C’est ce qui rend la courbe plate au début et très raide après vingt ans.',
      en: 'Interest earns interest of its own. That is what makes the curve flat at first and very steep after twenty years.',
    },
  },
  'cout-d-opportunite': {
    term: { fr: 'Coût d’opportunité', en: 'Opportunity cost' },
    short: {
      fr: 'Ce à quoi tu renonces en choisissant. Un achat de 200 $ ne coûte pas seulement 200 $, il coûte aussi ce que ces 200 $ auraient pu devenir.',
      en: 'What you give up by choosing. A $200 purchase does not just cost $200, it also costs whatever that $200 could have become.',
    },
  },

  /* --- ce qu'on achete ----------------------------------------------------- */
  action: {
    term: { fr: 'Action', en: 'Share (stock)' },
    short: {
      fr: 'Un morceau d’une entreprise. Sa valeur monte et descend avec l’entreprise, et rien ne garantit qu’elle revienne.',
      en: 'A piece of a company. Its value rises and falls with the company, and nothing guarantees it comes back.',
    },
  },
  obligation: {
    term: { fr: 'Obligation', en: 'Bond' },
    short: {
      fr: 'Un prêt que tu fais à un État ou à une entreprise, qui te rend la somme avec des intérêts à une date connue. Moins secouant qu’une action, et moins rentable sur la durée.',
      en: 'A loan you make to a government or a company, repaid with interest on a known date. Less bumpy than a share, and less rewarding over the long run.',
    },
  },
  dividende: {
    term: { fr: 'Dividende', en: 'Dividend' },
    short: {
      fr: 'Une part des bénéfices qu’une entreprise verse à ceux qui détiennent ses actions. Toutes n’en versent pas, et ce n’est pas une obligation.',
      en: 'A slice of profit a company pays to the people who hold its shares. Not every company pays one, and none is obliged to.',
    },
  },
  fnb: {
    term: { fr: 'FNB (ou ETF)', en: 'ETF' },
    short: {
      fr: 'Un panier qui contient des centaines d’actions d’un coup, et qui s’achète comme une seule. C’est la façon la plus simple de ne pas parier sur une seule entreprise.',
      en: 'A basket holding hundreds of shares at once, bought as if it were one. It is the simplest way not to bet on a single company.',
    },
  },
  indice: {
    term: { fr: 'Indice', en: 'Index' },
    short: {
      fr: 'Une liste d’entreprises qui sert de repère, par exemple les 500 plus grandes des États-Unis. Un fonds « indiciel » se contente de la copier.',
      en: 'A list of companies used as a reference, for example the 500 largest in the United States. An "index" fund simply copies it.',
    },
  },
  diversification: {
    term: { fr: 'Diversification', en: 'Diversification' },
    short: {
      fr: 'Ne pas mettre son argent au même endroit. Quand une entreprise s’effondre, elle n’emporte qu’une petite part de ce que tu as.',
      en: 'Not putting your money in one place. When a company collapses, it only takes a small share of what you hold with it.',
    },
  },
  'frais-de-gestion': {
    term: { fr: 'Frais de gestion', en: 'Management fee' },
    short: {
      fr: 'Le pourcentage prélevé chaque année sur ce que tu as placé, que ça monte ou que ça descende. 2 % au lieu de 0,2 % coûte des dizaines de milliers sur une vie.',
      en: 'The percentage taken every year from what you hold, whether it rises or falls. 2 % instead of 0.2 % costs tens of thousands over a lifetime.',
    },
  },
  volatilite: {
    term: { fr: 'Volatilité', en: 'Volatility' },
    short: {
      fr: 'L’ampleur des mouvements, à la hausse comme à la baisse. Élevée ne veut pas dire mauvaise : elle veut dire qu’il faut pouvoir attendre.',
      en: 'How much things move, up as well as down. High does not mean bad: it means you have to be able to wait.',
    },
  },
  'marche-baissier': {
    term: { fr: 'Marché baissier', en: 'Bear market' },
    short: {
      fr: 'Une baisse d’au moins 20 % qui dure. Il y en a eu à chaque décennie, et chacune a fini par être rattrapée.',
      en: 'A drop of at least 20 % that lasts. There has been one every decade, and every one has eventually been made back.',
    },
  },
  rendement: {
    term: { fr: 'Rendement', en: 'Return' },
    short: {
      fr: 'Ce que ton argent a rapporté, en pourcentage. Un rendement passé se raconte bien et ne promet rien.',
      en: 'What your money earned, as a percentage. A past return tells a good story and promises nothing.',
    },
  },
  'achat-periodique': {
    term: { fr: 'Achat périodique', en: 'Dollar-cost averaging' },
    short: {
      fr: 'Placer le même montant à date fixe, quoi qu’il arrive. Ça enlève la question « est-ce le bon moment », à laquelle personne ne sait répondre.',
      en: 'Investing the same amount on a fixed date, whatever happens. It removes the "is this the right moment" question, which nobody can answer.',
    },
  },

  /* --- ou on l'achete ------------------------------------------------------ */
  courtier: {
    term: { fr: 'Courtier', en: 'Broker' },
    short: {
      fr: 'L’application ou l’institution par laquelle tu achètes. C’est un intermédiaire, pas un placement.',
      en: 'The app or institution you buy through. It is a middleman, not an investment.',
    },
  },
  symbole: {
    term: { fr: 'Symbole (ticker)', en: 'Ticker' },
    short: {
      fr: 'Le code de quelques lettres qui identifie ce que tu achètes. Deux fonds très différents peuvent avoir des noms proches et des symboles distincts.',
      en: 'The few-letter code identifying what you buy. Two very different funds can have similar names and distinct tickers.',
    },
  },
  'ordre-au-marche': {
    term: { fr: 'Ordre au marché', en: 'Market order' },
    short: {
      fr: 'Acheter tout de suite, au prix du moment. Simple, et c’est celui qu’on utilise pour un fonds large.',
      en: 'Buy right now, at whatever price is going. Simple, and the one to use for a broad fund.',
    },
  },
  'ordre-a-cours-limite': {
    term: { fr: 'Ordre à cours limité', en: 'Limit order' },
    short: {
      fr: 'Acheter seulement si le prix descend jusqu’à un montant que tu fixes. Si le prix n’y va pas, rien ne se passe.',
      en: 'Buy only if the price comes down to an amount you set. If it never does, nothing happens.',
    },
  },
  'compte-non-enregistre': {
    term: { fr: 'Compte ordinaire', en: 'Taxable account' },
    short: {
      fr: 'Un compte de placement sans avantage fiscal : ce qu’il rapporte est imposable. C’est celui qu’on ouvre quand les autres sont pleins.',
      en: 'An investment account with no tax break: what it earns is taxed. The one you open when the others are full.',
    },
  },
  'plafond-de-cotisation': {
    term: { fr: 'Plafond de cotisation', en: 'Contribution room' },
    short: {
      fr: 'Le maximum que tu as le droit de mettre dans un compte avantageux. Le dépasser coûte une pénalité mensuelle.',
      en: 'The most you are allowed to put into a tax-advantaged account. Going over costs a monthly penalty.',
    },
  },
  celi: {
    term: { fr: 'CELI', en: 'TFSA' },
    short: {
      fr: 'Un compte où ce que tes placements rapportent n’est jamais imposé, et d’où tu peux retirer quand tu veux.',
      en: 'An account where what your investments earn is never taxed, and which you can withdraw from whenever you want.',
    },
    only: ['ca'],
  },
  reer: {
    term: { fr: 'REER', en: 'RRSP' },
    short: {
      fr: 'Un compte qui réduit ton impôt cette année, et sur lequel tu paieras l’impôt au retrait, en principe à la retraite.',
      en: 'An account that cuts your tax this year, and which you pay tax on when you withdraw, in principle at retirement.',
    },
    only: ['ca'],
  },
  pea: {
    term: { fr: 'PEA', en: 'PEA' },
    short: {
      fr: 'Un compte français pour investir en actions européennes. Après cinq ans, les gains échappent à l’impôt sur le revenu.',
      en: 'A French account for investing in European shares; after five years, gains escape income tax.',
    },
    only: ['fr'],
  },
  'assurance-vie': {
    term: { fr: 'Assurance-vie', en: 'Assurance-vie' },
    short: {
      fr: 'En France, une enveloppe de placement souple, et non un contrat en cas de décès. Fiscalité plus douce après huit ans.',
      en: 'In France, a flexible investment wrapper rather than a death benefit. Gentler taxation after eight years.',
    },
    only: ['fr'],
  },
  '401k': {
    term: { fr: '401(k)', en: '401(k)' },
    short: {
      fr: 'Un compte de retraite proposé par l’employeur, souvent avec une part versée par lui. Cette part-là est de l’argent gratuit.',
      en: 'A retirement account offered by an employer, often with a matching contribution. That match is free money.',
    },
    only: ['us'],
  },
  'roth-ira': {
    term: { fr: 'Roth IRA', en: 'Roth IRA' },
    short: {
      fr: 'Un compte de retraite américain alimenté après impôt : les gains et les retraits sont ensuite exonérés.',
      en: 'A US retirement account funded after tax: gains and withdrawals are then free of it.',
    },
    only: ['us'],
  },

  /* --- la carte ------------------------------------------------------------ */
  'limite-de-credit': {
    term: { fr: 'Limite de crédit', en: 'Credit limit' },
    short: {
      fr: 'Le maximum que la carte accepte de te prêter. Ce n’est pas une somme que tu possèdes.',
      en: 'The most the card agrees to lend you. It is not an amount you own.',
    },
  },
  solde: {
    term: { fr: 'Solde', en: 'Balance' },
    short: {
      fr: 'Ce que tu dois à la carte à un instant donné. Tant qu’il n’est pas à zéro, il coûte des intérêts.',
      en: 'What you owe the card at a given moment. Until it is zero, it costs interest.',
    },
  },
  releve: {
    term: { fr: 'Relevé', en: 'Statement' },
    short: {
      fr: 'Le récapitulatif mensuel de la carte, arrêté à une date fixe. C’est le montant du relevé qu’il faut payer en entier, pas le solde du jour.',
      en: 'The card’s monthly summary, closed on a fixed date. It is the statement amount you must pay in full, not today’s balance.',
    },
  },
  'delai-de-grace': {
    term: { fr: 'Délai de grâce', en: 'Grace period' },
    short: {
      fr: 'Les quelques semaines entre la fin du relevé et la date limite, pendant lesquelles rien n’est facturé si tu paies tout. Il disparaît dès qu’il reste un solde.',
      en: 'The few weeks between the statement closing and the due date, during which nothing is charged if you pay in full. It vanishes the moment a balance remains.',
    },
  },
  'paiement-minimum': {
    term: { fr: 'Paiement minimum', en: 'Minimum payment' },
    short: {
      fr: 'La plus petite somme acceptée pour ne pas être en retard. La payer évite une pénalité et n’arrête pas les intérêts.',
      en: 'The smallest amount accepted to avoid being late. Paying it avoids a penalty and does not stop the interest.',
    },
  },
  'taux-annuel': {
    term: { fr: 'Taux annuel (TAP, APR)', en: 'Annual rate (APR)' },
    short: {
      fr: 'Le coût du crédit sur un an, en pourcentage. 19,99 % est courant sur une carte, et c’est énorme comparé à ce que rapporte un placement.',
      en: 'The cost of the credit over a year, as a percentage. 19.99 % is common on a card, and that is enormous next to what an investment earns.',
    },
  },
  'interet-quotidien': {
    term: { fr: 'Intérêt quotidien', en: 'Daily interest' },
    short: {
      fr: 'Les cartes calculent chaque jour, pas une fois par mois. Payer une semaine plus tôt coûte donc réellement moins cher.',
      en: 'Cards calculate every day, not once a month. Paying a week earlier really does cost less.',
    },
  },
  'avance-de-fonds': {
    term: { fr: 'Avance de fonds', en: 'Cash advance' },
    short: {
      fr: 'Retirer de l’argent liquide avec une carte de crédit. Aucun délai de grâce : les intérêts courent dès la première minute, souvent à un taux plus élevé.',
      en: 'Taking cash out with a credit card. No grace period: interest runs from the first minute, often at a higher rate.',
    },
  },
  'frais-de-conversion': {
    term: { fr: 'Frais de conversion', en: 'Foreign transaction fee' },
    short: {
      fr: 'Environ 2,5 % ajoutés à tout achat dans une autre devise, en ligne compris. Ils n’apparaissent pas comme une ligne séparée.',
      en: 'About 2.5 % added to any purchase in another currency, online included. It does not show up as its own line.',
    },
  },
  'frais-annuels': {
    term: { fr: 'Frais annuels', en: 'Annual fee' },
    short: {
      fr: 'Ce que la carte coûte juste pour exister. Ils ne valent la peine que si tu utilises vraiment ce qu’ils achètent.',
      en: 'What the card costs just to exist. Worth it only if you actually use what it buys.',
    },
  },
  'cote-de-credit': {
    term: { fr: 'Cote de crédit', en: 'Credit score' },
    short: {
      fr: 'Une note qui résume, pour un prêteur, ta façon de rembourser. Elle décide de ton taux d’hypothèque, et parfois d’un logement.',
      en: 'A number summarising, for a lender, how you repay. It decides your mortgage rate, and sometimes a flat.',
    },
  },
  'historique-de-credit': {
    term: { fr: 'Historique de crédit', en: 'Credit history' },
    short: {
      fr: 'Depuis combien de temps tu empruntes et rembourses. C’est la partie qu’on ne peut pas accélérer, seulement commencer tôt.',
      en: 'How long you have been borrowing and repaying. The part you cannot speed up, only start early.',
    },
  },
  'taux-utilisation': {
    term: { fr: 'Taux d’utilisation', en: 'Utilisation' },
    short: {
      fr: 'La part de ta limite que tu utilises. Rester sous 30 % aide la cote, même si tu paies tout chaque mois.',
      en: 'The share of your limit you use. Staying under 30 % helps the score, even if you pay in full every month.',
    },
  },
  'enquete-de-credit': {
    term: { fr: 'Enquête de crédit', en: 'Hard inquiry' },
    short: {
      fr: 'La vérification faite quand tu demandes un crédit. Elle laisse une trace et fait baisser la cote de quelques points pendant quelques mois.',
      en: 'The check made when you apply for credit. It leaves a mark and knocks a few points off the score for a few months.',
    },
  },
  'transfert-de-solde': {
    term: { fr: 'Transfert de solde', en: 'Balance transfer' },
    short: {
      fr: 'Déplacer une dette vers une carte à taux réduit pendant quelques mois. Utile si tu rembourses avant la fin de la promotion, piège sinon.',
      en: 'Moving a debt onto a card at a reduced rate for a few months. Useful if you clear it before the promotion ends, a trap if not.',
    },
  },
  'methode-avalanche': {
    term: { fr: 'Méthode avalanche', en: 'Avalanche method' },
    short: {
      fr: 'Attaquer d’abord la dette au taux le plus élevé. C’est celle qui coûte le moins cher en arithmétique.',
      en: 'Attack the highest-rate debt first. The one that costs least in arithmetic.',
    },
  },
  'methode-boule-de-neige': {
    term: { fr: 'Méthode boule de neige', en: 'Snowball method' },
    short: {
      fr: 'Attaquer d’abord le plus petit solde. Ça coûte un peu plus et ça donne une dette éteinte plus tôt, donc une preuve que ça marche.',
      en: 'Attack the smallest balance first. It costs a little more and clears a debt sooner, which is proof it works.',
    },
  },

  /* --- le budget ----------------------------------------------------------- */
  'revenu-brut': {
    term: { fr: 'Revenu brut', en: 'Gross income' },
    short: {
      fr: 'Le salaire avant impôts et retenues. C’est le chiffre qu’on annonce, et ce n’est pas celui avec lequel on vit.',
      en: 'Pay before tax and deductions. The number people quote, and not the one you live on.',
    },
  },
  'revenu-net': {
    term: { fr: 'Revenu net', en: 'Net income' },
    short: {
      fr: 'Ce qui arrive vraiment sur ton compte. C’est le seul chiffre sur lequel un budget se construit.',
      en: 'What actually lands in your account. The only number a budget is built on.',
    },
  },
  'depense-fixe': {
    term: { fr: 'Dépense fixe', en: 'Fixed cost' },
    short: {
      fr: 'Le même montant à la même date, quoi qu’il arrive : loyer, téléphone, abonnements. Elle est déjà promise avant le début du mois.',
      en: 'The same amount on the same date, whatever happens: rent, phone, subscriptions. Promised before the month even starts.',
    },
  },
  'depense-variable': {
    term: { fr: 'Dépense variable', en: 'Variable cost' },
    short: {
      fr: 'Ce qui change d’un mois à l’autre : épicerie, sorties, essence. C’est la seule partie sur laquelle une décision agit vite.',
      en: 'What changes from month to month: groceries, going out, petrol. The only part a decision moves quickly.',
    },
  },
  'budget-base-zero': {
    term: { fr: 'Budget à base zéro', en: 'Zero-based budget' },
    short: {
      fr: 'Donner un rôle à chaque dollar jusqu’à ce qu’il n’en reste aucun sans rôle. Ça ne veut pas dire tout dépenser : épargner est un rôle.',
      en: 'Give every dollar a job until none is left without one. It does not mean spending everything: saving is a job.',
    },
  },
  enveloppe: {
    term: { fr: 'Enveloppe', en: 'Envelope' },
    short: {
      fr: 'Un montant réservé d’avance à une catégorie. Quand elle est vide, on ne pioche pas ailleurs, on attend le mois suivant.',
      en: 'An amount set aside in advance for one category. When it is empty you do not raid another, you wait for next month.',
    },
  },
  'taux-epargne': {
    term: { fr: 'Taux d’épargne', en: 'Savings rate' },
    short: {
      fr: 'La part de ce que tu gagnes que tu ne dépenses pas. C’est le chiffre qui décide de tout le reste, bien avant le choix des placements.',
      en: 'The share of what you earn that you do not spend. The number that decides everything else, long before the choice of investments.',
    },
  },
  'fonds-urgence': {
    term: { fr: 'Fonds d’urgence', en: 'Emergency fund' },
    short: {
      fr: 'De l’argent disponible tout de suite pour un imprévu, gardé à part. C’est lui qui évite que le premier problème finisse sur une carte de crédit.',
      en: 'Money available right away for the unexpected, kept apart. It is what keeps the first problem off a credit card.',
    },
  },
  'valeur-nette': {
    term: { fr: 'Valeur nette', en: 'Net worth' },
    short: {
      fr: 'Ce que tu possèdes moins ce que tu dois. Elle peut être négative pendant des années sans que ce soit un échec.',
      en: 'What you own minus what you owe. It can be negative for years without that being a failure.',
    },
  },
}
