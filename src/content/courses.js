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
/**
 * L'ORDRE DU TABLEAU EST L'ORDRE DE LECTURE, ET IL EST VOULU.
 *
 * La liste des cours rend COURSES dans l'ordre du tableau. Cet ordre-la n'est
 * pas alphabetique et pas chronologique, c'est une progression:
 *
 *   1. Riche, lentement   les fondations, avant tout le reste
 *   2. Carte de credit    la dette chere, qui doit mourir AVANT d'investir
 *   3. Investir 101       dont la promesse dit elle-meme "commence la ou
 *                         Riche lentement s'arrete: le coussin est en place,
 *                         les dettes cheres sont mortes"
 *
 * Carte de credit est donc insere entre les deux et pas ajoute a la fin: mettre
 * l'investissement avant le remboursement d'un solde a 20 % est un mauvais
 * conseil, et l'etagere le dirait par son ordre meme.
 *
 * Une sonde qui visait le deuxieme cours par sa position a attrape celui-ci le
 * jour de l'insertion. C'est le prix d'un ordre qui a un sens, et la reponse
 * est de se reperer par slug: chaque carte porte data-slug.
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

  /**
   * CARTE DE CREDIT 101.
   *
   * Demande, en pointant l'etagere: "pourquoi Learn et toujours Learn, ca
   * doit etre comment utiliser une carte de credit ou Carte de credit 101".
   *
   * IL Y AVAIT DEJA UN MODULE APPELE "LA CARTE DE CREDIT", ET CE N'EST PAS CA.
   *
   * Celui de Budget 101 explique comment NOTER un achat par carte dans le
   * grand livre sans le compter deux fois. C'est de la comptabilite, utile, et
   * ca ne dit rien sur la carte elle-meme: ni le taux, ni le delai de grace,
   * ni pourquoi le paiement minimum est concu comme il est. Quelqu'un qui
   * cherche "comment utiliser une carte de credit" ne trouvait rien.
   *
   * CE COURS EST ECRIT CONTRE LA CRITIQUE FAITE A INVESTIR 101.
   *
   * Ce cours-la a ete relu comme un debutant complet et il ratait quatre
   * choses: il s'arretait avant le geste, il ne verifiait jamais ce qui avait
   * ete retenu (zero quiz sur cinq lecons), il n'avait aucune reflexion, et il
   * ne recapitulait rien. Les huit lecons ci-dessous ont donc toutes un quiz
   * et une reflexion, une lecon montre le geste, et la derniere est une
   * check-list.
   *
   * LES CHIFFRES SONT CALCULES, PAS CHOISIS.
   *
   * Ceux de la lecon c1.3 sortent d'une simulation mois par mois d'un solde de
   * 3 000 $ a 20 % annuel, minimum de 3 % du solde: 207 mois et 3 370 $
   * d'interets, contre 42 mois et 1 193 $ a 100 $ fixes. Un cours qui invente
   * ses chiffres pour faire peur perd le droit d'etre cru sur le reste.
   */
  {
    slug: 'carte-de-credit',
    title: { fr: 'Carte de crédit 101', en: 'Credit card 101' },
    tagline: {
      fr: 'L’outil le plus utile et le plus cher de ton portefeuille, selon une seule chose : est-ce que tu paies le solde en entier. Le reste du cours explique pourquoi.',
      en: 'The most useful and the most expensive tool in your wallet, depending on one thing: whether you pay the balance in full. The rest of the course explains why.',
    },
    modules: [
      {
        n: 1,
        title: { fr: 'Comment ça marche vraiment', en: 'How it actually works' },
        intro: {
          fr: 'Quatre leçons sur la mécanique. Pas de morale : une carte de crédit n’est ni bien ni mal, c’est un prêt à taux élevé assorti d’un mois de gratuité, et tout dépend de savoir lequel des deux tu utilises.',
          en: 'Four lessons on the mechanics. No morals: a credit card is neither good nor bad, it is a high-rate loan with a free month attached, and everything depends on knowing which of the two you are using.',
        },
        lessons: [
          {
            id: 'c1.1',
            state: 'written',
            title: { fr: 'Ce n’est pas ton argent', en: 'It is not your money' },
            sub: { fr: 'Ce qui se passe vraiment quand tu tapes la carte.', en: 'What actually happens when you tap the card.' },
            objective: {
              fr: 'Comprendre qu’une carte de crédit n’est pas un moyen de paiement mais un emprunt, refait à chaque achat, et savoir lire les deux soldes que la banque affiche.',
              en: 'Understand that a credit card is not a payment method but a loan, taken again at every purchase, and be able to read the two balances the bank shows you.',
            },
            points: [
              {
                lead: { fr: 'Chaque achat est un prêt.', en: 'Every purchase is a loan.' },
                body: {
                  fr: 'La banque paie le commerçant à ta place, tout de suite, et tu lui dois la somme. Un café à 4 $ payé par carte de crédit est un emprunt de 4 $. Ça n’a aucune importance tant que tu rembourses le mois même, et ça en a énormément le jour où tu ne le fais pas.',
                  en: 'The bank pays the merchant for you, immediately, and you owe it the money. A $4 coffee on a credit card is a $4 loan. That matters not at all as long as you repay within the month, and enormously the day you do not.',
                },
              },
              {
                lead: { fr: 'Il y a deux soldes, et un seul compte.', en: 'There are two balances, and only one matters.' },
                body: {
                  fr: 'Le solde courant bouge à chaque achat. Le solde du relevé est figé le jour où le relevé est émis, et c’est celui-là qu’il faut payer en entier pour ne pas payer d’intérêts. Confondre les deux est l’erreur la plus fréquente des gens qui croient pourtant bien faire.',
                  en: 'The current balance moves with every purchase. The statement balance is frozen on the day the statement is issued, and that is the one to pay in full to owe no interest. Confusing the two is the most common mistake among people who think they are doing it right.',
                },
              },
              {
                lead: { fr: 'La limite n’est pas un budget.', en: 'The limit is not a budget.' },
                body: {
                  fr: 'C’est le montant que la banque accepte de te prêter, calculé sur ce qu’elle gagne si tu ne rembourses pas tout. Elle ne l’a pas fixé en regardant ce que tu peux te permettre. Une limite qui monte n’est pas une promotion.',
                  en: 'It is the amount the bank agrees to lend you, worked out from what it earns if you do not repay in full. It was not set by looking at what you can afford. A limit going up is not a promotion.',
                },
              },
            ],
            metaphor: {
              fr: 'Une porte, pas un portefeuille. Un portefeuille contient ce que tu as. Une porte s’ouvre sur ce que quelqu’un d’autre a, et elle se referme sur une dette.',
              en: 'A door, not a wallet. A wallet holds what you have. A door opens onto what somebody else has, and it closes on a debt.',
            },
            reflection: {
              fr: 'Regarde ta limite de crédit. Ça représente combien de mois de ton loyer ? Est-ce que tu prêterais cette somme à quelqu’un qui gagne ce que tu gagnes ?',
              en: 'Look at your credit limit. How many months of your rent is that? Would you lend that much to somebody earning what you earn?',
            },
            todo: {
              fr: 'Trouve le taux d’intérêt annuel sur ton relevé, sur les achats et sur les avances de fonds. Écris les deux chiffres. La plupart des gens qui ont une carte ne les connaissent pas.',
              en: 'Find the annual interest rate on your statement, for purchases and for cash advances. Write both numbers down. Most people with a card do not know them.',
            },
            quiz: [
              {
                ask: { fr: 'Tu paies un café 4 $ avec ta carte de crédit. Que s’est-il passé ?', en: 'You pay $4 for a coffee with your credit card. What just happened?' },
                options: [
                  { fr: 'Tu as dépensé 4 $ de ton compte', en: 'You spent $4 from your account' },
                  { fr: 'Tu as emprunté 4 $ à la banque, qui a payé le café à ta place', en: 'You borrowed $4 from the bank, which paid for the coffee on your behalf' },
                  { fr: 'Rien, tant que le relevé n’est pas émis', en: 'Nothing, until the statement is issued' },
                ],
                answer: 1,
                why: {
                  fr: 'La banque avance l’argent au commerçant immédiatement. C’est un prêt, même minuscule, même remboursé trois semaines plus tard sans un centime d’intérêt. Le voir comme un prêt est ce qui change le comportement.',
                  en: 'The bank advances the money to the merchant immediately. It is a loan, however tiny, even repaid three weeks later without a cent of interest. Seeing it as a loan is what changes behaviour.',
                },
              },
              {
                ask: { fr: 'Lequel des deux soldes faut-il payer en entier pour ne pas payer d’intérêts ?', en: 'Which of the two balances must you pay in full to owe no interest?' },
                options: [
                  { fr: 'Le solde courant, celui qui bouge à chaque achat', en: 'The current balance, the one that moves with every purchase' },
                  { fr: 'Le solde du relevé, figé le jour de son émission', en: 'The statement balance, frozen on the day it was issued' },
                  { fr: 'Le paiement minimum indiqué en bas', en: 'The minimum payment shown at the bottom' },
                ],
                answer: 1,
                why: {
                  fr: 'Le solde du relevé. Payer le solde courant est possible et coûte plus cher en trésorerie sans rien apporter ; payer le minimum déclenche les intérêts sur tout. C’est une distinction que la plupart des relevés expliquent mal.',
                  en: 'The statement balance. Paying the current balance is possible and ties up more cash for no gain; paying the minimum triggers interest on everything. Most statements explain this badly.',
                },
              },
              {
                ask: { fr: 'Ta banque relève ta limite de 2 000 $ à 5 000 $ sans que tu aies rien demandé. Qu’est-ce que ça dit ?', en: 'Your bank raises your limit from $2,000 to $5,000 without you asking. What does that tell you?' },
                options: [
                  { fr: 'Que tu peux te permettre de dépenser 5 000 $', en: 'That you can afford to spend $5,000' },
                  { fr: 'Que la banque estime gagner davantage en te prêtant plus', en: 'That the bank expects to earn more by lending you more' },
                  { fr: 'Que ton dossier de crédit est excellent et qu’il n’y a rien à surveiller', en: 'That your credit file is excellent and there is nothing to watch' },
                ],
                answer: 1,
                why: {
                  fr: 'Une hausse de limite est une décision commerciale, pas une évaluation de ce que tu peux te permettre. Elle est souvent proposée à des gens qui portent un solde, parce que ce sont eux qui rapportent.',
                  en: 'A limit increase is a commercial decision, not an assessment of what you can afford. It is often offered to people carrying a balance, because they are the profitable ones.',
                },
              },
            ],
          },
          {
            id: 'c1.2',
            state: 'written',
            title: { fr: 'Le seul mois gratuit', en: 'The one free month' },
            sub: { fr: 'Le délai de grâce, et comment on le perd.', en: 'The grace period, and how you lose it.' },
            objective: {
              fr: 'Comprendre qu’une carte de crédit prête gratuitement pendant environ trois semaines, à une seule condition, et savoir exactement ce qui fait disparaître cette gratuité.',
              en: 'Understand that a credit card lends free for about three weeks, on one condition, and know exactly what makes that free period disappear.',
            },
            points: [
              {
                lead: { fr: 'La gratuité existe, et elle est écrite dans le contrat.', en: 'The free period is real, and it is written in the contract.' },
                body: {
                  fr: 'Entre l’achat et l’échéance du relevé, il s’écoule souvent de trois à sept semaines pendant lesquelles l’argent emprunté ne coûte rien. C’est la seule chose vraiment gratuite dans tout ce cours, et beaucoup de gens paient des intérêts sans savoir qu’elle existe.',
                  en: 'Between the purchase and the statement due date there are often three to seven weeks in which the borrowed money costs nothing. It is the only genuinely free thing in this whole course, and plenty of people pay interest without knowing it exists.',
                },
              },
              {
                lead: { fr: 'La condition est « en entier », pas « à temps ».', en: 'The condition is "in full", not "on time".' },
                body: {
                  fr: 'Payer 95 % du relevé à la date d’échéance ne donne pas 95 % du délai de grâce : il disparaît en entier. Les intérêts partent alors de la date de chaque achat, rétroactivement, et pas du jour où tu as manqué.',
                  en: 'Paying 95 % of the statement on the due date does not buy you 95 % of the grace period: it goes entirely. Interest then runs from the date of each purchase, retroactively, not from the day you fell short.',
                },
              },
              {
                lead: { fr: 'Une fois perdu, il ne revient pas tout de suite.', en: 'Once lost, it does not come straight back.' },
                body: {
                  fr: 'Tant qu’un solde reste, les achats NEUFS commencent souvent à porter intérêt dès le premier jour, sans aucun délai. C’est pour ça qu’un petit solde qui traîne coûte beaucoup plus cher qu’il n’en a l’air : il taxe aussi tout ce que tu achètes après.',
                  en: 'While a balance remains, NEW purchases often start accruing interest from day one, with no grace at all. That is why a small lingering balance costs far more than it looks: it taxes everything you buy afterwards too.',
                },
              },
            ],
            metaphor: {
              fr: 'La bibliothèque. Rendre le livre à temps ne coûte rien du tout. Un jour de retard, et l’amende ne porte pas sur ce jour-là : elle porte sur toutes les semaines où tu l’avais, gratuitement, sans le savoir.',
              en: 'The library. Returning the book on time costs nothing at all. One day late, and the fine is not for that day: it is for all the weeks you had it, free, without realising.',
            },
            reflection: {
              fr: 'Est-ce que tu connais, sans regarder, la date d’échéance de ta carte ? Si la réponse est non, ce n’est pas de la négligence : rien dans l’application de ta banque n’est conçu pour te la faire retenir.',
              en: 'Do you know, without looking, your card’s due date? If not, that is not carelessness: nothing in your bank’s app is designed to make you remember it.',
            },
            todo: {
              fr: 'Trouve la date d’échéance sur ton relevé et mets-la dans le calendrier de Rich & Friends, en répétition mensuelle, avec un rappel trois jours avant. C’est la seule tâche de ce cours qui empêche à elle seule presque tous les intérêts.',
              en: 'Find the due date on your statement and put it in the Rich & Friends calendar, repeating monthly, with a reminder three days before. It is the one task in this course that on its own prevents almost all the interest.',
            },
            quiz: [
              {
                ask: { fr: 'Ton relevé indique 800 $. Tu paies 780 $ à la date d’échéance. Que se passe-t-il ?', en: 'Your statement says $800. You pay $780 by the due date. What happens?' },
                options: [
                  { fr: 'Tu paies des intérêts sur les 20 $ restants seulement', en: 'You pay interest on the remaining $20 only' },
                  { fr: 'Tu perds le délai de grâce et les intérêts courent sur chaque achat depuis sa date', en: 'You lose the grace period and interest runs on each purchase from its date' },
                  { fr: 'Rien, tant que tu paies plus que le minimum', en: 'Nothing, as long as you pay more than the minimum' },
                ],
                answer: 1,
                why: {
                  fr: 'C’est la surprise la plus coûteuse de tout le cours. Le délai de grâce est tout ou rien : 20 $ manquants sur 800 $ font courir les intérêts sur les 800 $, rétroactivement. C’est écrit dans le contrat et presque jamais expliqué.',
                  en: 'This is the most expensive surprise in the course. The grace period is all or nothing: $20 short on $800 makes interest run on the $800, retroactively. It is in the contract and almost never explained.',
                },
              },
              {
                ask: { fr: 'Tu portes un solde depuis deux mois. Tu achètes un manteau aujourd’hui. À partir de quand cet achat porte-t-il intérêt ?', en: 'You have carried a balance for two months. You buy a coat today. From when does that purchase accrue interest?' },
                options: [
                  { fr: 'À partir de la prochaine échéance, comme d’habitude', en: 'From the next due date, as usual' },
                  { fr: 'Dès aujourd’hui, sans aucun délai', en: 'From today, with no grace at all' },
                  { fr: 'Seulement si tu ne paies pas le relevé suivant en entier', en: 'Only if you do not pay the next statement in full' },
                ],
                answer: 1,
                why: {
                  fr: 'Tant qu’un solde reste, le délai de grâce ne s’applique plus aux achats neufs. C’est ce qui rend un petit solde beaucoup plus cher qu’il n’en a l’air : il taxe aussi tout ce qui vient après lui.',
                  en: 'While a balance remains, the grace period no longer applies to new purchases. That is what makes a small balance far more expensive than it looks: it taxes everything that comes after it, too.',
                },
              },
              {
                ask: { fr: 'Quelle est la seule action qui garantit de ne jamais payer d’intérêts sur les achats ?', en: 'What is the only action that guarantees you never pay interest on purchases?' },
                options: [
                  { fr: 'Payer le minimum à chaque fois, sans jamais le manquer', en: 'Paying the minimum every time, never missing it' },
                  { fr: 'Payer le solde du relevé en entier, avant chaque échéance', en: 'Paying the statement balance in full, before every due date' },
                  { fr: 'Rester bien en dessous de sa limite de crédit', en: 'Staying well below your credit limit' },
                ],
                answer: 1,
                why: {
                  fr: 'Le minimum ne protège de rien sauf des frais de retard, et rester sous sa limite ne change pas un centime d’intérêt. Une seule règle compte, et elle tient en cinq mots : le relevé, en entier, à temps.',
                  en: 'The minimum protects you from nothing but late fees, and staying under your limit changes not one cent of interest. Only one rule matters, and it is five words long: the statement, in full, on time.',
                },
              },
            ],
          },
          {
            id: 'c1.3',
            state: 'written',
            title: { fr: 'Le paiement minimum', en: 'The minimum payment' },
            sub: { fr: 'Le chiffre le plus cher de ton relevé.', en: 'The most expensive number on your statement.' },
            objective: {
              fr: 'Voir en chiffres ce que coûte le paiement minimum, et comprendre qu’il n’est pas une suggestion prudente mais le montant qui maximise ce que la banque encaisse.',
              en: 'See in numbers what the minimum payment costs, and understand that it is not a cautious suggestion but the amount that maximises what the bank collects.',
            },
            points: [
              {
                lead: { fr: '3 000 $ au minimum : dix-sept ans.', en: '$3,000 at the minimum: seventeen years.' },
                body: {
                  fr: 'Un solde de 3 000 $ à 20 % par an, remboursé au minimum de 3 % du solde, prend 207 mois, soit 17,3 ans, et coûte 3 370 $ d’intérêts. Tu rembourses plus d’intérêts que le montant emprunté, et tu passes presque deux décennies dessus.',
                  en: 'A $3,000 balance at 20 % a year, repaid at the 3 % minimum, takes 207 months, which is 17.3 years, and costs $3,370 in interest. You repay more in interest than you borrowed, and you spend nearly two decades on it.',
                },
              },
              {
                lead: { fr: '100 $ fixes : trois ans et demi.', en: '$100 fixed: three and a half years.' },
                body: {
                  fr: 'Le même solde, remboursé 100 $ par mois sans jamais baisser, est éteint en 42 mois pour 1 193 $ d’intérêts. Le montant de départ est presque le même que le premier minimum ; c’est le fait de ne pas le laisser diminuer qui fait toute la différence.',
                  en: 'The same balance, repaid at a flat $100 a month, is cleared in 42 months for $1,193 in interest. The starting amount is close to the first minimum; it is refusing to let it shrink that makes the whole difference.',
                },
              },
              {
                lead: { fr: 'Le minimum baisse avec le solde, et c’est le piège.', en: 'The minimum falls with the balance, and that is the trap.' },
                body: {
                  fr: 'Un pourcentage du solde diminue à mesure que le solde diminue, donc le remboursement ralentit exactement quand il devrait accélérer. Un montant fixe, même modeste, casse cette mécanique.',
                  en: 'A percentage of the balance shrinks as the balance shrinks, so repayment slows down exactly when it should speed up. A fixed amount, however modest, breaks that mechanism.',
                },
              },
            ],
            metaphor: {
              fr: 'L’escalator qui descend. Payer le minimum, c’est monter à peu près à la vitesse à laquelle les marches descendent. Tu bouges, tu transpires, et le paysage ne change pas.',
              en: 'The down escalator. Paying the minimum is climbing at roughly the speed the steps are descending. You are moving, you are working, and the view does not change.',
            },
            reflection: {
              fr: 'Si un vendeur te proposait un prêt sur dix-sept ans pour un solde de 3 000 $, tu le signerais ? C’est exactement le contrat que le paiement minimum propose, sans jamais le formuler ainsi.',
              en: 'If a salesperson offered you a seventeen-year loan for a $3,000 balance, would you sign? That is exactly the deal the minimum payment offers, without ever putting it that way.',
            },
            todo: {
              fr: 'Si tu portes un solde, décide d’un montant fixe que tu paieras chaque mois, quoi qu’affiche le relevé, et fais-en un objectif récurrent dans Rich & Friends. Même 20 $ de plus que le minimum change le nombre d’années.',
              en: 'If you carry a balance, decide on a fixed amount you will pay every month whatever the statement says, and make it a recurring goal in Rich & Friends. Even $20 above the minimum changes the number of years.',
            },
            quiz: [
              {
                ask: { fr: 'Solde de 3 000 $ à 20 %, payé au minimum de 3 %. Combien de temps pour l’éteindre ?', en: '$3,000 at 20 %, paid at the 3 % minimum. How long to clear it?' },
                options: [
                  { fr: 'Environ 3 ans', en: 'About 3 years' },
                  { fr: 'Environ 8 ans', en: 'About 8 years' },
                  { fr: 'Plus de 17 ans', en: 'More than 17 years' },
                ],
                answer: 2,
                why: {
                  fr: '207 mois, et 3 370 $ d’intérêts, soit plus que le solde emprunté. Presque personne ne devine ce chiffre, y compris des gens qui portent un solde depuis des années : l’intuition dit trois ou quatre ans.',
                  en: '207 months, and $3,370 in interest, which is more than the amount borrowed. Almost nobody guesses this, including people who have carried a balance for years: intuition says three or four.',
                },
              },
              {
                ask: { fr: 'Sur ce même solde, payer 100 $ fixes par mois au lieu du minimum, ça donne quoi ?', en: 'On that same balance, paying a flat $100 a month instead of the minimum gives what?' },
                options: [
                  { fr: '42 mois et 1 193 $ d’intérêts', en: '42 months and $1,193 in interest' },
                  { fr: '90 mois et 2 400 $ d’intérêts', en: '90 months and $2,400 in interest' },
                  { fr: 'À peu près la même chose, le taux est identique', en: 'Roughly the same, the rate is identical' },
                ],
                answer: 0,
                why: {
                  fr: 'Dix-sept ans deviennent trois ans et demi, et les intérêts passent de 3 370 $ à 1 193 $. Le taux n’a pas bougé d’un point : c’est uniquement le refus de laisser le paiement diminuer avec le solde.',
                  en: 'Seventeen years become three and a half, and interest drops from $3,370 to $1,193. The rate did not move a single point: it is purely the refusal to let the payment shrink with the balance.',
                },
              },
              {
                ask: { fr: 'Pourquoi le paiement minimum ralentit-il le remboursement au fil du temps ?', en: 'Why does the minimum payment slow repayment down over time?' },
                options: [
                  { fr: 'Parce que le taux d’intérêt augmente à mesure que tu rembourses', en: 'Because the interest rate rises as you repay' },
                  { fr: 'Parce qu’il est un pourcentage du solde, donc il rétrécit quand le solde rétrécit', en: 'Because it is a percentage of the balance, so it shrinks as the balance shrinks' },
                  { fr: 'Parce que la banque ajoute des frais mensuels au solde', en: 'Because the bank adds monthly fees to the balance' },
                ],
                answer: 1,
                why: {
                  fr: 'Le taux ne bouge pas. C’est la forme du minimum qui est en cause : un pourcentage du solde freine exactement au moment où il faudrait accélérer, et c’est précisément ce qu’un montant fixe corrige.',
                  en: 'The rate does not move. It is the shape of the minimum: a percentage of the balance brakes exactly when it should accelerate, and that is precisely what a fixed amount fixes.',
                },
              },
            ],
          },
          {
            id: 'c1.4',
            state: 'written',
            title: { fr: 'Les frais qu’on ne voit pas', en: 'The fees you do not see' },
            sub: { fr: 'Avance de fonds, change, cotisation annuelle.', en: 'Cash advances, currency, annual fee.' },
            objective: {
              fr: 'Reconnaître les trois façons dont une carte coûte de l’argent en dehors du taux d’intérêt affiché, et savoir laquelle des trois est la plus chère de très loin.',
              en: 'Recognise the three ways a card costs money outside the advertised interest rate, and know which of the three is by far the most expensive.',
            },
            points: [
              {
                lead: { fr: 'L’avance de fonds n’a pas de délai de grâce. Aucun.', en: 'A cash advance has no grace period. None.' },
                body: {
                  fr: 'Retirer du comptant avec une carte de crédit fait courir les intérêts à la seconde, à un taux souvent plus élevé que celui des achats, plus un frais fixe prélevé tout de suite. Il n’existe aucune façon d’éviter ces intérêts, même en payant le relevé en entier le lendemain.',
                  en: 'Taking cash out with a credit card starts interest the same second, usually at a higher rate than purchases, plus a flat fee charged immediately. There is no way to avoid that interest, not even by paying the statement in full the next day.',
                },
              },
              {
                lead: { fr: 'Ce qui compte comme une avance de fonds est plus large qu’on croit.', en: 'What counts as a cash advance is wider than you think.' },
                body: {
                  fr: 'Selon les émetteurs : un virement vers un compte, l’achat de devises, certains paris et jeux, et parfois un rechargement de portefeuille électronique. La ligne se lit dans le contrat, pas sur l’écran du guichet.',
                  en: 'Depending on the issuer: a transfer to an account, buying foreign currency, some gambling, and sometimes topping up an e-wallet. That line is in the contract, not on the terminal screen.',
                },
              },
              {
                lead: { fr: 'La cotisation annuelle est un calcul, pas une opinion.', en: 'The annual fee is arithmetic, not an opinion.' },
                body: {
                  fr: 'Une carte à 120 $ par an qui rend 2 % sur tes dépenses devient rentable à partir de 6 000 $ dépensés dans l’année sur cette carte. En dessous, tu paies pour des récompenses qui te coûtent plus qu’elles ne rapportent. Le calcul se fait une fois, avec tes vrais chiffres.',
                  en: 'A card costing $120 a year that returns 2 % on your spending breaks even at $6,000 spent on it in the year. Below that, you are paying for rewards that cost more than they return. The sum is done once, with your real numbers.',
                },
              },
            ],
            metaphor: {
              fr: 'Le guichet automatique de l’aéroport. Le taux affiché en grand est le seul chiffre que tu regardes, et ce n’est jamais celui qui te coûte le plus.',
              en: 'The airport cash machine. The rate in big letters is the only number you look at, and it is never the one costing you most.',
            },
            reflection: {
              fr: 'Est-ce que tu as déjà retiré du comptant avec une carte de crédit en pensant que c’était un service neutre ? Ce n’est pas une faute : rien sur l’écran du guichet ne dit que les intérêts viennent de commencer.',
              en: 'Have you ever taken cash out on a credit card, thinking it was a neutral service? That is not a failing: nothing on the cash machine screen says the interest has just started.',
            },
            todo: {
              fr: 'Ouvre les douze derniers relevés et additionne tout ce qui n’est pas un achat : frais d’avance, frais de change, cotisation, frais de retard. Un seul total. C’est ce que la carte t’a coûté sans rien t’avoir vendu.',
              en: 'Open the last twelve statements and add up everything that is not a purchase: advance fees, currency fees, the annual fee, late fees. One total. That is what the card cost you without selling you anything.',
            },
            quiz: [
              {
                ask: { fr: 'Tu retires 200 $ au guichet avec ta carte de crédit et tu paies le relevé en entier le lendemain. Combien d’intérêts ?', en: 'You take out $200 on your credit card and pay the statement in full the next day. How much interest?' },
                options: [
                  { fr: 'Zéro, puisque tu as payé en entier et à temps', en: 'Zero, since you paid in full and on time' },
                  { fr: 'Des intérêts depuis la seconde du retrait, plus un frais fixe', en: 'Interest from the second of the withdrawal, plus a flat fee' },
                  { fr: 'Zéro, mais avec un frais fixe seulement', en: 'Zero, but with a flat fee only' },
                ],
                answer: 1,
                why: {
                  fr: 'Le délai de grâce ne couvre que les achats. Une avance de fonds porte intérêt immédiatement, souvent à un taux supérieur, et payer en entier le lendemain n’efface pas la journée écoulée ni le frais.',
                  en: 'The grace period covers purchases only. A cash advance accrues interest immediately, often at a higher rate, and paying in full the next day erases neither the day that passed nor the fee.',
                },
              },
              {
                ask: { fr: 'Une carte coûte 120 $ par an et rend 2 % sur tes achats. À partir de combien devient-elle rentable ?', en: 'A card costs $120 a year and returns 2 % on purchases. Above what spending is it worth it?' },
                options: [
                  { fr: '2 400 $ dépensés dans l’année', en: '$2,400 spent in the year' },
                  { fr: '6 000 $ dépensés dans l’année', en: '$6,000 spent in the year' },
                  { fr: '12 000 $ dépensés dans l’année', en: '$12,000 spent in the year' },
                ],
                answer: 1,
                why: {
                  fr: '120 divisé par 2 %, soit 6 000 $. En dessous, la cotisation coûte plus que les récompenses ne rapportent. C’est un calcul d’une ligne que personne ne fait avant de signer, et il se refait chaque année.',
                  en: '$120 divided by 2 %, which is $6,000. Below that, the fee costs more than the rewards return. It is a one-line sum nobody does before signing, and it is worth redoing every year.',
                },
              },
              {
                ask: { fr: 'Laquelle de ces opérations est le plus souvent traitée comme une avance de fonds ?', en: 'Which of these is most often treated as a cash advance?' },
                options: [
                  { fr: 'Un achat en ligne à l’étranger', en: 'An online purchase from abroad' },
                  { fr: 'Un virement depuis la carte vers ton compte bancaire', en: 'A transfer from the card to your bank account' },
                  { fr: 'Un abonnement mensuel prélevé automatiquement', en: 'A monthly subscription charged automatically' },
                ],
                answer: 1,
                why: {
                  fr: 'Un virement sortant est du comptant aux yeux de l’émetteur, donc sans délai de grâce. L’achat à l’étranger est un achat, avec des frais de change en plus mais le délai de grâce intact.',
                  en: 'An outgoing transfer is cash in the issuer’s eyes, so no grace period. A purchase from abroad is a purchase, with a currency fee on top but the grace period intact.',
                },
              },
            ],
          },
        ],
        action: {
          fr: 'Une seule chose à faire après ce module : mettre la date d’échéance de ta carte dans le calendrier, en répétition mensuelle, avec un rappel. Tout le reste du cours devient facultatif si celle-là est faite.',
          en: 'One thing to do after this module: put your card’s due date in the calendar, repeating monthly, with a reminder. Everything else in this course becomes optional once that one is done.',
        },
      },
      {
        n: 2,
        title: { fr: 'S’en servir, ou s’en sortir', en: 'Using it, or getting out' },
        intro: {
          fr: 'Le module précédent explique la mécanique. Celui-ci sert à deux personnes différentes : celle qui n’a pas encore de solde et veut que la carte travaille pour elle, et celle qui en a un et veut savoir par où commencer. Les deux lisent les mêmes leçons.',
          en: 'The previous module explains the mechanics. This one serves two different people: the one with no balance yet who wants the card working for them, and the one who has a balance and wants to know where to start. Both read the same lessons.',
        },
        lessons: [
          {
            id: 'c2.1',
            state: 'written',
            title: { fr: 'Ce qui construit vraiment ton dossier', en: 'What actually builds your file' },
            sub: { fr: 'Le score de crédit, sans les mythes.', en: 'The credit score, without the myths.' },
            objective: {
              fr: 'Savoir quels comportements pèsent réellement sur un dossier de crédit, et pourquoi deux gestes qui semblent responsables peuvent le faire baisser.',
              en: 'Know which behaviours actually weigh on a credit file, and why two moves that feel responsible can lower it.',
            },
            points: [
              {
                lead: { fr: 'Payer à temps pèse plus que tout le reste réuni.', en: 'Paying on time weighs more than everything else combined.' },
                body: {
                  fr: 'L’historique de paiement est le facteur le plus lourd chez tous les bureaux de crédit. Un paiement en retard laisse une trace pendant des années, et un paiement minimum fait à temps compte comme un paiement à temps : pour le dossier, pas pour ton portefeuille.',
                  en: 'Payment history is the heaviest factor at every credit bureau. One late payment leaves a mark for years, and a minimum payment made on time counts as on time: for the file, not for your wallet.',
                },
              },
              {
                lead: { fr: 'Le taux d’utilisation compte, et il se mesure au relevé.', en: 'Utilisation counts, and it is measured at the statement.' },
                body: {
                  fr: 'C’est la part de ta limite que tu utilises. La règle courante est de rester sous 30 % : 600 $ sur une limite de 2 000 $. Le chiffre transmis est souvent celui du jour du relevé, donc payer avant cette date, et pas seulement avant l’échéance, change ce qui est rapporté.',
                  en: 'It is the share of your limit you are using. The common rule is to stay under 30 %: $600 on a $2,000 limit. The figure reported is usually the one on statement day, so paying before that date, not just before the due date, changes what gets reported.',
                },
              },
              {
                lead: { fr: 'Fermer une vieille carte peut faire baisser ton score.', en: 'Closing an old card can lower your score.' },
                body: {
                  fr: 'Elle emporte son ancienneté et sa limite, donc l’âge moyen de tes comptes baisse et ton taux d’utilisation monte d’un coup, sans que tu aies dépensé un centime de plus. Fermer une carte sans frais dont on ne se sert plus est rarement le bon geste.',
                  en: 'It takes its age and its limit with it, so the average age of your accounts falls and your utilisation jumps, without you spending a cent more. Closing a no-fee card you no longer use is rarely the right move.',
                },
              },
            ],
            metaphor: {
              fr: 'Le CV. Ce qui compte n’est pas d’avoir eu un seul emploi parfait, c’est de n’avoir aucun trou et de l’avoir tenu longtemps. Effacer une vieille ligne rend le CV plus court, pas plus propre.',
              en: 'A CV. What counts is not one perfect job, it is having no gaps and having held things a long time. Deleting an old line makes the CV shorter, not cleaner.',
            },
            reflection: {
              fr: 'Ton dossier de crédit décide un jour de ton loyer, de ton assurance et de ton prêt auto. Est-ce que tu sais ce qu’il contient aujourd’hui, ou est-ce que tu le découvriras au moment où quelqu’un te dira non ?',
              en: 'Your credit file will one day decide your rent, your insurance and your car loan. Do you know what is in it today, or will you find out the moment somebody says no?',
            },
            todo: {
              fr: 'Calcule ton taux d’utilisation : solde divisé par limite, en pourcentage. Si c’est au-dessus de 30 %, essaie un paiement supplémentaire avant la date du relevé plutôt qu’avant l’échéance, et regarde ce qui est rapporté le mois suivant.',
              en: 'Work out your utilisation: balance divided by limit, as a percentage. If it is above 30 %, try an extra payment before statement day rather than before the due date, and watch what gets reported next month.',
            },
            quiz: [
              {
                ask: { fr: 'Tu as une limite de 2 000 $. Quel solde te garde sous la barre des 30 % ?', en: 'You have a $2,000 limit. What balance keeps you under 30 %?' },
                options: [
                  { fr: 'Moins de 200 $', en: 'Under $200' },
                  { fr: 'Moins de 600 $', en: 'Under $600' },
                  { fr: 'Moins de 1 000 $', en: 'Under $1,000' },
                ],
                answer: 1,
                why: {
                  fr: '30 % de 2 000 $ font 600 $. Et le chiffre qui compte est celui du jour du relevé, pas celui de l’échéance : quelqu’un qui paie toujours en entier peut quand même faire rapporter un taux élevé.',
                  en: '30 % of $2,000 is $600. And the number that counts is the one on statement day, not the due date: somebody who always pays in full can still have a high figure reported.',
                },
              },
              {
                ask: { fr: 'Tu as une vieille carte sans frais que tu n’utilises plus. Que se passe-t-il si tu la fermes ?', en: 'You have an old no-fee card you no longer use. What happens if you close it?' },
                options: [
                  { fr: 'Ton score monte, tu as un compte de moins à gérer', en: 'Your score rises, one less account to manage' },
                  { fr: 'Ton score peut baisser : tu perds son ancienneté et sa limite', en: 'Your score can fall: you lose its age and its limit' },
                  { fr: 'Rien ne change tant que le solde était à zéro', en: 'Nothing changes, since the balance was zero' },
                ],
                answer: 1,
                why: {
                  fr: 'C’est le geste contre-intuitif du cours. Fermer un compte réduit l’âge moyen de ton dossier et retire sa limite du total, donc ton taux d’utilisation monte alors que tu n’as rien dépensé de plus.',
                  en: 'This is the counter-intuitive move in the course. Closing an account lowers your file’s average age and removes its limit from the total, so your utilisation rises although you spent nothing more.',
                },
              },
              {
                ask: { fr: 'Quel facteur pèse le plus lourd dans un dossier de crédit ?', en: 'Which factor weighs heaviest in a credit file?' },
                options: [
                  { fr: 'Le nombre de cartes que tu possèdes', en: 'How many cards you hold' },
                  { fr: 'L’historique de paiement, donc payer à temps', en: 'Payment history, meaning paying on time' },
                  { fr: 'Ton revenu annuel', en: 'Your annual income' },
                ],
                answer: 1,
                why: {
                  fr: 'Le revenu ne figure même pas dans le calcul du score chez la plupart des bureaux. C’est le comportement de remboursement qui domine, très loin devant le reste, et c’est aussi le seul facteur entièrement sous ton contrôle chaque mois.',
                  en: 'Income does not even enter the score calculation at most bureaus. Repayment behaviour dominates, far ahead of everything else, and it is also the only factor entirely under your control every month.',
                },
              },
            ],
          },
          {
            id: 'c2.2',
            state: 'written',
            title: { fr: 'Déjà dedans', en: 'Already in it' },
            sub: { fr: 'Sortir d’un solde qui ne bouge plus.', en: 'Getting out of a balance that will not move.' },
            objective: {
              fr: 'Savoir dans quel ordre attaquer des dettes, et découvrir que la banque a des options qu’elle n’offre jamais spontanément.',
              en: 'Know what order to attack debts in, and discover that the bank has options it never offers unprompted.',
            },
            points: [
              {
                lead: { fr: 'Arrêter l’hémorragie passe avant tout le reste.', en: 'Stopping the bleed comes before everything else.' },
                body: {
                  fr: 'Tant que la carte sert encore aux achats du quotidien, le solde se reconstitue aussi vite qu’il descend. Sortir la carte du portefeuille, la retirer des paiements enregistrés en ligne, et payer en débit le temps de la vider.',
                  en: 'While the card is still paying for daily life, the balance rebuilds as fast as it falls. Take the card out of your wallet, remove it from saved online payments, and pay by debit until it is empty.',
                },
              },
              {
                lead: { fr: 'Deux ordres possibles, et ils ne visent pas la même chose.', en: 'Two possible orders, aiming at different things.' },
                body: {
                  fr: 'Le taux le plus élevé d’abord coûte le moins cher en arithmétique. Le plus petit solde d’abord donne une dette éteinte plus vite, donc une preuve que ça marche. Si tu as déjà abandonné deux fois, la preuve vaut plus que les quelques dollars d’écart.',
                  en: 'Highest rate first is cheapest arithmetically. Smallest balance first clears one debt sooner, which is proof that it works. If you have already given up twice, the proof is worth more than the few dollars of difference.',
                },
              },
              {
                lead: { fr: 'La banque a des options qu’elle n’offre jamais d’elle-même.', en: 'The bank has options it never offers on its own.' },
                body: {
                  fr: 'Un taux réduit sur demande, le passage à une carte à taux bas, un prêt personnel à taux plus faible qui rachète le solde, un plan de remboursement. Rien de tout ça n’apparaît dans l’application : ça se demande au téléphone, et un non n’est pas définitif.',
                  en: 'A lower rate on request, a switch to a low-rate card, a personal loan at a lower rate that buys out the balance, a repayment plan. None of it appears in the app: you ask on the phone, and a no is not final.',
                },
              },
            ],
            metaphor: {
              fr: 'Le seau percé. Écoper plus vite est épuisant et ne règle rien tant que le trou est ouvert. On bouche d’abord, on écope ensuite.',
              en: 'The leaking bucket. Bailing faster is exhausting and settles nothing while the hole is open. Plug first, bail second.',
            },
            reflection: {
              fr: 'Un solde de carte n’est pas un jugement moral sur toi. C’est un produit conçu, vendu, et rentable précisément quand il est mal compris. Est-ce que tu te parles comme tu parlerais à un ami dans la même situation ?',
              en: 'A card balance is not a moral judgement on you. It is a product, designed and sold, and profitable precisely when it is misunderstood. Do you talk to yourself the way you would talk to a friend in the same spot?',
            },
            todo: {
              fr: 'Écris toutes tes dettes en une colonne : le solde, le taux, le paiement minimum. Rien d’autre. La plupart des gens ne les ont jamais vues côte à côte, et c’est la vue qui rend la décision évidente.',
              en: 'Write every debt in one column: balance, rate, minimum payment. Nothing else. Most people have never seen them side by side, and it is that view that makes the decision obvious.',
            },
            script: [
              {
                fr: 'Bonjour, je porte un solde sur ma carte depuis quelques mois et le taux est à [X] %. Je veux le rembourser. Est-ce que vous pouvez baisser mon taux, ou est-ce que j’ai droit à une carte à taux réduit chez vous ?',
                en: 'Hello, I have been carrying a balance for a few months and the rate is [X] %. I want to clear it. Can you lower my rate, or do I qualify for a low-rate card with you?',
              },
              {
                fr: 'Si c’est non : est-ce que vous proposez un prêt personnel qui rachèterait ce solde à un taux plus bas ? Quel serait le taux et sur combien de mois ?',
                en: 'If that is no: do you offer a personal loan that would buy out this balance at a lower rate? What rate, and over how many months?',
              },
              {
                fr: 'Merci. Je note votre nom et la date. Je rappellerai le mois prochain si la situation n’a pas changé.',
                en: 'Thank you. I am noting your name and the date. I will call back next month if nothing has changed.',
              },
            ],
            quiz: [
              {
                ask: { fr: 'Tu commences à rembourser un solde mais tu continues à payer tes courses avec la carte. Que se passe-t-il ?', en: 'You start clearing a balance but keep paying for groceries with the card. What happens?' },
                options: [
                  { fr: 'Ça va, tant que tu paies plus que ce que tu dépenses', en: 'Fine, as long as you pay more than you spend' },
                  { fr: 'Le solde se reconstitue, et les achats neufs portent intérêt dès le premier jour', en: 'The balance rebuilds, and new purchases accrue interest from day one' },
                  { fr: 'Rien, les nouveaux achats gardent leur délai de grâce', en: 'Nothing, new purchases keep their grace period' },
                ],
                answer: 1,
                why: {
                  fr: 'C’est la leçon c1.2 qui revient : tant qu’un solde reste, le délai de grâce ne protège plus les achats neufs. Continuer à utiliser la carte pendant un remboursement rend chaque course plus chère qu’en débit.',
                  en: 'Lesson c1.2 comes back: while a balance remains, the grace period no longer protects new purchases. Using the card during a repayment makes every shop more expensive than debit would be.',
                },
              },
              {
                ask: { fr: 'Tu as trois dettes. Laquelle attaquer en premier si tu as déjà abandonné deux fois ?', en: 'You have three debts. Which first, if you have already given up twice?' },
                options: [
                  { fr: 'Le taux le plus élevé, c’est mathématiquement le moins cher', en: 'The highest rate, mathematically the cheapest' },
                  { fr: 'Le plus petit solde, pour en éteindre une vite et avoir la preuve que ça marche', en: 'The smallest balance, to clear one fast and have proof it works' },
                  { fr: 'Toutes en même temps, à parts égales', en: 'All at once, in equal parts' },
                ],
                answer: 1,
                why: {
                  fr: 'L’arithmétique dit le taux le plus élevé, et elle a raison de quelques dollars. Mais un plan qu’on abandonne coûte cent pour cent. Quand la tenue est le vrai risque, la victoire rapide vaut plus que l’optimum théorique.',
                  en: 'Arithmetic says highest rate, and it is right by a few dollars. But a plan you abandon costs a hundred per cent. When sticking to it is the real risk, the quick win beats the theoretical optimum.',
                },
              },
              {
                ask: { fr: 'Que peux-tu obtenir en appelant ta banque, que l’application ne propose jamais ?', en: 'What can a phone call to your bank get you that the app never offers?' },
                options: [
                  { fr: 'Rien, les taux sont fixes et identiques pour tout le monde', en: 'Nothing, rates are fixed and the same for everyone' },
                  { fr: 'Un taux réduit, une carte à taux bas, ou un prêt qui rachète le solde', en: 'A lower rate, a low-rate card, or a loan that buys out the balance' },
                  { fr: 'L’effacement d’une partie du solde', en: 'Part of the balance written off' },
                ],
                answer: 1,
                why: {
                  fr: 'Rien n’est effacé, mais un taux se négocie plus souvent qu’on ne le croit, surtout auprès de quelqu’un qui paie à temps. Ça ne s’affiche nulle part parce que ça ne se propose pas : ça se demande.',
                  en: 'Nothing gets written off, but a rate is negotiable more often than people think, especially for somebody who pays on time. It appears nowhere because it is not offered: it is asked for.',
                },
              },
            ],
          },
          {
            id: 'c2.3',
            state: 'written',
            title: { fr: 'La carte dans ton pays', en: 'The card where you live' },
            sub: { fr: 'Le même objet ne veut pas dire la même chose partout.', en: 'The same object does not mean the same thing everywhere.' },
            objective: {
              fr: 'Savoir si la carte qu’on te propose est du crédit ou du débit déguisé, et reconnaître le produit piège de sa propre région.',
              en: 'Know whether the card you are offered is credit or disguised debit, and recognise your own region’s trap product.',
            },
            universal: {
              fr: 'Partout, la même première question, et elle n’est pas « quelles récompenses » : est-ce que ce bout de plastique dépense mon argent ou celui de la banque ? Une carte de débit prend ce que tu as. Une carte de crédit emprunte. Entre les deux existent des produits qui portent le mot carte et ne se comportent comme aucun des deux, et c’est là que les gens se font avoir.',
              en: 'Everywhere, the same first question, and it is not "which rewards": does this piece of plastic spend my money or the bank’s? A debit card takes what you have. A credit card borrows. Between the two sit products that carry the word card and behave like neither, and that is where people get caught.',
            },
            byCountry: {
              ca: {
                grail: {
                  fr: 'Le réflexe qui règle presque tout : le paiement automatique du SOLDE COMPLET, pas du minimum, programmé chez ta banque le jour de l’échéance. Il transforme la carte en carte de débit avec un mois de décalage, et supprime d’un coup le délai de grâce perdu, les frais de retard et la marque au dossier.',
                  en: 'The one habit that settles almost everything: an automatic payment of the FULL statement balance, not the minimum, set up at your bank for the due date. It turns the card into a debit card with a month’s delay, and removes at a stroke the lost grace period, the late fees and the mark on your file.',
                },
                points: [
                  {
                    lead: { fr: 'Deux bureaux, deux dossiers.', en: 'Two bureaus, two files.' },
                    body: {
                      fr: 'Equifax et TransUnion tiennent chacun le leur, et ils ne contiennent pas toujours la même chose. Les deux sont consultables gratuitement, et une erreur sur l’un ne se corrige pas toute seule sur l’autre.',
                      en: 'Equifax and TransUnion each hold their own, and they do not always contain the same thing. Both can be checked free, and an error on one does not fix itself on the other.',
                    },
                  },
                  {
                    lead: { fr: 'Au Québec, le paiement minimum légal a été relevé par étapes.', en: 'In Quebec, the legal minimum payment has been raised in stages.' },
                    body: {
                      fr: 'C’est une protection, pas une contrainte : un minimum plus élevé raccourcit énormément la durée de remboursement, exactement dans le sens de la leçon c1.3. Ailleurs au pays le minimum reste bas, donc le montant fixe que tu décides toi-même compte encore plus.',
                      en: 'That is a protection, not a constraint: a higher minimum shortens repayment enormously, exactly along the lines of lesson c1.3. Elsewhere in the country the minimum stays low, so the fixed amount you set yourself matters even more.',
                    },
                  },
                  {
                    lead: { fr: 'Les cartes de magasin sont les plus chères du marché.', en: 'Store cards are the most expensive on the market.' },
                    body: {
                      fr: 'Offertes à la caisse contre un rabais immédiat, à des taux souvent bien supérieurs à ceux d’une carte bancaire ordinaire. Le rabais est payé une fois, le taux court tant qu’il reste un solde.',
                      en: 'Offered at the till against an instant discount, at rates often well above an ordinary bank card. The discount is paid once, the rate runs as long as a balance remains.',
                    },
                  },
                ],
                todo: {
                  fr: 'Ouvre l’application de ta banque et programme le paiement automatique du solde complet à l’échéance. Puis demande ton dossier de crédit gratuit chez Equifax et chez TransUnion, et lis-les.',
                  en: 'Open your bank app and set up the automatic full-balance payment on the due date. Then request your free credit file from both Equifax and TransUnion, and read them.',
                },
              },
              fr: {
                grail: {
                  fr: 'En France, la question numéro un est : est-ce du débit différé ou du crédit renouvelable ? La carte à débit différé prélève TON argent en fin de mois, ne coûte aucun intérêt, et n’est pas un crédit. Le crédit renouvelable est un vrai prêt à taux élevé, souvent adossé à une carte de magasin, et c’est le produit qui fait le plus de dégâts dans le pays.',
                  en: 'In France the first question is: deferred debit or revolving credit? A deferred-debit card takes YOUR money at month end, costs no interest, and is not credit. Revolving credit is a real high-rate loan, often attached to a store card, and it is the product that does the most damage in the country.',
                },
                points: [
                  {
                    lead: { fr: 'Le débit différé n’est pas gratuit pour autant.', en: 'Deferred debit is not free for all that.' },
                    body: {
                      fr: 'Il ne coûte pas d’intérêts, mais il décale la lecture de ton compte : le solde affiché ne dit plus ce que tu as, il dit ce que tu as moins ce qui n’est pas encore prélevé. C’est un piège de trésorerie, pas un piège de taux.',
                      en: 'It costs no interest, but it distorts how you read your account: the balance shown no longer says what you have, it says what you have minus what has not been taken yet. That is a cash-flow trap, not a rate trap.',
                    },
                  },
                  {
                    lead: { fr: 'Le crédit renouvelable se vend là où on ne l’attend pas.', en: 'Revolving credit is sold where you least expect it.' },
                    body: {
                      fr: 'À la caisse d’un magasin, dans une offre de fidélité, dans un financement en plusieurs fois. La loi impose depuis des années un remboursement minimum du capital à chaque échéance, précisément parce que sans ça le solde ne descendait jamais.',
                      en: 'At a shop till, inside a loyalty offer, inside a pay-in-instalments deal. The law has for years required a minimum repayment of capital at each instalment, precisely because without it the balance never came down.',
                    },
                  },
                  {
                    lead: { fr: 'Il n’y a pas de score de crédit à la française.', en: 'There is no French credit score.' },
                    body: {
                      fr: 'Pas d’équivalent d’Equifax : ce qui existe est le FICP, un fichier d’incidents tenu par la Banque de France. On n’y construit rien de positif, on peut seulement y entrer. C’est l’inverse exact de la logique nord-américaine.',
                      en: 'No Equifax equivalent: what exists is the FICP, an incident file held by the Banque de France. You build nothing positive in it, you can only end up in it. That is the exact inverse of the North American logic.',
                    },
                  },
                ],
                todo: {
                  fr: 'Sors ta carte et cherche la mention « débit immédiat » ou « débit différé » sur ton contrat. Puis vérifie qu’aucune carte de magasin dans ton portefeuille n’est adossée à un crédit renouvelable ouvert.',
                  en: 'Take out your card and look for "débit immédiat" or "débit différé" on your contract. Then check that no store card in your wallet has an open revolving credit attached.',
                },
              },
              us: {
                grail: {
                  fr: 'Le paiement automatique du solde complet, comme partout, et une deuxième règle propre au pays : ne jamais accepter une offre « 0 % » sans avoir lu ce qui se passe à la fin. Certaines, surtout chez les enseignes, sont à intérêts différés : si le solde n’est pas à zéro à la date butoir, tous les intérêts de la période sont facturés rétroactivement, d’un coup.',
                  en: 'Automatic full-balance payment, as everywhere, and a second rule specific to the country: never take a "0 %" offer without reading what happens at the end. Some, especially store ones, are deferred interest: if the balance is not zero on the deadline, all the interest for the period is charged retroactively, at once.',
                },
                points: [
                  {
                    lead: { fr: 'Le FICO est un produit, pas une vérité.', en: 'FICO is a product, not a truth.' },
                    body: {
                      fr: 'Plusieurs versions coexistent et la banque ne regarde pas forcément celle que ton application te montre gratuitement. L’ordre de grandeur est utile, le chiffre exact l’est beaucoup moins.',
                      en: 'Several versions coexist and the lender does not necessarily look at the one your app shows you free. The ballpark is useful, the exact number much less so.',
                    },
                  },
                  {
                    lead: { fr: 'Intérêts différés et 0 % réel ne sont pas la même offre.', en: 'Deferred interest and a real 0 % are not the same offer.' },
                    body: {
                      fr: 'Un vrai 0 % introductif ne facture rien pour la période écoulée quand elle se termine. Un intérêt différé facture tout, rétroactivement, s’il reste un dollar. Le mot à chercher dans le contrat est « deferred ».',
                      en: 'A genuine intro 0 % charges nothing for the elapsed period when it ends. Deferred interest charges everything, retroactively, if one dollar remains. The word to look for in the contract is "deferred".',
                    },
                  },
                  {
                    lead: { fr: 'Le CARD Act a rendu une chose visible sur ton relevé.', en: 'The CARD Act made one thing visible on your statement.' },
                    body: {
                      fr: 'Il oblige l’émetteur à imprimer combien d’années tu mettrais en payant le minimum, et ce que coûterait un remboursement en trois ans. C’est la leçon c1.3, imprimée sur ton propre relevé, et presque personne ne la lit.',
                      en: 'It requires the issuer to print how many years you would take paying the minimum, and what a three-year payoff would cost. That is lesson c1.3, printed on your own statement, and almost nobody reads it.',
                    },
                  },
                ],
                todo: {
                  fr: 'Trouve sur ton relevé l’encadré du paiement minimum imposé par le CARD Act et lis le nombre d’années. Puis programme le paiement automatique du solde complet.',
                  en: 'Find the CARD Act minimum payment box on your statement and read the number of years. Then set up automatic full-balance payment.',
                },
              },
              af: {
                grail: {
                  fr: 'La première honnêteté de la leçon : dans la zone UEMOA et la zone CEMAC, la très grande majorité des cartes en circulation sont des cartes de DÉBIT, pas de crédit. Le vrai sujet du crédit court ailleurs : avances sur mobile money, microcrédit, tontines et prêts entre proches. Les règles des leçons précédentes s’appliquent quand même, parce qu’un taux reste un taux.',
                  en: 'The lesson’s first honesty: in the UEMOA and CEMAC zones, the vast majority of cards in circulation are DEBIT cards, not credit. The real credit story runs elsewhere: mobile money advances, microcredit, tontines and loans between relatives. The earlier lessons still apply, because a rate is still a rate.',
                },
                points: [
                  {
                    lead: { fr: 'Le crédit mobile se compte en jours, pas en années.', en: 'Mobile credit is counted in days, not years.' },
                    body: {
                      fr: 'Une avance affichée à « 5 % » sur trente jours n’est pas 5 % par an : c’est de l’ordre de 60 % en rythme annuel. La façon dont un coût est présenté est un choix de vente, et ramener chaque offre à un taux annuel est la seule façon de les comparer.',
                      en: 'An advance advertised at "5 %" over thirty days is not 5 % a year: it is on the order of 60 % annualised. How a cost is presented is a sales choice, and converting every offer to an annual rate is the only way to compare them.',
                    },
                  },
                  {
                    lead: { fr: 'La tontine n’est pas du crédit, et elle en fait le travail.', en: 'A tontine is not credit, and it does credit’s job.' },
                    body: {
                      fr: 'Elle ne coûte pas d’intérêt et elle marche sur la confiance, ce qui est sa force et son seul risque. Elle ne construit aucun dossier auprès d’une banque, donc elle ne remplace pas un historique le jour où un vrai prêt devient nécessaire.',
                      en: 'It costs no interest and it runs on trust, which is its strength and its only risk. It builds no file with any bank, so it does not replace a history the day a real loan becomes necessary.',
                    },
                  },
                  {
                    lead: { fr: 'Le vrai piège local est le crédit sans écrit.', en: 'The real local trap is credit with nothing written down.' },
                    body: {
                      fr: 'Un prêt entre proches sans montant, sans échéance et sans papier ne se termine jamais proprement : il finit en dispute familiale plutôt qu’en défaut de paiement. Écrire trois lignes et les signer coûte cinq minutes et sauve une relation.',
                      en: 'A loan between relatives with no amount, no deadline and no paper never ends cleanly: it ends in a family argument rather than a default. Writing three lines and signing them costs five minutes and saves a relationship.',
                    },
                  },
                ],
                note: {
                  fr: 'Si une carte de crédit t’est proposée par une banque de la place, la question reste la même que partout : quel est le taux annuel, y a-t-il un délai de grâce, et quels frais s’appliquent à un retrait de comptant. Trois questions, au téléphone, avant de signer.',
                  en: 'If a local bank offers you a credit card, the question is the same as anywhere: what is the annual rate, is there a grace period, and what fees apply to a cash withdrawal. Three questions, on the phone, before signing.',
                },
                todo: {
                  fr: 'Prends la dernière avance ou le dernier crédit court que tu as pris, et ramène son coût à un taux annuel : coût divisé par montant, divisé par le nombre de jours, multiplié par 365. Écris le chiffre.',
                  en: 'Take the last advance or short credit you used, and convert its cost to an annual rate: cost divided by amount, divided by the number of days, times 365. Write the number down.',
                },
              },
            },
            reflection: {
              fr: 'Est-ce que tu sais, pour la carte que tu as dans la poche, si elle dépense ton argent ou celui de la banque ? Beaucoup de gens vivent des années avec la mauvaise réponse en tête.',
              en: 'For the card in your pocket, do you know whether it spends your money or the bank’s? Plenty of people live for years with the wrong answer in their head.',
            },
            quiz: [
              {
                ask: { fr: 'Quelle est la première question à poser devant n’importe quelle carte, n’importe où ?', en: 'What is the first question to ask about any card, anywhere?' },
                options: [
                  { fr: 'Quelles récompenses est-ce qu’elle donne ?', en: 'What rewards does it give?' },
                  { fr: 'Est-ce qu’elle dépense mon argent ou celui de la banque ?', en: 'Does it spend my money or the bank’s?' },
                  { fr: 'Quelle est sa limite ?', en: 'What is its limit?' },
                ],
                answer: 1,
                why: {
                  fr: 'Tout le reste découle de là. Les récompenses ne comptent que sur une carte payée en entier, et la limite ne dit rien de ce que tu peux te permettre. Débit ou crédit est la seule question qui change la nature de l’objet.',
                  en: 'Everything else follows from it. Rewards only count on a card paid in full, and the limit says nothing about what you can afford. Debit or credit is the only question that changes what the object is.',
                },
              },
              {
                ask: { fr: 'Une avance mobile annoncée à « 5 % sur 30 jours », ça fait quoi en rythme annuel ?', en: 'A mobile advance advertised at "5 % over 30 days" is roughly what annualised?' },
                options: [
                  { fr: 'Environ 5 % par an', en: 'About 5 % a year' },
                  { fr: 'Environ 20 % par an', en: 'About 20 % a year' },
                  { fr: 'De l’ordre de 60 % par an', en: 'On the order of 60 % a year' },
                ],
                answer: 2,
                why: {
                  fr: 'Douze périodes de trente jours dans une année. La façon dont un coût est présenté est un choix de vente : ramener chaque offre à un taux annuel est la seule façon de comparer une avance mobile, une carte et un microcrédit.',
                  en: 'Twelve thirty-day periods in a year. How a cost is presented is a sales choice: converting every offer to an annual rate is the only way to compare a mobile advance, a card and a microloan.',
                },
              },
              {
                ask: { fr: 'Une offre à « 0 % » se termine et il reste 40 $. Que peut-il arriver de pire ?', en: 'A "0 %" offer ends and $40 remains. What is the worst that can happen?' },
                options: [
                  { fr: 'Tu paies des intérêts sur les 40 $ à partir de maintenant', en: 'You pay interest on the $40 from now on' },
                  { fr: 'Tous les intérêts de toute la période sont facturés rétroactivement', en: 'All the interest for the whole period is charged retroactively' },
                  { fr: 'L’offre se prolonge automatiquement', en: 'The offer extends automatically' },
                ],
                answer: 1,
                why: {
                  fr: 'C’est l’intérêt différé, courant sur les cartes de magasin. Le mot à chercher dans le contrat est « deferred » : un vrai 0 % ne facture rien pour la période écoulée, un intérêt différé facture tout si un dollar reste.',
                  en: 'That is deferred interest, common on store cards. The word to look for is "deferred": a genuine 0 % charges nothing for the elapsed period, deferred interest charges everything if one dollar remains.',
                },
              },
            ],
          },
          {
            id: 'c2.4',
            state: 'written',
            title: { fr: 'Ce qu’il faut retenir', en: 'What to take away' },
            sub: { fr: 'Sept lignes, et une check-list.', en: 'Seven lines, and a checklist.' },
            objective: {
              fr: 'Repartir avec une liste courte qu’on peut relire en deux minutes dans six mois, et avec les gestes concrets déjà cochés ou pas.',
              en: 'Leave with a short list you can reread in two minutes six months from now, and with the concrete steps either ticked or not.',
            },
            points: [
              {
                lead: { fr: 'Une seule règle vaut toutes les autres.', en: 'One rule is worth all the others.' },
                body: {
                  fr: 'Payer le solde du RELEVÉ, en ENTIER, AVANT l’échéance. Fais ça et le taux d’intérêt de ta carte ne te concerne plus jamais. Rate-le une fois et tout le reste du cours devient d’actualité.',
                  en: 'Pay the STATEMENT balance, in FULL, BEFORE the due date. Do that and your card’s interest rate never concerns you again. Miss it once and the rest of this course becomes relevant.',
                },
              },
              {
                lead: { fr: 'Les trois choses qui coûtent le plus.', en: 'The three most expensive things.' },
                body: {
                  fr: 'Le paiement minimum, qui transforme trois ans en dix-sept. L’avance de fonds, qui n’a aucun délai de grâce. Et un solde qui traîne, qui fait payer intérêt sur les achats neufs dès le premier jour.',
                  en: 'The minimum payment, which turns three years into seventeen. The cash advance, which has no grace period at all. And a lingering balance, which makes new purchases accrue interest from day one.',
                },
              },
              {
                lead: { fr: 'Les deux gestes qui règlent presque tout.', en: 'The two moves that settle almost everything.' },
                body: {
                  fr: 'Le paiement automatique du solde complet, programmé une fois. Et la date d’échéance dans le calendrier, avec un rappel. Ensemble, ils rendent la plupart de ce cours théorique.',
                  en: 'Automatic full-balance payment, set up once. And the due date in the calendar, with a reminder. Together they make most of this course theoretical.',
                },
              },
            ],
            metaphor: {
              fr: 'Le couteau de cuisine. Bien tenu, c’est l’outil le plus utile du tiroir et personne ne s’en méfie. Mal tenu, il ne devient pas un mauvais couteau : il reste exactement le même objet.',
              en: 'The kitchen knife. Held well, it is the most useful tool in the drawer and nobody fears it. Held badly, it does not become a bad knife: it stays exactly the same object.',
            },
            reflection: {
              fr: 'Sur les huit leçons, laquelle t’a appris quelque chose que tu ne savais pas ? Écris-la. C’est celle-là que tu répéteras à quelqu’un, et répéter est la seule façon de retenir.',
              en: 'Of the eight lessons, which taught you something you did not know? Write it down. That is the one you will repeat to somebody, and repeating is the only way to remember.',
            },
            todo: {
              fr: 'La check-list, à cocher pour de vrai : 1) je connais mon taux annuel. 2) la date d’échéance est dans mon calendrier avec un rappel. 3) le paiement automatique du solde complet est programmé. 4) je sais ce que compte mon émetteur comme avance de fonds. 5) mon taux d’utilisation est sous 30 %. 6) si j’ai un solde, j’ai décidé d’un montant fixe. 7) j’ai appelé ma banque au moins une fois.',
              en: 'The checklist, to tick for real: 1) I know my annual rate. 2) the due date is in my calendar with a reminder. 3) automatic full-balance payment is set up. 4) I know what my issuer counts as a cash advance. 5) my utilisation is under 30 %. 6) if I carry a balance, I have decided on a fixed amount. 7) I have called my bank at least once.',
            },
            quiz: [
              {
                ask: { fr: 'S’il ne fallait retenir qu’une phrase de tout ce cours, laquelle ?', en: 'If you kept one sentence from this whole course, which?' },
                options: [
                  { fr: 'Ne jamais posséder de carte de crédit', en: 'Never own a credit card' },
                  { fr: 'Payer le solde du relevé, en entier, avant l’échéance', en: 'Pay the statement balance, in full, before the due date' },
                  { fr: 'Toujours rester bien en dessous de sa limite', en: 'Always stay well below your limit' },
                ],
                answer: 1,
                why: {
                  fr: 'Ni interdiction, ni prudence vague. Une carte payée en entier chaque mois est un outil gratuit qui construit un dossier ; la même carte payée au minimum est un des prêts les plus chers auxquels un particulier ait accès. Le même objet, deux comportements.',
                  en: 'Neither a ban nor vague caution. A card paid in full each month is a free tool that builds a file; the same card paid at the minimum is one of the most expensive loans a private person can get. Same object, two behaviours.',
                },
              },
              {
                ask: { fr: 'Quel geste unique empêche le plus d’intérêts, une fois pour toutes ?', en: 'Which single move prevents the most interest, once and for all?' },
                options: [
                  { fr: 'Baisser sa limite de crédit', en: 'Lowering your credit limit' },
                  { fr: 'Programmer le paiement automatique du solde complet', en: 'Setting up automatic full-balance payment' },
                  { fr: 'Fermer les cartes qu’on n’utilise plus', en: 'Closing the cards you no longer use' },
                ],
                answer: 1,
                why: {
                  fr: 'Il se programme une fois et il travaille tous les mois, y compris les mois où tu oublies. Baisser sa limite ne change pas un centime d’intérêt, et fermer une vieille carte peut faire baisser ton dossier.',
                  en: 'It is set up once and works every month, including the months you forget. Lowering your limit changes not a cent of interest, and closing an old card can lower your file.',
                },
              },
              {
                ask: { fr: 'Tu portes un solde et tu continues à payer tes courses avec la carte. Quel est le vrai coût ?', en: 'You carry a balance and keep paying for groceries with the card. What is the real cost?' },
                options: [
                  { fr: 'Rien de plus, les courses sont des achats normaux', en: 'Nothing extra, groceries are ordinary purchases' },
                  { fr: 'Chaque course porte intérêt dès le premier jour, sans délai de grâce', en: 'Every shop accrues interest from day one, with no grace period' },
                  { fr: 'Seulement les frais de retard si tu manques une échéance', en: 'Only late fees if you miss a due date' },
                ],
                answer: 1,
                why: {
                  fr: 'C’est la conséquence la moins connue de tout le cours, et elle revient trois fois : tant qu’un solde reste, le délai de grâce ne protège plus rien. Un petit solde rend plus cher tout ce que tu achètes après lui.',
                  en: 'It is the least known consequence in the course, and it comes back three times: while a balance remains, the grace period protects nothing. A small balance makes everything you buy after it more expensive.',
                },
              },
            ],
          },
        ],
        action: {
          fr: 'Reprends la check-list de la dernière leçon et coche ce qui est vraiment fait. Ce qui reste non coché est ta liste de la semaine, et elle tient en moins d’une heure au total.',
          en: 'Take the checklist from the last lesson and tick what is genuinely done. What is left unticked is your week’s list, and the whole thing takes under an hour.',
        },
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
        /* Numerote depuis SON cours et pas depuis le brief d'origine. Il
           s'appelait 3 parce que la demande disait "Module 3 : Investir 101",
           et il ouvrait le cours: un etudiant arrivait sur un cours dont le
           premier module portait le numero 3. */
        n: 1,
        title: { fr: 'Faire travailler l’argent pour soi', en: 'Putting money to work' },
        intro: {
          fr: 'Ton rassurant, transparent sur le risque, orienté long terme. Le mot bourse fait peur à la moitié des gens et le module ne gagne rien à faire semblant du contraire : la baisse est nommée dès la première leçon.',
          en: 'Reassuring in tone, straight about risk, aimed at the long run. The word "market" frightens half the room and the module gains nothing by pretending otherwise: the drawdown is named in the first lesson.',
        },
        lessons: [
          {
            id: 'i1.1',
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
            id: 'i1.2',
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
            id: 'i1.3',
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
            id: 'i1.4',
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
        n: 2,
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
            id: 'i2.1',
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
