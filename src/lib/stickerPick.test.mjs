import { pickFrom } from './stickerPick.js'

let bad = 0
const ok = (name, cond, extra) => {
  if (!cond) bad += 1
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`)
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)}`)

console.log('sticker pick')

const OLD = ['bass', 'bird', 'burger', 'cloudguy', 'daisy', 'popsicle', 'skullfire']

console.log(' ce qui existe est garde, dans l ordre voulu')
eq('les noms voulus sortent dans leur ordre',
   pickFrom(['cloudguy', 'bass', 'burger'], OLD), ['cloudguy', 'bass', 'burger'])
eq('un nom absent est saute, pas remplace par du vide',
   pickFrom(['cloudguy', 'nexistepas', 'bass'], OLD), ['cloudguy', 'bass'])
eq('un nom ecrit deux fois n apparait qu une fois',
   pickFrom(['bass', 'bass', 'bird'], OLD), ['bass', 'bird'])

console.log(' sans minimum, rien ne change: c est l ancien comportement')
eq('aucun nom ne correspond, la liste est vide',
   pickFrom(['a', 'b'], OLD), [])
eq('et une liste vide reste vide', pickFrom([], OLD), [])

console.log(' LE CAS QUI A MOTIVE CE FICHIER: tout le dossier est remplace')
{
  /* Les douze noms ecrits a la main dans SignIn.jsx et Stickers.jsx, contre un
     dossier ou plus aucun d eux n existe. Sans minimum, quatre surfaces
     perdent leur decor en silence. */
  const NOUVEAUX = ['boosted', 'bro', 'coeur', 'daisy2', 'eyes', 'sup', 'turntable2']
  eq('sans minimum, la surface est nue',
     pickFrom(['cloudguy', 'skullfire', 'bass', 'burger', 'bird', 'popsicle'], NOUVEAUX), [])
  const six = pickFrom(['cloudguy', 'skullfire', 'bass', 'burger', 'bird', 'popsicle'], NOUVEAUX, 6)
  ok('avec un minimum, elle en a six', six.length === 6, JSON.stringify(six))
  ok('pris parmi ce qui existe vraiment', six.every((n) => NOUVEAUX.includes(n)))
  ok('sans doublon', new Set(six).size === six.length)
  eq('et dans l ordre du dossier, pas au hasard', six, NOUVEAUX.slice(0, 6))
}

console.log(' le complement ne remplace pas ce qui a survecu')
{
  const melange = ['bass', 'boosted', 'bro', 'sup']
  const trois = pickFrom(['bass', 'disparu', 'aussi-disparu'], melange, 3)
  eq('le survivant reste en tete', trois, ['bass', 'boosted', 'bro'])
  ok('et il n est pas repris une seconde fois par le complement',
     trois.filter((n) => n === 'bass').length === 1)
}

console.log(' on ne complete jamais au-dela de ce qui existe')
{
  const deux = ['a', 'b']
  const r = pickFrom(['x'], deux, 6)
  eq('six demandes, deux disponibles, deux rendus', r, ['a', 'b'])
  ok('donc pas de trou dans la liste', r.every(Boolean))
}

console.log(' un dossier vide ne fait pas tomber la page')
eq('rien a proposer, rien rendu', pickFrom(['bass'], [], 6), [])
eq('et available manquant est traite comme vide', pickFrom(['bass'], undefined, 6), [])
eq('wanted manquant aussi', pickFrom(undefined, OLD, 2), ['bass', 'bird'])

console.log(' le minimum n est pas un maximum')
eq('plus de noms voulus que le minimum, tous sortent',
   pickFrom(['bass', 'bird', 'burger'], OLD, 2), ['bass', 'bird', 'burger'])

console.log(`\n  ${20 - bad} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
