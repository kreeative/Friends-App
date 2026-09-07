/* Extensions explicites: charge par node dans shelves.test.mjs, qui ne resout
   pas les imports sans extension comme le fait Vite. */
import { COURSES } from '../content/courses.js'
import { STUDIES } from '../content/studies.js'

/**
 * Les quatre etageres de Lectures.
 *
 * POURQUOI DES ONGLETS PLUTOT QU'UNE COLONNE.
 *
 * La page empilait quatre sortes de contenu les unes sous les autres: une
 * carte vers les cours, la formation budget, deux bannieres, puis le
 * catalogue. Rien ne disait ou l'une finissait et l'autre commencait, et le
 * catalogue, qui est ce qu'on vient chercher le plus souvent, etait a quatre
 * ecrans de defilement du titre. Un onglet met les quatre au meme niveau et
 * remonte chacune en haut de page.
 *
 * ET POURQUOI IL N'Y A PLUS DE CARTE "OUVRIR LES COURS".
 *
 * Elle ne menait pas a un cours, elle menait a une page qui listait les cours.
 * Un clic pour arriver a une liste qui aurait pu etre la, c'est une porte
 * devant une porte. Les cours sont listes directement dans leur onglet.
 *
 * L'ORDRE.
 *
 * Cours d'abord parce que c'est gratuit et que c'est ce que la page veut
 * qu'on fasse. Livres avant etudes parce que c'est le catalogue. Les etudes
 * en dernier parce qu'il y en a une par mois au mieux, et qu'une etagere
 * rarement remplie ne merite pas d'etre la premiere chose lue.
 */
export const SHELVES = ['courses', 'articles', 'books', 'studies']

export const DEFAULT_SHELF = 'courses'

/**
 * L'etagere lue depuis l'URL, ou celle par defaut.
 *
 * Le choix vit dans la query string et pas dans un useState, pour trois
 * raisons qui ont toutes deja coute quelque chose ailleurs dans ce depot: le
 * bouton retour du telephone revient a l'onglet precedent au lieu de quitter
 * la page, un lien vers "les livres" est partageable, et revenir d'un livre
 * ne rejette pas sur l'onglet des cours.
 */
export function safeShelf(id) {
  return SHELVES.includes(id) ? id : DEFAULT_SHELF
}

/**
 * Les etudes d'une sorte donnee.
 *
 * ARTICLE ET ETUDE SONT DEUX CHOSES, ET L'APPLICATION LE DISAIT DEJA.
 *
 * Les deux vivent dans STUDIES et rendent la meme page, ce qui est correct:
 * c'est la meme mise en page. Mais leurs bandeaux ne disent pas la meme chose
 * et ne l'ont jamais dit: "Nos etudes" d'un cote, "Article" de l'autre. Une
 * etude, ici, c'est un sondage qu'on a mene, publie avec sa methode et ses
 * limites. Un article, c'est un texte informatif construit sur les travaux
 * publies par d'autres, avec ses sources citees.
 *
 * `kind` rend cette difference lisible par le code au lieu de la laisser dans
 * deux chaines de traduction. Le repli est 'study' pour qu'une entree ecrite
 * avant ce champ continue d'apparaitre quelque part plutot que de disparaitre
 * des deux onglets.
 */
export function studiesOfKind(kind) {
  return STUDIES.filter((s) => (s.kind ?? 'study') === kind)
}

/**
 * Combien d'elements sur une etagere, pour le compteur de l'onglet.
 *
 * Le compteur n'est pas de la decoration: sans lui, un onglet vide se decouvre
 * en le touchant, et les etudes sont l'etagere qui a le plus de chances de
 * n'avoir qu'une entree. Savoir avant de toucher qu'il y en a une evite
 * l'aller-retour.
 *
 * Les livres sont passes en parametre parce qu'ils viennent du reseau: le
 * catalogue est une requete, pas un fichier du bundle, et cette fonction reste
 * pure.
 */
export function shelfCount(id, { books = [] } = {}) {
  switch (safeShelf(id)) {
    /* Plus de `+ formation`: Budget 101 etait compte a part parce qu'il vivait
       dans un autre fichier avec son propre lecteur. C'est un cours de COURSES
       comme les trois autres, donc il est deja dans le compte, et l'ajouter
       une deuxieme fois annoncait cinq cours pour quatre cartes. */
    case 'courses':
      return COURSES.length
    case 'articles':
      return studiesOfKind('article').length
    case 'books':
      return books.length
    case 'studies':
      return studiesOfKind('study').length
    default:
      return 0
  }
}
