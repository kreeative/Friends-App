/**
 * node src/lib/amount.test.mjs
 *
 * The invariant is that the size only ever goes DOWN as the string gets
 * longer. A non-monotonic step means some amount renders bigger than a shorter
 * one, which looks like a bug in the number rather than in the scale.
 *
 * And that nothing ever truncates: these functions return a class, never a
 * string, so there is no path here that can shorten an amount.
 */
import { cardClass, heroClass } from './amount.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else { fail += 1; console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`) }
}

const ORDER = ['text-hero', 'text-metric', 'text-h1', 'text-h2', 'text-body', 'text-small']
const rank = (c) => ORDER.indexOf(c)

/* --- real amounts, at 390px --------------------------------------------- */

ok('a small amount stays hero', heroClass('$45.50') === 'text-hero', heroClass('$45.50'))
ok('four figures still hero', heroClass('$1,234.56') === 'text-hero', heroClass('$1,234.56'))
ok('six figures step down', heroClass('$123,456.78') === 'text-metric', heroClass('$123,456.78'))
/* The one from the screenshot that spilled out of its card. */
ok('the millions step down again', heroClass('$22,222,000.00') === 'text-h1',
   heroClass('$22,222,000.00'))
ok('and something absurd goes smaller still',
   heroClass('$1,222,222,000.00') === 'text-h2', heroClass('$1,222,222,000.00'))

/* CFA has no decimals and a trailing mark, so it is shorter for the same
   money: 1 000 000 XOF is not the same length as $1,000,000.00. */
ok('a CFA figure is measured as painted', heroClass('1 000 000 F') === 'text-metric',
   heroClass('1 000 000 F'))

/* --- the invariant ------------------------------------------------------- */

{
  let broke = null
  let prev = -1
  for (let n = 0; n <= 40; n++) {
    const r = rank(heroClass('9'.repeat(n)))
    if (r < prev) { broke = `${n} characters went back up` ; break }
    prev = r
  }
  ok('hero size never grows as the string grows, 0 to 40 characters', broke === null, broke ?? '')
}
{
  let broke = null
  let prev = -1
  for (let n = 0; n <= 40; n++) {
    const r = rank(cardClass('9'.repeat(n)))
    if (r < prev) { broke = `${n} characters went back up`; break }
    prev = r
  }
  ok('and neither does the card size', broke === null, broke ?? '')
}

/* --- it can only resize, never shorten ----------------------------------- */

{
  const out = new Set()
  for (let n = 0; n <= 60; n++) { out.add(heroClass('9'.repeat(n))); out.add(cardClass('9'.repeat(n))) }
  ok('every result is a class from the scale', [...out].every((c) => ORDER.includes(c)),
     [...out].join())
  /* Nothing here returns text, so no caller can accidentally print a
     truncated amount. "$22,222,00..." is off by a hundred and unreadable as
     an error.
     
     Checked as "every result is a class name" rather than "contains no
     digit": text-h1 and text-h2 both contain one, and the first version of
     this assertion failed on the code being right. */
  ok('and never returns anything that could be printed as money',
     [...out].every((c) => /^text-[a-z0-9]+$/.test(c) && !/[$.,\s]/.test(c)),
     [...out].join())
}

/* --- defensive ----------------------------------------------------------- */

ok('an empty string is the biggest size', heroClass('') === 'text-hero')
ok('null does not throw', heroClass(null) === 'text-hero')
ok('undefined does not throw', heroClass() === 'text-hero')
ok('a number is accepted', heroClass(45.5) === 'text-hero', heroClass(45.5))
ok('cardClass survives the same', cardClass() === 'text-h2' && cardClass(null) === 'text-h2')

console.log(`\namount\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
