/**
 * node src/lib/fill.test.mjs
 *
 * One rule carries this file: an unknown key stays visible. Studies keep their
 * figures outside the prose so a translation cannot carry a percentage away
 * with it, which only works if a marker that finds no value announces itself
 * rather than vanishing into a sentence that still reads as finished.
 */
import { fill } from './fill.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else { fail += 1; console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`) }
}

ok('a marker is replaced', fill('{n} réponses', { n: 92 }) === '92 réponses')
ok('several at once', fill('{a} et {b}', { a: 1, b: 2 }) === '1 et 2')
ok('the same marker twice', fill('{n}/{n}', { n: 7 }) === '7/7')
ok('zero is a value, not a blank', fill('{n} %', { n: 0 }) === '0 %')
ok('false is a value too', fill('{v}', { v: false }) === 'false')

/* The whole point. "parmi eux, {x} % n'epargnent rien" with x missing must not
   become "parmi eux,  % n'epargnent rien", which reads as a typo rather than
   as a hole. */
ok('an unknown key stays visible', fill('a {nope} b', { n: 1 }) === 'a {nope} b')
ok('null is treated as absent', fill('{n}', { n: null }) === '{n}')
ok('undefined too', fill('{n}', { n: undefined }) === '{n}')
ok('no values at all leaves the text alone', fill('{n} réponses') === '{n} réponses')

ok('text with no markers is untouched', fill('rien à faire') === 'rien à faire')
ok('empty in, empty out', fill('') === '')
ok('null text does not throw', fill(null) === '')
ok('undefined text does not throw', fill() === '')
/* Not a marker: the regex wants word characters only, so prose using braces or
   spaces inside them is left alone. */
ok('braces with spaces are not markers', fill('{ n }', { n: 5 }) === '{ n }')
ok('empty braces are not markers', fill('{}', {}) === '{}')
ok('accents are not word characters, so not markers',
   fill('{été}', { 'été': 1 }) === '{été}')

console.log(`\nfill\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
