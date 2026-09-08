/**
 * node src/lib/units.test.mjs
 *
 * "J'ai une bouteille d'eau qui fait 40 oz. Je ne suivais pas vraiment avec la
 * notation en verres combien je bois."
 *
 * Le cas qui doit tenir avant tous les autres: 40 oz enregistre, puis relu,
 * doit redonner 40 oz. Un arrondi qui derive d'une once par aller-retour
 * transforme la bouteille en 39 au premier enregistrement, et personne ne
 * regarde le chiffre d'assez pres pour le voir tout de suite.
 */
import {
  ML_PER_OZ, MAX_SERVING_ML, MIN_SERVING_ML,
  formatAmount, fromUnit, parseAmount, safeServing, safeUnit, toUnit, unitLabel,
} from './units.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, got, want) => ok(name, got === want, `${JSON.stringify(got)} != ${JSON.stringify(want)}`)

console.log('units')

/* ------------------------------------------------------------------ *
 * LA BOUTEILLE DE 40 oz.
 * ------------------------------------------------------------------ */
eq('40 oz vaut 1183 ml', fromUnit(40, 'oz'), 1183)
eq('et 1183 ml redonne 40 oz', toUnit(1183, 'oz'), 40)
eq('la bouteille s ecrit comme sur l objet', formatAmount(1183, 'oz', 'fr'), '40 oz')

/* L aller-retour, sur toute la plage utile: si une seule taille derive, une
   bouteille change de contenance toute seule apres un enregistrement. */
{
  const derive = []
  for (let oz = 1; oz <= 68; oz += 1) {
    if (toUnit(fromUnit(oz, 'oz'), 'oz') !== oz) derive.push(oz)
  }
  ok('aucune taille en onces ne derive a l aller-retour', derive.length === 0, derive.join(' '))
}
{
  const derive = []
  for (let ml = MIN_SERVING_ML; ml <= MAX_SERVING_ML; ml += 1) {
    if (toUnit(fromUnit(ml, 'ml'), 'ml') !== ml) derive.push(ml)
  }
  ok('ni aucune taille en millilitres', derive.length === 0, derive.slice(0, 6).join(' '))
}

/* ------------------------------------------------------------------ *
 * L once americaine, pas l imperiale. 4 % d ecart, 47 ml sur 40 oz.
 * ------------------------------------------------------------------ */
ok('l once est celle des bouteilles vendues ici', Math.abs(ML_PER_OZ - 29.5735) < 1e-9)
ok('ce n est pas l once imperiale', Math.abs(ML_PER_OZ - 28.4131) > 1)

/* ------------------------------------------------------------------ *
 * L ecriture. Ce qui se lit, pas ce qui est vrai au millilitre.
 * ------------------------------------------------------------------ */
eq('sous le litre, des millilitres', formatAmount(500, 'ml', 'fr'), '500 ml')
eq('a partir du litre, des litres', formatAmount(2000, 'ml', 'fr'), '2 L')
eq('sans zero decimal inutile', formatAmount(2000, 'ml', 'en'), '2 L')
eq('avec la virgule francaise', formatAmount(1200, 'ml', 'fr'), '1,2 L')
eq('et le point anglais', formatAmount(1200, 'ml', 'en'), '1.2 L')
eq('zero se dit', formatAmount(0, 'ml', 'fr'), '0 ml')
eq('zero se dit aussi en onces', formatAmount(0, 'oz', 'fr'), '0 oz')
eq('en onces on reste en onces', formatAmount(2000, 'oz', 'fr'), '68 oz')

/* ------------------------------------------------------------------ *
 * Ce qu on tape. Le clavier francais sort une virgule.
 * ------------------------------------------------------------------ */
eq('une virgule decimale est comprise', parseAmount('1,5', 'oz'), Math.round(1.5 * ML_PER_OZ))
eq('un point aussi', parseAmount('1.5', 'oz'), Math.round(1.5 * ML_PER_OZ))
eq('les espaces autour ne genent pas', parseAmount('  40 ', 'oz'), 1183)
eq('un champ vide n est pas zero', parseAmount('', 'ml'), null)
eq('des espaces seuls non plus', parseAmount('   ', 'ml'), null)
eq('du texte n est pas une quantite', parseAmount('beaucoup', 'ml'), null)
eq('zero tape n est pas une gorgee', parseAmount('0', 'ml'), null)
eq('un negatif non plus', parseAmount('-5', 'ml'), null)
eq('null ne casse rien', parseAmount(null, 'ml'), null)
eq('undefined non plus', parseAmount(undefined, 'ml'), null)

/* ------------------------------------------------------------------ *
 * Les bornes, les memes dans les deux unites.
 * ------------------------------------------------------------------ */
eq('une contenance minuscule remonte au plancher', safeServing(10), MIN_SERVING_ML)
eq('une contenance enorme redescend au plafond', safeServing(9999), MAX_SERVING_ML)
eq('une contenance normale passe', safeServing(1183), 1183)
eq('une valeur absente prend le repli', safeServing(null), 250)
eq('le repli est celui qu on donne', safeServing(undefined, 300), 300)
/* Le repli par defaut ne se declenche que sur undefined, jamais sur null: la
   regle des parametres par defaut a deja coute du temps dans ce depot, donc
   safeServing gere null lui-meme plutot que de compter dessus. */
eq('null aussi prend le repli, pas NaN', safeServing(null, 300), 300)

/* ------------------------------------------------------------------ *
 * L unite. Une valeur inconnue en base ne doit rien casser.
 * ------------------------------------------------------------------ */
eq('ml est une unite', safeUnit('ml'), 'ml')
eq('oz aussi', safeUnit('oz'), 'oz')
eq('litre n en est pas une', safeUnit('L'), 'ml')
eq('ni null', safeUnit(null), 'ml')
eq('ni une valeur inventee en base', safeUnit('gallons'), 'ml')
eq('le mot suit l unite', unitLabel('oz'), 'oz')
eq('et le repli aussi', unitLabel('nimporte'), 'ml')

/* ------------------------------------------------------------------ *
 * Les entrees folles ne doivent pas rendre NaN a l ecran.
 * ------------------------------------------------------------------ */
eq('toUnit sur null', toUnit(null, 'oz'), 0)
eq('toUnit sur du texte', toUnit('beaucoup', 'ml'), 0)
eq('fromUnit sur du texte', fromUnit('beaucoup', 'oz'), 0)
eq('formatAmount sur null', formatAmount(null, 'ml', 'fr'), '0 ml')
eq('formatAmount sur un negatif', formatAmount(-500, 'ml', 'fr'), '0 ml')

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
