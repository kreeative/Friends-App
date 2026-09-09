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
/**
 * L'image d'un groupe: celle qu'il a choisie, sinon celle qui se calcule.
 *
 * POURQUOI LES DEUX PLUTOT QUE L'UNE OU L'AUTRE
 *
 * Le calcul a partir de l'identifiant existait seul, et son commentaire disait
 * ou etait sa limite: un groupe ne pouvait pas POSSEDER son image, et ajouter
 * une illustration pouvait rebattre les visages de tout le monde. Le choix
 * stocke repond a ca.
 *
 * Mais il ne remplace pas le calcul, il passe devant. Un groupe qui n'a rien
 * choisi doit avoir un visage quand meme, stable, sans que personne ait eu a
 * s'en occuper et sans une migration qui remplirait des milliers de lignes
 * avec une image tiree au sort.
 *
 * UN NOM QUI N'EXISTE PLUS RETOMBE SUR LE CALCUL. Le dossier des stickers
 * change: on vient d'en remplacer vingt-trois d'un coup. Un groupe dont le
 * choix pointe sur un fichier disparu doit montrer une image, pas un trou.
 * C'est la meme regle que pickFrom: ce qui est demande passe d'abord, ce qui
 * existe decide.
 *
 * @param chosen     le nom stocke sur le groupe, ou null
 * @param id         l'identifiant du groupe, pour le calcul de secours
 * @param available  les noms qui existent vraiment
 */
export function chooseSticker(chosen, id, available) {
  const noms = available ?? []
  if (!noms.length) return undefined
  if (chosen && noms.includes(chosen)) return chosen
  if (!id) return noms[0]
  /* Somme des chiffres hexadecimaux de l'uuid. Le meme calcul qu'avant, pour
     qu'un groupe qui n'a rien choisi ne change pas de visage en passant a
     cette version. */
  const n = [...String(id).replace(/-/g, '')].reduce((a, c) => a + (parseInt(c, 16) || 0), 0)
  return noms[n % noms.length]
}

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
