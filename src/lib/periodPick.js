/* L'extension est ecrite: ce fichier tourne aussi sous node, dans son propre
   test, et node ne resout pas './cycle' tout court. */
import { addDays, dayKey, daysBetween, fromKey } from './cycle.js'

/**
 * Cocher les jours de regles directement sur le mois, comme dans Flo.
 *
 *   "Look the way you can just coche the case number on flo. Our app doesn't
 *    show the day as little round and I don't want it too, so adapt to the
 *    full month view only."
 *
 * Donc: pas de petite pastille a cocher sous le chiffre. La case du jour EST
 * la case a cocher, et la selection se voit par la tuile qui se remplit. Le
 * geste vit dans la vue MOIS et nulle part ailleurs, parce que c'est la seule
 * ou un mois entier est visible et ou cocher trois jours de suite a un sens.
 *
 * Ce fichier ne touche ni a React ni a Supabase. Il repond a une seule
 * question, et c'est celle ou une erreur effacerait des donnees: etant donne
 * ce qui est enregistre, ce qui est coche, et ce que la personne a REELLEMENT
 * touche, qu'est-ce qu'on ecrit et qu'est-ce qu'on retire.
 *
 * ============================================================================
 * POURQUOI `touched` EXISTE, ET POURQUOI C'EST LA PARTIE IMPORTANTE
 * ============================================================================
 *
 * cycle_log porte `started_on` et `ended_on`, et ended_on n'a JAMAIS ete ecrit
 * par l'application: toutes les lignes existantes l'ont a null. phaseOn dessine
 * alors cinq jours par defaut a partir du debut.
 *
 * Donc si on amorcait la selection avec tout l'historique et qu'on
 * reconciliait tout, enregistrer apres avoir coche un seul jour de septembre
 * reecrirait `ended_on = debut + 4` sur chaque regle de l'annee derniere. La
 * personne n'a touche a aucune d'elles, et l'application aurait invente une
 * duree pour toutes.
 *
 * `touched` est la reponse: seules les series qui contiennent un jour qu'elle a
 * vraiment tape peuvent bouger. Tout le reste est laisse exactement tel quel,
 * meme si c'est affiche et meme si c'est coche.
 */

/** Le jour suivant, en YYYY-MM-DD, sans jamais passer par un fuseau. */
const suivant = (k) => {
  const d = fromKey(k)
  return d ? dayKey(addDays(d, 1)) : null
}

/**
 * Les jours qu'une ligne enregistree occupe a l'ecran.
 *
 * `ended_on` quand il est la, sinon `periodDays` jours a partir du debut, ce
 * qui est exactement ce que phaseOn dessine. Les deux doivent etre d'accord:
 * une ligne dessinee sur cinq jours et reconciliee sur trois ferait disparaitre
 * deux jours a l'enregistrement sans que personne les ait touches.
 */
export function spanOf(row, periodDays = 5) {
  const from = fromKey(row?.started_on ?? row)
  if (!from) return null
  const end = fromKey(row?.ended_on)
  /* Une fin avant le debut est une ligne cassee, pas une serie a l'envers. La
     contrainte cycle_log_order l'interdit en base; ici on retombe sur la duree
     par defaut plutot que de rendre une plage vide. */
  const to = end && daysBetween(from, end) >= 0 ? end : addDays(from, periodDays - 1)
  return { from: dayKey(from), to: dayKey(to) }
}

/** Tous les jours d'une plage, bornes comprises. */
export function daysOfSpan(span) {
  const out = []
  if (!span?.from || !span?.to) return out
  let k = span.from
  /* Une borne dure: une plage folle (une fin en 2049) ne doit pas faire tourner
     la boucle un million de fois dans le fil de rendu. Deux mois est plus long
     que la plus longue regle jamais enregistree. */
  for (let i = 0; i < 62 && k; i += 1) {
    out.push(k)
    if (k === span.to) break
    k = suivant(k)
  }
  return out
}

/** Les jours que l'historique dit deja etre des jours de regles. */
export function selectedFrom(rows, periodDays = 5) {
  const out = new Set()
  for (const row of rows ?? []) {
    for (const k of daysOfSpan(spanOf(row, periodDays))) out.add(k)
  }
  return out
}

/**
 * Les series continues d'un paquet de jours coches, triees.
 *
 * Cocher 17, 18 et 19 est UNE regle de trois jours, pas trois regles d'un jour.
 * Cocher 17, 18 et 25 en fait deux, parce qu'une interruption de six jours au
 * milieu n'est pas un saignement continu et que rien n'autorise l'application a
 * combler le trou toute seule.
 */
export function runsOf(keys) {
  const tries = [...(keys ?? [])].filter((k) => fromKey(k)).sort()
  const out = []
  for (const k of tries) {
    const last = out[out.length - 1]
    if (last && suivant(last.to) === k) last.to = k
    else out.push({ from: k, to: k })
  }
  return out
}

/**
 * Ce qu'il faut ecrire et ce qu'il faut retirer.
 *
 * `rows`      les lignes de cycle_log telles qu'elles sont en base
 * `selected`  les jours coches a l'ecran, a l'instant d'enregistrer
 * `touched`   les jours qu'elle a REELLEMENT tapes pendant cette session
 *
 * Une serie ne peut bouger que si elle contient un jour touche, dans son etat
 * d'avant ou dans son etat d'apres. Sans cette regle, enregistrer reecrirait
 * une duree inventee sur tout l'historique: voir la note en haut du fichier.
 *
 * Une serie identique a une ligne deja en base n'est ni ajoutee ni retiree. Un
 * aller-retour, cocher un jour puis le decocher, n'ecrit donc rien du tout.
 */
export function reconcile({ rows = [], selected, touched, periodDays = 5 } = {}) {
  const coches = selected instanceof Set ? selected : new Set(selected ?? [])
  const tapes = touched instanceof Set ? touched : new Set(touched ?? [])

  const cle = (s) => `${s.from}/${s.to}`

  const avant = new Map()
  for (const row of rows) {
    const span = spanOf(row, periodDays)
    if (span) avant.set(cle(span), { span, row, jours: daysOfSpan(span) })
  }

  const apres = new Map()
  for (const span of runsOf(coches)) apres.set(cle(span), { span, jours: daysOfSpan(span) })

  /**
   * LA ZONE CONCERNEE, ET POURQUOI CE N'EST PAS SEULEMENT LES JOURS TAPES.
   *
   * La premiere version demandait a chaque serie de contenir elle-meme un jour
   * tape. Deux cas mesures l'ont cassee, et le deuxieme perdait des donnees:
   *
   *   Ajouter le 20 a une regle enregistree du 17 au 19. L'ancienne plage ne
   *   contient pas le 20, donc elle n'etait pas retiree, et la nouvelle du 17
   *   au 20 etait ecrite a cote: deux lignes qui se chevauchent pour une seule
   *   regle.
   *
   *   Decocher le 20 et le 21 d'une ligne sans fin, dessinee du 17 au 21.
   *   L'ancienne plage contenait le 20, donc elle partait. La nouvelle, du 17
   *   au 19, n'en contenait aucun, donc elle n'etait pas ecrite. La regle
   *   disparaissait entierement.
   *
   * Ce qui compte n'est donc pas "contient un jour tape" mais "touche a la
   * zone", et la zone s'etend de proche en proche: un jour tape attire la serie
   * qui le contient, cette serie attire celles qui la chevauchent, et ainsi de
   * suite jusqu'a ce que plus rien ne bouge. Une seule regle peut s'etendre sur
   * plusieurs jours de chaque cote; la boucle est bornee pour qu'un historique
   * long ne puisse pas la faire tourner indefiniment.
   */
  const zone = new Set(tapes)
  const tout = [...avant.values(), ...apres.values()]
  for (let tour = 0; tour < tout.length + 1; tour += 1) {
    let bouge = false
    for (const { jours } of tout) {
      if (!jours.some((k) => zone.has(k))) continue
      for (const k of jours) {
        if (!zone.has(k)) {
          zone.add(k)
          bouge = true
        }
      }
    }
    if (!bouge) break
  }
  const concerne = (jours) => jours.some((k) => zone.has(k))

  const add = []
  for (const [k, { span, jours }] of apres) {
    if (avant.has(k)) continue
    if (!concerne(jours)) continue
    add.push({ started_on: span.from, ended_on: span.to })
  }

  const remove = []
  for (const [k, { row, jours }] of avant) {
    if (apres.has(k)) continue
    if (!concerne(jours)) continue
    /* Sans identifiant il n'y a rien a supprimer avec certitude, et supprimer
       par date toucherait la mauvaise ligne si deux se chevauchent. */
    if (row?.id) remove.push(row.id)
  }

  return { add, remove }
}
