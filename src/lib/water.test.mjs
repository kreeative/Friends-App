/**
 * node src/lib/water.test.mjs
 *
 * Le calcul qui repond a "comment tu peux calculer pour que tout le monde
 * remplisse ses objectifs de boire de l'eau dans la journee".
 *
 * Ce qui est verifie ici est ce qui se voit quand c'est faux: un rappel a 6h
 * du matin, un rappel toutes les deux minutes a 22h50, une cible atteinte qui
 * continue de faire vibrer le telephone, et le chiffre de la demande, 30
 * minutes, qui donnerait 7,5 litres si on le prenait pour une cadence.
 */
import {
  DEFAULT_TARGET,
  GLASS_ML,
  MAX_GAP,
  MAX_TARGET,
  MIN_GAP,
  MIN_TARGET,
  defaultTarget,
  everyLabel,
  glassesFor,
  planFor,
  safeTarget,
} from './water.js'

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

const WAKE = 8 * 60 // 08:00
const SLEEP = 23 * 60 // 23:00
const day = (over = {}) => planFor({ wakeMin: WAKE, sleepMin: SLEEP, ...over })

// ---- la cible ---------------------------------------------------------------

eq('une femme', defaultTarget('woman'), 2000)
eq('un homme', defaultTarget('man'), 2500)
eq('autre', defaultTarget('other'), 2200)
/* Une non-reponse n'est pas une reponse: le repli est la valeur du milieu et
   pas celle d'un des deux. */
eq('pas de reponse', defaultTarget(null), DEFAULT_TARGET)
eq('ni un mot inconnu', defaultTarget('licorne'), DEFAULT_TARGET)

eq('une cible absurde est ramenee dans les bornes', safeTarget(99999), MAX_TARGET)
eq('en bas aussi', safeTarget(10), MIN_TARGET)
eq('du texte retombe sur le defaut', safeTarget('beaucoup'), DEFAULT_TARGET)
eq('NaN aussi', safeTarget(NaN), DEFAULT_TARGET)

eq('huit verres pour deux litres', glassesFor(2000, 250), 8)
eq('on arrondit vers le haut', glassesFor(2100, 250), 9)
eq('un verre de zero ml ne divise pas par zero', glassesFor(2000, 0), 8)

// ---- LE CHIFFRE DE LA DEMANDE ----------------------------------------------

/**
 * "Chaque 30 min boire un verre d'eau."
 *
 * Fenetre de 900 minutes, un rappel toutes les 30: 30 verres de 250 ml, soit
 * 7,5 litres. C'est pour ca que 30 minutes est le PLANCHER et pas la cadence.
 * Cette assertion existe pour que le chiffre reste visible dans le depot: si
 * quelqu'un le remet comme cadence un jour, elle dit ce que ça produit.
 */
{
  const window = SLEEP - WAKE
  eq('la fenetre eveillee fait bien 900 minutes', window, 900)
  eq('un rappel toutes les 30 minutes ferait 30 verres', window / MIN_GAP, 30)
  eq('soit 7500 ml', (window / MIN_GAP) * GLASS_ML, 7500)
  ok('c est plus de trois fois la cible par defaut', 7500 > DEFAULT_TARGET * 3)
}

// ---- le plan d'une journee normale -------------------------------------------

{
  /* Au reveil, rien de bu, deux litres a boire: huit verres sur 900 minutes. */
  const p = day({ target: 2000, drunkMl: 0, nowMin: WAKE })
  eq('huit verres restants', p.glassesLeft, 8)
  /* 900 / 8 = 112,5, arrondi a 113. Ecrit 112 d'abord, ce qui est la moitie
     d'une division faite de tete: le code avait raison et l'assertion tort. */
  eq('un toutes les 113 minutes', p.gapMin, 113)
  eq('le premier a 09:53', p.nextMin, WAKE + 113)
  ok('ni fini ni endormi ni en retard', !p.done && !p.asleep && !p.late)
}

// ---- ET C'EST LA QUE CA REPOND VRAIMENT A LA QUESTION ------------------------

/**
 * L'intervalle se RECALCULE. Un intervalle fixe ne rattrape rien: quelqu'un
 * qui saute sa matinee finit a la moitie de sa cible sans que l'application
 * l'ait remarque.
 */
{
  const onTime = day({ target: 2000, drunkMl: 1000, nowMin: 15 * 60 }) // a moitie a 15h
  const behind = day({ target: 2000, drunkMl: 250, nowMin: 15 * 60 }) //  un verre a 15h
  ok('etre en retard resserre les rappels', behind.gapMin < onTime.gapMin,
     `${behind.gapMin} vs ${onTime.gapMin}`)
  eq('quatre verres restants quand on est a moitie', onTime.glassesLeft, 4)
  eq('sept quand on est en retard', behind.glassesLeft, 7)
}

{
  const before = day({ target: 2000, drunkMl: 0, nowMin: 12 * 60 })
  const after = day({ target: 2000, drunkMl: 1000, nowMin: 12 * 60 })
  ok('boire d un coup espace les rappels', after.gapMin > before.gapMin,
     `${after.gapMin} vs ${before.gapMin}`)
}

// ---- les bornes, qui sont la pour des cas reels ------------------------------

{
  /* 22h50, il reste un litre. L'ideal serait un verre toutes les 2,5 minutes.
     On envoie au plancher et on le DIT, au lieu de faire vibrer vingt fois. */
  const p = day({ target: 2000, drunkMl: 1000, nowMin: 22 * 60 + 50 })
  ok('jamais plus souvent que le plancher', p.gapMin >= MIN_GAP, `${p.gapMin} min`)
  ok('et la journee est annoncee comme manquee', p.late === true,
     'promettre une cible qu on ne peut plus atteindre est pire que de le dire')
  ok('le prochain rappel ne depasse pas l heure du coucher', p.nextMin <= SLEEP, `${p.nextMin}`)
}

{
  /* Petite cible, longue journee: sans plafond ce serait un rappel toutes les
     trois heures, qu on a oublie avant qu il revienne. */
  const p = planFor({ target: MIN_TARGET, glass: 250, wakeMin: 360, sleepMin: 1440, nowMin: 360 })
  ok('jamais plus espace que le plafond', p.gapMin <= MAX_GAP, `${p.gapMin} min`)
}

// ---- la fenetre eveillee -----------------------------------------------------

{
  /* 6h du matin, quelqu'un qui a dit se lever a 8h. C'est exactement la
     notification qui fait desactiver la fonction. */
  const p = day({ target: 2000, nowMin: 6 * 60 })
  ok('rien avant le reveil', p.asleep === true)
  eq('mais le premier verre est prevu au reveil', p.nextMin, WAKE)
}

{
  const p = day({ target: 2000, drunkMl: 500, nowMin: 23 * 60 + 30 })
  ok('rien apres le coucher', p.asleep === true)
  eq('et plus rien de prevu', p.nextMin, null)
}

// ---- la cible atteinte -------------------------------------------------------

{
  const p = day({ target: 2000, drunkMl: 2000, nowMin: 18 * 60 })
  ok('une cible atteinte arrete les rappels', p.done === true)
  eq('et il ne reste rien', [p.remainingMl, p.glassesLeft, p.nextMin], [0, 0, null])
}
{
  const p = day({ target: 2000, drunkMl: 3000, nowMin: 18 * 60 })
  ok('avoir depasse ne rend pas un reste negatif', p.done === true && p.remainingMl === 0)
}

// ---- les entrees qui viennent de la base ou d'un formulaire -------------------

{
  /* drunkMl arrive d'une somme SQL, donc potentiellement null sur une journee
     sans aucun verre. Default parameters only fire for undefined, pas pour
     null: c'est un gotcha du depot et il vaut une assertion. */
  const p = day({ target: 2000, drunkMl: null, nowMin: 12 * 60 })
  eq('null ne casse pas le reste', p.remainingMl, 2000)
  ok('et ne rend pas NaN', Number.isFinite(p.gapMin))
}
{
  const p = planFor()
  ok('sans aucun argument, un plan valide quand meme', Number.isFinite(p.gapMin) || p.asleep)
}

// ---- l'affichage --------------------------------------------------------------

{
  const t = (k, v) => `${k}:${JSON.stringify(v)}`
  eq('moins d une heure', everyLabel(45, t), 'water.every_m:{"m":45}')
  eq('une heure pile', everyLabel(120, t), 'water.every_h:{"h":2}')
  eq('une heure et des minutes', everyLabel(112, t), 'water.every_hm:{"h":1,"m":52}')
  eq('rien a dire quand il n y a pas d ecart', everyLabel(null, t), '')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
