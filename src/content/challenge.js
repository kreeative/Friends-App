/**
 * LE DEFI 21 MATINS.
 *
 *   "Let's take a 21 days challenge of Miracle Morning. Here's how you can
 *    join the group. And then basically when they're gonna join, all the
 *    objectives are gonna be there in the to-do list. And then ask them if
 *    they woke up, drink water, went to the gym, whatever."
 *
 * Deux choses vivent ici: les objectifs que le groupe recoit a sa creation
 * (create_challenge, supabase/76_challenge.sql), et les mots de la page
 * publique /defi, celle du lien de la video.
 *
 * DES OBJECTIFS GENERIQUES, ET RIEN DE PERSONNEL.
 *
 * La routine qui a servi de point de depart etait un emploi du temps
 * personnel: heures de lever, trajets, jours de bureau et jours de cours. Le
 * depot est public et le groupe sera ouvert a des inconnus, donc rien de tout
 * ca n'est ici. Ce qui reste est la methode, pas la vie de quelqu'un: se
 * lever a l'heure qu'on s'est fixee, boire de l'eau, et les six temps de
 * S.A.V.E.R.S.
 *
 * LE NOM.
 *
 * "Miracle Morning" est le titre d'un livre de Hal Elrod et une marque. Le
 * defi s'appelle donc "Defi 21 matins" et la page cite le livre comme source,
 * sans se presenter comme liee a l'auteur.
 *
 * Chaque objectif est une phrase qu'on coche: c'est le titre de la carte "Objectif
 * du jour", qui les pose un par un chaque matin. `why` n'apparait que sur la
 * page publique. `proof` vaut 'none' partout: un matin se dit en un tap, et
 * demander une photo du verre d'eau est la facon la plus sure de faire
 * abandonner au jour 3.
 */

/** Le seul defi pour l'instant. La meme valeur que le check de la migration 76. */
export const CHALLENGE_ID = 'morning21'

/** Combien de matins. */
export const CHALLENGE_DAYS = 21

export const CHALLENGE = {
  en: {
    name: '21 Mornings Challenge',
    goals: [
      { title: 'Wake up at my planned time', why: 'The first decision of the day, kept.', proof: 'none' },
      { title: 'Drink a big glass of water', why: 'Your body just went eight hours without a drink.', proof: 'none' },
      { title: 'Silence: 5 quiet minutes', why: 'Start the day calm instead of reacting to it.', proof: 'none' },
      { title: 'Affirmations: read them out loud', why: 'Remind yourself who you are aiming to be, and why.', proof: 'none' },
      { title: 'Visualise my day going well', why: 'See the day go right before you live it.', proof: 'none' },
      { title: 'Move for at least 10 minutes', why: 'A walk, a stretch, the gym. At your own pace.', proof: 'none' },
      { title: 'Read 10 pages', why: 'Ten pages a day is a book a month.', proof: 'none' },
      { title: 'Write 3 lines in my journal', why: 'Empty your head, note one good thing, set the course.', proof: 'none' },
    ],
    page: {
      eyebrow: '21 Mornings Challenge',
      title: '21 mornings to keep the plans you make.',
      /* The words the yellow marker goes behind. A substring of `title`. */
      mark: 'the plans you make.',
      body: 'Love having everything planned, but the discipline does not always follow? Same. So let’s do it together: every morning the app asks whether you did it, and the group sees who is keeping up.',
      join: 'Join the challenge',
      start: 'Start my challenge',
      note: 'Free. Make your account and you land straight in the group.',
      note_start: 'Free. You get a group with every morning goal already in it, and a link to bring your friends.',
      list_eyebrow: 'Every morning',
      list_title: 'The app asks you, one at a time:',
      steps_eyebrow: 'How it works',
      steps: [
        { title: 'Join the group', body: 'With the link. Every goal is already in your list.' },
        { title: 'Tick your morning', body: 'Up on time? Your glass of water? Ten minutes of moving? One tap each.' },
        { title: 'Keep it up for 21 days', body: 'Your counter moves every morning and the group sees who is keeping up. You choose what you share.' },
      ],
      credit: 'Inspired by the S.A.V.E.R.S. routine from Hal Elrod’s book The Miracle Morning. Rich & Friends is not affiliated with the author.',
      /* The preview card on the page, built from the app's own classes. */
      preview_eyebrow: 'Goal of the day',
      preview_done: 'Mark done',
    },
  },
  fr: {
    name: 'Défi 21 matins',
    goals: [
      { title: 'Me lever à l’heure prévue', why: 'La première décision de la journée, tenue.', proof: 'none' },
      { title: 'Boire un grand verre d’eau', why: 'Ton corps sort de huit heures sans boire.', proof: 'none' },
      { title: 'Silence : 5 minutes au calme', why: 'Commencer la journée au calme, pas en réaction.', proof: 'none' },
      { title: 'Affirmations : les lire à voix haute', why: 'Te rappeler qui tu veux devenir, et pourquoi.', proof: 'none' },
      { title: 'Visualiser ma journée réussie', why: 'Voir la journée bien se passer avant de la vivre.', proof: 'none' },
      { title: 'Bouger au moins 10 minutes', why: 'Une marche, des étirements, la salle. À ton rythme.', proof: 'none' },
      { title: 'Lire 10 pages', why: 'Dix pages par jour, c’est un livre par mois.', proof: 'none' },
      { title: 'Écrire 3 lignes dans mon journal', why: 'Vider ta tête, noter une bonne chose, fixer le cap.', proof: 'none' },
    ],
    page: {
      eyebrow: 'Défi 21 matins',
      title: '21 matins pour tenir ce que tu planifies.',
      mark: 'ce que tu planifies.',
      body: 'Tu adores tout planifier, mais la discipline ne suit pas toujours ? Pareil. Alors on s’y met ensemble : chaque matin, l’app te demande si tu l’as fait, et le groupe voit qui tient.',
      join: 'Je rejoins le défi',
      start: 'Lancer mon défi',
      note: 'Gratuit. Tu crées ton compte et tu arrives directement dans le groupe.',
      note_start: 'Gratuit. Tu reçois un groupe avec tous les objectifs du matin déjà dedans, et un lien pour embarquer tes amis.',
      list_eyebrow: 'Chaque matin',
      list_title: 'L’app te demande, un par un :',
      steps_eyebrow: 'Comment ça marche',
      steps: [
        { title: 'Rejoins le groupe', body: 'Avec le lien. Tous les objectifs sont déjà dans ta liste.' },
        { title: 'Coche ton matin', body: 'Debout à l’heure ? Ton verre d’eau ? Dix minutes de sport ? Un tap par objectif.' },
        { title: 'Tiens 21 jours', body: 'Ton compteur avance chaque matin et le groupe voit qui tient. Tu choisis ce que tu partages.' },
      ],
      credit: 'Inspiré de la routine S.A.V.E.R.S. du livre The Miracle Morning de Hal Elrod. Rich & Friends n’est pas affilié à l’auteur.',
      preview_eyebrow: 'Objectif du jour',
      preview_done: 'Marquer fait',
    },
  },
}

/** La version dans la langue de la personne, l'anglais sinon. */
export function challengeCopy(locale) {
  return CHALLENGE[locale] ?? CHALLENGE.en
}

/**
 * Ce qu'on envoie a create_challenge(): le texte et le type de preuve, dans
 * l'ordre. La base les garde dans cet ordre (voir la migration 76).
 */
export function challengeGoals(locale) {
  return challengeCopy(locale).goals.map((g) => ({ commitment: g.title, proof_type: g.proof }))
}
