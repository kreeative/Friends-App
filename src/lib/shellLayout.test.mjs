/**
 * node src/lib/shellLayout.test.mjs
 *
 * The two navigations, and the fact that exactly one of them is ever showing.
 *
 * WHAT WAS MEASURED, in headless Chromium at four real device widths, before
 * any of this was written down:
 *
 *   390px  phone            rail hidden, bottom bar visible
 *   820px  iPad portrait    rail 16..224, bottom bar hidden
 *   1180px iPad landscape   rail 16..224, bottom bar hidden
 *   1440px laptop           rail 16..224, bottom bar hidden,
 *                           top bar 296..1384 aligned with the page
 *
 * This file cannot lay anything out and does not pretend to. What it holds is
 * the set of class contracts that result depends on, because the realistic
 * regression is not a subtle CSS interaction, it is somebody adding a nav item
 * or restyling a bar without knowing there are two of them.
 *
 * ONE MEASUREMENT HERE WAS WRONG FOR A WHILE AND IT IS WORTH RECORDING.
 * The probe looked for the bottom bar by matching `bottom-4` in a className,
 * and the rail carries `bottom-4` too, so it reported the rail's visibility as
 * the tab bar's and the phone layout looked broken when it was not. The
 * assertion below pins the class that actually distinguishes them.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\nshell layout')

const shell = read('src/components/AppShell.jsx')

/* --- exactly one navigation is visible at any width ---------------------- */

ok('there is a side rail', /data-hook="side-rail"/.test(shell))
ok(
  'the rail appears only from md up',
  /hidden w-\[13rem\] flex-col p-2 md:flex/.test(shell),
  'without md:flex it would show on a phone alongside the bottom bar',
)
ok(
  'the bottom bar disappears from md up',
  /inset-x-4 bottom-4[^"]*md:hidden/.test(shell),
  'two navigations at once is the failure this pairing prevents',
)

/* The class that tells the two bars apart, which a probe got wrong. Both
   carry bottom-4; only the tab bar spans the width. */
ok(
  'only the bottom bar carries inset-x-4',
  (shell.match(/inset-x-4/g) ?? []).length === 1,
  'the rail must stay identifiable separately from it',
)

/* --- the content clears the rail ---------------------------------------- */

ok(
  'content is padded past the rail from md up',
  /md:pl-\[15rem\]/.test(shell),
  '13rem of rail plus the 1rem it is inset by on each side',
)
ok(
  'and not padded below it',
  !/\bpl-\[15rem\](?!\])/.test(shell.replace(/md:pl-\[15rem\]/g, '')),
  'a phone would be pushed off its own screen',
)

/* --- one brand mark, not two -------------------------------------------- */

/* Written straight. The first version of this assertion had a ternary whose
   two branches were identical, so it could not fail for the reason it named,
   which is worse than not having it. */
ok(
  'the top bar hides its lockup once the rail shows one',
  /className="press shrink-0 md:hidden"[\s\S]{0,80}LockupInline size=\{36\}/.test(shell),
  'two lockups on one screen is a logo competing with itself',
)
ok('the rail carries a lockup of its own', /data-hook="side-rail"[\s\S]{0,600}LockupInline/.test(shell))

/* --- the chrome frames what is under it --------------------------------- */

ok(
  'the top bar widens to the widest page',
  /max-w-content md:max-w-\[68rem\]/.test(shell),
  'a 40rem bar floating above a 68rem calendar reads as two unrelated things',
)

/* --- the calendar uses the width ---------------------------------------- */

const cal = read('src/pages/Calendar.jsx')

ok(
  'the calendar is wider than the reading column, and only it is',
  /max-w-content[^"]*md:max-w-\[68rem\]/.test(cal),
  'a grid is the exception; a 1200px settings form is worse, not better',
)
ok(
  'the cycle panel moves beside the grid at xl, not lg',
  /xl:grid-cols-\[minmax\(0,1fr\)_20rem\]/.test(cal),
  'at lg an iPad in landscape lost the grid to 572px, barely wider than a phone',
)
ok('month tiles grow when there is room', /md:min-h-\[6\.5rem\]/.test(cal))
ok(
  'and show a third entry rather than counting it as hidden',
  /const shown = useWide\(\) \? 3 : 2/.test(cal),
  'a class cannot change the number passed to slice()',
)

/* --- decoration stays where it has room --------------------------------- */

const stickers = read('src/components/Stickers.jsx')
ok(
  'the stickers are limited to the phone layout',
  /absolute inset-0 z-20 overflow-hidden md:hidden/.test(stickers),
  'measured at 1440px they landed on the page title, a calendar tile and the cycle panel',
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
