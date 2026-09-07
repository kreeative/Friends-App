/**
 * Budget 101, au format des trois autres cours.
 *
 * CE QUI A ETE DEMANDE
 *
 *   "Budget 101 doit etre le meme format que les autres cours, mais ca doit
 *    plus parler de comment faire un budget."
 *
 * Les deux moities de la phrase comptent.
 *
 * LE FORMAT. Budget 101 etait une "formation" a part: son propre lecteur
 * (Formation.jsx), son propre stockage de progression, sa propre carte dans
 * Lectures avec une fleche au lieu d'un bouton "Commencer le cours". Sur
 * l'etagere Cours, c'etait le seul element qui ne ressemblait pas aux autres,
 * pour une raison qui n'existait plus depuis que les cours vivent dans
 * l'application. Il est donc un cours: memes modules, memes lecons, meme
 * navigation, meme quiz.
 *
 * LE CONTENU. L'ancienne version parlait de budget dans trois modules sur
 * sept; les quatre autres parlaient d'epargne, d'interets composes et de
 * carte de credit. Ces sujets ont maintenant leurs propres cours (Investir
 * 101, Carte de credit 101) et les repeter ici, en plus court et en moins
 * bon, n'aide personne. Ce cours ne fait plus qu'une chose: comment on fait
 * un budget, du premier chiffre jusqu'au mois ou il tient encore.
 *
 * Trois modules, dans l'ordre ou on s'en sert:
 *
 *   1  Voir clair       ce qui rentre, ce qui part, comment le trier
 *   2  Faire le budget  la decision, ecrite d'avance
 *   3  Le tenir         ce qui casse le premier mois, et comment reparer
 *
 * Chaque lecon finit sur un geste dans l'application: les enveloppes, le plan
 * et l'epargne existent deja dans l'onglet Budget, et un cours qui finit sur
 * un sommaire est un cours qu'on fait une fois.
 *
 * Le francais est la langue source, l'anglais la traduction, comme partout
 * ailleurs dans content/courses.js. Accents et apostrophe courbe: la regle
 * ASCII de CLAUDE.md vise le SQL qui traverse un presse-papier, pas le texte
 * de l'application.
 *
 * Fichier separe plutot qu'ajoute a courses.js, qui fait deja 170 ko: la
 * forme du tableau ne change pas, seule la provenance d'un element change.
 */

export const BUDGET_101 = {
  slug: 'budget-101',
  title: { fr: 'Budget 101', en: 'Budget 101' },
  tagline: {
    fr: 'Faire un budget, pour vrai : ce qui rentre, ce qui part, et la décision que tu prends avant que l’argent parte.',
    en: 'Making a budget, for real: what comes in, what leaves, and the decision you make before the money moves.',
  },
  modules: [
    {
      n: 1,
      title: { fr: 'Voir clair', en: 'Seeing clearly' },
      intro: {
        fr: 'On ne décide rien tant qu’on ne voit rien. Trois leçons pour avoir les vrais chiffres devant soi, sans se juger et sans rien couper pour l’instant.',
        en: 'Nothing gets decided while nothing is visible. Three lessons to get the real numbers in front of you, without judging any of them and without cutting anything yet.',
      },
      action: {
        fr: 'À la fin de ce module tu dois pouvoir écrire trois nombres : ce qui rentre, ce qui part sans que tu y penses, et ce qui reste.',
        en: 'By the end of this module you should be able to write three numbers: what comes in, what leaves without you thinking about it, and what is left.',
      },
      lessons: [
        {
          id: 'b1.1',
          terms: ['revenu-brut', 'revenu-net'],
          state: 'written',
          title: { fr: 'Ce qui rentre vraiment', en: 'What actually comes in' },
          sub: {
            fr: 'Le seul chiffre de départ, et ce n’est pas ton salaire.',
            en: 'The one starting number, and it is not your salary.',
          },
          objective: {
            fr: 'Savoir quel montant sert de base au budget, et quoi faire quand il change d’un mois à l’autre.',
            en: 'Know which amount the budget is built on, and what to do when it changes from month to month.',
          },
          points: [
            {
              lead: { fr: 'Le net, pas le brut.', en: 'Net, not gross.' },
              body: {
                fr: 'Le brut est un chiffre de contrat. Ce qui se dépense, c’est ce qui touche le compte après impôts et retenues. Un budget bâti sur le brut est faux d’environ un quart dès la première ligne, et l’erreur ne se voit qu’à la fin du mois.',
                en: 'Gross is a contract number. What gets spent is what lands in the account after tax and deductions. A budget built on gross is wrong by about a quarter from its first line, and the error only shows up at the end of the month.',
              },
            },
            {
              lead: { fr: 'Un revenu irrégulier se budgète sur le mois le plus bas.', en: 'An irregular income is budgeted on the lowest month.' },
              body: {
                fr: 'Pourboires, contrats, heures variables : prends les trois derniers mois et retiens le plus faible. Les mois au-dessus deviennent du surplus qu’on attribue exprès, au lieu d’un budget qui casse un mois sur trois et qu’on abandonne.',
                en: 'Tips, contracts, variable hours: take the last three months and keep the lowest. The bigger months become a surplus you assign on purpose, instead of a budget that breaks one month in three and gets abandoned.',
              },
            },
            {
              lead: { fr: 'Tout ce qui arrive compte, pas seulement la paie.', en: 'Everything that arrives counts, not just the pay.' },
              body: {
                fr: 'Bourses, allocations, remboursements d’impôt, argent d’un parent, revente. Ça rentre sur le compte, donc ça rentre dans le budget. Ce qui n’est pas écrit se dépense sans décision.',
                en: 'Grants, benefits, tax refunds, money from a parent, something sold. It lands in the account, so it belongs in the budget. What is not written down gets spent without a decision.',
              },
            },
          ],
          todo: {
            fr: 'Ouvre ton application bancaire et écris le total de ce qui est entré le mois dernier. Un seul nombre. C’est le haut de ton budget.',
            en: 'Open your banking app and write the total of everything that came in last month. One number. That is the top of your budget.',
          },
          reflection: {
            fr: 'Est-ce que tu connais ton revenu net par cœur ? Si la réponse est non, ce n’est pas un défaut de mémoire : c’est le signe que tes décisions d’argent se prennent sur une impression plutôt que sur un chiffre.',
            en: 'Do you know your net income by heart? If not, that is not a memory problem: it is a sign that your money decisions are made on an impression rather than on a number.',
          },
          quiz: [
            {
              ask: {
                fr: 'Tes heures varient beaucoup d’un mois à l’autre. Sur quel montant construis-tu ton budget ?',
                en: 'Your hours vary a lot from month to month. Which amount do you build the budget on?',
              },
              options: [
                { fr: 'La moyenne des trois derniers mois', en: 'The average of the last three months' },
                { fr: 'Le plus faible des trois derniers mois', en: 'The lowest of the last three months' },
                { fr: 'Le meilleur mois, pour te motiver', en: 'The best month, to motivate yourself' },
              ],
              answer: 1,
              why: {
                fr: 'La moyenne casse un mois sur deux, et le meilleur mois casse presque toujours. Le plancher tient tous les mois, et les mois au-dessus deviennent un surplus qu’on attribue exprès.',
                en: 'The average breaks every other month, and the best month breaks nearly always. The floor holds every month, and the bigger months become a surplus you assign on purpose.',
              },
            },
          ],
        },
        {
          id: 'b1.2',
          terms: ['depense-fixe', 'depense-variable'],
          state: 'written',
          title: { fr: 'Où va ton argent', en: 'Where your money goes' },
          sub: {
            fr: 'Sept jours d’observation avant la première décision.',
            en: 'Seven days of looking before the first decision.',
          },
          objective: {
            fr: 'Voir tes dépenses réelles plutôt que celles dont tu te souviens, et repérer celles qui partent sans que tu les décides.',
            en: 'See your real spending rather than the spending you remember, and spot what leaves without you deciding it.',
          },
          points: [
            {
              lead: { fr: 'La mémoire sous-estime les petites dépenses.', en: 'Memory underestimates small spending.' },
              body: {
                fr: 'Le loyer, tout le monde s’en souvient. Ce qui échappe, ce sont les montants sous vingt dollars, qui sont nombreux et qui font le trou. Écrire chaque transaction pendant sept jours suffit à voir apparaître ce que résumer ne montre jamais.',
                en: 'Everybody remembers the rent. What escapes is everything under twenty dollars, which is where the volume is and where the hole comes from. Writing down every transaction for seven days is enough to see what summarising never shows.',
              },
            },
            {
              lead: { fr: 'Les prélèvements automatiques sont les plus chers à ignorer.', en: 'Automatic payments are the most expensive ones to ignore.' },
              body: {
                fr: 'Un abonnement à quinze dollars par mois est cent quatre-vingts dollars par an, et il ne demande jamais rien. Fais la liste de tout ce qui part tout seul : abonnements, assurances, forfaits, applications. Beaucoup de gens en trouvent un dont ils ignoraient l’existence.',
                en: 'A fifteen-a-month subscription is a hundred and eighty a year, and it never asks for anything. List everything that leaves on its own: subscriptions, insurance, plans, apps. Most people find one they did not know was running.',
              },
            },
            {
              lead: { fr: 'Sans se juger, et c’est une consigne technique.', en: 'Without judging, and that is a technical instruction.' },
              body: {
                fr: 'Quelqu’un qui a honte de ce qu’il note arrête de noter, et un relevé incomplet ne sert à rien. Cette semaine ne sert pas à décider, elle sert à voir. Les coupes viennent après, et elles seront plus faciles avec les vrais chiffres.',
                en: 'Somebody ashamed of what they are logging stops logging, and an incomplete record is worth nothing. This week is not for deciding, it is for seeing. Cuts come later, and they get easier once the numbers are real.',
              },
            },
          ],
          metaphor: {
            fr: 'Personne ne range une pièce dans le noir. On allume, on regarde ce qui traîne, et seulement ensuite on décide quoi garder.',
            en: 'Nobody tidies a room in the dark. You turn the light on, look at what is lying around, and only then decide what stays.',
          },
          todo: {
            fr: 'Note 100 % de tes transactions pendant sept jours. Papier, notes du téléphone ou l’onglet Budget de l’application : l’outil est indifférent, la complétude ne l’est pas.',
            en: 'Log 100 % of your transactions for seven days. Paper, phone notes, or the Budget tab in this app: the tool does not matter, being complete does.',
          },
          quiz: [
            {
              ask: {
                fr: 'Qu’est-ce qui échappe le plus souvent quand on estime ses dépenses de mémoire ?',
                en: 'What most often escapes when you estimate your spending from memory?',
              },
              options: [
                { fr: 'Le loyer et les grosses factures', en: 'Rent and the big bills' },
                { fr: 'Les montants sous vingt dollars, et ce qui part automatiquement', en: 'Everything under twenty, and whatever leaves automatically' },
                { fr: 'Les dépenses du week-end', en: 'Weekend spending' },
              ],
              answer: 1,
              why: {
                fr: 'Les gros montants sont mémorables et rares. Le trou se creuse avec le nombre : beaucoup de petites lignes, plus les prélèvements qui ne demandent jamais rien.',
                en: 'Big amounts are memorable and rare. The hole comes from volume: many small lines, plus the automatic payments that never ask for anything.',
              },
            },
          ],
        },
        {
          id: 'b1.3',
          state: 'written',
          title: { fr: 'Besoins, envies, engagements', en: 'Needs, wants, commitments' },
          sub: {
            fr: 'Trois piles, et la troisième est celle qu’on oublie.',
            en: 'Three piles, and the third is the forgotten one.',
          },
          objective: {
            fr: 'Trier tes dépenses en trois catégories qui répondent chacune à une question différente quand il faut couper.',
            en: 'Sort your spending into three categories, each answering a different question when something has to go.',
          },
          points: [
            {
              lead: { fr: 'Un besoin est ce sans quoi la semaine ne tient pas.', en: 'A need is what the week does not work without.' },
              body: {
                fr: 'Logement, électricité, épicerie de base, le transport qui te mène au travail ou aux cours. Ce n’est pas une catégorie morale : le café n’est pas un vice, il est simplement dans une autre pile.',
                en: 'Housing, power, basic groceries, the transport that gets you to work or class. This is not a moral category: coffee is not a vice, it just sits in another pile.',
              },
            },
            {
              lead: { fr: 'Une envie est ajustable, et elle a le droit d’exister.', en: 'A want is adjustable, and it is allowed to exist.' },
              body: {
                fr: 'Sorties, vêtements, livraisons, jeux. Un budget qui met les envies à zéro dure onze jours. Elles sont budgétées d’avance précisément pour qu’on puisse les dépenser sans culpabilité, ce qui est le seul état dans lequel un budget survit.',
                en: 'Going out, clothes, deliveries, games. A budget that zeroes the wants lasts eleven days. They are budgeted in advance precisely so they can be spent without guilt, which is the only state in which a budget survives.',
              },
            },
            {
              lead: { fr: 'Un engagement est une envie qu’on a signée.', en: 'A commitment is a want you signed for.' },
              body: {
                fr: 'Abonnement, forfait, paiement d’un objet en douze fois, assurance. Ça se comporte comme un besoin, parce que ça part tout seul, mais ça n’en est pas un : ça se résilie. C’est la pile où se trouve presque toujours la marge quand il en faut.',
                en: 'A subscription, a phone plan, twelve monthly instalments on something, insurance. It behaves like a need because it leaves on its own, but it is not one: it can be cancelled. It is almost always the pile where the room to move is.',
              },
            },
          ],
          todo: {
            fr: 'Reprends ta semaine de notes et écris B, E ou G à côté de chaque ligne. Puis regarde la colonne G : c’est la seule des trois qui se change en un appel.',
            en: 'Take your week of notes and write N, W or C beside each line. Then look at the C column: it is the only one of the three that changes with a phone call.',
          },
          quiz: [
            {
              ask: {
                fr: 'Ton forfait téléphone à 60 $ par mois, dans quelle pile ?',
                en: 'Your 60-a-month phone plan: which pile?',
              },
              options: [
                { fr: 'Un besoin : sans téléphone, rien ne marche', en: 'A need: nothing works without a phone' },
                { fr: 'Un engagement : ça part tout seul, et ça se renégocie', en: 'A commitment: it leaves on its own, and it can be renegotiated' },
                { fr: 'Une envie : c’est du confort', en: 'A want: it is a comfort' },
              ],
              answer: 1,
              why: {
                fr: 'Avoir un téléphone est un besoin, payer soixante dollars pour celui-là est un engagement. La distinction n’est pas rhétorique : c’est elle qui te fait appeler ton fournisseur au lieu de couper l’épicerie.',
                en: 'Having a phone is a need; paying sixty for that particular plan is a commitment. The distinction is not rhetorical: it is what makes you call your provider instead of cutting groceries.',
              },
            },
            {
              ask: {
                fr: 'Pourquoi la consigne dit-elle de noter sans se juger ?',
                en: 'Why does the instruction say to log without judging?',
              },
              options: [
                { fr: 'Par politesse, ça ne change rien au résultat', en: 'Out of politeness, it changes nothing' },
                { fr: 'Parce que quelqu’un qui a honte arrête de noter, et un relevé incomplet ne sert à rien', en: 'Because somebody ashamed stops logging, and an incomplete record is worth nothing' },
                { fr: 'Parce que les petites dépenses n’ont pas d’importance', en: 'Because small spending does not matter' },
              ],
              answer: 1,
              why: {
                fr: 'La semaine d’observation n’a qu’un défaut possible : être incomplète. Tout ce qui pousse à ne pas écrire une ligne est un problème technique avant d’être un problème d’humeur.',
                en: 'The observation week has exactly one possible flaw: being incomplete. Anything that discourages writing a line down is a technical problem before it is a mood problem.',
              },
            },
          ],
        },
      ],
    },
    {
      n: 2,
      title: { fr: 'Faire le budget', en: 'Making the budget' },
      intro: {
        fr: 'Un budget n’est pas un relevé, c’est une décision écrite d’avance. Quatre leçons pour transformer les chiffres du module 1 en un plan que le mois peut suivre.',
        en: 'A budget is not a statement, it is a decision written in advance. Four lessons to turn module 1’s numbers into a plan the month can follow.',
      },
      action: {
        fr: 'À la fin de ce module, chaque dollar de ton prochain mois a un rôle écrit avant d’arriver.',
        en: 'By the end of this module, every dollar of your next month has a job written before it arrives.',
      },
      lessons: [
        {
          id: 'b2.1',
          terms: ['budget-base-zero'],
          state: 'written',
          title: { fr: 'Chaque dollar a un rôle', en: 'Every dollar has a job' },
          sub: {
            fr: 'Le budget à base zéro, et ce que « zéro » veut dire.',
            en: 'The zero-based budget, and what "zero" means.',
          },
          objective: {
            fr: 'Savoir écrire un budget dont le résultat est zéro, et comprendre pourquoi c’est le contraire de tout dépenser.',
            en: 'Know how to write a budget that lands on zero, and why that is the opposite of spending everything.',
          },
          points: [
            {
              lead: { fr: 'Revenus moins attributions égale zéro.', en: 'Income minus assignments equals zero.' },
              body: {
                fr: 'Si mille dollars rentrent, mille dollars sont attribués : loyer, épicerie, transport, sorties, épargne, remboursement. Le zéro est celui de l’argent NON ATTRIBUE, pas celui du compte en banque.',
                en: 'If a thousand comes in, a thousand gets assigned: rent, groceries, transport, going out, savings, debt. The zero is unassigned money, not the bank balance.',
              },
            },
            {
              lead: { fr: 'L’épargne est une ligne comme les autres.', en: 'Savings is a line like any other.' },
              body: {
                fr: 'C’est ce qui distingue ce budget d’une simple liste de factures : « mettre de côté » est une attribution, pas un reste. Un dollar qui n’a pas de rôle en trouve un tout seul, et rarement celui qu’on aurait choisi.',
                en: 'That is what separates this from a list of bills: putting money aside is an assignment, not a leftover. A dollar with no job finds one on its own, and rarely the one you would have picked.',
              },
            },
            {
              lead: { fr: 'On budgète l’argent qu’on a, pas celui qu’on attend.', en: 'You budget the money you have, not the money you expect.' },
              body: {
                fr: 'Le budget porte sur ce qui est déjà entré ou sur le plancher calculé en leçon 1. Attribuer une paie qui n’est pas arrivée, c’est un plan qui dépend d’un événement futur, et c’est la définition d’un découvert.',
                en: 'The budget covers what has already arrived, or the floor you worked out in lesson 1. Assigning a pay that has not landed is a plan that depends on a future event, which is the definition of an overdraft.',
              },
            },
          ],
          metaphor: {
            fr: 'Un budget est une liste d’instructions données à l’avance, comme une commande passée avant d’avoir faim. Décider en ayant faim n’est pas une décision, c’est une réaction.',
            en: 'A budget is a set of instructions given in advance, like ordering before you are hungry. Deciding while hungry is not a decision, it is a reaction.',
          },
          todo: {
            fr: 'Prends ton revenu du mois dernier et attribue-le, ligne par ligne, jusqu’à ce qu’il ne reste rien de non attribué. Sur papier d’abord si c’est plus simple.',
            en: 'Take last month’s income and assign it, line by line, until nothing is unassigned. On paper first if that is easier.',
          },
          quiz: [
            {
              ask: {
                fr: 'Ton budget tombe à zéro. Qu’est-ce que ça veut dire ?',
                en: 'Your budget lands on zero. What does that mean?',
              },
              options: [
                { fr: 'Ton compte est vide à la fin du mois', en: 'Your account is empty at the end of the month' },
                { fr: 'Il ne reste plus un dollar sans rôle assigné', en: 'There is no dollar left without a job' },
                { fr: 'Tu as dépensé exactement ce que tu as gagné', en: 'You spent exactly what you earned' },
              ],
              answer: 1,
              why: {
                fr: 'Le zéro porte sur l’argent non attribué. L’épargne est une attribution : un budget à base zéro peut très bien finir le mois avec trois cents dollars de côté, et c’est même le but.',
                en: 'The zero is about unassigned money. Savings is an assignment: a zero-based budget can absolutely finish the month with three hundred put aside, and that is the point.',
              },
            },
          ],
        },
        {
          id: 'b2.2',
          terms: ['taux-epargne'],
          state: 'written',
          title: { fr: 'Le squelette : 50 / 30 / 20', en: 'The skeleton: 50 / 30 / 20' },
          sub: {
            fr: 'Par où commencer quand la page est blanche.',
            en: 'Where to start when the page is blank.',
          },
          objective: {
            fr: 'Avoir une première répartition en trois parts, et savoir la déformer sans considérer que le budget a échoué.',
            en: 'Have a first three-way split, and know how to bend it without deciding the budget failed.',
          },
          points: [
            {
              lead: { fr: 'Cinquante, trente, vingt, sur le net.', en: 'Fifty, thirty, twenty, of the net.' },
              body: {
                fr: 'La moitié aux besoins, un peu moins d’un tiers aux envies, un cinquième aux objectifs financiers : épargne de précaution, dettes, investissement. C’est un point de départ, pas une loi.',
                en: 'Half to needs, a bit under a third to wants, a fifth to financial goals: the emergency cushion, debt, investing. It is a starting point, not a law.',
              },
            },
            {
              lead: { fr: 'Si le loyer explose les 50 %, la règle plie.', en: 'If rent blows past 50 %, the rule bends.' },
              body: {
                fr: 'Dans une grande ville, un loyer à 55 ou 60 % du net est une réalité, pas une faute. Passe à 60 / 20 / 20 et garde la part des objectifs, parce que c’est celle qui, un an plus tard, aura change quelque chose.',
                en: 'In a big city, rent at 55 or 60 % of net is a fact, not a failure. Move to 60 / 20 / 20 and protect the goals share, because that is the one that will have changed something a year from now.',
              },
            },
            {
              lead: { fr: 'Le rôle de la règle est de finir en dix minutes.', en: 'The rule exists to get you finished in ten minutes.' },
              body: {
                fr: 'Un premier budget parfait n’existe pas et un premier budget jamais terminé est très courant. Trois parts, trois nombres, on ajuste au mois deux : c’est un cadre qui permet de commencer, et commencer est la difficulté.',
                en: 'A perfect first budget does not exist; an unfinished first budget is very common. Three shares, three numbers, adjust in month two: it is a frame that lets you start, and starting is the hard part.',
              },
            },
          ],
          todo: {
            fr: 'Calcule les trois montants sur ton revenu net : 50 %, 30 %, 20 %. Compare-les à ce que tu as vraiment dépensé le mois dernier. L’écart est ta liste de travail.',
            en: 'Work out the three amounts on your net income: 50 %, 30 %, 20 %. Compare them with what you actually spent last month. The gap is your to-do list.',
          },
          quiz: [
            {
              ask: {
                fr: 'Ton loyer à lui seul prend 58 % de ton net. Que fais-tu ?',
                en: 'Rent alone takes 58 % of your net. What do you do?',
              },
              options: [
                { fr: 'Tu passes à 60 / 20 / 20 en protégeant la part des objectifs', en: 'Move to 60 / 20 / 20 and protect the goals share' },
                { fr: 'Tu abandonnes la règle, elle ne s’applique pas à toi', en: 'Drop the rule, it does not apply to you' },
                { fr: 'Tu mets l’épargne à zéro jusqu’à un déménagement', en: 'Zero the savings until you move' },
              ],
              answer: 0,
              why: {
                fr: 'La règle est un point de départ, pas une loi : elle plie. La part qu’on protège en pliant est celle des objectifs, parce que c’est la seule qui aura changé quelque chose dans un an.',
                en: 'The rule is a starting point, not a law: it bends. The share you protect while bending is the goals one, because it is the only one that will have changed anything a year out.',
              },
            },
          ],
        },
        {
          id: 'b2.3',
          terms: ['enveloppe'],
          state: 'written',
          title: { fr: 'Les enveloppes', en: 'The envelopes' },
          sub: {
            fr: 'Une enveloppe par décision, pas une par dépense.',
            en: 'One envelope per decision, not one per expense.',
          },
          objective: {
            fr: 'Découper ton budget en catégories assez peu nombreuses pour être tenues, et assez précises pour dire non.',
            en: 'Split the budget into categories few enough to keep, and precise enough to say no.',
          },
          points: [
            {
              lead: { fr: 'Entre six et dix, pas vingt-cinq.', en: 'Six to ten, not twenty-five.' },
              body: {
                fr: 'Vingt-cinq enveloppes demandent vingt-cinq décisions à chaque achat, et ce budget-là est abandonné en trois semaines. Regroupe : « épicerie » plutôt que fruits, viande, café. La finesse ne sert que là où tu comptes vraiment agir.',
                en: 'Twenty-five envelopes ask for twenty-five decisions at every purchase, and that budget is abandoned in three weeks. Group them: "groceries" rather than fruit, meat, coffee. Detail only earns its place where you actually intend to act.',
              },
            },
            {
              lead: { fr: 'Une enveloppe pour ce qui tombe une fois par an.', en: 'One envelope for what lands once a year.' },
              body: {
                fr: 'Immatriculation, cadeaux, rentrée, dentiste. Ce ne sont pas des imprévus : ce sont des dépenses prévisibles qu’on ne divise jamais par douze. Mettre trente dollars par mois de côté transforme une catastrophe de décembre en ligne budgétaire.',
                en: 'Registration, gifts, back to school, the dentist. These are not surprises: they are predictable costs nobody divides by twelve. Putting thirty a month aside turns a December disaster into a budget line.',
              },
            },
            {
              lead: { fr: 'Le nom de l’enveloppe fait le travail.', en: 'The name of the envelope does the work.' },
              body: {
                fr: '« Divers » se vide toujours en premier et n’apprend rien. Une enveloppe s’appelle par la décision qu’elle représente : « sorties », « transport », « imprévus ». Au moment de payer, le nom doit pouvoir répondre oui ou non.',
                en: '"Misc" always empties first and teaches nothing. An envelope is named after the decision it stands for: "going out", "transport", "unexpected". At the till, the name has to be able to answer yes or no.',
              },
            },
          ],
          todo: {
            fr: 'Ouvre l’onglet Budget, section Enveloppes, et crée les tiennes avec le montant du mois. Six à dix, dont une pour ce qui tombe une fois par an.',
            en: 'Open the Budget tab, Envelopes, and create yours with this month’s amount. Six to ten, one of them for what lands once a year.',
          },
          reflection: {
            fr: 'Regarde le nom de chacune de tes enveloppes et demande-toi : au moment de payer, est-ce que ce nom sait dire non ? « Divers » ne sait jamais.',
            en: 'Look at each envelope name and ask: at the till, can that name say no? "Misc" never can.',
          },
          quiz: [
            {
              ask: {
                fr: 'Combien d’enveloppes pour un premier budget ?',
                en: 'How many envelopes for a first budget?',
              },
              options: [
                { fr: 'Une par type de dépense, le plus précis possible', en: 'One per kind of expense, as precise as possible' },
                { fr: 'Entre six et dix, dont une pour ce qui tombe une fois par an', en: 'Six to ten, one of them for what lands once a year' },
                { fr: 'Trois : besoins, envies, épargne', en: 'Three: needs, wants, savings' },
              ],
              answer: 1,
              why: {
                fr: 'Vingt-cinq enveloppes demandent vingt-cinq décisions à chaque achat et le budget est abandonné en trois semaines. Trois seulement ne disent pas où couper. Entre six et dix, on tient et on décide.',
                en: 'Twenty-five envelopes ask for twenty-five decisions at every purchase, and that budget dies in three weeks. Three alone cannot tell you where to cut. Six to ten is where it holds and still decides.',
              },
            },
          ],
        },
        {
          id: 'b2.4',
          terms: ['fonds-urgence'],
          state: 'written',
          title: { fr: 'Se payer en premier', en: 'Paying yourself first' },
          sub: {
            fr: 'L’ordre des opérations le jour de paie.',
            en: 'The order of operations on payday.',
          },
          objective: {
            fr: 'Faire partir l’épargne avant le reste, et savoir quel montant est tenable.',
            en: 'Get savings out before everything else, and know what amount is sustainable.',
          },
          points: [
            {
              lead: { fr: 'Ce qui reste à la fin du mois est toujours zéro.', en: 'What is left at the end of the month is always zero.' },
              body: {
                fr: 'Épargner le reste ne marche pour presque personne, non par manque de volonté mais parce que les dépenses occupent l’espace disponible. Le virement part le jour de la paie, avant que l’espace existe.',
                en: 'Saving the leftovers works for almost nobody, not for lack of will but because spending expands to fill the space available. The transfer leaves on payday, before the space exists.',
              },
            },
            {
              lead: { fr: 'Automatique, sinon ça dépend de ton humeur du 15.', en: 'Automatic, or it depends on how you feel on the 15th.' },
              body: {
                fr: 'Un virement programmé vers un compte séparé le lendemain du dépôt de paie. Séparé, parce qu’un solde visible sur le compte courant est un solde disponible, et disponible finit toujours par vouloir dire dépensé.',
                en: 'A scheduled transfer to a separate account the day after pay lands. Separate, because a balance you can see in the current account is a balance you can spend, and available always ends up meaning spent.',
              },
            },
            {
              lead: { fr: 'Dix pour cent est un chiffre, pas un examen.', en: 'Ten per cent is a number, not an exam.' },
              body: {
                fr: 'Si dix pour cent est impossible ce mois-ci, mets vingt dollars. Le montant compte moins que l’existence du virement : c’est lui qu’on augmente ensuite, et augmenter un virement qui existe déjà demande trente secondes.',
                en: 'If ten per cent is impossible this month, put twenty. The amount matters less than the transfer existing: that is what gets increased later, and increasing a transfer that already exists takes thirty seconds.',
              },
            },
          ],
          todo: {
            fr: 'Programme le virement dans ton application bancaire, daté du lendemain de ta paie. Puis note le montant dans la section Épargne de l’onglet Budget.',
            en: 'Set the transfer up in your banking app, dated the day after your pay. Then record the amount in the Savings section of the Budget tab.',
          },
          quiz: [
            {
              ask: {
                fr: 'Pourquoi le virement part-il le jour de la paie plutôt qu’à la fin du mois ?',
                en: 'Why does the transfer leave on payday rather than at the end of the month?',
              },
              options: [
                { fr: 'Parce que les intérêts sont meilleurs en début de mois', en: 'Because interest is better early in the month' },
                { fr: 'Parce que les dépenses occupent tout l’espace disponible, donc il ne reste jamais rien', en: 'Because spending expands to fill the space available, so nothing is ever left' },
                { fr: 'Parce que la banque l’exige', en: 'Because the bank requires it' },
              ],
              answer: 1,
              why: {
                fr: 'Ce n’est pas une question de rendement, c’est une question d’ordre. L’argent parti avant que le mois commence n’a pas à être défendu contre le mois.',
                en: 'It is not about returns, it is about order. Money that left before the month started does not have to be defended against the month.',
              },
            },
          ],
        },
      ],
    },
    {
      n: 3,
      title: { fr: 'Le tenir', en: 'Keeping it' },
      intro: {
        fr: 'Le premier budget casse. C’est prévu, et c’est même le seul moyen d’apprendre ce que coûte vraiment ta vie. Trois leçons sur la réparation, plus le récapitulatif.',
        en: 'The first budget breaks. That is expected, and it is the only way to learn what your life actually costs. Three lessons on repair, plus the recap.',
      },
      action: {
        fr: 'À la fin de ce module tu as un rendez-vous hebdomadaire de cinq minutes dans ton calendrier, et une règle écrite pour les mois où ça déborde.',
        en: 'By the end of this module you have a weekly five-minute appointment in your calendar, and a written rule for the months that overflow.',
      },
      lessons: [
        {
          id: 'b3.1',
          state: 'written',
          title: { fr: 'Le premier mois est un brouillon', en: 'The first month is a draft' },
          sub: {
            fr: 'Se tromper de trente pour cent est la normale, pas l’échec.',
            en: 'Being thirty per cent out is normal, not failure.',
          },
          objective: {
            fr: 'Traiter le premier budget comme une hypothèse à corriger, et savoir quoi corriger en premier.',
            en: 'Treat the first budget as a hypothesis to correct, and know what to correct first.',
          },
          points: [
            {
              lead: { fr: 'Tu ne connais pas encore tes montants.', en: 'You do not know your own numbers yet.' },
              body: {
                fr: 'Presque tout le monde sous-estime l’épicerie et surestime sa capacité à ne pas commander à manger. Le premier mois mesure; le deuxième budgète. Un écart n’est pas une faute morale, c’est une donnée.',
                en: 'Almost everybody underestimates groceries and overestimates their ability not to order food. The first month measures; the second budgets. A gap is not a moral failing, it is data.',
              },
            },
            {
              lead: { fr: 'Corrige l’enveloppe, pas ta personnalité.', en: 'Fix the envelope, not your personality.' },
              body: {
                fr: 'Si l’épicerie déborde trois mois de suite de quarante dollars, ton budget épicerie est faux de quarante dollars. Monte-le, et prends les quarante ailleurs. Un budget qui te demande d’être quelqu’un d’autre perd toujours.',
                en: 'If groceries overshoot by forty three months running, your groceries budget is forty wrong. Raise it, and take the forty from somewhere else. A budget that asks you to be a different person always loses.',
              },
            },
            {
              lead: { fr: 'Trois mois avant de juger la méthode.', en: 'Three months before judging the method.' },
              body: {
                fr: 'Le mois un mesure, le mois deux corrige, le mois trois ressemble à la vie. Abandonner au mois un, c’est abandonner pendant la partie du processus qui n’est pas censée marcher.',
                en: 'Month one measures, month two corrects, month three starts to look like your life. Quitting in month one is quitting during the part of the process that is not supposed to work yet.',
              },
            },
          ],
          reflection: {
            fr: 'Quand ton budget a débordé le mois dernier, qu’est-ce que tu t’es dit ? Si la phrase parlait de toi plutôt que du chiffre, c’est le signe que tu jugeais une personne au lieu de corriger une ligne.',
            en: 'When your budget overflowed last month, what did you tell yourself? If the sentence was about you rather than about the number, you were judging a person instead of correcting a line.',
          },
          todo: {
            fr: 'Prends l’enveloppe qui a le plus débordé et change son montant maintenant, dans l’onglet Budget. Puis dis à quelle enveloppe tu retires la différence.',
            en: 'Take the envelope that overshot the most and change its amount now, in the Budget tab. Then say which envelope gives up the difference.',
          },
          quiz: [
            {
              ask: {
                fr: 'Après combien de mois peut-on juger si la méthode marche pour toi ?',
                en: 'After how many months can you judge whether the method works for you?',
              },
              options: [
                { fr: 'Un : si le premier mois casse, ce n’est pas fait pour toi', en: 'One: if the first month breaks, it is not for you' },
                { fr: 'Trois : le premier mesure, le deuxième corrige, le troisième ressemble à ta vie', en: 'Three: the first measures, the second corrects, the third looks like your life' },
                { fr: 'Douze, un cycle complet', en: 'Twelve, a full cycle' },
              ],
              answer: 1,
              why: {
                fr: 'Abandonner au mois un, c’est abandonner pendant la partie du processus qui n’est pas censée marcher. Le premier mois sert à mesurer des montants que tu ne connais pas encore.',
                en: 'Quitting in month one is quitting during the part that is not supposed to work yet. Month one exists to measure numbers you do not know yet.',
              },
            },
          ],
        },
        {
          id: 'b3.2',
          state: 'written',
          title: { fr: 'Quand une enveloppe est vide', en: 'When an envelope is empty' },
          sub: {
            fr: 'Le 18 du mois, et il reste douze jours.',
            en: 'The 18th, and twelve days to go.',
          },
          objective: {
            fr: 'Avoir une règle décidée d’avance pour le moment où une catégorie est épuisée, au lieu d’improviser avec une carte.',
            en: 'Have a rule decided in advance for the moment a category runs out, instead of improvising with a card.',
          },
          points: [
            {
              lead: { fr: 'On déplace, on ne crée pas.', en: 'You move money, you do not create it.' },
              body: {
                fr: 'L’argent vient d’une autre enveloppe, nommée à voix haute : « les sorties passent de 120 à 80, l’épicerie de 300 à 340 ». Le total ne bouge pas. C’est ce qui distingue un budget d’un vœu.',
                en: 'The money comes out of another envelope, named out loud: "going out drops from 120 to 80, groceries goes from 300 to 340". The total does not move. That is what separates a budget from a wish.',
              },
            },
            {
              lead: { fr: 'L’épargne n’est pas la variable d’ajustement par défaut.', en: 'Savings is not the default adjustment.' },
              body: {
                fr: 'C’est la plus facile à prendre et la plus chère à long terme. Si elle doit y passer, que ce soit une décision explicite et un mois précis, pas une habitude silencieuse qui annule le module 2.',
                en: 'It is the easiest to raid and the most expensive over time. If it has to go, let it be an explicit decision for a named month, not a silent habit that quietly cancels module 2.',
              },
            },
            {
              lead: { fr: 'La carte de crédit n’est pas une enveloppe.', en: 'The credit card is not an envelope.' },
              body: {
                fr: 'Payer avec la carte ne crée pas d’argent, ça déplace la dépense dans le mois suivant, avec des intérêts si le solde n’est pas payé en entier. C’est le sujet de Carte de crédit 101, et c’est le mécanisme qui transforme un dépassement de quarante dollars en solde permanent.',
                en: 'Paying by card does not create money, it moves the expense into next month, with interest if the balance is not cleared in full. That is the subject of Credit card 101, and it is the mechanism that turns a forty-dollar overshoot into a permanent balance.',
              },
            },
          ],
          todo: {
            fr: 'Écris ta règle en une phrase, maintenant, avant d’en avoir besoin : « si une enveloppe est vide, je prends dans ___, et jamais dans ___ ».',
            en: 'Write your rule in one sentence, now, before you need it: "if an envelope is empty, I take from ___, and never from ___".',
          },
          quiz: [
            {
              ask: {
                fr: 'Le 18, ton enveloppe épicerie est vide. Que fais-tu ?',
                en: 'On the 18th, your groceries envelope is empty. What do you do?',
              },
              options: [
                { fr: 'Tu paies l’épicerie avec la carte de crédit jusqu’à la prochaine paie', en: 'Pay for groceries with the credit card until the next pay' },
                { fr: 'Tu nommes l’enveloppe qui donne la différence et tu changes les deux montants', en: 'Name the envelope that gives up the difference and change both amounts' },
                { fr: 'Tu arrêtes de suivre ton budget pour ce mois-ci', en: 'Stop tracking your budget for this month' },
              ],
              answer: 1,
              why: {
                fr: 'Le budget reste vrai tant que le total ne bouge pas. La carte ne crée pas d’argent, elle déplace la dépense au mois suivant, et arrêter de suivre revient à ne pas savoir ce qui s’est passé au moment où c’est le plus utile.',
                en: 'The budget stays true as long as the total does not move. The card creates no money, it moves the expense into next month, and stopping tracking means not knowing what happened exactly when knowing helps most.',
              },
            },
          ],
        },
        {
          id: 'b3.3',
          state: 'written',
          title: { fr: 'Le rendez-vous de cinq minutes', en: 'The five-minute appointment' },
          sub: {
            fr: 'Ce qui fait qu’un budget existe encore au mois trois.',
            en: 'What makes a budget still exist in month three.',
          },
          objective: {
            fr: 'Installer une revue hebdomadaire courte, et savoir exactement quoi y regarder.',
            en: 'Set up a short weekly review, and know exactly what to look at in it.',
          },
          points: [
            {
              lead: { fr: 'Une fois par semaine, pas une fois par mois.', en: 'Once a week, not once a month.' },
              body: {
                fr: 'Une fois par mois, la seule chose qu’on peut faire est constater. Une fois par semaine, il reste trois semaines pour corriger. C’est la différence entre un tableau de bord et une autopsie.',
                en: 'Once a month, all you can do is observe. Once a week, there are three weeks left to correct. That is the difference between a dashboard and an autopsy.',
              },
            },
            {
              lead: { fr: 'Trois questions, et rien d’autre.', en: 'Three questions, and nothing else.' },
              body: {
                fr: 'Qu’est-ce qui est parti cette semaine ? Quelle enveloppe est en avance sur son rythme ? Qu’est-ce qui arrive la semaine prochaine et que je n’ai pas prévu ? Cinq minutes, pas une heure : une revue longue est une revue qu’on saute.',
                en: 'What left this week? Which envelope is running ahead of its pace? What is coming next week that I have not planned for? Five minutes, not an hour: a long review is a review that gets skipped.',
              },
            },
            {
              lead: { fr: 'Un rendez-vous, pas une intention.', en: 'An appointment, not an intention.' },
              body: {
                fr: 'Un jour, une heure, une notification. « Je regarderai quand j’aurai le temps » est la formulation d’une chose qui n’arrivera pas. L’application peut te le rappeler : c’est exactement ce que fait un événement récurrent avec un rappel.',
                en: 'A day, a time, a notification. "I will look when I get a chance" is the wording of something that will not happen. The app can remind you: that is exactly what a repeating event with a reminder is for.',
              },
            },
          ],
          todo: {
            fr: 'Ouvre le Calendrier, crée un événement récurrent de cinq minutes, le même jour chaque semaine, et coche le rappel. Dimanche soir marche bien : le mois n’est pas encore décidé.',
            en: 'Open the Calendar, create a repeating five-minute event on the same day each week, and tick the reminder. Sunday evening works well: the month is not decided yet.',
          },
          reflection: {
            fr: '« Je regarderai quand j’aurai le temps » : combien de choses as-tu déjà rangées dans cette phrase ? C’est la formulation d’une chose qui n’arrivera pas, et c’est pour ça qu’elle devient un rendez-vous.',
            en: '"I will look when I get a chance": how many things have you already filed under that sentence? It is the wording of something that will not happen, which is why it becomes an appointment.',
          },
          quiz: [
            {
              ask: {
                fr: 'Pourquoi la revue est-elle hebdomadaire et pas mensuelle ?',
                en: 'Why is the review weekly rather than monthly?',
              },
              options: [
                { fr: 'Parce qu’une fois par mois il ne reste plus qu’à constater, alors qu’il reste trois semaines pour corriger', en: 'Because once a month all you can do is observe, while weekly leaves three weeks to correct' },
                { fr: 'Parce que les banques mettent à jour chaque semaine', en: 'Because banks update weekly' },
                { fr: 'Parce que c’est plus rigoureux', en: 'Because it is more rigorous' },
              ],
              answer: 0,
              why: {
                fr: 'C’est la différence entre un tableau de bord et une autopsie. Cinq minutes le dimanche laissent le temps de déplacer une enveloppe; le 31 du mois, il n’y a plus rien à déplacer.',
                en: 'It is the difference between a dashboard and an autopsy. Five minutes on Sunday leaves time to move an envelope; on the 31st there is nothing left to move.',
              },
            },
          ],
        },
        {
          id: 'b3.4',
          terms: 'course',
          state: 'written',
          title: { fr: 'Ce qu’il faut retenir', en: 'What to take away' },
          sub: {
            fr: 'Dix leçons, une page, une check-list.',
            en: 'Ten lessons, one page, one checklist.',
          },
          objective: {
            fr: 'Repartir avec la suite exacte des gestes, dans l’ordre, sans avoir à relire le cours.',
            en: 'Leave with the exact sequence of moves, in order, without re-reading the course.',
          },
          points: [
            {
              lead: { fr: 'Un budget se fait avec trois nombres.', en: 'A budget is made of three numbers.' },
              body: {
                fr: 'Ce qui rentre en net, ce qui part sans décision, ce qui reste. Tout le reste du cours consiste à donner un rôle au troisième avant qu’il en trouve un tout seul.',
                en: 'Net in, what leaves without a decision, what is left. The rest of the course is about giving the third one a job before it finds one by itself.',
              },
            },
            {
              lead: { fr: 'Les trois piles décident où couper.', en: 'The three piles decide where to cut.' },
              body: {
                fr: 'Besoins, envies, engagements. Presque toute la marge est dans les engagements, qui se comportent comme des besoins et se résilient comme des envies.',
                en: 'Needs, wants, commitments. Nearly all the room is in the commitments, which behave like needs and cancel like wants.',
              },
            },
            {
              lead: { fr: 'Le budget est écrit avant le mois, pas pendant.', en: 'The budget is written before the month, not during it.' },
              body: {
                fr: 'Base zéro, six à dix enveloppes, l’épargne en premier et automatique. La règle 50 / 30 / 20 sert à finir le premier jet en dix minutes, pas à être respectée à la décimale.',
                en: 'Zero-based, six to ten envelopes, savings first and automatic. The 50 / 30 / 20 rule exists to get the first draft done in ten minutes, not to be honoured to the decimal.',
              },
            },
            {
              lead: { fr: 'Ce qui casse se répare en déplaçant, jamais en empruntant.', en: 'What breaks gets repaired by moving money, never by borrowing it.' },
              body: {
                fr: 'Une enveloppe vide se remplit depuis une autre, nommée. Le premier mois est un brouillon, le troisième ressemble à ta vie, et cinq minutes par semaine sont ce qui les relie.',
                en: 'An empty envelope is refilled from another, named one. The first month is a draft, the third looks like your life, and five minutes a week is what connects them.',
              },
            },
          ],
          todo: {
            fr: 'La check-list, dans l’ordre : 1) écrire le revenu net; 2) noter sept jours de dépenses; 3) trier en besoins, envies, engagements; 4) attribuer chaque dollar jusqu’à zéro; 5) créer six à dix enveloppes; 6) programmer le virement d’épargne; 7) mettre la revue de cinq minutes au calendrier. Ce qui n’est pas coché est ta semaine.',
            en: 'The checklist, in order: 1) write your net income; 2) log seven days of spending; 3) sort into needs, wants, commitments; 4) assign every dollar down to zero; 5) create six to ten envelopes; 6) schedule the savings transfer; 7) put the five-minute review in the calendar. Whatever is unticked is your week.',
          },
          quiz: [
            {
              ask: {
                fr: 'Si tu ne gardais qu’une phrase de ce cours, laquelle ?',
                en: 'If you kept one sentence from this course, which one?',
              },
              options: [
                { fr: 'Il faut dépenser moins', en: 'Spend less' },
                { fr: 'Chaque dollar reçoit un rôle avant d’arriver, et l’épargne part en premier', en: 'Every dollar gets a job before it arrives, and savings leaves first' },
                { fr: 'Il faut suivre la règle 50 / 30 / 20', en: 'Follow the 50 / 30 / 20 rule' },
              ],
              answer: 1,
              why: {
                fr: '« Dépenser moins » est un souhait sans mécanisme, et la règle 50 / 30 / 20 n’est qu’un point de départ. Ce qui fait le travail, c’est de décider avant, et de faire partir l’épargne avant que le mois ait son mot à dire.',
                en: '"Spend less" is a wish with no mechanism, and 50 / 30 / 20 is only a starting point. What does the work is deciding in advance, and getting savings out before the month has a say.',
              },
            },
            {
              ask: {
                fr: 'Au mois deux, ton épicerie a encore débordé de quarante dollars. Que fais-tu ?',
                en: 'In month two, groceries overshot by forty again. What do you do?',
              },
              options: [
                { fr: 'Tu montes le budget épicerie de quarante et tu les prends dans une autre enveloppe', en: 'Raise the groceries budget by forty and take it from another envelope' },
                { fr: 'Tu essaies plus fort le mois prochain', en: 'Try harder next month' },
                { fr: 'Tu arrêtes de budgéter l’épicerie', en: 'Stop budgeting groceries at all' },
              ],
              answer: 0,
              why: {
                fr: 'Deux mois de suite au même endroit, ce n’est pas un dérapage, c’est une mesure : ton budget épicerie est faux de quarante dollars. Un budget qui te demande d’être quelqu’un d’autre perd toujours.',
                en: 'Twice in a row in the same place is not a slip, it is a measurement: your groceries budget is forty wrong. A budget that asks you to be a different person always loses.',
              },
            },
          ],
        },
      ],
    },
  ],
}
