/**
 * The thank-you page.
 *
 * NOBODY IS ADDED TO THIS LIST BY GUESSING.
 *
 * The list shipped empty and stayed empty until Anne-Kelly wrote the names out
 * herself. Names that appeared in passing in a screenshot, a group roster or a
 * notification are not consent to be printed on a public page that search
 * engines will index, and a person who tested an app has not agreed to be
 * named for it just by testing. That rule still holds for the next person
 * added: it comes from her, in writing, or it does not go here.
 *
 * SPELLED THE WAY SHE WROTE THEM, INCLUDING THE ACCENTS SHE DID AND DID NOT
 * USE. Somebody else's name is not a thing to correct on their behalf, and
 * "Kouyate" and "Kouyaté" are different names to the people who carry them.
 * The order is hers too, which is why it is not alphabetical.
 *
 * `note` is optional, one short line, for what somebody actually caught. None
 * are set: inventing a contribution to sit under a real person's name would be
 * worse than the blank.
 *
 * The page still reads correctly if this ever empties again. The roll does not
 * render at all when the list is empty, so there is never a heading over a
 * blank space.
 */
export const TESTERS = [
  { name: 'Sophie Noutevi' },
  { name: 'Fatim Traoré' },
  { name: 'Timéo Kouyate' },
  { name: 'Elmine Kouyate' },
  { name: 'Aline Ettien' },
  { name: 'Meliane Lasm' },
]

export const CREDITS = {
  en: {
    title: 'Thank you',
    lede: 'This was tested by people who had nothing to gain from it.',
    body: [
      'Every app has a page like this and most of them are a formality. This one is not, because the thing you are using was shaped by a small number of people who agreed to open a half-finished app on their own phone, use it for a week, and then tell me the truth about it.',
      'That is a real favour. Testing something a friend made is socially awkward in a way that testing a stranger’s product is not: the easy thing is to say it is great and change the subject. Nobody here did the easy thing. What I asked them for was the uncomfortable version: what was confusing, what they never found, what they stopped opening, and what made them feel judged rather than supported. That is what I got, and several of the decisions this app is built on came out of it.',
      'None of it would have been found by me alone. You cannot see the part of your own work that only makes sense because you are the one who built it, and no amount of looking harder fixes that. It takes somebody opening the thing for the first time and saying what actually happened.',
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
      'C’est un vrai service. Tester quelque chose fait par une amie est socialement inconfortable d’une manière que tester le produit d’un inconnu n’est pas : le plus simple, c’est de dire que c’est super et de changer de sujet. Personne ici n’a fait le plus simple. Ce que je leur ai demandé, c’était la version inconfortable : ce qui était confus, ce qu’ils n’ont jamais trouvé, ce qu’ils ont arrêté d’ouvrir, et ce qui leur donnait l’impression d’être jugés plutôt que soutenus. C’est ce que j’ai eu, et plusieurs des décisions sur lesquelles cette application est construite en sont sorties.',
      'Rien de tout ça n’aurait été trouvé par moi seule. On ne voit pas la partie de son propre travail qui ne tient debout que parce qu’on l’a construite soi-même, et regarder plus attentivement n’y change rien. Il faut quelqu’un qui ouvre la chose pour la première fois et qui dit ce qui s’est vraiment passé.',
    ],
    rollTitle: 'Les personnes qui l’ont testée',
    removal: 'Si tu es sur cette page et que tu préférerais ne pas y être, écris-nous et tu n’y seras plus le jour même.',
    signature: 'Anne-Kelly Kouyaté',
    signatureNote: 'Fondatrice',
  },
}
