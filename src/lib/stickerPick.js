/**
 * Choisir les stickers d'une surface, sans jamais la laisser nue.
 *
 * POURQUOI CE FICHIER EXISTE SEPAREMENT DE art.js
 *
 * art.js utilise import.meta.glob, que node ne sait pas executer: rien de ce
 * qui vit dedans ne peut etre teste autrement qu'en lisant son texte. La regle
 * de choix, elle, est une fonction pure sur deux listes de noms. Elle vit donc
 * ici, ou elle se teste pour de vrai.
 *
 * LE PIEGE QU'ELLE FERME
 *
 * Quatre surfaces nomment des stickers precis: la rangee de la page de
 * connexion, et les trois jeux de Stickers.jsx (le site public, l'application,
 * le deck d'accueil). Douze noms au total, ecrits a la main.
 *
 * Ces listes etaient filtrees contre ce qui existe vraiment, ce qui est juste
 * pour UN nom disparu: mieux vaut un sticker en moins qu'une image cassee.
 * Mais remplacer tout le dossier d'un coup fait disparaitre les douze a la
 * fois, et le filtre rend alors une liste VIDE. Pas d'erreur, pas d'image
 * cassee, pas de trace: la page de connexion perd sa rangee et toutes les
 * pages perdent leur decor, et rien ne le signale.
 *
 * Demande: "remplace tout les sticker par ceux ci". C'est exactement le geste
 * qui declenche ca.
 *
 * Donc: on garde les noms voulus qui existent, et on complete avec ce qu'il y
 * a, dans l'ordre, jusqu'au compte demande. Une liste choisie a la main peut
 * perdre un membre; une surface ne peut pas perdre son decor.
 *
 * Le complement est DETERMINISTE, pris dans l'ordre des noms disponibles. Un
 * tirage au sort donnerait deux rendus differents pour le meme code, ce qui
 * rendrait toute capture d'ecran impossible a comparer d'une fois sur l'autre.
 */

/**
 * @param wanted     les noms voulus, dans l'ordre
 * @param available  les noms qui existent vraiment
 * @param atLeast    combien il en faut au minimum. 0 = l'ancien comportement,
 *                   filtrer et rien de plus.
 * @returns          les noms a afficher, sans doublon
 */
export function pickFrom(wanted, available, atLeast = 0) {
  const have = new Set(available ?? [])
  /* Set aussi sur le resultat: un nom ecrit deux fois dans une liste voulue
     donnerait deux fois la meme image a deux places du rail, ce qui se voit. */
  const kept = []
  for (const name of wanted ?? []) {
    if (have.has(name) && !kept.includes(name)) kept.push(name)
  }
  if (kept.length >= atLeast) return kept

  /* Il en manque. On complete avec ce qui reste, dans l'ordre donne. */
  for (const name of available ?? []) {
    if (kept.length >= atLeast) break
    if (!kept.includes(name)) kept.push(name)
  }
  return kept
}
