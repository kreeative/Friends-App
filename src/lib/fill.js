/**
 * Remplace les marqueurs {cle} d'un texte par des valeurs.
 *
 * Le meme geste que t() dans i18n.jsx, mais pour du contenu plutot que pour des
 * chaines traduites : les etudes portent leurs chiffres dans un objet a part
 * pour qu'une traduction ne puisse pas emporter un pourcentage avec elle, et
 * c'est ici que les deux se rejoignent.
 *
 * UNE CLE INCONNUE RESTE VISIBLE.
 *
 * Elle n'est pas remplacee par du vide. Une phrase a laquelle il manque un
 * nombre doit se voir a la relecture, pas se lire comme une phrase finie qui
 * dit autre chose : « parmi ceux qui ont une ambition,  % n'epargnent rien »
 * est une faute qu'on repere, « ... n'epargnent rien » ne l'est pas.
 *
 * Pur et sans import, donc testable sous node sans bundler.
 */
export function fill(text, values = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (whole, key) => {
    const v = values?.[key]
    return v === undefined || v === null ? whole : String(v)
  })
}
