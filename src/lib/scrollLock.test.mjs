/**
 * node src/lib/scrollLock.test.mjs
 *
 * The interleaving that froze the goals page.
 *
 * Reported as "ca scrolle pas en bas, c'est comme bloque", and reproduced in
 * headless Chromium with real touch events: open a goal card, close it, open
 * another before the first has finished closing, and the page moves 0px for
 * ever after.
 *
 * The old code was `previous = body.style.overflow` at lock time and
 * `body.style.overflow = previous` at release. The case below named "A ouvre,
 * B ouvre, A ferme, B ferme" is the one that breaks it, and it is the first
 * test here.
 */
import { lockScroll, resetScrollLock, scrollLockDepth } from './scrollLock.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/* Un document de papier: le seul morceau du DOM que ce fichier touche est
   body.style.overflow, alors c est tout ce qu il imite. */
const fakeDoc = (start = '') => ({ body: { style: { overflow: start } } })

console.log('scrollLock')

/* ------------------------------------------------------------------ *
 * LE CAS RAPPORTE. Deux panneaux qui se recouvrent, fermes dans l ordre
 * ou ils ont ete ouverts.
 * ------------------------------------------------------------------ */
{
  const doc = fakeDoc('')
  const a = lockScroll(doc)
  ok('A ouvre: la page est bloquee', doc.body.style.overflow === 'hidden')
  const b = lockScroll(doc)
  ok('B ouvre: toujours bloquee', doc.body.style.overflow === 'hidden')
  a()
  ok('A ferme mais B est ouvert: encore bloquee', doc.body.style.overflow === 'hidden')
  b()
  ok('B ferme: la page defile a nouveau', doc.body.style.overflow === '', `overflow=${doc.body.style.overflow}`)
  ok('et plus rien n est tenu', scrollLockDepth() === 0)
  resetScrollLock(doc)
}

/* Et dans l autre ordre, le dernier ouvert ferme en premier. */
{
  const doc = fakeDoc('')
  const a = lockScroll(doc)
  const b = lockScroll(doc)
  b()
  ok('ordre inverse: encore bloquee tant que A tient', doc.body.style.overflow === 'hidden')
  a()
  ok('ordre inverse: rendue a la fin', doc.body.style.overflow === '')
  resetScrollLock(doc)
}

/* ------------------------------------------------------------------ *
 * Un seul panneau, le cas que l ancien code faisait bien.
 * ------------------------------------------------------------------ */
{
  const doc = fakeDoc('')
  const un = lockScroll(doc)
  ok('un seul: bloquee', doc.body.style.overflow === 'hidden')
  un()
  ok('un seul: rendue', doc.body.style.overflow === '')
  resetScrollLock(doc)
}

/* ------------------------------------------------------------------ *
 * Ce qui etait la avant est rendu, pas efface. Une page qui bloquait deja
 * son defilement pour une autre raison doit le retrouver.
 * ------------------------------------------------------------------ */
{
  const doc = fakeDoc('clip')
  const un = lockScroll(doc)
  const deux = lockScroll(doc)
  un()
  deux()
  ok('la valeur d origine revient', doc.body.style.overflow === 'clip', `overflow=${doc.body.style.overflow}`)
  resetScrollLock(doc)
}

/* ------------------------------------------------------------------ *
 * Relacher deux fois ne compte qu une fois.
 *
 * React peut rejouer le nettoyage d un effet en mode strict, et un second
 * relachement qui decrementerait a nouveau debloquerait la page sous un
 * panneau encore ouvert: le meme defaut de l autre cote.
 * ------------------------------------------------------------------ */
{
  const doc = fakeDoc('')
  const a = lockScroll(doc)
  const b = lockScroll(doc)
  a()
  a()
  a()
  ok('trois relachements de A ne comptent que pour un', doc.body.style.overflow === 'hidden')
  ok('et il reste exactement un verrou', scrollLockDepth() === 1, `depth=${scrollLockDepth()}`)
  b()
  ok('B rend la page', doc.body.style.overflow === '')
  resetScrollLock(doc)
}

/* ------------------------------------------------------------------ *
 * Trois panneaux, parce que rien dans le compte ne s arrete a deux.
 * ------------------------------------------------------------------ */
{
  const doc = fakeDoc('')
  const holds = [lockScroll(doc), lockScroll(doc), lockScroll(doc)]
  ok('trois verrous comptes', scrollLockDepth() === 3)
  holds[1]()
  holds[0]()
  ok('deux relaches, un tient: bloquee', doc.body.style.overflow === 'hidden')
  holds[2]()
  ok('le dernier rend la page', doc.body.style.overflow === '')
  resetScrollLock(doc)
}

/* ------------------------------------------------------------------ *
 * Verrouiller, tout relacher, reverrouiller. Le second cycle doit repartir
 * de la vraie valeur et non d un 'hidden' garde du premier.
 * ------------------------------------------------------------------ */
{
  const doc = fakeDoc('')
  lockScroll(doc)()
  const encore = lockScroll(doc)
  ok('second cycle: bloquee', doc.body.style.overflow === 'hidden')
  encore()
  ok('second cycle: rendue', doc.body.style.overflow === '', `overflow=${doc.body.style.overflow}`)
  resetScrollLock(doc)
}

/* ------------------------------------------------------------------ *
 * Sans document, rien ne doit lever. Le rendu serveur n en a pas.
 * ------------------------------------------------------------------ */
{
  const rien = lockScroll(null)
  ok('sans document: une fonction quand meme', typeof rien === 'function')
  rien()
  ok('et rien n a ete compte', scrollLockDepth() === 0)
  const vide = lockScroll({})
  vide()
  ok('un objet sans body ne compte pas non plus', scrollLockDepth() === 0)
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
