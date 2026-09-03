/**
 * The thank-you page.
 *
 * THE LIST IS EMPTY AND THAT IS DELIBERATE.
 *
 * Nobody is added to it by guessing. Names that appeared in passing in a
 * screenshot, a group roster or a notification are not consent to be printed
 * on a public page that search engines will index, and a person who tested an
 * app has not agreed to be named for it just by testing. Anne-Kelly says who
 * goes here, and the page is built so adding them is one edit.
 *
 * The page reads correctly with the list empty: the note stands on its own and
 * the roll simply does not render. So this can ship before the names exist
 * without publishing a heading over a blank space.
 *
 * HOW MUCH OF A NAME TO PRINT IS THE AUTHOR'S CALL, NOT A RULE HERE.
 * `name` is free text. "Ariel", "Ariel D." and a full name all render the same,
 * and a first name alone is the kinder default for somebody who did a favour
 * rather than took a job. `note` is optional, one short line, for what they
 * actually caught.
 */
export const TESTERS = [
  /* Examples of the shape, commented out so nothing fictional ever renders:
     { name: 'Prenom N.', note: 'a trouve le bug du calendrier' },
     { name: 'Prenom' },
  */
]

export const CREDITS = {
  en: {
    title: 'Thank you',
    lede: 'This was tested by people who had nothing to gain from it.',
    body: [
      'Every app has a page like this and most of them are a formality. This one is not, because the thing you are using was shaped by a small number of people who agreed to open a half-finished app on their own phone, use it for a week, and then tell me the truth about it.',
      'That is a real favour. Testing something a friend made is socially awkward in a way that testing a stranger’s product is not: the easy thing is to say it is great and change the subject. Nobody here did the easy thing. They told me what was confusing, what they never found, what they stopped opening after two days, and what made them feel judged rather than supported. Several of the decisions this app is built on are theirs.',
      'A few of the things they caught: buttons that did nothing, words that meant something different than intended, and a check-in that asked more of somebody’s evening than an evening has. None of that would have been found by me alone, because I already knew what everything was supposed to do.',
    ],
    rollTitle: 'The people who tested it',
    /* Printed under the roll, in small type. Publishing somebody's name should
       come with a way to stop publishing it, in the same place they read it. */
    removal: 'If you are on this page and would rather not be, write to us and you will be off it the same day.',
    signature: 'Anne-Kelly Kouyaté',
    signatureNote: 'Founder',
  },

  fr: {
    title: 'Merci',
    lede: 'Cette application a été testée par des gens qui n’avaient rien à y gagner.',
    body: [
      'Toutes les applications ont une page comme celle-ci et la plupart sont une formalité. Pas celle-là, parce que ce que tu utilises a été façonné par quelques personnes qui ont accepté d’ouvrir une application à moitié finie sur leur propre téléphone, de s’en servir pendant une semaine, et de me dire la vérité dessus.',
      'C’est un vrai service. Tester quelque chose fait par une amie est socialement inconfortable d’une manière que tester le produit d’un inconnu n’est pas : le plus simple, c’est de dire que c’est super et de changer de sujet. Personne ici n’a fait le plus simple. Ils m’ont dit ce qui était confus, ce qu’ils n’ont jamais trouvé, ce qu’ils ont arrêté d’ouvrir au bout de deux jours, et ce qui leur donnait l’impression d’être jugés plutôt que soutenus. Plusieurs des décisions sur lesquelles cette application est construite viennent d’eux.',
      'Quelques-unes des choses qu’ils ont attrapées : des boutons qui ne faisaient rien, des mots qui voulaient dire autre chose que prévu, et un point du jour qui demandait à une soirée plus que ce qu’une soirée contient. Rien de tout ça n’aurait été trouvé par moi seule, parce que je savais déjà ce que chaque chose était censée faire.',
    ],
    rollTitle: 'Les personnes qui l’ont testée',
    removal: 'Si tu es sur cette page et que tu préférerais ne pas y être, écris-nous et tu n’y seras plus le jour même.',
    signature: 'Anne-Kelly Kouyaté',
    signatureNote: 'Fondatrice',
  },
}
