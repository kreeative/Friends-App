/**
 * Landing-page copy, kept out of the i18n dictionary for the same reason the
 * legal texts are: this is prose that changes on its own schedule, and it
 * reads far better as paragraphs than as sixty interface keys.
 */

export const LANDING = {
  en: {
    hero: {
      title: 'Change your life. Take back your future.',
      /* An aim, not a count. See the note on the French copy. */
      body: 'The goal: help millions of people transform how they live, through personal discipline, an ambitious mindset and control of their money.',
      cta: 'Upgrade your lifestyle',
      secondary: 'How it works',
      note: 'Free, and your budget stays private',
    },

    manifesto:
      'A new way of living does not ask for luck. It asks for vision, for discipline every day, and for the right tools to carry it out.',

    pillars: {
      eyebrow: 'The three pillars',
      title: 'What you build here.',
      items: [
        {
          n: '01',
          title: 'Discipline & mindset',
          body: 'Build the daily habits that shape the better version of you. You say what you are going to do, your friends see it, and you tick it off every day.',
          tone: 'bg-cat-1-soft',
        },
        {
          n: '02',
          title: 'Upgrade your lifestyle',
          body: 'Think bigger. Travel, a career change, independence: give your most ambitious plans a date and a number instead of keeping them in your head.',
          tone: 'bg-cat-3-soft',
        },
        {
          n: '03',
          title: 'Financial freedom',
          body: 'Put your money behind what you want: envelopes for the everyday, Big Budgets for the large things, and savings for what is left.',
          tone: 'bg-cat-5-soft',
        },
      ],
    },

    /* See the note on the French copy: this block exists because people sent
       the link and could not tell what the app was for. */
    what: {
      eyebrow: 'In plain terms',
      title: 'What is Rich & Friends?',
      items: [
        {
          title: 'A small group of friends, and what each of you commits to.',
          body: 'You write down what you are going to do and how often. Your friends see it. They write theirs too.',
        },
        {
          title: 'One check-in a day, in about a minute.',
          body: 'You tick off what you did, with proof if your goal asks for it. Nobody sees anyone else\u2019s answers until the day is over.',
        },
        {
          title: 'A personal budget nobody can see.',
          body: 'How much you can spend today without breaking your month. No one in your group can read it, and that is not a setting: it is written into the database.',
        },
      ],
    },

    /* The answer has to answer the question. See the note on the French. */
    problem: {
      eyebrow: 'Why don’t we reach our goals?',
      title: 'Almost never for want of willpower.',
      reasons: [
        {
          why: 'A vague goal cannot be checked.',
          body: '"Get back into shape" has no yes or no, so you never find out whether you kept it.',
          fix: 'Here you write a commitment, a rhythm, and what will count as proof.',
        },
        {
          why: 'When somebody disappears, nothing happens.',
          body: 'Nobody notices, and the app that asks least of you is the first one you drop.',
          fix: 'Here, after two periods of silence, your friends see it and one of them offers to write to you.',
        },
        {
          why: 'One broken streak and people quit.',
          body: 'Starting from zero costs more than the day you actually missed.',
          fix: 'Here the number the group looks at is a share of the period, not a streak. A missed day costs you a fraction, not everything.',
        },
      ],
    },

    steps: {
      eyebrow: 'How it works',
      title: 'Three moving parts, and no fourth.',
      items: [
        {
          n: '01',
          title: 'Say what you will actually do',
          body: 'Not "get fit". A commitment, a cadence, a trigger (when and where) and what counts as proof. Naming when and where roughly doubles follow-through over stating an intention alone.',
        },
        {
          n: '02',
          title: 'Everyone checks in at the same time',
          body: 'One shared window each day, not five separate reminders. Results stay sealed until it closes, so there is a moment to come back for rather than a form that is always open.',
        },
        {
          n: '03',
          title: 'Someone notices when you go quiet',
          body: 'Miss two weeks and the group sees it, and one of them can offer to check on you. A message from a friend, not another notification into the void.',
        },
      ],
    },

    different: {
      eyebrow: 'What is deliberately different',
      previewTitle: '2 of 4 have checked in',
      previewRate: '11 of the last 14',
      preview: [
        ['AK', 'Ana', 'chip-green', 'Checked in'],
        ['BM', 'Ben', 'chip-green', 'Checked in'],
        ['TO', 'Tomas', 'chip-quiet', 'Not yet'],
        ['RS', 'Rue', 'chip-quiet', 'Away today'],
      ],
      items: [
        {
          title: 'A rate, never a streak',
          body: 'Eleven of the last fourteen. A bad day moves it a few points; nothing ever resets to zero, so restarting never looks worse than quitting.',
        },
        {
          title: 'Away is not a miss',
          body: 'Exams, travel, illness. Say so in advance and the day leaves the maths entirely. Being honest about a hard fortnight should cost nothing.',
        },
        {
          title: 'No leaderboard',
          body: 'Ranking friends by performance mostly teaches whoever is last to stop opening the app. They are the person the group most needs to keep.',
        },
        {
          title: 'Two emails a month, maximum',
          body: 'One before the window opens, one if you have missed twice. The limit is enforced by the database, not by good intentions.',
        },
      ],
    },

    library: {
      eyebrow: 'The reading library',
      title: 'Three books, written to be accurate.',
      body: 'Most personal development repeats claims the research abandoned years ago. Willpower as a fuel tank, power posing, twenty-one days to a habit. These name the researchers, state where the evidence is thin, and say plainly what failed to replicate. First chapter of each is free.',
      cta: 'Read a first chapter',
      books: [
        {
          title: 'The Story You Tell About Ability',
          sub: 'Mindset, honestly',
          line: 'What you believe about ability changes what you do after failure. The only moment that matters.',
        },
        {
          title: 'Evidence of Yourself',
          sub: 'Confidence as a byproduct',
          line: 'Confidence is not manufactured internally and then acted on. It is the residue of evidence that you can handle things.',
        },
        {
          title: 'Design Beats Discipline',
          sub: 'Why willpower is not the variable',
          line: 'People who look disciplined are mostly not resisting more. They have arranged their lives so there is less to resist.',
        },
      ],
    },

    theme: {
      title: 'Make it yours.',
      body: 'Pick the ground and the colour separately. Only one colour is ever on screen. That is the point of choosing. Your choice is remembered on this device and follows you into the app.',
    },

    close: {
      title: 'Two to six people. One minute a day.',
      body: 'Bring the friends you would actually be embarrassed to disappoint.',
      cta: 'Start a group',
    },

    footer: {
      tagline: 'A daily check-in with a few people who know what you are working on.',
      product: 'Product',
      home: 'Home',
      menu: 'Menu',
      links: { how: 'How it works', about: 'About', library: 'The books', signin: 'Sign in' },
      legalHeading: 'Legal',
      contact: 'Contact',
      rights: 'All rights reserved.',
      built: 'Proudly Ivorian.',
    },
  },

  fr: {
    hero: {
      title: 'Change de vie. Reprends le contrôle de ton avenir.',
      /**
       * UN OBJECTIF, PAS UNE STATISTIQUE.
       *
       * La premiere version disait « aide des milliers de personnes ». C'est
       * un chiffre verifiable, et il est faux aujourd'hui : les groupes de
       * cette app se comptent sur les doigts. Une page publique qui annonce
       * des utilisateurs qu'elle n'a pas est la meme faute que « 5 membres
       * maximum », qui n'est ecrit nulle part dans la base, et que
       * « Telecharger l'application », qui ne telecharge rien.
       *
       * « Objectif : aider des millions de personnes » dit la meme ambition et
       * se trouve etre vrai, parce que c'est une declaration d'intention et
       * non un compte. Rien a corriger le jour ou le chiffre arrive.
       */
      body: 'Objectif : aider des millions de personnes à transformer leur mode de vie grâce à la discipline personnelle, un mindset ambitieux et la maîtrise financière.',
      cta: 'Améliore ton Lifestyle',
      secondary: 'Comment ça marche',
      note: 'Gratuit, et ton budget reste privé',
    },

    manifesto:
      'Un nouveau mode de vie ne demande pas de la chance. Il demande de la vision, de la discipline au quotidien et les bons outils pour l’exécuter.',

    /* Les trois piliers. Chacun pointe vers une partie de l'app qui existe
       vraiment : les objectifs et le point quotidien, les projets et le suivi,
       le budget et l'epargne. */
    pillars: {
      eyebrow: 'Les trois piliers',
      title: 'Ce que tu construis ici.',
      items: [
        {
          n: '01',
          title: 'Discipline & Mindset',
          body: 'Construis les habitudes quotidiennes qui façonnent la meilleure version de toi-même. Tu dis ce que tu vas faire, tes amis le voient, et tu coches chaque jour.',
          tone: 'bg-cat-1-soft',
        },
        {
          n: '02',
          title: 'Upgrade ton Lifestyle',
          body: 'Pense grand. Voyages, reconversion, indépendance : donne une date et un montant à tes projets les plus ambitieux au lieu de les garder dans ta tête.',
          tone: 'bg-cat-3-soft',
        },
        {
          n: '03',
          title: 'Liberté Financière',
          body: 'Mets ton argent au service de tes rêves : des enveloppes pour le quotidien, le Haut Budget pour les gros projets, et l’épargne pour ce qui reste.',
          tone: 'bg-cat-5-soft',
        },
      ],
    },

    /**
     * Ce que l'app EST, en trois phrases concretes.
     *
     * Le hero est une promesse et le bloc suivant parle des autres apps. Rien
     * ne disait ce qu'on fait ici, et c'est le retour qui a declenche ce bloc :
     * les gens a qui on envoie le lien ne comprennent pas a quoi ca sert.
     *
     * Chaque phrase est verifiable dans le code. Il n'y a volontairement aucun
     * nombre de membres : la taille du groupe n'est pas contrainte en base, et
     * annoncer « 5 maximum » sur une page publique serait faux.
     */
    what: {
      eyebrow: 'Concrètement',
      title: 'C’est quoi, Rich & Friends ?',
      items: [
        {
          title: 'Un petit groupe d’amis, et ce que chacun s’engage à faire.',
          body: 'Tu écris ce que tu vas faire et à quel rythme. Tes amis le voient. Eux aussi écrivent le leur.',
        },
        {
          title: 'Un point par jour, en une minute.',
          body: 'Tu coches ce que tu as fait, avec une preuve si ton objectif en demande une. Personne ne voit les réponses des autres avant la fin de la journée.',
        },
        {
          title: 'Un budget perso que personne ne voit.',
          body: 'Combien tu peux dépenser aujourd’hui sans casser ton mois. Aucun membre de ton groupe ne peut le lire, et ce n’est pas un réglage : c’est écrit dans la base.',
        },
      ],
    },

    /**
     * LA REPONSE DOIT REPONDRE A LA QUESTION.
     *
     * Le titre disait « Ces applis n'echouent pas par manque de fonctions »
     * sous un chapeau qui demande « pourquoi on n'atteint pas nos objectifs ».
     * La question porte sur nous, la reponse parlait des logiciels. Personne
     * n'arrive sur cette page en se demandant pourquoi les applis echouent.
     *
     * Trois raisons, sur nous, et pour chacune ce que l'app fait. Les trois
     * sont verifiables dans le code : la preuve demandee a la creation d'un
     * objectif, le nudge leve par tick() apres deux periodes sans nouvelles,
     * et memberRates qui calcule une proportion sur la fenetre.
     *
     * La troisieme a failli etre fausse. La formulation evidente etait « ici
     * rien ne se casse » : c'est faux, streakOf coupe bien la serie au premier
     * jour du. Ce qui est vrai, c'est que la serie n'est pas le chiffre que le
     * groupe regarde.
     */
    problem: {
      eyebrow: 'Pourquoi on n’atteint pas nos objectifs ?',
      title: 'Presque jamais par manque de volonté.',
      reasons: [
        {
          why: 'Un objectif vague ne se vérifie pas.',
          body: '« Me remettre au sport » n’a pas de réponse oui ou non, alors on ne sait jamais si on l’a tenu.',
          fix: 'Ici tu écris un engagement, un rythme, et ce qui comptera comme preuve.',
        },
        {
          why: 'Quand quelqu’un disparaît, il ne se passe rien.',
          body: 'Personne ne le remarque, et l’app la moins gênante est celle qu’on lâche en premier.',
          fix: 'Ici, après deux périodes sans nouvelles, tes amis le voient et l’un d’eux se propose de t’écrire.',
        },
        {
          why: 'Une série cassée, et on abandonne.',
          body: 'Repartir de zéro coûte plus cher que le jour qu’on a manqué.',
          fix: 'Ici le chiffre que le groupe regarde est une proportion sur la période, pas une série. Un jour manqué te coûte une fraction, pas tout.',
        },
      ],
    },

    steps: {
      eyebrow: 'Comment ça marche',
      title: 'Oui, en 3 étapes seulement.',
      items: [
        {
          n: '01',
          title: 'Dis ce que tu vas vraiment faire',
          body: 'Pas « me remettre au sport ». Un engagement, un rythme, un déclencheur (quand et où) et ce qui compte comme preuve. Préciser quand et où double à peu près les chances de s’y tenir.',
        },
        {
          n: '02',
          title: 'Tout le monde fait le point en même temps',
          body: 'Une seule fenêtre partagée chaque jour, pas cinq rappels séparés. Les réponses restent scellées jusqu’à la fermeture : il y a un moment où revenir, pas un formulaire toujours ouvert.',
        },
        {
          n: '03',
          title: 'Quelqu’un remarque quand tu disparais',
          body: 'Deux semaines sans nouvelles et le groupe le voit, et l’un d’eux peut proposer de prendre des tiennes. Un message d’un ami, pas une notification de plus dans le vide.',
        },
      ],
    },

    different: {
      eyebrow: 'Ce qui change, volontairement',
      previewTitle: '2 sur 4 ont fait le point',
      previewRate: '11 des 14 dernières',
      preview: [
        ['AK', 'Ana', 'chip-green', 'Fait'],
        ['BM', 'Ben', 'chip-green', 'Fait'],
        ['TO', 'Tomas', 'chip-quiet', 'Pas encore'],
        ['RS', 'Rue', 'chip-quiet', 'Absente'],
      ],
      items: [
        {
          title: 'Un taux, jamais une série',
          body: 'Onze sur les quatorze derniers. Une mauvaise journée fait bouger ça de quelques points ; rien ne repart jamais de zéro, donc recommencer n’est jamais pire qu’abandonner.',
        },
        {
          title: 'Absent n’est pas manqué',
          body: 'Examens, voyage, maladie. Dis-le à l’avance et la journée sort complètement du calcul. Être honnête sur une quinzaine difficile ne devrait rien coûter.',
        },
        {
          title: 'Pas de classement',
          body: 'Classer ses amis par performance apprend surtout au dernier à ne plus ouvrir l’appli. C’est précisément celui que le groupe doit garder.',
        },
        {
          title: 'Deux e-mails par mois, maximum',
          body: 'Un avant l’ouverture, un si tu as manqué deux fois. La limite est imposée par la base de données, pas par de bonnes intentions.',
        },
      ],
    },

    library: {
      eyebrow: 'La bibliothèque',
      title: 'Trois livres, écrits pour être justes.',
      body: 'Le développement personnel répète des affirmations que la recherche a abandonnées depuis longtemps. La volonté comme réservoir, les postures de pouvoir, vingt-et-un jours pour une habitude. Ces livres nomment les chercheurs, disent où les preuves sont minces, et annoncent clairement ce qui n’a pas été reproduit. Le premier chapitre de chacun est gratuit.',
      cta: 'Lire un premier chapitre',
      books: [
        {
          title: 'The Story You Tell About Ability',
          sub: 'L’état d’esprit, honnêtement',
          line: 'Ce que tu crois sur tes capacités change ce que tu fais après un échec. Le seul moment qui compte.',
        },
        {
          title: 'Evidence of Yourself',
          sub: 'La confiance comme résidu',
          line: 'La confiance ne se fabrique pas à l’intérieur avant d’agir. C’est ce que laissent les preuves accumulées que tu sais encaisser.',
        },
        {
          title: 'Design Beats Discipline',
          sub: 'Pourquoi la volonté n’est pas la variable',
          line: 'Les gens qui ont l’air disciplinés ne résistent pas plus. Ils ont arrangé leur vie pour avoir moins à résister.',
        },
      ],
    },

    theme: {
      title: 'À ta main.',
      body: 'Choisis le fond et la couleur séparément. Une seule couleur à l’écran à la fois. C’est tout l’intérêt de choisir. Ton choix est retenu sur cet appareil et te suit dans l’application.',
    },

    close: {
      title: 'De deux à six. Une minute par jour.',
      body: 'Amène les amis que tu serais vraiment gêné de décevoir.',
      cta: 'Créer un groupe',
    },

    footer: {
      tagline: 'Un point quotidien avec quelques personnes qui savent sur quoi tu travailles.',
      product: 'Produit',
      links: {
        how: 'Comment ça marche',
        about: 'À propos',
        library: 'Les livres',
        signin: 'Se connecter',
      },
      legalHeading: 'Légal',
      contact: 'Contact',
      rights: 'Tous droits réservés.',
      built: 'Fièrement ivoirien.',
    },
  },
}
