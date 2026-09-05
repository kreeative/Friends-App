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
 * EN FRANCAIS SEULEMENT, POUR L'INSTANT.
 *
 * Comme les manuscrits, qui sont en anglais seulement. La chrome de
 * l'application est traduite, le contenu ne l'est pas encore, et pretendre le
 * contraire avec une traduction automatique serait pire que l'assumer.
 */

/**
 * Les quatre regions, dans l'ordre ou elles sont proposees.
 *
 * `ca` est le defaut parce que c'est la ou est le produit, et pas parce que
 * c'est la plus grande: la lecon qui compte le plus ici est celle de la zone
 * franc, et elle est ecrite avec autant de soin que les trois autres.
 */
export const COUNTRIES = [
  { id: 'ca', flag: '🇨🇦', label: 'Canada' },
  { id: 'fr', flag: '🇫🇷', label: 'France / Europe' },
  { id: 'us', flag: '🇺🇸', label: 'États-Unis' },
  { id: 'af', flag: '🌍', label: 'Afrique (BRVM / CEMAC)' },
]

/** Ce que dit l'onboarding quand on choisit sa region. */
export const COUNTRY_ANSWERS = {
  ca: 'Parfait ! Ton parcours va se concentrer sur le CELI et le REER. On verra aussi le CELIAPP si une première maison est dans tes plans.',
  fr: 'Parfait ! Ton parcours va se concentrer sur le PEA et l’Assurance-Vie. Première chose à retenir : l’horloge fiscale démarre à l’ouverture.',
  us: 'Parfait ! Ton parcours va se concentrer sur le Roth IRA et le 401(k). On commence par l’argent gratuit : l’abondement de ton employeur.',
  af: 'Parfait ! Ton parcours va se concentrer sur les SGI et la BRVM. On verra comment ouvrir un compte-titres et reconnaître un intermédiaire agréé.',
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
    title: 'Riche, lentement',
    tagline:
      'Du grand débutant à l’investisseur autonome. Le titre est un parti pris : une formation qui promet vite ment sur la seule variable qui fait le travail.',
    modules: [
      {
        n: 0,
        title: 'Mais au fait, c’est quoi l’argent ?',
        intro:
          'Quatre leçons conceptuelles, sans un seul chiffre à retenir. Le seul module du cours qui ne demande aucune action : les autres finissent sur un geste, celui-ci finit sur une question.',
        lessons: [
          {
            id: '0.1',
            state: 'written',
            title: 'La pierre au fond de l’océan',
            sub: 'Du troc aux billets : la grande histoire d’une illusion collective.',
            objective:
              'Comprendre que l’argent n’a aucune valeur en lui-même : il est une confiance partagée, et il fonctionne exactement tant que tout le monde continue d’y croire.',
            points: [
              {
                lead: 'L’histoire du troc est elle-même un mythe.',
                body: 'On nous a tous raconté la même chose à l’école : deux poulets contre une hache, c’était compliqué, alors on a inventé la monnaie. Les anthropologues n’ont jamais trouvé cette société-là. Ce qu’ils trouvent partout, c’est du crédit : on se doit des choses, on s’en souvient, on règle plus tard.',
              },
              {
                lead: 'L’île de Yap, et la pierre qui n’est jamais arrivée.',
                body: 'La monnaie y était d’énormes disques de pierre, trop lourds pour être déplacés : on changeait le propriétaire, pas la pierre. Un jour l’une d’elles coule pendant le transport. Personne ne la reverra jamais. Elle sert de monnaie pendant des générations, parce que l’île entière est d’accord sur qui la possède.',
              },
              {
                lead: 'Ton solde est une ligne dans une base de données.',
                body: 'Le billet n’est plus adossé à l’or depuis les années 1970, et l’immense majorité de l’argent qui existe n’a jamais été imprimée. Ce qui la rend réelle, ce n’est pas une matière, c’est que ton propriétaire, ton épicier et l’État acceptent la même écriture.',
              },
            ],
            reflection:
              'Regarde le solde de ton compte. Ni papier, ni or, ni objet : une ligne dans l’ordinateur d’une banque. Qu’est-ce qui devrait casser dans le monde pour que cette ligne cesse de valoir quelque chose ?',
            quiz: [
              {
                ask: 'Que trouvent les anthropologues avant l’apparition de la monnaie ?',
                options: [
                  'Des sociétés de troc pur, où l’on échangeait deux poulets contre une hache',
                  'Des systèmes de crédit et de dettes dont les gens se souvenaient et qu’ils réglaient plus tard',
                  'Des sociétés sans échange, où chaque foyer produisait tout ce dont il avait besoin',
                ],
                answer: 1,
                why: 'Le troc est l’histoire qu’on raconte à l’école, et personne ne l’a jamais trouvée sur le terrain. La monnaie n’a donc pas remplacé le troc, elle a rendu le crédit transportable entre des inconnus qui ne se reverront jamais.',
              },
              {
                ask: 'La pierre de Yap tombée au fond de l’océan a continué de servir de monnaie. Pourquoi ?',
                options: [
                  'Parce que les habitants espéraient encore la repêcher',
                  'Parce qu’un chef garantissait sa valeur et pouvait la remplacer',
                  'Parce que toute l’île restait d’accord sur qui la possédait',
                ],
                answer: 2,
                why: 'La valeur n’était pas dans la pierre, elle était dans l’accord. C’est exactement ce qui fait tenir ton compte en banque : personne ne va vérifier des billets dans un coffre.',
              },
              {
                ask: 'Qu’est-ce qui rend réel l’argent affiché sur ton compte ?',
                options: [
                  'Une réserve d’or détenue par la banque centrale',
                  'Le fait que ton propriétaire, ton épicier et l’État acceptent la même écriture',
                  'Les billets imprimés qui correspondent, quelque part, à ton solde',
                ],
                answer: 1,
                why: 'Le lien avec l’or a été coupé dans les années 1970 et la très grande majorité de l’argent n’a jamais été imprimée. Ce qui rend ton solde réel, c’est l’acceptation et non la matière. Bonne nouvelle : une convention, ça s’apprend.',
              },
            ],
          },
          {
            id: '0.2',
            state: 'written',
            title: 'Un mégaphone, pas un masque',
            sub: 'L’argent est un amplificateur, pas un monstre.',
            objective:
              'Cesser de traiter l’argent comme une force morale et le voir comme un multiplicateur neutre de ce qui est déjà là. Le droit d’en vouloir sans se sentir sale.',
            points: [
              {
                lead: 'L’argent n’invente aucun trait de caractère, il enlève les freins.',
                body: 'Une personne généreuse avec 2 000 $ devient une personne généreuse avec 200 000 $. Ce que la richesse fait vraiment, c’est retirer les contraintes qui obligeaient tout le monde à se comporter à peu près pareil. Ce qui reste ensuite, c’est toi, en plus gros.',
              },
              {
                lead: 'D’où vient le tabou, et à qui il profite.',
                body: 'Presque personne ne connaît le salaire de ses parents. On apprend très tôt que le sujet est gênant, jamais pourquoi. Le silence n’a jamais protégé la personne qui se tait ; il protège celle qui sait déjà.',
              },
              {
                lead: 'Ce que la recherche dit vraiment, et où elle s’arrête.',
                body: 'Des travaux récents montrent que le bonheur continue de monter avec le revenu pour la plupart des gens, sauf pour ceux qui vont déjà mal, chez qui l’argent ne répare rien. Ni « l’argent rend heureux » ni « l’argent ne fait pas le bonheur » : il achète très efficacement l’absence de certains malheurs.',
              },
            ],
            reflection:
              'Termine cette phrase sans réfléchir : « Chez nous, on ne parlait jamais de _______. » Puis : qui t’a appris ça, et est-ce que cette personne avait de l’argent ?',
          },
          {
            id: '0.3',
            state: 'written',
            title: 'Tu ne paies jamais en dollars',
            sub: 'Le temps contre l’argent : ta véritable monnaie d’échange.',
            objective:
              'Réaliser que chaque dépense est payée en heures de vie, et que le vrai rendement de l’argent n’est pas un pourcentage mais le contrôle de son emploi du temps.',
            points: [
              {
                lead: 'Le taux de change que personne n’affiche.',
                body: 'Salaire net, moins le transport, les vêtements de travail, les heures non facturées mais passées quand même. Un objet à 300 $ ne coûte pas 300 $, il coûte une journée et demie de ton existence, et c’est la seule devise que tu ne peux pas gagner davantage.',
              },
              {
                lead: 'Le plus gros dividende que l’argent paie, c’est le contrôle de ton temps.',
                body: 'Dire non, changer de travail, être malade sans paniquer : rien de tout ça ne s’achète en magasin, tout s’achète avec de l’épargne. Les gens croient qu’ils épargnent pour des choses. Ils épargnent pour des options.',
              },
              {
                lead: 'L’asymétrie qui rend tout ça urgent.',
                body: 'L’argent perdu se regagne. Le temps, non. Et pourtant nous protégeons farouchement notre argent et donnons notre temps à qui le demande poliment.',
              },
            ],
            reflection:
              'Calcule ton taux horaire réel, à la louche. Prends le dernier achat de plus de 100 $ que tu as fait et convertis-le en heures de ta vie. Est-ce que tu le referais ?',
          },
          {
            id: '0.4',
            state: 'written',
            title: 'La douleur qui a disparu',
            sub: 'Le piège de l’argent invisible.',
            objective:
              'Comprendre que son cerveau n’a jamais été conçu pour des paiements sans friction, et que dépenser moins n’est pas un problème de volonté mais de conception.',
            points: [
              {
                lead: 'Payer faisait mal, et c’était utile.',
                body: 'Sortir un billet et voir la monnaie revenir produit une petite douleur mesurable, que les chercheurs appellent la douleur de payer. Les travaux les plus connus montrent qu’on accepte de payer sensiblement plus cher quand on ne paie pas en liquide. L’ordre de grandeur exact se discute encore, la direction, non.',
              },
              {
                lead: 'Chaque étape supprimée coûte de l’argent.',
                body: 'Le liquide, puis la carte, puis le sans contact, puis le téléphone, puis le visage. Ce n’est pas une conspiration, c’est un design réussi : tout ce qui rend le paiement plus fluide augmente le paiement.',
              },
              {
                lead: 'L’abonnement, forme finale de l’argent invisible.',
                body: 'Une dépense qui se répète toute seule, autorisée une fois, qui ne demande plus jamais son avis. Si le système peut dépenser à ta place sans rien te demander, il peut aussi épargner à ta place de la même manière.',
              },
            ],
            reflection:
              'Ouvre la liste de tes abonnements. Compte ceux que tu avais oubliés. Puis, pour chacun : si tu devais aller le repayer aujourd’hui, en billets, à un guichet, en faisant la file, est-ce que tu irais ?',
          },
        ],
      },
      {
        n: 1,
        title: 'Personne n’est fou',
        intro:
          'Le module qui désamorce la honte. Tant que quelqu’un croit que son problème est un défaut de caractère, il n’écoute pas la suite, il se défend.',
        action: 'La page unique, remplie, datée.',
        lessons: [
          { id: '1.1', state: 'plan', title: 'Ton argent a une biographie', sub: 'Ce que tu crois sur l’argent a été écrit par une époque, un pays et une famille que tu n’as pas choisis.' },
          { id: '1.2', state: 'plan', title: 'Riche, ou fortuné', sub: 'Fortuné, c’est ce que tu ne vois pas, parce que c’est précisément l’argent qui n’a pas été dépensé.' },
          { id: '1.3', state: 'plan', title: 'Le temps fait le travail', sub: 'Le rendement fait la vedette, la durée fait le résultat.' },
          { id: '1.4', state: 'plan', title: 'Ta page unique', sub: 'Ce qui rentre, ce qui sort, ce que tu possèdes, ce que tu dois. Une page, pas un tableur.' },
        ],
      },
      {
        n: 2,
        title: 'Ce qui te paie, ce qui te coûte',
        intro:
          'Classer chaque ligne de son argent en actif ou passif, et rediriger ce qu’on coupe vers ce qui compte.',
        action: 'Une dépense coupée, une dépense assumée, un virement programmé.',
        lessons: [
          { id: '2.1', state: 'plan', title: 'La seule question', sub: 'Est-ce que cette chose met de l’argent dans ta poche, ou est-ce qu’elle en sort ?' },
          { id: '2.2', state: 'plan', title: 'La dépense consciente', sub: 'Couper sans pitié ce dont tu te fous, dépenser sans culpabilité sur ce que tu aimes.' },
          { id: '2.3', state: 'plan', title: 'Le coussin avant le rendement', sub: 'Rembourser une carte à 21 % est un rendement garanti de 21 %, net d’impôt, sans risque.' },
          { id: '2.4', state: 'plan', title: 'Le système qui décide à ta place', sub: 'La volonté est une ressource qui s’épuise, un virement automatique non.' },
        ],
      },
      {
        n: 3,
        title: 'L’argent et les autres',
        intro:
          'Placé juste après la dépense consciente, parce que c’est exactement là qu’elle se casse la figure. Personne n’abandonne son budget seul dans sa cuisine.',
        action: 'Une phrase apprise par cœur et dite pour de vrai à quelqu’un dans les deux semaines.',
        lessons: [
          {
            id: '3.1',
            state: 'written',
            title: 'Tu n’es pas un guichet automatique',
            sub: 'Aime ta famille, mais protège tes finances.',
            objective:
              'Comprendre qu’une limite n’est pas un rejet, et désapprendre l’équation entre dire non à une demande d’argent et abandonner les siens.',
            points: [
              { lead: 'Le prêt familial n’existe pas.', body: 'C’est un don auquel on a ajouté du ressentiment en option : celui qui prête compte, celui qui emprunte évite, et la relation paie la facture bien après l’argent.' },
              { lead: 'Un pourcentage, pas un cas par cas.', body: '« L’enveloppe famille est à sec ce mois-ci » est une information. « Je ne peux pas » est une invitation à négocier.' },
              { lead: 'Ton non a besoin d’un chiffre, pas d’une excuse.', body: 'Un non chiffré ferme la discussion sans fermer la porte, et il protège la personne en face : elle sait à quoi s’en tenir et peut chercher ailleurs.' },
            ],
            script: [
              '« Je peux mettre 100 $ ce mois-ci. Je préfère te les donner plutôt qu’on parle de remboursement, comme ça il n’y a rien qui traîne entre nous. Au-delà de ça je ne peux pas, et ce n’est pas contre toi. »',
              '« J’ai une enveloppe pour la famille, elle est à X par mois. Quand elle est vide, elle est vide. »',
            ],
          },
          {
            id: '3.2',
            state: 'written',
            title: 'La note qu’on partage à parts égales',
            sub: 'Choisis tes amis, et ton style de vie avec.',
            objective:
              'Comprendre que l’inflation de son train de vie est un phénomène social et non une faiblesse personnelle.',
            points: [
              { lead: 'Ton style de vie est la moyenne des cinq personnes avec qui tu sors.', body: 'On ne juge jamais une dépense dans l’absolu, on la juge par rapport à ce que font les gens autour.' },
              { lead: 'Tu ne paies jamais le repas, tu paies l’appartenance.', body: 'Si c’est le seul moyen d’appartenir à ce groupe, la question n’est plus le budget, c’est le groupe.' },
              { lead: 'Refuse le format, jamais la personne.', body: 'Une contre-proposition dit « je veux te voir » avec le même argent, et le restaurant à 80 $ disparaît sans que personne ne perde la face.' },
            ],
            script: [
              '« Le resto je passe ce mois-ci. Mais je suis à 100 % partant pour un verre après, ou venez chez moi samedi, je cuisine. »',
              '« Moi je règle ce que j’ai pris, ça vous va ? » Six mots, dits sans s’excuser. La gêne dure trois secondes.',
            ],
          },
          {
            id: '3.3',
            state: 'written',
            title: 'La conversation qui coûte le moins cher',
            sub: 'L’amour et l’argent : les règles du jeu en couple.',
            objective:
              'Comprendre qu’une dispute d’argent n’est presque jamais une dispute d’argent, et désapprendre le « on verra plus tard ».',
            points: [
              { lead: 'Les disputes d’argent sont des disputes de valeurs.', body: 'Tant que la conversation reste sur le montant, elle tourne en boucle, parce que le montant n’est pas le sujet.' },
              { lead: 'Trois architectures, aucune moralement supérieure.', body: 'Tout commun, tout séparé, ou un compte commun au prorata des revenus. À revenus inégaux, le 50/50 n’est pas l’équité, c’est un transfert déguisé de celui qui gagne le moins vers celui qui gagne le plus.' },
              { lead: 'Le seuil de consultation.', body: 'Un montant au-dessus duquel on se prévient, décidé ensemble, une fois. En dessous, personne n’a de comptes à rendre, et c’est ça qui le rend tenable.' },
            ],
            script: [
              '« C’est quoi la première chose que tu as apprise sur l’argent, chez toi, quand tu étais petit ? »',
              '« Est-ce qu’on se fixe un montant au-dessus duquel on se prévient avant d’acheter ? Moi je proposerais 200 $. »',
            ],
          },
          {
            id: '3.4',
            state: 'written',
            title: 'Personne ne regarde ta voiture',
            sub: 'Maîtriser les codes cachés de la richesse.',
            objective:
              'Comprendre que les signaux extérieurs de richesse sont payés avec la richesse elle-même, et désapprendre l’équation entre visible et riche.',
            points: [
              { lead: 'Le paradoxe de l’homme dans la voiture.', body: 'Tu vois passer une voiture magnifique et tu admires la voiture. Tu ne penses pas une seconde au conducteur, tu t’imagines toi-même au volant. C’est ce que font les autres devant la tienne.' },
              { lead: 'La richesse est invisible par définition.', body: 'Le sac acheté est de l’argent dépensé ; la richesse, c’est précisément l’argent qui n’a pas été dépensé. On imite ce qu’on voit, et ce qu’on voit est la partie qui a été détruite.' },
              { lead: 'Le signal fort est souvent un signal de dette.', body: 'Une dépense visible dit ce que quelqu’un peut payer ce mois-ci, pas ce qu’il possède, et il arrive assez souvent qu’elle dise l’inverse.' },
            ],
            script: [
              '« Assez pour être tranquille, pas encore assez pour la retraite. Et toi, tu vises quoi ? »',
              '« Je préfère payer ma liberté que mon image. Mais je juge personne, chacun son truc. »',
            ],
          },
        ],
      },
      {
        n: 4,
        title: 'Trois enveloppes, un ordre',
        intro:
          'Le module le plus québécois du cours : le même dollar, placé dans la mauvaise enveloppe, coûte des années de rendement en impôt. Ici on enseigne LA DÉCISION, pas la mécanique d’ouverture, qui est dans Investir 101.',
        action: 'Une enveloppe ouverte cette semaine, la bonne, avec la raison écrite en une phrase.',
        lessons: [
          { id: '4.1', state: 'plan', title: 'Le CELI, l’enveloppe qui ne demande rien', sub: 'Le piège de calendrier : les droits retirés ne reviennent que le 1er janvier suivant.' },
          { id: '4.2', state: 'plan', title: 'Le REER, un report et non un cadeau', sub: 'Il gagne si ton taux baisse, il perd s’il monte, et c’est toute la décision.' },
          { id: '4.3', state: 'plan', title: 'Le CELIAPP, le meilleur des deux', sub: 'Ouvre-le dès que tu es admissible, même avec 0 $ : c’est l’ouverture qui démarre l’horloge.' },
          { id: '4.4', state: 'plan', title: 'L’ordre de remplissage', sub: 'L’argent gratuit d’abord, puis le CELIAPP, puis REER ou CELI selon le taux marginal.' },
        ],
      },
      {
        n: 5,
        title: 'Tenir',
        intro:
          'Construire un portefeuille qu’on peut garder trente ans, et écrire d’avance ce qu’on fera le jour où il perdra 30 %.',
        action: 'Le plan écrit, signé, daté, rangé quelque part où tu le retrouveras en pleine baisse.',
        lessons: [
          { id: '5.1', state: 'plan', title: 'Un fonds, pas quinze', sub: 'Choisir quinze titres, c’est se donner quinze occasions de vendre au mauvais moment.' },
          { id: '5.2', state: 'plan', title: 'Les frais sont le seul rendement garanti', sub: 'Sur trente ans, 2 % contre 0,2 % changent le tiers du résultat.' },
          { id: '5.3', state: 'plan', title: 'Ton plan écrit', sub: 'Écrit quand tout va bien, parce qu’il sert exactement quand tout va mal.' },
          { id: '5.4', state: 'plan', title: 'Le krach', sub: 'Une stratégie raisonnable que tu tiens bat une stratégie optimale que tu abandonnes.' },
        ],
      },
    ],
  },

  {
    slug: 'investir-101',
    title: 'Investir 101',
    tagline:
      'Faire travailler l’argent pour soi. Commence là où « Riche, lentement » s’arrête : le coussin est en place, les dettes chères sont mortes, et la question devient où va cet argent.',
    modules: [
      {
        n: 3,
        title: 'Faire travailler l’argent pour soi',
        intro:
          'Ton rassurant, transparent sur le risque, orienté long terme. Le mot bourse fait peur à la moitié des gens et le module ne gagne rien à faire semblant du contraire : la baisse est nommée dès la première leçon.',
        lessons: [
          {
            id: 'i3.1',
            state: 'written',
            title: 'Ton argent fond pendant que tu dors',
            sub: 'Pourquoi laisser son argent à la banque est un piège.',
            objective:
              'Comprendre que l’argent qui dort perd de la valeur chaque année sans que rien ne bouge à l’écran, et que le temps est le seul ingrédient qu’on ne peut pas rattraper plus tard.',
            points: [
              { lead: 'L’inflation est une taxe que personne ne facture.', body: 'À 3 % par an, 1 000 $ laissés dans un compte chèque valent environ 740 $ dans dix ans en pouvoir d’achat. Le solde n’a pas bougé, et c’est ça qui rend le phénomène invisible.' },
              { lead: 'Les intérêts composés sont exponentiels, et personne n’a d’intuition pour l’exponentiel.', body: 'Sur cinq ans on voit à peine la différence ; sur trente ans elle est énorme. La courbe est ennuyeuse précisément pendant les années où il faut tenir.' },
              { lead: 'Commencer tôt bat épargner beaucoup.', body: '200 $ par mois à 25 ans finit devant 400 $ par mois à 40 ans. Le second n’a pas été moins sérieux, il a eu moins d’années.' },
            ],
            metaphor:
              'Le congélateur débranché. Rien ne bouge, la porte est fermée, tout a l’air en ordre. C’est en ouvrant dans six mois qu’on découvre ce qui s’est passé.',
            todo:
              'Trouver le taux d’intérêt réel de son compte d’épargne et le comparer à l’inflation de l’an dernier. Écrire les deux chiffres l’un sous l’autre.',
          },
          {
            id: 'i3.2',
            state: 'written',
            title: 'Prêter ou posséder',
            sub: 'Actions contre obligations : le dictionnaire de la bourse.',
            objective:
              'Comprendre qu’il n’existe que deux façons de mettre son argent au travail, et savoir dire laquelle rapporte le plus et laquelle dort le mieux la nuit.',
            points: [
              { lead: 'Une action, c’est posséder un morceau.', body: 'Copropriétaire d’une entreprise, minuscule mais réel. Rendement historique élevé, et des baisses de 30 % ou 40 % qui reviennent régulièrement : ce n’est pas un accident du système, c’est le prix d’entrée.' },
              { lead: 'Une obligation, c’est prêter.', body: 'Un intérêt convenu, le capital à l’échéance, beaucoup moins de secousses. Pas « sans risque » pour autant : l’emprunteur peut faire défaut, et la valeur baisse quand les taux montent.' },
              { lead: 'Le mélange est la vraie décision.', body: 'Pas « laquelle est meilleure » mais « combien de chacune », et la réponse dépend d’une seule chose : dans combien d’années tu as besoin de cet argent. À trois ans, la bourse n’est pas un placement, c’est un pari.' },
            ],
            metaphor:
              'Le locataire et le propriétaire. L’obligation, c’est prêter la maison contre un loyer convenu d’avance : prévisible, plafonné. L’action, c’est posséder la maison : les mauvaises années sont pour toi, et les bonnes aussi.',
            todo:
              'Écrire une seule ligne : « J’ai besoin de cet argent dans ____ ans. » Le chiffre commande tout le reste du module.',
          },
          {
            id: 'i3.3',
            state: 'written',
            title: 'Tout acheter d’un coup',
            sub: 'Les FNB : l’arme secrète de l’investisseur paresseux.',
            objective:
              'Comprendre qu’on n’a pas à choisir les bonnes entreprises pour investir, et que ne pas choisir est une stratégie respectable plutôt qu’un aveu d’incompétence.',
            points: [
              { lead: 'Un FNB est un panier déjà rempli.', body: 'Un seul achat, et tu détiens un morceau de centaines d’entreprises. Le tout-en-un va plus loin : actions et obligations dans une proportion fixe, et il se rééquilibre seul.' },
              { lead: 'Les frais sont la seule chose que tu contrôles vraiment.', body: '2 % contre 0,2 % sur trente ans ne grignote pas la marge, ça prend une part énorme du résultat final.' },
              { lead: 'Ce que le FNB ne fait pas.', body: 'Il ne protège pas des baisses : quand le marché tombe de 30 %, ton panier tombe de 30 %. Il élimine le risque de tout perdre sur une seule entreprise, et c’est le seul risque que la diversification sait traiter.' },
            ],
            metaphor:
              'Le panier de fruits du marché. Choisir soi-même quinze fruits demande de savoir lesquels sont mûrs, et un fruit pourri gâche le panier. Le panier tout prêt suit la saison : si elle est mauvaise il est moins bon, mais tu ne rentres jamais avec quinze fruits pourris.',
            todo:
              'Ouvrir la page d’un FNB tout-en-un et lire une seule ligne : le ratio des frais de gestion. Le comparer à celui du fonds vendu par sa banque.',
          },
          {
            id: 'i3.4',
            state: 'written',
            title: 'L’enveloppe n’est pas le placement',
            sub: 'Le compte que tu ouvres, et ce que tu mets dedans.',
            objective:
              'Comprendre qu’une enveloppe fiscale n’est pas un placement mais un contenant, et que l’erreur la plus fréquente des débutants est d’ouvrir le compte, d’y virer de l’argent, et de croire que c’est fait.',
            points: [
              { lead: 'Le contenant et le contenu.', body: 'Des milliers de personnes ont un compte à l’abri de l’impôt qui ne contient que du comptant depuis des années : elles ont l’abri fiscal et rien à abriter.' },
              { lead: 'Ce que l’enveloppe change vraiment.', body: 'Pas le rendement, mais ce que tu gardes du rendement. Même placement, mêmes gains, et la différence est l’impôt que tu ne paies pas.' },
              { lead: 'Ce qu’il ne faut jamais faire.', body: 'Ouvrir cinq comptes chez quatre institutions. Les frais se multiplient et l’espace de cotisation devient impossible à suivre.' },
            ],
            metaphor:
              'Le sac isotherme. Il ne cuisine rien et ne remplit rien : il garde ce que tu as mis dedans à la bonne température pendant le trajet. Un sac isotherme vide reste un sac vide.',
            todo:
              'Vérifier ses droits de cotisation auprès de l’administration de son pays, et regarder si l’argent déjà versé est investi ou s’il dort en comptant.',
          },
        ],
      },
      {
        n: 'I',
        title: 'Où et comment investir selon ton pays',
        intro:
          'Ce qui change d’un pays à l’autre, ce ne sont pas les questions, ce sont seulement les réponses. La leçon suit la région choisie. Aucun plafond et aucun taux n’est gravé dans le cours : ils changent tous, et une leçon qui les récite est fausse l’année suivante sans prévenir.',
        lessons: [
          {
            id: 'i.pays',
            state: 'written',
            title: 'Le plan de match de ta région',
            sub: 'Quel compte ouvrir en premier, et par où on passe.',
            /* La lecon a geometrie variable: un tronc commun, puis quatre
               versions. C'est la structure demandee, "des rectangles a
               l'interieur des cours", et c'est aussi la seule facon de tenir
               quatre fiscalites sans quatre cours separes. */
            universal:
              'Partout sur la planète, la même règle : on n’investit pas « dans un compte », on investit à travers un compte. Le compte est un contenant, le placement est ce qu’on met dedans. Un compte ouvert et alimenté qui ne contient que du comptant ne rapporte rien, et c’est l’erreur la plus répandue chez les débutants du monde entier.',
            byCountry: {
              ca: {
                grail:
                  'Le CELI, en premier, pour presque tout le monde. Il ne demande aucun revenu élevé, il ne bloque rien, et un retrait n’est jamais imposé. Exception nette : si une première propriété est au programme, le CELIAPP passe devant, seul compte du pays qui déduit à l’entrée et ne taxe pas à la sortie.',
                points: [
                  { lead: 'Le REER est un report, pas un cadeau.', body: 'Tu déduis à ton taux d’aujourd’hui, tu paies au taux du jour du retrait. À bas revenu, cotiser au REER peut coûter plus cher que ne rien faire.' },
                  { lead: 'Le CELI a un piège de calendrier.', body: 'Les droits retirés ne reviennent que le 1er janvier suivant. Retirer 5 000 $ en juin et les remettre en octobre est un dépassement, pénalisé chaque mois.' },
                  { lead: 'Le CELIAPP se périme.', body: 'Sa durée de vie est limitée après l’ouverture, d’où le conseil qui vaut la leçon entière : l’ouvrir dès l’admissibilité, même avec 0 $.' },
                ],
                todo:
                  'Ouvrir un compte chez un courtier à escompte plutôt qu’au comptoir de sa banque : Wealthsimple, Questrade ou Disnat. Pièce d’identité, NAS, une vingtaine de minutes. Puis relever ses droits de cotisation dans Mon dossier de l’ARC avant de verser quoi que ce soit.',
              },
              fr: {
                grail:
                  'Le PEA, pour qui vise les actions et le long terme. Après cinq ans de détention, les gains échappent à l’impôt sur le revenu et il ne reste que les prélèvements sociaux.',
                points: [
                  { lead: 'L’horloge démarre à l’ouverture, pas au premier gros versement.', body: 'D’où l’intérêt d’ouvrir un PEA aujourd’hui avec une somme symbolique : dans cinq ans, l’antériorité est acquise. Même raisonnement pour l’assurance-vie et son seuil de huit ans.' },
                  { lead: 'Le PEA est européen, et ça se contourne légalement.', body: 'Les actions américaines n’y sont pas éligibles en direct, mais il existe des ETF éligibles au PEA qui répliquent les indices mondiaux par synthèse. Le point pratique que la plupart des débutants ignorent.' },
                  { lead: 'L’assurance-vie ne sert pas à la même chose.', body: 'Plus souple, imbattable pour la transmission grâce à ses abattements par bénéficiaire. Le Livret A, lui, n’est pas un investissement : c’est l’épargne de précaution.' },
                ],
                todo:
                  'Ouvrir un PEA chez un courtier en ligne et verser le minimum, aujourd’hui. Prendre date coûte quelques euros et ne s’achète qu’une seule fois.',
              },
              us: {
                grail:
                  'Le 401(k) jusqu’à concurrence de l’abondement de l’employeur, et rien d’autre avant ça. C’est un rendement immédiat de 50 % à 100 % sur chaque dollar, garanti. Ensuite seulement le Roth IRA.',
                points: [
                  { lead: 'L’ordre est un algorithme, pas une opinion.', body: '401(k) jusqu’à l’abondement, puis Roth IRA jusqu’au plafond, puis retour au 401(k).' },
                  { lead: 'Le Roth est post-impôt, et c’est sa force.', body: 'Tu paies l’impôt maintenant, plus jamais après. Détail qui rassure : les cotisations d’un Roth IRA, pas les gains, peuvent être retirées à tout moment sans impôt ni pénalité.' },
                  { lead: 'Il existe un plafond de revenu pour le Roth IRA.', body: 'Au-delà, la porte d’entrée normale se ferme, et le passage par une conversion est légal mais demande un vrai conseil.' },
                ],
                todo:
                  'Ouvrir son portail RH, vérifier le pourcentage d’abondement et régler sa cotisation au moins à ce niveau. Puis ouvrir un Roth IRA chez Vanguard, Fidelity ou Schwab, et acheter quelque chose dedans.',
              },
              af: {
                grail:
                  'Il n’y en a pas d’équivalent, et le dire est la première honnêteté de la leçon : la zone UEMOA et la zone CEMAC n’ont pas d’enveloppe fiscale comparable au CELI ou au PEA. Ce que tu ouvres, c’est un compte-titres chez une SGI agréée, et l’avantage se joue ailleurs : sur les frais, sur le rendement des obligations d’État, et sur le fait d’être investi plutôt que de laisser dormir.',
                points: [
                  { lead: 'On ne passe pas en direct.', body: 'Acheter à la BRVM, à Abidjan, se fait obligatoirement par une société de gestion et d’intermédiation agréée. Même logique à la BVMAC de Douala pour la CEMAC. Vérifier l’agrément auprès du régulateur régional est le premier réflexe.' },
                  { lead: 'La liquidité est la vraie contrainte, pas le rendement.', body: 'La cote régionale compte quelques dizaines de sociétés, dominée par une poignée de titres, et il n’existe pas d’équivalent local d’un FNB indiciel bon marché. On construit lentement, on ne spécule pas.' },
                  { lead: 'Les obligations d’État sont l’outil le plus sous-estimé de la zone.', body: 'Coupons souvent supérieurs à ce qu’un européen ou un canadien obtient à risque comparable, accessibles par la même SGI, et mieux adaptés à quelqu’un qui débute.' },
                ],
                note:
                  'Le point diaspora. Envoyer de l’argent au pays n’est pas investir. Un terrain acheté à distance sans titre foncier vérifié, un chantier confié à un proche sans contrat, une « opportunité » sans intermédiaire agréé : ce sont les trois façons les plus courantes de perdre dix ans d’épargne. Si personne n’est agréé et que rien n’est écrit, ce n’est pas un placement.',
                todo:
                  'Choisir une SGI agréée dans son pays, vérifier son agrément sur le site du régulateur régional, demander la liste des pièces à fournir, et poser une seule question au téléphone : les frais à l’achat, à la vente, et à la garde annuelle.',
              },
            },
          },
        ],
      },
    ],
  },
]
