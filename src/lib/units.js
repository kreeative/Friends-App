/**
 * Les millilitres et les onces, et la seule regle qui compte: on stocke en ml.
 *
 * CE QUI A ETE DEMANDE
 *
 *   "Je ne bois pas de verre d'eau. J'ai une bouteille d'eau qui fait 40 oz.
 *    Donc je ne suivais pas vraiment avec la notation en verres combien je
 *    bois. Je viens d'ouvrir ma calculatrice et j'ai fait le calcul de ma
 *    cible d'eau moins l'eau que je bois dans ma bouteille. Je pensais a une
 *    option ou ce n'est pas un verre d'eau, mais... si tu as une bouteille et
 *    que ta bouteille est en oz ou en ml."
 *
 * Ouvrir une calculatrice pour savoir ou on en est, c'est l'application qui
 * n'a pas fait son travail.
 *
 * POURQUOI L'UNITE EST UN AFFICHAGE ET PAS UN STOCKAGE
 *
 * water_log.ml et notify_pref.water_target_ml restent en millilitres, et tout
 * le calcul (le rythme, le rattrapage, le retard) continue de tourner en
 * millilitres. L'unite ne change que ce qu'on ecrit a l'ecran et ce qu'on tape
 * dans un champ.
 *
 * C'est la seule facon de ne pas casser l'historique: quelqu'un qui a note six
 * mois en ml et qui passe aux onces doit voir ses six mois convertis, pas
 * reinterpretes. Stocker l'unite avec chaque ligne aurait donne une table ou
 * additionner deux lignes demande d'abord de les convertir, ce qui est le
 * genre de detail qu'on oublie une fois sur trois.
 *
 * L'ONCE LIQUIDE AMERICAINE, PAS L'IMPERIALE
 *
 * 29,5735 ml. L'once imperiale britannique fait 28,4131 ml, soit 4 % de moins,
 * et sur une bouteille de 40 oz l'ecart est de 47 ml. Le produit est au Canada
 * et les bouteilles y sont vendues en onces americaines, comme aux Etats-Unis.
 * Ecrit ici pour que le jour ou quelqu'un au Royaume-Uni trouve son compte
 * bizarre, la reponse soit dans le fichier.
 */

/** Une once liquide americaine, en millilitres. */
export const ML_PER_OZ = 29.5735

export const UNITS = ['ml', 'oz']

/** Les bornes d'une contenance, en ml: de la petite tasse au grand bidon. */
export const MIN_SERVING_ML = 50
export const MAX_SERVING_ML = 2000

/** L'unite, ou le repli. Une valeur inconnue en base ne doit rien casser. */
export function safeUnit(unit) {
  return UNITS.includes(unit) ? unit : 'ml'
}

/**
 * Des millilitres vers l'unite affichee, en nombre.
 *
 * Arrondi a l'entier pour les onces: personne n'ecrit 39,7 oz sur une
 * bouteille, et un champ qui rend 39,99999 apres un aller-retour est un champ
 * que l'on croit casse.
 */
export function toUnit(ml, unit = 'ml') {
  const n = Number(ml) || 0
  return safeUnit(unit) === 'oz' ? Math.round(n / ML_PER_OZ) : Math.round(n)
}

/**
 * De l'unite affichee vers des millilitres, en entier.
 *
 * L'aller-retour est stable aux tailles qui existent: 40 oz donne 1183 ml, et
 * 1183 ml redonne 40 oz. C'est verifie sur toute la plage dans le test, parce
 * qu'un arrondi qui derive d'une once par aller-retour transformerait une
 * bouteille de 40 en bouteille de 39 au premier enregistrement.
 */
export function fromUnit(n, unit = 'ml') {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.round(safeUnit(unit) === 'oz' ? v * ML_PER_OZ : v)
}

/** Le mot de l'unite, tel qu'il s'ecrit a cote d'un nombre. */
export function unitLabel(unit) {
  return safeUnit(unit) === 'oz' ? 'oz' : 'ml'
}

/**
 * Une quantite, ecrite pour etre lue.
 *
 * En onces, toujours des onces: une bouteille fait 40 oz, pas 1,2 quelque
 * chose, et c'est le chiffre imprime sur l'objet qu'on a dans la main.
 *
 * En millilitres, on passe au litre a partir de 1000, avec une decimale. "2000
 * ml" est juste et personne ne l'ecrit; "2 L" est ce que dit une bouteille.
 * Le zero decimal inutile est retire, donc 2 L et pas 2,0 L.
 *
 * La virgule decimale suit la langue: 1,2 L en francais, 1.2 L en anglais.
 * Intl s'en charge plutot qu'un remplacement de point par une virgule, qui est
 * la version qui se trompe sur les milliers.
 */
export function formatAmount(ml, unit = 'ml', locale = 'fr') {
  const tag = locale === 'en' ? 'en-CA' : 'fr-CA'
  const n = Math.max(0, Number(ml) || 0)

  if (safeUnit(unit) === 'oz') {
    return `${new Intl.NumberFormat(tag).format(toUnit(n, 'oz'))} oz`
  }
  if (n < 1000) return `${new Intl.NumberFormat(tag).format(Math.round(n))} ml`

  const litres = Math.round(n / 100) / 10
  return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(litres)} L`
}

/**
 * Ce qu'on tape dans un champ, ramene a des millilitres utilisables.
 *
 * Accepte la virgule decimale, parce que sur un clavier francais c'est ce qui
 * sort et que Number(',5') vaut NaN. Rend null pour ce qui n'est pas un
 * nombre, plutot que zero: un champ vide et un zero tape ne veulent pas dire
 * la meme chose, et confondre les deux enregistrerait une gorgee de rien.
 */
export function parseAmount(text, unit = 'ml') {
  const raw = String(text ?? '').trim().replace(',', '.')
  if (!raw) return null
  const v = Number(raw)
  if (!Number.isFinite(v) || v <= 0) return null
  return fromUnit(v, unit)
}

/**
 * Une contenance ramenee dans ses bornes.
 *
 * Bornee en ML et pas dans l'unite affichee, pour que les deux unites aient
 * exactement les memes limites: sinon une bouteille acceptee en onces serait
 * refusee en millilitres apres un simple changement d'unite.
 */
export function safeServing(ml, fallback = 250) {
  const n = Number(ml)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(MAX_SERVING_ML, Math.max(MIN_SERVING_ML, Math.round(n)))
}
