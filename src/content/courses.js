/* Extension explicite: ce fichier est charge par node dans courses.test.mjs,
   qui ne resout pas les imports sans extension comme le fait Vite. Meme
   convention que studies.js, schedule.js et les autres modules testes. */

/**
 * Les cours, dans le bundle et pas dans la base.
 *
 * POURQUOI PAS UNE TABLE.
 *
 * Les livres sont en base parce qu'ils sont payants: la politique RLS est le
 * paywall, et un chapitre qui voyagerait dans le bundle serait un chapitre
 * lisible par quiconque ouvre les outils de developpement. Les cours ne sont
 * pas payants aujourd'hui, donc rien de tout ca ne s'applique, et le cout de
 * la base est entierement du cote des inconvenients.
 *
 * Ce cout est reel et il a ete paye il y a deux jours: la migration 08 des
 * corps de chapitres n'avait jamais ete lancee, le lecteur affichait
 * quarante-huit paragraphes de texte de remplissage, et personne ne pouvait le
 * voir depuis le depot. Un fichier dans le bundle est en ligne des que Vercel
 * deploie, sans SQL a copier depuis un iPad.
 *
 * Le jour ou un cours devient payant, il migre vers une table avec la meme
 * politique que chapters, et cette structure se transpose ligne pour ligne.
 *
 * DEUX LANGUES, UN SEUL ARBRE.
 *
 * Chaque phrase est un objet { fr, en }. La structure, elle, n'existe qu'une
 * fois. C'est ce qui empeche une lecon d'exister dans une langue et pas dans
 * l'autre, ce qui est exactement ce qui arrive avec deux arbres paralleles: on
 * ajoute d'un cote, on oublie de l'autre, et personne ne le voit avant qu'un
 * anglophone ouvre le module. Voir say() dans src/lib/courses.js, et le test
 * qui compte les traductions manquantes.
 */

/**
 * Les quatre regions, dans l'ordre ou elles sont proposees.
 *
 * `ca` est le defaut parce que c'est la ou est le produit, et pas parce que
 * c'est la plus grande: la lecon qui compte le plus ici est celle de la zone
 * franc, et elle est ecrite avec autant de soin que les trois autres.
 */
export const COUNTRIES = [
  { id: 'ca', flag: '🇨🇦', label: { fr: 'Canada', en: 'Canada' } },
  { id: 'fr', flag: '🇫🇷', label: { fr: 'France / Europe', en: 'France / Europe' } },
  { id: 'us', flag: '🇺🇸', label: { fr: 'États-Unis', en: 'United States' } },
  { id: 'af', flag: '🌍', label: { fr: 'Afrique (BRVM / CEMAC)', en: 'Africa (BRVM / CEMAC)' } },
]

/** Ce que dit l'onboarding quand on choisit sa region. */
export const COUNTRY_ANSWERS = {
  ca: {
    fr: 'Parfait ! Ton parcours va se concentrer sur le CELI et le REER. On verra aussi le CELIAPP si une première maison est dans tes plans.',
    en: 'Good. Your path will focus on the TFSA and the RRSP. We will cover the FHSA too if a first home is in your plans.',
  },
  fr: {
    fr: 'Parfait ! Ton parcours va se concentrer sur le PEA et l’Assurance-Vie. Première chose à retenir : l’horloge fiscale démarre à l’ouverture.',
    en: 'Good. Your path will focus on the PEA and the assurance-vie. First thing to remember: the tax clock starts the day you open the account.',
  },
  us: {
    fr: 'Parfait ! Ton parcours va se concentrer sur le Roth IRA et le 401(k). On commence par l’argent gratuit : l’abondement de ton employeur.',
    en: 'Good. Your path will focus on the Roth IRA and the 401(k). We start with the free money: your employer match.',
  },
  af: {
    fr: 'Parfait ! Ton parcours va se concentrer sur les SGI et la BRVM. On verra comment ouvrir un compte-titres et reconnaître un intermédiaire agréé.',
    en: 'Good. Your path will focus on licensed brokers and the BRVM. We will cover opening a securities account and spotting a licensed intermediary.',
  },
}

/**
 * Un cours: des modules, des lecons.
 *
 * `state` vaut 'written' ou 'plan'. Une lecon en plan affiche son contenu tel
 * qu'il est, c'est-a-dire une esquisse, et le dit. C'est la seule facon
 * honnete de publier un cours en cours d'ecriture: masquer les modules non
 * rediges donnerait un produit qui a l'air fini et qui s'arrete sans prevenir.
 */
export const COURSES = [
  {
    slug: 'riche-lentement',
    title: { fr: 'Riche, lentement', en: 'Rich, slowly' },
    tagline: {
      fr: 'Du grand débutant à l’investisseur autonome. Le titre est un parti pris : une formation qui promet vite ment sur la seule variable qui fait le travail.',
      en: 'From complete beginner to investing on your own. The title is a position: a course that promises fast is lying about the one variable that does the work.',
    },
    modules: [
      {
        n: 0,
        title: {
          fr: 'Mais au fait, c’est quoi l’argent ?',
          en: 'Hold on, what is money?',
        },
        intro: {
          fr: 'Quatre leçons conceptuelles, sans un seul chiffre à retenir. Le seul module du cours qui ne demande aucune action : les autres finissent sur un geste, celui-ci finit sur une question.',
          en: 'Four conceptual lessons, not a single number to memorise. The only module that asks you to do nothing: the others end on an action, this one ends on a question.',
        },
        lessons: [
          {
            id: '0.1',
            state: 'written',
            title: { fr: 'La pierre au fond de l’océan', en: 'The stone at the bottom of the sea' },
            sub: {
              fr: 'Du troc aux billets : la grande histoire d’une illusion collective.',
              en: 'From barter to banknotes: the long story of a shared illusion.',
            },
            objective: {
              fr: 'Comprendre que l’argent n’a aucune valeur en lui-même : il est une confiance partagée, et il fonctionne exactement tant que tout le monde continue d’y croire.',
              en: 'Understand that money has no value of its own: it is shared trust, and it works exactly as long as everybody keeps believing in it.',
            },
            points: [
              {
                lead: { fr: 'L’histoire du troc est elle-même un mythe.', en: 'The barter story is itself a myth.' },
                body: {
                  fr: 'On nous a tous raconté la même chose à l’école : deux poulets contre une hache, c’était compliqué, alors on a inventé la monnaie. Les anthropologues n’ont jamais trouvé cette société-là. Ce qu’ils trouvent partout, c’est du crédit : on se doit des choses, on s’en souvient, on règle plus tard.',
                  en: 'We were all told the same thing at school: two chickens for an axe, it got complicated, so somebody invented money. Anthropologists have never found that society. What they find everywhere is credit: people owe each other things, they remember, they settle later.',
                },
              },
              {
                lead: { fr: 'L’île de Yap, et la pierre qui n’est jamais arrivée.', en: 'The island of Yap, and the stone that never arrived.' },
                body: {
                  fr: 'La monnaie y était d’énormes disques de pierre, trop lourds pour être déplacés : on changeait le propriétaire, pas la pierre. Un jour l’une d’elles coule pendant le transport. Personne ne la reverra jamais. Elle sert de monnaie pendant des générations, parce que l’île entière est d’accord sur qui la possède.',
                  en: 'Their money was enormous stone discs, far too heavy to move: you changed the owner, not the stone. One day one of them sinks in transit. Nobody will ever see it again. It goes on serving as money for generations, because the whole island agrees on who owns it.',
                },
              },
              {
                lead: { fr: 'Ton solde est une ligne dans une base de données.', en: 'Your balance is a row in a database.' },
                body: {
                  fr: 'Le billet n’est plus adossé à l’or depuis les années 1970, et l’immense majorité de l’argent qui existe n’a jamais été imprimée. Ce qui la rend réelle, ce n’est pas une matière, c’est que ton propriétaire, ton épicier et l’État acceptent la même écriture.',
                  en: 'Notes stopped being backed by gold in the 1970s, and the vast majority of the money that exists has never been printed. What makes it real is not a substance, it is that your landlord, your grocer and the state all accept the same entry.',
                },
              },
            ],
            reflection: {
              fr: 'Regarde le solde de ton compte. Ni papier, ni or, ni objet : une ligne dans l’ordinateur d’une banque. Qu’est-ce qui devrait casser dans le monde pour que cette ligne cesse de valoir quelque chose ?',
              en: 'Look at your balance. Not paper, not gold, not an object: a row in a bank’s computer. What would have to break in the world for that row to stop being worth something?',
            },
            quiz: [
              {
                ask: {
                  fr: 'Que trouvent les anthropologues avant l’apparition de la monnaie ?',
                  en: 'What do anthropologists find before money appears?',
                },
                options: [
                  {
                    fr: 'Des sociétés de troc pur, où l’on échangeait deux poulets contre une hache',
                    en: 'Pure barter societies, trading two chickens for an axe',
                  },
                  {
                    fr: 'Des systèmes de crédit et de dettes dont les gens se souvenaient et qu’ils réglaient plus tard',
                    en: 'Systems of credit and debt that people remembered and settled later',
                  },
                  {
                    fr: 'Des sociétés sans échange, où chaque foyer produisait tout ce dont il avait besoin',
                    en: 'Societies with no exchange at all, where each household made everything it needed',
                  },
                ],
                answer: 1,
                why: {
                  fr: 'Le troc est l’histoire qu’on raconte à l’école, et personne ne l’a jamais trouvée sur le terrain. La monnaie n’a donc pas remplacé le troc, elle a rendu le crédit transportable entre des inconnus qui ne se reverront jamais.',
                  en: 'Barter is the story taught at school, and nobody has ever found it in the field. So money did not replace barter; it made credit portable between strangers who will never meet again.',
                },
              },
              {
                ask: {
                  fr: 'La pierre de Yap tombée au fond de l’océan a continué de servir de monnaie. Pourquoi ?',
                  en: 'The Yap stone that sank kept working as money. Why?',
                },
                options: [
                  {
                    fr: 'Parce que les habitants espéraient encore la repêcher',
                    en: 'Because the islanders still hoped to recover it',
                  },
                  {
                    fr: 'Parce qu’un chef garantissait sa valeur et pouvait la remplacer',
                    en: 'Because a chief guaranteed its value and could replace it',
                  },
                  {
                    fr: 'Parce que toute l’île restait d’accord sur qui la possédait',
                    en: 'Because the whole island still agreed on who owned it',
                  },
                ],
                answer: 2,
                why: {
                  fr: 'La valeur n’était pas dans la pierre, elle était dans l’accord. C’est exactement ce qui fait tenir ton compte en banque : personne ne va vérifier des billets dans un coffre.',
                  en: 'The value was never in the stone, it was in the agreement. That is exactly what holds your bank account up: nobody is going to check for notes in a vault.',
                },
              },
              {
                ask: {
                  fr: 'Qu’est-ce qui rend réel l’argent affiché sur ton compte ?',
                  en: 'What makes the money shown in your account real?',
                },
                options: [
                  {
                    fr: 'Une réserve d’or détenue par la banque centrale',
                    en: 'A gold reserve held by the central bank',
                  },
                  {
                    fr: 'Le fait que ton propriétaire, ton épicier et l’État acceptent la même écriture',
                    en: 'The fact that your landlord, your grocer and the state accept the same entry',
                  },
                  {
                    fr: 'Les billets imprimés qui correspondent, quelque part, à ton solde',
                    en: 'Printed notes matching your balance, somewhere',
                  },
                ],
                answer: 1,
                why: {
                  fr: 'Le lien avec l’or a été coupé dans les années 1970 et la très grande majorité de l’argent n’a jamais été imprimée. Ce qui rend ton solde réel, c’est l’acceptation et non la matière. Bonne nouvelle : une convention, ça s’apprend.',
                  en: 'The link to gold was cut in the 1970s and the vast majority of money has never been printed. What makes your balance real is acceptance, not substance. Good news: a convention is something you can learn to play.',
                },
              },
            ],
          },
          {
            id: '0.2',
            state: 'written',
            title: { fr: 'Un mégaphone, pas un masque', en: 'A megaphone, not a mask' },
            sub: {
              fr: 'L’argent est un amplificateur, pas un monstre.',
              en: 'Money is an amplifier, not a monster.',
            },
            objective: {
              fr: 'Cesser de traiter l’argent comme une force morale et le voir comme un multiplicateur neutre de ce qui est déjà là. Le droit d’en vouloir sans se sentir sale.',
              en: 'Stop treating money as a moral force and see it as a neutral multiplier of what is already there. The right to want it without feeling dirty.',
            },
            points: [
              {
                lead: {
                  fr: 'L’argent n’invente aucun trait de caractère, il enlève les freins.',
                  en: 'Money invents no character trait, it removes the brakes.',
                },
                body: {
                  fr: 'Une personne généreuse avec 2 000 $ devient une personne généreuse avec 200 000 $. Ce que la richesse fait vraiment, c’est retirer les contraintes qui obligeaient tout le monde à se comporter à peu près pareil. Ce qui reste ensuite, c’est toi, en plus gros.',
                  en: 'A generous person with $2,000 becomes a generous person with $200,000. What wealth actually does is remove the constraints that forced everybody to behave roughly alike. What is left afterwards is you, larger.',
                },
              },
              {
                lead: { fr: 'D’où vient le tabou, et à qui il profite.', en: 'Where the taboo comes from, and who it serves.' },
                body: {
                  fr: 'Presque personne ne connaît le salaire de ses parents. On apprend très tôt que le sujet est gênant, jamais pourquoi. Le silence n’a jamais protégé la personne qui se tait ; il protège celle qui sait déjà.',
                  en: 'Almost nobody knows what their parents earned. We learn very early that the subject is awkward, never why. Silence has never protected the person keeping quiet; it protects the one who already knows.',
                },
              },
              {
                lead: {
                  fr: 'Ce que la recherche dit vraiment, et où elle s’arrête.',
                  en: 'What the research actually says, and where it stops.',
                },
                body: {
                  fr: 'Des travaux récents montrent que le bonheur continue de monter avec le revenu pour la plupart des gens, sauf pour ceux qui vont déjà mal, chez qui l’argent ne répare rien. Ni « l’argent rend heureux » ni « l’argent ne fait pas le bonheur » : il achète très efficacement l’absence de certains malheurs.',
                  en: 'Recent work shows wellbeing keeps rising with income for most people, except for those already doing badly, where money repairs nothing. Neither "money buys happiness" nor "money can’t buy happiness": it very efficiently buys the absence of certain miseries.',
                },
              },
            ],
            reflection: {
              fr: 'Termine cette phrase sans réfléchir : « Chez nous, on ne parlait jamais de _______. » Puis : qui t’a appris ça, et est-ce que cette personne avait de l’argent ?',
              en: 'Finish this sentence without thinking: "At home, we never talked about _______." Then: who taught you that, and did they have money?',
            },
          },
          {
            id: '0.3',
            state: 'written',
            title: { fr: 'Tu ne paies jamais en dollars', en: 'You never pay in dollars' },
            sub: {
              fr: 'Le temps contre l’argent : ta véritable monnaie d’échange.',
              en: 'Time against money: the currency you actually spend.',
            },
            objective: {
              fr: 'Réaliser que chaque dépense est payée en heures de vie, et que le vrai rendement de l’argent n’est pas un pourcentage mais le contrôle de son emploi du temps.',
              en: 'Realise that every purchase is paid for in hours of your life, and that the real return on money is not a percentage but control over your own time.',
            },
            points: [
              {
                lead: { fr: 'Le taux de change que personne n’affiche.', en: 'The exchange rate nobody posts.' },
                body: {
                  fr: 'Salaire net, moins le transport, les vêtements de travail, les heures non facturées mais passées quand même. Un objet à 300 $ ne coûte pas 300 $, il coûte une journée et demie de ton existence, et c’est la seule devise que tu ne peux pas gagner davantage.',
                  en: 'Take-home pay, minus the commute, the work clothes, the unbilled hours you spend anyway. A $300 object does not cost $300, it costs a day and a half of your existence, and that is the one currency you cannot earn more of.',
                },
              },
              {
                lead: {
                  fr: 'Le plus gros dividende que l’argent paie, c’est le contrôle de ton temps.',
                  en: 'The biggest dividend money pays is control over your time.',
                },
                body: {
                  fr: 'Dire non, changer de travail, être malade sans paniquer : rien de tout ça ne s’achète en magasin, tout s’achète avec de l’épargne. Les gens croient qu’ils épargnent pour des choses. Ils épargnent pour des options.',
                  en: 'Saying no, changing jobs, being ill without panicking: none of that is sold in a shop, all of it is bought with savings. People think they are saving for things. They are saving for options.',
                },
              },
              {
                lead: { fr: 'L’asymétrie qui rend tout ça urgent.', en: 'The asymmetry that makes this urgent.' },
                body: {
                  fr: 'L’argent perdu se regagne. Le temps, non. Et pourtant nous protégeons farouchement notre argent et donnons notre temps à qui le demande poliment.',
                  en: 'Money lost can be earned back. Time cannot. And yet we guard our money fiercely and hand our time to anyone who asks politely.',
                },
              },
            ],
            reflection: {
              fr: 'Calcule ton taux horaire réel, à la louche. Prends le dernier achat de plus de 100 $ que tu as fait et convertis-le en heures de ta vie. Est-ce que tu le referais ?',
              en: 'Work out your real hourly rate, roughly. Take the last thing you bought over $100 and convert it into hours of your life. Would you do it again?',
            },
          },
          {
            id: '0.4',
            state: 'written',
            title: { fr: 'La douleur qui a disparu', en: 'The pain that went away' },
            sub: { fr: 'Le piège de l’argent invisible.', en: 'The trap of invisible money.' },
            objective: {
              fr: 'Comprendre que son cerveau n’a jamais été conçu pour des paiements sans friction, et que dépenser moins n’est pas un problème de volonté mais de conception.',
              en: 'Understand that your brain was never built for frictionless payment, and that spending less is a design problem rather than a willpower problem.',
            },
            points: [
              {
                lead: { fr: 'Payer faisait mal, et c’était utile.', en: 'Paying used to hurt, and that was useful.' },
                body: {
                  fr: 'Sortir un billet et voir la monnaie revenir produit une petite douleur mesurable, que les chercheurs appellent la douleur de payer. Les travaux les plus connus montrent qu’on accepte de payer sensiblement plus cher quand on ne paie pas en liquide. L’ordre de grandeur exact se discute encore, la direction, non.',
                  en: 'Handing over a note and watching the change come back produces a small measurable sting, which researchers call the pain of paying. The best known work shows people will pay noticeably more for the same thing when they are not paying cash. The exact size is still argued over; the direction is not.',
                },
              },
              {
                lead: { fr: 'Chaque étape supprimée coûte de l’argent.', en: 'Every step removed costs you money.' },
                body: {
                  fr: 'Le liquide, puis la carte, puis le sans contact, puis le téléphone, puis le visage. Ce n’est pas une conspiration, c’est un design réussi : tout ce qui rend le paiement plus fluide augmente le paiement.',
                  en: 'Cash, then the card, then contactless, then the phone, then your face. This is not a conspiracy, it is good design working: everything that makes paying smoother increases paying.',
                },
              },
              {
                lead: {
                  fr: 'L’abonnement, forme finale de l’argent invisible.',
                  en: 'The subscription, final form of invisible money.',
                },
                body: {
                  fr: 'Une dépense qui se répète toute seule, autorisée une fois, qui ne demande plus jamais son avis. Si le système peut dépenser à ta place sans rien te demander, il peut aussi épargner à ta place de la même manière.',
                  en: 'A payment that repeats itself, authorised once, that never asks again. If the system can spend on your behalf without asking, it can save on your behalf exactly the same way.',
                },
              },
            ],
            reflection: {
              fr: 'Ouvre la liste de tes abonnements. Compte ceux que tu avais oubliés. Puis, pour chacun : si tu devais aller le repayer aujourd’hui, en billets, à un guichet, en faisant la file, est-ce que tu irais ?',
              en: 'Open your list of subscriptions. Count the ones you had forgotten. Then, for each: if you had to go and pay it again today, in cash, at a counter, in a queue, would you go?',
            },
          },
        ],
      },
      {
        n: 1,
        title: { fr: 'Personne n’est fou', en: 'Nobody is crazy' },
        intro: {
          fr: 'Le module qui désamorce la honte. Tant que quelqu’un croit que son problème est un défaut de caractère, il n’écoute pas la suite, il se défend.',
          en: 'The module that defuses the shame. As long as somebody believes their problem is a character flaw, they are not listening, they are defending themselves.',
        },
        action: { fr: 'La page unique, remplie, datée.', en: 'The single page, filled in and dated.' },
        lessons: [
          {
            id: '1.1', state: 'plan',
            title: { fr: 'Ton argent a une biographie', en: 'Your money has a biography' },
            sub: {
              fr: 'Ce que tu crois sur l’argent a été écrit par une époque, un pays et une famille que tu n’as pas choisis.',
              en: 'What you believe about money was written by a decade, a country and a family you did not choose.',
            },
          },
          {
            id: '1.2', state: 'plan',
            title: { fr: 'Riche, ou fortuné', en: 'Rich, or wealthy' },
            sub: {
              fr: 'Fortuné, c’est ce que tu ne vois pas, parce que c’est précisément l’argent qui n’a pas été dépensé.',
              en: 'Wealth is what you cannot see, because it is precisely the money that was not spent.',
            },
          },
          {
            id: '1.3', state: 'plan',
            title: { fr: 'Le temps fait le travail', en: 'Time does the work' },
            sub: {
              fr: 'Le rendement fait la vedette, la durée fait le résultat.',
              en: 'Returns get the headline, duration gets the result.',
            },
          },
          {
            id: '1.4', state: 'plan',
            title: { fr: 'Ta page unique', en: 'Your single page' },
            sub: {
              fr: 'Ce qui rentre, ce qui sort, ce que tu possèdes, ce que tu dois. Une page, pas un tableur.',
              en: 'What comes in, what goes out, what you own, what you owe. One page, not a spreadsheet.',
            },
          },
        ],
      },
      {
        n: 2,
        title: { fr: 'Ce qui te paie, ce qui te coûte', en: 'What pays you, what costs you' },
        intro: {
          fr: 'Classer chaque ligne de son argent en actif ou passif, et rediriger ce qu’on coupe vers ce qui compte.',
          en: 'Sort every line of your money into asset or liability, and send what you cut towards what you actually care about.',
        },
        action: {
          fr: 'Une dépense coupée, une dépense assumée, un virement programmé.',
          en: 'One expense cut, one spent without guilt, one transfer scheduled.',
        },
        lessons: [
          {
            id: '2.1', state: 'plan',
            title: { fr: 'La seule question', en: 'The only question' },
            sub: {
              fr: 'Est-ce que cette chose met de l’argent dans ta poche, ou est-ce qu’elle en sort ?',
              en: 'Does this thing put money in your pocket, or take it out?',
            },
          },
          {
            id: '2.2', state: 'plan',
            title: { fr: 'La dépense consciente', en: 'Conscious spending' },
            sub: {
              fr: 'Couper sans pitié ce dont tu te fous, dépenser sans culpabilité sur ce que tu aimes.',
              en: 'Cut mercilessly on what you do not care about, spend extravagantly on what you love.',
            },
          },
          {
            id: '2.3', state: 'plan',
            title: { fr: 'Le coussin avant le rendement', en: 'The cushion before the return' },
            sub: {
              fr: 'Rembourser une carte à 21 % est un rendement garanti de 21 %, net d’impôt, sans risque.',
              en: 'Paying off a card at 21 % is a guaranteed 21 % return, after tax, with no risk.',
            },
          },
          {
            id: '2.4', state: 'plan',
            title: { fr: 'Le système qui décide à ta place', en: 'The system that decides for you' },
            sub: {
              fr: 'La volonté est une ressource qui s’épuise, un virement automatique non.',
              en: 'Willpower is a resource that runs out. An automatic transfer is not.',
            },
          },
        ],
      },
      {
        n: 3,
        title: { fr: 'L’argent et les autres', en: 'Money and other people' },
        intro: {
          fr: 'Placé juste après la dépense consciente, parce que c’est exactement là qu’elle se casse la figure. Personne n’abandonne son budget seul dans sa cuisine.',
          en: 'Placed right after conscious spending, because that is exactly where conscious spending falls apart. Nobody abandons their budget alone in their kitchen.',
        },
        action: {
          fr: 'Une phrase apprise par cœur et dite pour de vrai à quelqu’un dans les deux semaines.',
          en: 'One sentence learned by heart and actually said to somebody within two weeks.',
        },
        lessons: [
          {
            id: '3.1',
            state: 'written',
            title: { fr: 'Tu n’es pas un guichet automatique', en: 'You are not a cash machine' },
            sub: {
              fr: 'Aime ta famille, mais protège tes finances.',
              en: 'Love your family, and protect your finances.',
            },
            objective: {
              fr: 'Comprendre qu’une limite n’est pas un rejet, et désapprendre l’équation entre dire non à une demande d’argent et abandonner les siens.',
              en: 'Understand that a boundary is not a rejection, and unlearn the equation between saying no to a request for money and abandoning your own people.',
            },
            points: [
              {
                lead: { fr: 'Le prêt familial n’existe pas.', en: 'There is no such thing as a family loan.' },
                body: {
                  fr: 'C’est un don auquel on a ajouté du ressentiment en option : celui qui prête compte, celui qui emprunte évite, et la relation paie la facture bien après l’argent.',
                  en: 'It is a gift with resentment added as an option: the lender keeps count, the borrower avoids, and the relationship pays the bill long after the money does.',
                },
              },
              {
                lead: { fr: 'Un pourcentage, pas un cas par cas.', en: 'A percentage, not case by case.' },
                body: {
                  fr: '« L’enveloppe famille est à sec ce mois-ci » est une information. « Je ne peux pas » est une invitation à négocier.',
                  en: '"The family envelope is empty this month" is information. "I can’t" is an invitation to negotiate.',
                },
              },
              {
                lead: {
                  fr: 'Ton non a besoin d’un chiffre, pas d’une excuse.',
                  en: 'Your no needs a number, not an excuse.',
                },
                body: {
                  fr: 'Un non chiffré ferme la discussion sans fermer la porte, et il protège la personne en face : elle sait à quoi s’en tenir et peut chercher ailleurs.',
                  en: 'A no with a number in it closes the discussion without closing the door, and it protects the other person: they know where they stand and can look elsewhere.',
                },
              },
            ],
            script: [
              {
                fr: '« Je peux mettre 100 $ ce mois-ci. Je préfère te les donner plutôt qu’on parle de remboursement, comme ça il n’y a rien qui traîne entre nous. Au-delà de ça je ne peux pas, et ce n’est pas contre toi. »',
                en: '"I can put in $100 this month. I would rather give it to you than talk about paying it back, so there is nothing hanging between us. Beyond that I can’t, and it is not about you."',
              },
              {
                fr: '« J’ai une enveloppe pour la famille, elle est à X par mois. Quand elle est vide, elle est vide. »',
                en: '"I have a family envelope, it is X a month. When it is empty, it is empty."',
              },
            ],
          },
          {
            id: '3.2',
            state: 'written',
            title: { fr: 'La note qu’on partage à parts égales', en: 'The bill split evenly' },
            sub: {
              fr: 'Choisis tes amis, et ton style de vie avec.',
              en: 'Choose your friends, and your lifestyle with them.',
            },
            objective: {
              fr: 'Comprendre que l’inflation de son train de vie est un phénomène social et non une faiblesse personnelle.',
              en: 'Understand that lifestyle creep is a social phenomenon rather than a personal weakness.',
            },
            points: [
              {
                lead: {
                  fr: 'Ton style de vie est la moyenne des cinq personnes avec qui tu sors.',
                  en: 'Your lifestyle is the average of the five people you go out with.',
                },
                body: {
                  fr: 'On ne juge jamais une dépense dans l’absolu, on la juge par rapport à ce que font les gens autour.',
                  en: 'Nobody ever judges a purchase in the abstract. We judge it against what the people around us are doing.',
                },
              },
              {
                lead: {
                  fr: 'Tu ne paies jamais le repas, tu paies l’appartenance.',
                  en: 'You never pay for the meal, you pay for belonging.',
                },
                body: {
                  fr: 'Si c’est le seul moyen d’appartenir à ce groupe, la question n’est plus le budget, c’est le groupe.',
                  en: 'If that is the only way to belong to this group, the question is no longer the budget, it is the group.',
                },
              },
              {
                lead: { fr: 'Refuse le format, jamais la personne.', en: 'Refuse the format, never the person.' },
                body: {
                  fr: 'Une contre-proposition dit « je veux te voir » avec le même argent, et le restaurant à 80 $ disparaît sans que personne ne perde la face.',
                  en: 'A counter-offer says "I want to see you" with the same money, and the $80 restaurant disappears without anybody losing face.',
                },
              },
            ],
            script: [
              {
                fr: '« Le resto je passe ce mois-ci. Mais je suis à 100 % partant pour un verre après, ou venez chez moi samedi, je cuisine. »',
                en: '"I’m skipping the restaurant this month. But I am completely up for a drink after, or come to mine on Saturday and I’ll cook."',
              },
              {
                fr: '« Moi je règle ce que j’ai pris, ça vous va ? » Six mots, dits sans s’excuser. La gêne dure trois secondes.',
                en: '"I’ll pay for what I had, is that alright?" Said without apologising. The awkwardness lasts three seconds.',
              },
            ],
          },
          {
            id: '3.3',
            state: 'written',
            title: { fr: 'La conversation qui coûte le moins cher', en: 'The cheapest conversation you will ever have' },
            sub: {
              fr: 'L’amour et l’argent : les règles du jeu en couple.',
              en: 'Love and money: the rules of the game in a couple.',
            },
            objective: {
              fr: 'Comprendre qu’une dispute d’argent n’est presque jamais une dispute d’argent, et désapprendre le « on verra plus tard ».',
              en: 'Understand that a money argument is almost never about money, and unlearn "we’ll sort it out later".',
            },
            points: [
              {
                lead: {
                  fr: 'Les disputes d’argent sont des disputes de valeurs.',
                  en: 'Money arguments are arguments about values.',
                },
                body: {
                  fr: 'Tant que la conversation reste sur le montant, elle tourne en boucle, parce que le montant n’est pas le sujet.',
                  en: 'As long as the conversation stays on the amount, it goes in circles, because the amount is not the subject.',
                },
              },
              {
                lead: {
                  fr: 'Trois architectures, aucune moralement supérieure.',
                  en: 'Three arrangements, none of them morally superior.',
                },
                body: {
                  fr: 'Tout commun, tout séparé, ou un compte commun au prorata des revenus. À revenus inégaux, le 50/50 n’est pas l’équité, c’est un transfert déguisé de celui qui gagne le moins vers celui qui gagne le plus.',
                  en: 'Everything joint, everything separate, or a joint account funded in proportion to income. On unequal incomes, 50/50 is not fairness, it is a disguised transfer from whoever earns less to whoever earns more.',
                },
              },
              {
                lead: { fr: 'Le seuil de consultation.', en: 'The check-in threshold.' },
                body: {
                  fr: 'Un montant au-dessus duquel on se prévient, décidé ensemble, une fois. En dessous, personne n’a de comptes à rendre, et c’est ça qui le rend tenable.',
                  en: 'An amount above which you tell each other, agreed together, once. Below it, nobody owes an explanation, and that is what makes it survivable.',
                },
              },
            ],
            script: [
              {
                fr: '« C’est quoi la première chose que tu as apprise sur l’argent, chez toi, quand tu étais petit ? »',
                en: '"What is the first thing you learned about money at home, when you were small?"',
              },
              {
                fr: '« Est-ce qu’on se fixe un montant au-dessus duquel on se prévient avant d’acheter ? Moi je proposerais 200 $. »',
                en: '"Shall we agree an amount above which we tell each other before buying? I would suggest $200."',
              },
            ],
          },
          {
            id: '3.4',
            state: 'written',
            title: { fr: 'Personne ne regarde ta voiture', en: 'Nobody is looking at your car' },
            sub: {
              fr: 'Maîtriser les codes cachés de la richesse.',
              en: 'The quiet codes of actual wealth.',
            },
            objective: {
              fr: 'Comprendre que les signaux extérieurs de richesse sont payés avec la richesse elle-même, et désapprendre l’équation entre visible et riche.',
              en: 'Understand that the outward signals of wealth are paid for with the wealth itself, and unlearn the equation between visible and rich.',
            },
            points: [
              {
                lead: { fr: 'Le paradoxe de l’homme dans la voiture.', en: 'The man in the car paradox.' },
                body: {
                  fr: 'Tu vois passer une voiture magnifique et tu admires la voiture. Tu ne penses pas une seconde au conducteur, tu t’imagines toi-même au volant. C’est ce que font les autres devant la tienne.',
                  en: 'You see a beautiful car go past and you admire the car. You do not think about the driver for a second, you picture yourself behind the wheel. That is exactly what other people do with yours.',
                },
              },
              {
                lead: { fr: 'La richesse est invisible par définition.', en: 'Wealth is invisible by definition.' },
                body: {
                  fr: 'Le sac acheté est de l’argent dépensé ; la richesse, c’est précisément l’argent qui n’a pas été dépensé. On imite ce qu’on voit, et ce qu’on voit est la partie qui a été détruite.',
                  en: 'The bag that was bought is money spent; wealth is precisely the money that was not. We copy what we can see, and what we can see is the part that was destroyed.',
                },
              },
              {
                lead: { fr: 'Le signal fort est souvent un signal de dette.', en: 'A loud signal is often a signal of debt.' },
                body: {
                  fr: 'Une dépense visible dit ce que quelqu’un peut payer ce mois-ci, pas ce qu’il possède, et il arrive assez souvent qu’elle dise l’inverse.',
                  en: 'Visible spending tells you what somebody can pay this month, not what they own, and often enough it tells you the opposite.',
                },
              },
            ],
            script: [
              {
                fr: '« Assez pour être tranquille, pas encore assez pour la retraite. Et toi, tu vises quoi ? »',
                en: '"Enough to be comfortable, not enough to retire. What are you aiming for?"',
              },
              {
                fr: '« Je préfère payer ma liberté que mon image. Mais je juge personne, chacun son truc. »',
                en: '"I would rather pay for my freedom than for my image. No judgement though, each to their own."',
              },
            ],
          },
        ],
      },
      {
        n: 4,
        title: { fr: 'Trois enveloppes, un ordre', en: 'Three envelopes, one order' },
        intro: {
          fr: 'Le module le plus québécois du cours : le même dollar, placé dans la mauvaise enveloppe, coûte des années de rendement en impôt. Ici on enseigne LA DÉCISION, pas la mécanique d’ouverture, qui est dans Investir 101.',
          en: 'The most Canadian module of the course: the same dollar in the wrong envelope costs years of return in tax. This one teaches THE DECISION, not the mechanics of opening an account, which live in Investing 101.',
        },
        action: {
          fr: 'Une enveloppe ouverte cette semaine, la bonne, avec la raison écrite en une phrase.',
          en: 'One account opened this week, the right one, with the reason written in a single sentence.',
        },
        lessons: [
          {
            id: '4.1', state: 'plan',
            title: { fr: 'Le CELI, l’enveloppe qui ne demande rien', en: 'The TFSA, the envelope that asks nothing' },
            sub: {
              fr: 'Le piège de calendrier : les droits retirés ne reviennent que le 1er janvier suivant.',
              en: 'The calendar trap: room you withdraw only comes back on 1 January.',
            },
          },
          {
            id: '4.2', state: 'plan',
            title: { fr: 'Le REER, un report et non un cadeau', en: 'The RRSP is a deferral, not a gift' },
            sub: {
              fr: 'Il gagne si ton taux baisse, il perd s’il monte, et c’est toute la décision.',
              en: 'It wins if your tax rate falls, it loses if it rises, and that is the whole decision.',
            },
          },
          {
            id: '4.3', state: 'plan',
            title: { fr: 'Le CELIAPP, le meilleur des deux', en: 'The FHSA, the best of both' },
            sub: {
              fr: 'Ouvre-le dès que tu es admissible, même avec 0 $ : c’est l’ouverture qui démarre l’horloge.',
              en: 'Open it the moment you qualify, even with $0: opening it is what starts the clock.',
            },
          },
          {
            id: '4.4', state: 'plan',
            title: { fr: 'L’ordre de remplissage', en: 'The filling order' },
            sub: {
              fr: 'L’argent gratuit d’abord, puis le CELIAPP, puis REER ou CELI selon le taux marginal.',
              en: 'Free money first, then the FHSA, then RRSP or TFSA depending on your marginal rate.',
            },
          },
        ],
      },
      {
        n: 5,
        title: { fr: 'Tenir', en: 'Holding on' },
        intro: {
          fr: 'Construire un portefeuille qu’on peut garder trente ans, et écrire d’avance ce qu’on fera le jour où il perdra 30 %.',
          en: 'Build a portfolio you can hold for thirty years, and write down in advance what you will do the day it falls 30 %.',
        },
        action: {
          fr: 'Le plan écrit, signé, daté, rangé quelque part où tu le retrouveras en pleine baisse.',
          en: 'The written plan, signed, dated, filed somewhere you will find it in the middle of a crash.',
        },
        lessons: [
          {
            id: '5.1', state: 'plan',
            title: { fr: 'Un fonds, pas quinze', en: 'One fund, not fifteen' },
            sub: {
              fr: 'Choisir quinze titres, c’est se donner quinze occasions de vendre au mauvais moment.',
              en: 'Picking fifteen stocks gives you fifteen chances to sell at the wrong moment.',
            },
          },
          {
            id: '5.2', state: 'plan',
            title: { fr: 'Les frais sont le seul rendement garanti', en: 'Fees are the only guaranteed return' },
            sub: {
              fr: 'Sur trente ans, 2 % contre 0,2 % changent le tiers du résultat.',
              en: 'Over thirty years, 2 % against 0.2 % changes a third of the result.',
            },
          },
          {
            id: '5.3', state: 'plan',
            title: { fr: 'Ton plan écrit', en: 'Your written plan' },
            sub: {
              fr: 'Écrit quand tout va bien, parce qu’il sert exactement quand tout va mal.',
              en: 'Written while everything is fine, because it is needed exactly when everything is not.',
            },
          },
          {
            id: '5.4', state: 'plan',
            title: { fr: 'Le krach', en: 'The crash' },
            sub: {
              fr: 'Une stratégie raisonnable que tu tiens bat une stratégie optimale que tu abandonnes.',
              en: 'A reasonable strategy you stick to beats an optimal one you abandon.',
            },
          },
        ],
      },
    ],
  },

  {
    slug: 'investir-101',
    title: { fr: 'Investir 101', en: 'Investing 101' },
    tagline: {
      fr: 'Faire travailler l’argent pour soi. Commence là où « Riche, lentement » s’arrête : le coussin est en place, les dettes chères sont mortes, et la question devient où va cet argent.',
      en: 'Putting money to work. Starts where "Rich, slowly" stops: the cushion is there, the expensive debt is dead, and the question becomes where this money goes.',
    },
    modules: [
      {
        n: 3,
        title: { fr: 'Faire travailler l’argent pour soi', en: 'Putting money to work' },
        intro: {
          fr: 'Ton rassurant, transparent sur le risque, orienté long terme. Le mot bourse fait peur à la moitié des gens et le module ne gagne rien à faire semblant du contraire : la baisse est nommée dès la première leçon.',
          en: 'Reassuring in tone, straight about risk, aimed at the long run. The word "market" frightens half the room and the module gains nothing by pretending otherwise: the drawdown is named in the first lesson.',
        },
        lessons: [
          {
            id: 'i3.1',
            state: 'written',
            title: { fr: 'Ton argent fond pendant que tu dors', en: 'Your money melts while you sleep' },
            sub: {
              fr: 'Pourquoi laisser son argent à la banque est un piège.',
              en: 'Why leaving your money in the bank is a trap.',
            },
            objective: {
              fr: 'Comprendre que l’argent qui dort perd de la valeur chaque année sans que rien ne bouge à l’écran, et que le temps est le seul ingrédient qu’on ne peut pas rattraper plus tard.',
              en: 'Understand that sleeping money loses value every year while nothing moves on the screen, and that time is the one ingredient you cannot make up for later.',
            },
            points: [
              {
                lead: { fr: 'L’inflation est une taxe que personne ne facture.', en: 'Inflation is a tax nobody invoices.' },
                body: {
                  fr: 'À 3 % par an, 1 000 $ laissés dans un compte chèque valent environ 740 $ dans dix ans en pouvoir d’achat. Le solde n’a pas bougé, et c’est ça qui rend le phénomène invisible.',
                  en: 'At 3 % a year, $1,000 left in a chequing account is worth about $740 in ten years in buying power. The balance has not moved, and that is what makes it invisible.',
                },
              },
              {
                lead: {
                  fr: 'Les intérêts composés sont exponentiels, et personne n’a d’intuition pour l’exponentiel.',
                  en: 'Compounding is exponential, and nobody has intuition for the exponential.',
                },
                body: {
                  fr: 'Sur cinq ans on voit à peine la différence ; sur trente ans elle est énorme. La courbe est ennuyeuse précisément pendant les années où il faut tenir.',
                  en: 'Over five years you can barely see the difference; over thirty it is enormous. The curve is boring precisely during the years you have to hold on.',
                },
              },
              {
                lead: { fr: 'Commencer tôt bat épargner beaucoup.', en: 'Starting early beats saving hard.' },
                body: {
                  fr: '200 $ par mois à 25 ans finit devant 400 $ par mois à 40 ans. Le second n’a pas été moins sérieux, il a eu moins d’années.',
                  en: '$200 a month from 25 ends up ahead of $400 a month from 40. The second person was not less serious, they had fewer years.',
                },
              },
            ],
            metaphor: {
              fr: 'Le congélateur débranché. Rien ne bouge, la porte est fermée, tout a l’air en ordre. C’est en ouvrant dans six mois qu’on découvre ce qui s’est passé.',
              en: 'The unplugged freezer. Nothing moves, the door is shut, everything looks fine. You find out what happened when you open it in six months.',
            },
            todo: {
              fr: 'Trouver le taux d’intérêt réel de son compte d’épargne et le comparer à l’inflation de l’an dernier. Écrire les deux chiffres l’un sous l’autre.',
              en: 'Find the actual interest rate on your savings account and compare it to last year’s inflation. Write the two numbers one under the other.',
            },
          },
          {
            id: 'i3.2',
            state: 'written',
            title: { fr: 'Prêter ou posséder', en: 'Lend or own' },
            sub: {
              fr: 'Actions contre obligations : le dictionnaire de la bourse.',
              en: 'Stocks against bonds: the market’s dictionary.',
            },
            objective: {
              fr: 'Comprendre qu’il n’existe que deux façons de mettre son argent au travail, et savoir dire laquelle rapporte le plus et laquelle dort le mieux la nuit.',
              en: 'Understand that there are only two ways to put money to work, and be able to say which pays more and which sleeps better at night.',
            },
            points: [
              {
                lead: { fr: 'Une action, c’est posséder un morceau.', en: 'A share means owning a piece.' },
                body: {
                  fr: 'Copropriétaire d’une entreprise, minuscule mais réel. Rendement historique élevé, et des baisses de 30 % ou 40 % qui reviennent régulièrement : ce n’est pas un accident du système, c’est le prix d’entrée.',
                  en: 'Part owner of a company, tiny but real. High historical returns, and falls of 30 % or 40 % that come round regularly: that is not a fault in the system, it is the entry price.',
                },
              },
              {
                lead: { fr: 'Une obligation, c’est prêter.', en: 'A bond means lending.' },
                body: {
                  fr: 'Un intérêt convenu, le capital à l’échéance, beaucoup moins de secousses. Pas « sans risque » pour autant : l’emprunteur peut faire défaut, et la valeur baisse quand les taux montent.',
                  en: 'An agreed interest, the capital back at maturity, far fewer shocks. Not "risk free" for all that: the borrower can default, and the value falls when rates rise.',
                },
              },
              {
                lead: { fr: 'Le mélange est la vraie décision.', en: 'The mix is the real decision.' },
                body: {
                  fr: 'Pas « laquelle est meilleure » mais « combien de chacune », et la réponse dépend d’une seule chose : dans combien d’années tu as besoin de cet argent. À trois ans, la bourse n’est pas un placement, c’est un pari.',
                  en: 'Not "which is better" but "how much of each", and the answer depends on one thing: how many years until you need this money. At three years, the market is not an investment, it is a bet.',
                },
              },
            ],
            metaphor: {
              fr: 'Le locataire et le propriétaire. L’obligation, c’est prêter la maison contre un loyer convenu d’avance : prévisible, plafonné. L’action, c’est posséder la maison : les mauvaises années sont pour toi, et les bonnes aussi.',
              en: 'The tenant and the owner. A bond is renting the house out for an agreed rent: predictable, capped. A share is owning the house: the bad years are yours, and so are the good ones.',
            },
            todo: {
              fr: 'Écrire une seule ligne : « J’ai besoin de cet argent dans ____ ans. » Le chiffre commande tout le reste du module.',
              en: 'Write one line: "I need this money in ____ years." That number drives everything else in the module.',
            },
          },
          {
            id: 'i3.3',
            state: 'written',
            title: { fr: 'Tout acheter d’un coup', en: 'Buy the whole thing at once' },
            sub: {
              fr: 'Les FNB : l’arme secrète de l’investisseur paresseux.',
              en: 'ETFs: the lazy investor’s secret weapon.',
            },
            objective: {
              fr: 'Comprendre qu’on n’a pas à choisir les bonnes entreprises pour investir, et que ne pas choisir est une stratégie respectable plutôt qu’un aveu d’incompétence.',
              en: 'Understand that you do not have to pick the right companies to invest, and that not picking is a respectable strategy rather than an admission of incompetence.',
            },
            points: [
              {
                lead: { fr: 'Un FNB est un panier déjà rempli.', en: 'An ETF is a basket already filled.' },
                body: {
                  fr: 'Un seul achat, et tu détiens un morceau de centaines d’entreprises. Le tout-en-un va plus loin : actions et obligations dans une proportion fixe, et il se rééquilibre seul.',
                  en: 'One purchase, and you hold a piece of hundreds of companies. The all-in-one goes further: shares and bonds in a fixed proportion, rebalancing itself.',
                },
              },
              {
                lead: {
                  fr: 'Les frais sont la seule chose que tu contrôles vraiment.',
                  en: 'Fees are the only thing you genuinely control.',
                },
                body: {
                  fr: '2 % contre 0,2 % sur trente ans ne grignote pas la marge, ça prend une part énorme du résultat final.',
                  en: '2 % against 0.2 % over thirty years does not nibble at the margin, it takes an enormous share of the final result.',
                },
              },
              {
                lead: { fr: 'Ce que le FNB ne fait pas.', en: 'What an ETF does not do.' },
                body: {
                  fr: 'Il ne protège pas des baisses : quand le marché tombe de 30 %, ton panier tombe de 30 %. Il élimine le risque de tout perdre sur une seule entreprise, et c’est le seul risque que la diversification sait traiter.',
                  en: 'It does not protect you from falls: when the market drops 30 %, your basket drops 30 %. It removes the risk of losing everything on one company, and that is the only risk diversification knows how to treat.',
                },
              },
            ],
            metaphor: {
              fr: 'Le panier de fruits du marché. Choisir soi-même quinze fruits demande de savoir lesquels sont mûrs, et un fruit pourri gâche le panier. Le panier tout prêt suit la saison : si elle est mauvaise il est moins bon, mais tu ne rentres jamais avec quinze fruits pourris.',
              en: 'The fruit basket at the market. Picking fifteen pieces yourself means knowing which are ripe, and one rotten piece spoils the lot. The ready-made basket follows the season: a bad season makes it worse, but you never come home with fifteen rotten pieces.',
            },
            todo: {
              fr: 'Ouvrir la page d’un FNB tout-en-un et lire une seule ligne : le ratio des frais de gestion. Le comparer à celui du fonds vendu par sa banque.',
              en: 'Open the page of an all-in-one ETF and read one line: the management expense ratio. Compare it to the fund your bank sells you.',
            },
          },
          {
            id: 'i3.4',
            state: 'written',
            title: { fr: 'L’enveloppe n’est pas le placement', en: 'The account is not the investment' },
            sub: {
              fr: 'Le compte que tu ouvres, et ce que tu mets dedans.',
              en: 'The account you open, and what you put in it.',
            },
            objective: {
              fr: 'Comprendre qu’une enveloppe fiscale n’est pas un placement mais un contenant, et que l’erreur la plus fréquente des débutants est d’ouvrir le compte, d’y virer de l’argent, et de croire que c’est fait.',
              en: 'Understand that a tax account is a container rather than an investment, and that the most common beginner mistake is opening it, transferring money in, and believing the job is done.',
            },
            points: [
              {
                lead: { fr: 'Le contenant et le contenu.', en: 'The container and the contents.' },
                body: {
                  fr: 'Des milliers de personnes ont un compte à l’abri de l’impôt qui ne contient que du comptant depuis des années : elles ont l’abri fiscal et rien à abriter.',
                  en: 'Thousands of people hold a tax-sheltered account that has contained nothing but cash for years: they have the shelter and nothing to shelter.',
                },
              },
              {
                lead: { fr: 'Ce que l’enveloppe change vraiment.', en: 'What the account actually changes.' },
                body: {
                  fr: 'Pas le rendement, mais ce que tu gardes du rendement. Même placement, mêmes gains, et la différence est l’impôt que tu ne paies pas.',
                  en: 'Not the return, but how much of the return you keep. Same investment, same gains, and the difference is the tax you do not pay.',
                },
              },
              {
                lead: { fr: 'Ce qu’il ne faut jamais faire.', en: 'The thing never to do.' },
                body: {
                  fr: 'Ouvrir cinq comptes chez quatre institutions. Les frais se multiplient et l’espace de cotisation devient impossible à suivre.',
                  en: 'Open five accounts at four institutions. The fees multiply and your contribution room becomes impossible to track.',
                },
              },
            ],
            metaphor: {
              fr: 'Le sac isotherme. Il ne cuisine rien et ne remplit rien : il garde ce que tu as mis dedans à la bonne température pendant le trajet. Un sac isotherme vide reste un sac vide.',
              en: 'The cool bag. It cooks nothing and fills nothing: it keeps what you put in it at the right temperature on the way home. An empty cool bag is still an empty bag.',
            },
            todo: {
              fr: 'Vérifier ses droits de cotisation auprès de l’administration de son pays, et regarder si l’argent déjà versé est investi ou s’il dort en comptant.',
              en: 'Check your contribution room with your country’s tax authority, and look at whether the money already in there is invested or sitting in cash.',
            },
          },
        ],
      },
      {
        n: 'I',
        title: {
          fr: 'Où et comment investir selon ton pays',
          en: 'Where and how to invest, depending on your country',
        },
        intro: {
          fr: 'Ce qui change d’un pays à l’autre, ce ne sont pas les questions, ce sont seulement les réponses. La leçon suit la région choisie. Aucun plafond et aucun taux n’est gravé dans le cours : ils changent tous, et une leçon qui les récite est fausse l’année suivante sans prévenir.',
          en: 'What changes from country to country is not the questions, only the answers. The lesson follows the region you picked. No limit and no rate is carved into the course: they all change, and a lesson that recites them is wrong the following year without warning.',
        },
        lessons: [
          {
            id: 'i.pays',
            state: 'written',
            title: { fr: 'Le plan de match de ta région', en: 'Your region’s game plan' },
            sub: {
              fr: 'Quel compte ouvrir en premier, et par où on passe.',
              en: 'Which account to open first, and who you go through.',
            },
            /* La lecon a geometrie variable: un tronc commun, puis quatre
               versions. C'est la structure demandee, "des rectangles a
               l'interieur des cours", et c'est aussi la seule facon de tenir
               quatre fiscalites sans quatre cours separes. */
            universal: {
              fr: 'Partout sur la planète, la même règle : on n’investit pas « dans un compte », on investit à travers un compte. Le compte est un contenant, le placement est ce qu’on met dedans. Un compte ouvert et alimenté qui ne contient que du comptant ne rapporte rien, et c’est l’erreur la plus répandue chez les débutants du monde entier.',
              en: 'Everywhere on the planet, the same rule: you do not invest "in an account", you invest through one. The account is a container, the investment is what you put in it. An account that is open, funded and holding nothing but cash returns nothing, and it is the most common beginner mistake in the world.',
            },
            byCountry: {
              ca: {
                grail: {
                  fr: 'Le CELI, en premier, pour presque tout le monde. Il ne demande aucun revenu élevé, il ne bloque rien, et un retrait n’est jamais imposé. Exception nette : si une première propriété est au programme, le CELIAPP passe devant, seul compte du pays qui déduit à l’entrée et ne taxe pas à la sortie.',
                  en: 'The TFSA, first, for almost everybody. It needs no high income, it locks nothing away, and a withdrawal is never taxed. One clear exception: if a first home is in the plan, the FHSA goes ahead of it, the only account in the country that deducts going in and does not tax coming out.',
                },
                points: [
                  {
                    lead: { fr: 'Le REER est un report, pas un cadeau.', en: 'The RRSP is a deferral, not a gift.' },
                    body: {
                      fr: 'Tu déduis à ton taux d’aujourd’hui, tu paies au taux du jour du retrait. À bas revenu, cotiser au REER peut coûter plus cher que ne rien faire.',
                      en: 'You deduct at today’s rate and pay at the rate on the day you withdraw. On a low income, contributing to an RRSP can cost you more than doing nothing.',
                    },
                  },
                  {
                    lead: { fr: 'Le CELI a un piège de calendrier.', en: 'The TFSA has a calendar trap.' },
                    body: {
                      fr: 'Les droits retirés ne reviennent que le 1er janvier suivant. Retirer 5 000 $ en juin et les remettre en octobre est un dépassement, pénalisé chaque mois.',
                      en: 'Room you withdraw only comes back on 1 January. Taking out $5,000 in June and putting it back in October is an over-contribution, penalised monthly.',
                    },
                  },
                  {
                    lead: { fr: 'Le CELIAPP se périme.', en: 'The FHSA expires.' },
                    body: {
                      fr: 'Sa durée de vie est limitée après l’ouverture, d’où le conseil qui vaut la leçon entière : l’ouvrir dès l’admissibilité, même avec 0 $.',
                      en: 'Its life is limited once opened, hence the tip that is worth the whole lesson: open it as soon as you qualify, even with $0 in it.',
                    },
                  },
                ],
                todo: {
                  fr: 'Ouvrir un compte chez un courtier à escompte plutôt qu’au comptoir de sa banque : Wealthsimple, Questrade ou Disnat. Pièce d’identité, NAS, une vingtaine de minutes. Puis relever ses droits de cotisation dans Mon dossier de l’ARC avant de verser quoi que ce soit.',
                  en: 'Open an account with a discount broker rather than at your bank counter: Wealthsimple, Questrade or Disnat. Photo ID, SIN, about twenty minutes. Then check your contribution room in CRA My Account before transferring anything.',
                },
              },
              fr: {
                grail: {
                  fr: 'Le PEA, pour qui vise les actions et le long terme. Après cinq ans de détention, les gains échappent à l’impôt sur le revenu et il ne reste que les prélèvements sociaux.',
                  en: 'The PEA, for anyone aiming at shares and the long run. After five years, gains escape income tax and only the social levies remain.',
                },
                points: [
                  {
                    lead: {
                      fr: 'L’horloge démarre à l’ouverture, pas au premier gros versement.',
                      en: 'The clock starts when you open it, not at your first real deposit.',
                    },
                    body: {
                      fr: 'D’où l’intérêt d’ouvrir un PEA aujourd’hui avec une somme symbolique : dans cinq ans, l’antériorité est acquise. Même raisonnement pour l’assurance-vie et son seuil de huit ans.',
                      en: 'Which is why opening a PEA today with a token amount matters: in five years the seniority is yours. Same reasoning for the assurance-vie and its eight-year threshold.',
                    },
                  },
                  {
                    lead: {
                      fr: 'Le PEA est européen, et ça se contourne légalement.',
                      en: 'The PEA is European, and that is legally worked around.',
                    },
                    body: {
                      fr: 'Les actions américaines n’y sont pas éligibles en direct, mais il existe des ETF éligibles au PEA qui répliquent les indices mondiaux par synthèse. Le point pratique que la plupart des débutants ignorent.',
                      en: 'US shares are not directly eligible, but there are PEA-eligible ETFs that track world indices synthetically. The practical point most beginners never hear.',
                    },
                  },
                  {
                    lead: {
                      fr: 'L’assurance-vie ne sert pas à la même chose.',
                      en: 'The assurance-vie is for something else.',
                    },
                    body: {
                      fr: 'Plus souple, imbattable pour la transmission grâce à ses abattements par bénéficiaire. Le Livret A, lui, n’est pas un investissement : c’est l’épargne de précaution.',
                      en: 'More flexible, and unbeatable for passing money on thanks to its per-beneficiary allowances. The Livret A is not an investment at all: it is your emergency fund.',
                    },
                  },
                ],
                todo: {
                  fr: 'Ouvrir un PEA chez un courtier en ligne et verser le minimum, aujourd’hui. Prendre date coûte quelques euros et ne s’achète qu’une seule fois.',
                  en: 'Open a PEA with an online broker and pay in the minimum, today. Starting the clock costs a few euros and can only be bought once.',
                },
              },
              us: {
                grail: {
                  fr: 'Le 401(k) jusqu’à concurrence de l’abondement de l’employeur, et rien d’autre avant ça. C’est un rendement immédiat de 50 % à 100 % sur chaque dollar, garanti. Ensuite seulement le Roth IRA.',
                  en: 'The 401(k) up to your employer match, and nothing else before it. That is an immediate 50 % to 100 % return on every dollar, guaranteed. Only then the Roth IRA.',
                },
                points: [
                  {
                    lead: { fr: 'L’ordre est un algorithme, pas une opinion.', en: 'The order is an algorithm, not an opinion.' },
                    body: {
                      fr: '401(k) jusqu’à l’abondement, puis Roth IRA jusqu’au plafond, puis retour au 401(k).',
                      en: '401(k) to the match, then Roth IRA to the limit, then back to the 401(k).',
                    },
                  },
                  {
                    lead: { fr: 'Le Roth est post-impôt, et c’est sa force.', en: 'The Roth is after tax, and that is its strength.' },
                    body: {
                      fr: 'Tu paies l’impôt maintenant, plus jamais après. Détail qui rassure : les cotisations d’un Roth IRA, pas les gains, peuvent être retirées à tout moment sans impôt ni pénalité.',
                      en: 'You pay the tax now and never again. A detail that reassures beginners: Roth IRA contributions, not the gains, can be withdrawn at any time with no tax and no penalty.',
                    },
                  },
                  {
                    lead: {
                      fr: 'Il existe un plafond de revenu pour le Roth IRA.',
                      en: 'There is an income limit on the Roth IRA.',
                    },
                    body: {
                      fr: 'Au-delà, la porte d’entrée normale se ferme, et le passage par une conversion est légal mais demande un vrai conseil.',
                      en: 'Above it the normal door closes, and going in through a conversion is legal but needs real advice.',
                    },
                  },
                ],
                todo: {
                  fr: 'Ouvrir son portail RH, vérifier le pourcentage d’abondement et régler sa cotisation au moins à ce niveau. Puis ouvrir un Roth IRA chez Vanguard, Fidelity ou Schwab, et acheter quelque chose dedans.',
                  en: 'Open your HR portal, check the match percentage and set your contribution at least that high. Then open a Roth IRA at Vanguard, Fidelity or Schwab, and buy something inside it.',
                },
              },
              af: {
                grail: {
                  fr: 'Il n’y en a pas d’équivalent, et le dire est la première honnêteté de la leçon : la zone UEMOA et la zone CEMAC n’ont pas d’enveloppe fiscale comparable au CELI ou au PEA. Ce que tu ouvres, c’est un compte-titres chez une SGI agréée, et l’avantage se joue ailleurs : sur les frais, sur le rendement des obligations d’État, et sur le fait d’être investi plutôt que de laisser dormir.',
                  en: 'There is no equivalent, and saying so is the lesson’s first act of honesty: the UEMOA and CEMAC zones have no tax wrapper comparable to a TFSA or a PEA. What you open is a securities account with a licensed broker, and the advantage is won elsewhere: on fees, on government bond yields, and on being invested at all rather than letting money sleep.',
                },
                points: [
                  {
                    lead: { fr: 'On ne passe pas en direct.', en: 'You cannot go direct.' },
                    body: {
                      fr: 'Acheter à la BRVM, à Abidjan, se fait obligatoirement par une société de gestion et d’intermédiation agréée. Même logique à la BVMAC de Douala pour la CEMAC. Vérifier l’agrément auprès du régulateur régional est le premier réflexe.',
                      en: 'Buying on the BRVM in Abidjan must go through a licensed brokerage. Same logic at the BVMAC in Douala for the CEMAC zone. Checking the licence with the regional regulator is the first move.',
                    },
                  },
                  {
                    lead: {
                      fr: 'La liquidité est la vraie contrainte, pas le rendement.',
                      en: 'Liquidity is the real constraint, not returns.',
                    },
                    body: {
                      fr: 'La cote régionale compte quelques dizaines de sociétés, dominée par une poignée de titres, et il n’existe pas d’équivalent local d’un FNB indiciel bon marché. On construit lentement, on ne spécule pas.',
                      en: 'The regional listing holds a few dozen companies, dominated by a handful of names, and there is no local equivalent of a cheap index ETF. You build slowly, you do not speculate.',
                    },
                  },
                  {
                    lead: {
                      fr: 'Les obligations d’État sont l’outil le plus sous-estimé de la zone.',
                      en: 'Government bonds are the most underrated tool in the zone.',
                    },
                    body: {
                      fr: 'Coupons souvent supérieurs à ce qu’un européen ou un canadien obtient à risque comparable, accessibles par la même SGI, et mieux adaptés à quelqu’un qui débute.',
                      en: 'Coupons often higher than a European or a Canadian gets at comparable risk, reachable through the same broker, and better suited to somebody starting out.',
                    },
                  },
                ],
                note: {
                  fr: 'Le point diaspora. Envoyer de l’argent au pays n’est pas investir. Un terrain acheté à distance sans titre foncier vérifié, un chantier confié à un proche sans contrat, une « opportunité » sans intermédiaire agréé : ce sont les trois façons les plus courantes de perdre dix ans d’épargne. Si personne n’est agréé et que rien n’est écrit, ce n’est pas un placement.',
                  en: 'The diaspora point. Sending money home is not investing. Land bought from a distance with no verified title, a build handed to a relative with no contract, an "opportunity" with no licensed intermediary: those are the three most common ways to lose ten years of savings. If nobody is licensed and nothing is written down, it is not an investment.',
                },
                todo: {
                  fr: 'Choisir une SGI agréée dans son pays, vérifier son agrément sur le site du régulateur régional, demander la liste des pièces à fournir, et poser une seule question au téléphone : les frais à l’achat, à la vente, et à la garde annuelle.',
                  en: 'Pick a licensed broker in your country, check the licence on the regional regulator’s site, ask for the list of documents needed, and ask one question on the phone: the fees to buy, to sell, and to hold for a year.',
                },
              },
            },
          },
        ],
      },
    ],
  },
]
