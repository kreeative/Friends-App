/**
 * node src/lib/reminders.test.mjs
 *
 * La fenetre eveillee, qui decide quand l'application a le droit de faire
 * vibrer un telephone.
 *
 * L'assertion qui compte le plus est celle du passage de minuit. Une fenetre
 * 22h - 06h, celle de quelqu'un qui travaille de nuit, rend `wake <= m && m <
 * sleep` faux a 2h du matin, qui est exactement le moment ou cette personne
 * est reveillee. Ecrit naivement, ce reglage produit le silence complet, et un
 * silence ne se remarque pas: personne ne signale les notifications qu'il n'a
 * pas recues.
 */
import {
  DAY,
  DEFAULTS,
  DEFAULT_SLEEP,
  DEFAULT_WAKE,
  LEAD_CHOICES,
  awakeMinutes,
  fromHm,
  isAwake,
  prefOf,
  remindMinFor,
  safeLead,
  safeMin,
  toHm,
  waterPlan,
} from './reminders.js'

let pass = 0,
  fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`,
  )
}
const ok = (label, cond, why = '') => {
  cond ? pass++ : fail++
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : `  ${why}`}`)
}

const h = (n, m = 0) => n * 60 + m

// ---- minutes du jour ---------------------------------------------------------

eq('huit heures', toHm(480), '08:00')
eq('minuit', toHm(0), '00:00')
eq('23:59', toHm(1439), '23:59')
eq('et retour', fromHm('08:00'), 480)
eq('un chiffre seul devant', fromHm('8:05'), 485)
eq('une saisie vide retombe sur le repli', fromHm('', 99), 99)
eq('du texte aussi', fromHm('midi', 99), 99)
eq('une heure impossible aussi', fromHm('25:00', 99), 99)
eq('un aller-retour ne perd rien', fromHm(toHm(1337)), 1337)

eq('une minute hors bornes est ramenee', safeMin(5000), DAY - 1)
eq('negative aussi', safeMin(-10), 0)
eq('et NaN retombe sur le repli', safeMin(NaN, 42), 42)

// ---- LE PASSAGE DE MINUIT ----------------------------------------------------

{
  // Une journee ordinaire: 08:00 - 23:00.
  ok('a midi, reveille', isAwake(h(12), h(8), h(23)))
  ok('a 08:00 pile, reveille', isAwake(h(8), h(8), h(23)))
  ok('a 07:59, non', !isAwake(h(7, 59), h(8), h(23)))
  ok('a 23:00 pile, non', !isAwake(h(23), h(8), h(23)))
  ok('a 3h du matin, non', !isAwake(h(3), h(8), h(23)))
}

{
  /* Le travail de nuit: 22:00 - 06:00. C'est le cas que la version naive
     casse, et elle le casse en silence. */
  const night = [h(22), h(6)]
  ok('a 23h, reveille', isAwake(h(23), ...night))
  ok('a 2h du matin, reveille', isAwake(h(2), ...night), 'le cas que la version naive rate')
  ok('a 05:59, reveille', isAwake(h(5, 59), ...night))
  ok('a 06:00 pile, non', !isAwake(h(6), ...night))
  ok('a midi, non', !isAwake(h(12), ...night))
}

{
  /* Les deux bouts egaux veulent dire toute la journee et pas rien: c'est le
     seul repli qui n'eteint pas quelque chose que personne n'a demande. */
  ok('une fenetre nulle laisse tout passer, a midi', isAwake(h(12), h(9), h(9)))
  ok('et a 3h du matin aussi', isAwake(h(3), h(9), h(9)))
}

// ---- la duree eveillee, qui est le denominateur du calcul de l'eau ------------

eq('une journee ordinaire', awakeMinutes(h(8), h(23)), 900)
eq('une nuit de travail compte pareil', awakeMinutes(h(22), h(6)), 480)
eq('une fenetre nulle vaut la journee entiere', awakeMinutes(h(9), h(9)), DAY)

// ---- une ligne de reglages qui vient de la base --------------------------------

{
  /* Personne n'a encore ouvert les reglages. C'est l'etat de tout le monde le
     jour ou la migration passe, donc ce n'est pas un cas limite. */
  const p = prefOf(null)
  eq('pas de ligne du tout: les defauts', [p.wake_min, p.sleep_min], [DEFAULT_WAKE, DEFAULT_SLEEP])
  eq('l eau est eteinte au depart', p.water_on, false)
  eq('les rappels d agenda sont allumes', p.events_on, true)
}

{
  /**
   * `?? true` et pas `|| true`. Un `||` rallumerait les rappels de quelqu'un
   * qui vient de les couper, ce qui est le pire bogue possible sur un ecran de
   * reglages: on le desactive, on revient, il est rallume.
   */
  const p = prefOf({ events_on: false, water_on: true })
  eq('un false enregistre reste false', p.events_on, false)
  eq('et un true reste true', p.water_on, true)
}

{
  const p = prefOf({ wake_min: 9999, sleep_min: -5, water_target_ml: 99999, water_glass_ml: 0 })
  ok('les valeurs folles sont ramenees dans les bornes',
     p.wake_min < DAY && p.sleep_min >= 0 && p.water_target_ml <= 4000 && p.water_glass_ml > 0,
     JSON.stringify(p))
}

// ---- le delai avant un evenement ----------------------------------------------

eq('un choix connu passe', safeLead(30), 30)
/* Une valeur arbitraire venue d'une vieille ligne s'afficherait comme aucun
   des choix et le select rendrait vide. On prend le plus proche. */
eq('une valeur inconnue prend le choix le plus proche', safeLead(20), 15)
/* 45 est a egale distance de 30 et de 60. L'egalite penche vers le plus tot:
   quinze minutes trop en avance ne coutent rien, quinze minutes trop tard
   veulent dire rate. Ecrit avec un `<` d'abord, ce qui rendait 30. */
eq('une egalite penche vers le rappel le plus tot', safeLead(45), 60)
eq('mais 20 reste a 15, qui est le plus proche', safeLead(20), 15)
eq('du texte retombe sur le defaut', safeLead('bientot'), DEFAULTS.events_lead_min)
ok('tous les choix se rendent eux-memes', LEAD_CHOICES.every((c) => safeLead(c) === c))

eq('trente minutes avant un cours de 9h', remindMinFor(h(9), 30), h(8, 30))
eq('zero minute avant, c est a l heure pile', remindMinFor(h(9), 0), h(9))
/**
 * Un rappel a 24h d'un cours de 9h tombe a 9h LA VEILLE, donc a -900. Rendu
 * negatif plutot que ramene a zero: l'information "c'est le jour d'avant" est
 * ce que l'appelant a besoin de savoir, et la ramener a zero enverrait le
 * rappel a minuit le bon jour, ce qui est faux et silencieux.
 */
eq('un jour avant rend un nombre negatif', remindMinFor(h(9), 1440), h(9) - 1440)

/* Un truc qui dure toute la journee n'a pas de "trente minutes avant".
   Calculer a partir de minuit enverrait le rappel de la fete nationale a
   23h30 la veille. */
eq('un evenement sans heure n a pas de rappel', remindMinFor(null, 30), null)
eq('undefined non plus', remindMinFor(undefined, 30), null)

// ---- la fenetre et l'eau se rencontrent en un seul endroit ---------------------

{
  /**
   * Trois appels a planFor() avec trois facons de deriver la fenetre, c'est
   * trois chiffres differents affiches au meme moment sur trois ecrans. Cette
   * assertion dit que waterPlan lit bien la fenetre des reglages et pas une
   * valeur par defaut.
   */
  const early = waterPlan({ wake_min: h(6), sleep_min: h(22), water_target_ml: 2000 },
                          { drunkMl: 0, nowMin: h(6) })
  const short = waterPlan({ wake_min: h(12), sleep_min: h(18), water_target_ml: 2000 },
                          { drunkMl: 0, nowMin: h(12) })
  ok('une journee courte resserre les rappels', short.gapMin < early.gapMin,
     `${short.gapMin} vs ${early.gapMin}`)
  eq('les deux visent bien huit verres', [early.glassesLeft, short.glassesLeft], [8, 8])
}

{
  /* La nuit de travail traverse minuit, donc la fenetre est 480 minutes et pas
     un nombre negatif. planFor compare des minutes brutes, donc ce cas doit
     rester coherent avec awakeMinutes. */
  const p = prefOf({ wake_min: h(22), sleep_min: h(6) })
  eq('la fenetre de nuit fait bien huit heures', awakeMinutes(p.wake_min, p.sleep_min), 480)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
