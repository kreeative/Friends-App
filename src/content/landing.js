/**
 * Landing-page copy, kept out of the i18n dictionary for the same reason the
 * legal texts are: this is prose that changes on its own schedule, and it
 * reads far better as paragraphs than as sixty interface keys.
 */

export const LANDING = {
  en: {
    hero: {
      eyebrow: 'For two to six people who mean it',
      title: 'Alone we go faster, but together we go further.',
      body: 'Our environment dictates our output. Stop grinding in isolation—surround yourself with high-caliber peers who force you to level up every single week.',
      cta: 'Start a group',
      secondary: 'How it works',
      note: 'Ambition Is Contagious.',
    },

    problem: {
      eyebrow: 'Why often we are not reaching our goals?',
      title: 'Productivity apps do not fail for lack of features.',
      body: 'They fail because vague goals cannot be checked, because nothing happens when someone goes silent, and because one missed day kills a streak so people quit rather than restart from zero. Every decision here was made against a single test: does this make the group more likely to still be here in week twelve?',
    },

    steps: {
      eyebrow: 'How it works',
      title: 'Three moving parts, and no fourth.',
      items: [
        {
          n: '01',
          title: 'Say what you will actually do',
          body: 'Not "get fit". A commitment, a cadence, a trigger — when and where — and what counts as proof. Naming when and where roughly doubles follow-through over stating an intention alone.',
        },
        {
          n: '02',
          title: 'Everyone checks in at the same time',
          body: 'One shared window each week, not five separate reminders. Results stay sealed until it closes, so there is a moment to come back for rather than a form that is always open.',
        },
        {
          n: '03',
          title: 'Someone notices when you go quiet',
          body: 'Miss two weeks and the group sees it — and one of them can offer to check on you. A message from a friend, not another notification into the void.',
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
        ['RS', 'Rue', 'chip-quiet', 'Away this week'],
      ],
      items: [
        {
          title: 'A rate, never a streak',
          body: 'Eleven of the last fourteen. A bad week moves it a few points; nothing ever resets to zero, so restarting never looks worse than quitting.',
        },
        {
          title: 'Away is not a miss',
          body: 'Exams, travel, illness — say so in advance and the week leaves the maths entirely. Being honest about a hard fortnight should cost nothing.',
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
      body: 'Most personal development repeats claims the research abandoned years ago — willpower as a fuel tank, power posing, twenty-one days to a habit. These name the researchers, state where the evidence is thin, and say plainly what failed to replicate. First chapter of each is free.',
      cta: 'Read a first chapter',
      books: [
        {
          title: 'The Story You Tell About Ability',
          sub: 'Mindset, honestly',
          line: 'What you believe about ability changes what you do after failure — the only moment that matters.',
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
      body: 'Pick the ground and the colour separately. Only one colour is ever on screen — that is the point of choosing. Your choice is remembered on this device and follows you into the app.',
    },

    close: {
      title: 'Two to six people. One evening a week.',
      body: 'Bring the friends you would actually be embarrassed to disappoint.',
      cta: 'Start a group',
    },

    footer: {
      tagline: 'A weekly check-in with a few people who know what you are working on.',
      product: 'Product',
      home: 'Home',
      menu: 'Menu',
      links: { how: 'How it works', library: 'The books', signin: 'Sign in' },
      legalHeading: 'Legal',
      contact: 'Contact',
      rights: 'All rights reserved.',
      built: 'Proudly Ivorian.',
    },
  },

  fr: {
    hero: {
      eyebrow: 'Pour deux à six personnes sérieuses',
      title: 'Parceque ensemble on construit plus vite.',
      body: 'Notre environnement dicte nos résultats. Arrêtez de moudre dans l’isolement - entourez-vous d’amis de haut calibre qui vous forcent à monter de niveau chaque semaine',
      cta: 'Créer un groupe',
      secondary: 'Comment ça marche',
      note: 'L’ambition est contagieuse',
    },

    problem: {
      eyebrow: 'Pourquoi on atteint souvent pas nos objectifs?',
      title: 'Ces applis n’échouent pas par manque de fonctions.',
      body: 'Elles échouent parce qu’un objectif vague ne peut pas être vérifié, parce que rien ne se passe quand quelqu’un disparaît, et parce qu’un seul jour manqué casse une série — alors les gens abandonnent plutôt que de repartir de zéro. Chaque décision ici a été prise sur un seul critère : est-ce que ça augmente les chances que le groupe soit encore là à la douzième semaine ?',
    },

    steps: {
      eyebrow: 'Comment ça marche',
      title: 'Oui, en 3 étapes seulement.',
      items: [
        {
          n: '01',
          title: 'Dis ce que tu vas vraiment faire',
          body: 'Pas « me remettre au sport ». Un engagement, un rythme, un déclencheur — quand et où — et ce qui compte comme preuve. Préciser quand et où double à peu près les chances de s’y tenir.',
        },
        {
          n: '02',
          title: 'Tout le monde fait le point en même temps',
          body: 'Une seule fenêtre partagée chaque semaine, pas cinq rappels séparés. Les réponses restent scellées jusqu’à la fermeture : il y a un moment où revenir, pas un formulaire toujours ouvert.',
        },
        {
          n: '03',
          title: 'Quelqu’un remarque quand tu disparais',
          body: 'Deux semaines sans nouvelles et le groupe le voit — et l’un d’eux peut proposer de prendre des tiennes. Un message d’un ami, pas une notification de plus dans le vide.',
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
          body: 'Onze sur les quatorze derniers. Une mauvaise semaine fait bouger ça de quelques points ; rien ne repart jamais de zéro, donc recommencer n’est jamais pire qu’abandonner.',
        },
        {
          title: 'Absent n’est pas manqué',
          body: 'Examens, voyage, maladie — dis-le à l’avance et la semaine sort complètement du calcul. Être honnête sur une quinzaine difficile ne devrait rien coûter.',
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
      body: 'Le développement personnel répète des affirmations que la recherche a abandonnées depuis longtemps — la volonté comme réservoir, les postures de pouvoir, vingt-et-un jours pour une habitude. Ces livres nomment les chercheurs, disent où les preuves sont minces, et annoncent clairement ce qui n’a pas été reproduit. Le premier chapitre de chacun est gratuit.',
      cta: 'Lire un premier chapitre',
      books: [
        {
          title: 'The Story You Tell About Ability',
          sub: 'L’état d’esprit, honnêtement',
          line: 'Ce que tu crois sur tes capacités change ce que tu fais après un échec — le seul moment qui compte.',
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
      body: 'Choisis le fond et la couleur séparément. Une seule couleur à l’écran à la fois — c’est tout l’intérêt de choisir. Ton choix est retenu sur cet appareil et te suit dans l’application.',
    },

    close: {
      title: 'De deux à six. Un soir par semaine.',
      body: 'Amène les amis que tu serais vraiment gêné de décevoir.',
      cta: 'Créer un groupe',
    },

    footer: {
      tagline: 'Un point hebdomadaire avec quelques personnes qui savent sur quoi tu travailles.',
      product: 'Produit',
      links: {
        how: 'Comment ça marche',
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
