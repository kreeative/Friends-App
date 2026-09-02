/**
 * node src/lib/shellLayout.test.mjs
 *
 * The two navigations, and the fact that exactly one of them is ever showing.
 *
 * WHAT WAS MEASURED, in headless Chromium at real device widths, before any of
 * this was written down. The rail was 13rem of words for one round and is now
 * 5.5rem of icons with a word under each, so the numbers below are the second
 * set:
 *
 *   390px  phone            rail hidden, bottom bar visible, top bar visible
 *   820px  iPad portrait    rail 16..104, bottom bar hidden, top bar hidden
 *   1180px iPad landscape   same, grid takes the rest
 *   1440px laptop           same
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
  /hidden w-\[5\.5rem\] flex-col p-1\.5 md:flex/.test(shell),
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
  /md:pl-\[7\.5rem\]/.test(shell),
  '5.5rem of rail plus the 1rem it is inset by on each side',
)
ok(
  'and not padded below it',
  !/\bpl-\[7\.5rem\](?!\])/.test(shell.replace(/md:pl-\[7\.5rem\]/g, '')),
  'a phone would be pushed off its own screen',
)

/* --- one chrome, not two ------------------------------------------------- */

/* The whole top bar is a phone component now. Once the rail took the bell and
   the avatar there was nothing left in it above md except the group name, and
   an empty 76px strip is the opposite of what this layout was asked for. */
ok(
  'the top bar is hidden from md up',
  /<header className="sticky top-0 z-40 px-4 pt-4 md:hidden">/.test(shell),
  'the rail carries the lockup, the bell and the avatar above md',
)
ok('the rail carries a lockup of its own', /data-hook="side-rail"[\s\S]{0,900}LockupInline/.test(shell))
ok(
  'and the group name has somewhere to be',
  /data-hook="rail-group"/.test(shell),
  'it was in the top bar, which no longer runs at this width',
)

/* --- the rail says what its icons mean ----------------------------------- */

/**
 * The one that matters most, and the reason it is an assertion rather than a
 * comment. An icon-only rail puts its names in a hover tooltip, and a tablet
 * has no hover: this layout exists FOR tablets. Deleting the label to save
 * 14px would leave an iPad user with no way to learn what a ring means short
 * of pressing it, and nothing would look broken.
 */
const icons = read('src/components/NavIcons.jsx')
ok('there is an icon set', /export const NAV_ICON/.test(icons))
ok(
  'every icon takes the current colour rather than its own',
  !/stroke="#|fill="#/.test(icons),
  'a hard-coded hue is right in exactly one of the two themes',
)
ok(
  'and none of them is announced to a screen reader',
  /'aria-hidden': 'true'/.test(icons),
  'the accessible name belongs to the link, not to the drawing',
)
ok(
  'the rail draws an icon and a word, not an icon alone',
  /<Icon className="h-5 w-5 shrink-0" \/>[\s\S]{0,120}<RailLabel>/.test(shell),
  'a tablet has no hover, so a tooltip is not a label',
)
ok(
  'the bell in the rail is labelled too',
  /placement === 'rail' &&[\s\S]{0,200}nav\.notifications/.test(read('src/components/NotificationBell.jsx')),
)

/* --- the calendar uses the width ---------------------------------------- */

const cal = read('src/pages/Calendar.jsx')

ok(
  'the calendar has no width cap above md, and it is the only page without one',
  /max-w-content[^"]*md:max-w-none/.test(cal),
  'a grid is the exception; a 1200px settings form is worse, not better',
)
ok(
  'the reading column is still the default everywhere else',
  /\.shell \{[\s\S]{0,80}max-w-content/.test(read('src/index.css')),
  'stretching every page is what "fill the width" must not be read as',
)
ok('month tiles grow when there is room', /md:min-h-\[6\.5rem\]/.test(cal))
ok(
  'and show a third entry rather than counting it as hidden',
  /const shown = useWide\(\) \? 3 : 2/.test(cal),
  'a class cannot change the number passed to slice()',
)

/* The two-column split is gone. It was xl-only and still cost a laptop 20rem
   for a panel that is mostly four dates; the drawer costs the grid nothing at
   any width. */
ok(
  'the cycle panel no longer takes a column from the grid',
  !/xl:grid-cols-\[minmax\(0,1fr\)_20rem\]/.test(cal),
  'this is what left the grid at 572px on an iPad in landscape',
)
ok('it is a drawer', /data-hook="cycle-drawer"/.test(read('src/components/CyclePanel.jsx')))

/* --- the layers ---------------------------------------------------------- */

ok('there is a layer toolbar', /data-hook="cal-layers"/.test(cal))
ok(
  'a layer that is off is not signalled by colour alone',
  /line-through/.test(cal) && /border-2 \$\{LAYER_RING\[layer\]\}/.test(cal),
  'WCAG 1.4.1: the fill, the hollow dot and the struck word all say it',
)
ok(
  'the toggles are buttons that report their own state',
  /aria-pressed=\{on\}/.test(cal),
  'a checkbox in a toolbar implies a form that submits',
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
