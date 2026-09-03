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
  /hidden w-\[3\.5rem\] flex-col p-1\.5 md:flex/.test(shell),
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
  /md:pl-\[5\.5rem\]/.test(shell),
  '3.5rem of rail plus the 1rem it is inset by on each side',
)
ok(
  'and not padded below it',
  !/\bpl-\[7\.5rem\](?!\])/.test(shell.replace(/md:pl-\[5\.5rem\]/g, '')),
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
/**
 * ICONS ALONE, ASKED FOR, AND THE NAMES HAD TO GO SOMEWHERE.
 *
 * The 11px word under each icon existed because an icon-only rail puts its
 * names in a hover tooltip and a tablet has no hover. That argument did not
 * change; it was overruled, which is a different thing, and these are what
 * stop the overrule costing a screen reader anything.
 *
 * An icon whose link has no text and no aria-label is an unlabelled link. This
 * is the assertion that catches somebody removing one.
 */
/* Scoped to SideRail, and with a window big enough to hold one. The first
   version searched the whole file at 700 characters and found ONE of the three
   NavLinks: the rail's blocks are longer than that because of the comment
   inside the className function, and the tab bar's link was being checked for
   an aria-label it does not need, since its name is the word inside it. */
const railSrc = shell.slice(shell.indexOf('function SideRail'), shell.indexOf('function TabBar'))
const railLinks = railSrc.match(/<NavLink[\s\S]{0,2000}?<\/NavLink>/g) ?? []
ok('the rail still has its links', railLinks.length >= 2, String(railLinks.length))
ok(
  'no rail item is left unlabelled',
  railLinks.every((l) => /aria-label=/.test(l)),
  'the visible word is gone, so this is the only accessible name left',
)
ok(
  'and every one carries a tooltip as well',
  railLinks.every((l) => /title=/.test(l)),
  'the weakest affordance available without a printed word, and better than none',
)
ok('there is no label component left over', !/RailLabel/.test(shell))
ok(
  'the bell has both too',
  /aria-label=\{count \?/.test(read('src/components/NotificationBell.jsx')) &&
    /title=\{count \?/.test(read('src/components/NotificationBell.jsx')),
)

/* --- the calendar uses the width ---------------------------------------- */

const cal = read('src/pages/Calendar.jsx')

ok(
  'the calendar has no width cap above md, and it is the only page without one',
  /max-w-content[^"]*md:max-w-none/.test(cal),
  'a grid is the exception; a 1200px settings form is worse, not better',
)
/* --- and so does every other page --------------------------------------- */

/**
 * THE 40REM COLUMN IS GONE, ON PURPOSE, AND THE LIMITS MOVED INWARD.
 *
 * The argument for keeping it was about CONTENT and was being made with a rule
 * about the PAGE, which cost every grid, table and card list on every screen.
 * These pin the replacement: the page is released, and the things that
 * genuinely need a limit carry their own.
 *
 * If somebody puts a cap back on .shell, the ones below start failing, which is
 * the signal that the fix belongs on a paragraph or an input instead.
 */
const css = read('src/index.css')

ok(
  'the shell is released above md',
  /\.shell \{[\s\S]{0,140}md:max-w-none/.test(css),
  'this is the change that was asked for twice',
)
ok(
  'and is still a reading column on a phone',
  /\.shell \{[\s\S]{0,140}max-w-content/.test(css),
  'a phone has one width and none of this applies to it',
)
ok('there is a limit for prose', /\.measure \{/.test(css))
ok('and one for a form', /\.measure-form \{/.test(css))
ok(
  'a card list becomes columns rather than full-width rows',
  /\.card-grid \{[\s\S]{0,120}lg:grid-cols-2/.test(css),
  'measured on goals at 1440: Supprimer and Terminer ended up 800px apart',
)
ok(
  'a settings page is two columns, never three',
  /\.pane-grid \{[\s\S]{0,120}lg:grid-cols-2/.test(css) &&
    !/\.pane-grid \{[\s\S]{0,120}grid-cols-3/.test(css),
  'a settings screen read in a Z is one where nobody finds anything',
)
ok(
  'a button stops before it becomes a section of the page',
  /\.btn \{[\s\S]{0,300}md:max-w-\[26rem\]/.test(css),
  'measured at 1440: "Configurer mon budget" was a 1213px pink bar',
)
ok(
  'and is still full width on a phone, where that was decided',
  /\.btn \{[\s\S]{0,220}w-full/.test(css),
)
ok(
  'the card lists actually use it',
  (read('src/pages/Goals.jsx').match(/card-grid/g) ?? []).length >= 4 &&
    /card-grid/.test(read('src/pages/Library.jsx')),
)
ok(
  'and the settings pages use the pane grid',
  /pane-grid/.test(read('src/pages/Me.jsx')) && /pane-grid/.test(read('src/pages/Account.jsx')),
)
ok(
  'no page opts out with a prop any more',
  !/shell-wide/.test(css) && !/<Screen wide/.test(read('src/pages/Dashboard.jsx')),
  'a prop every caller passes and nothing reads is one the next person has to check',
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

/* --- rails run to the screen, not to their column ------------------------ */

/**
 * .bleed-row's numbers ARE the layout's numbers, and that is the whole reason
 * these assertions exist.
 *
 * 9.5rem is the nav's 7.5 plus the shell's 2. Change either one and the rows
 * stop at the wrong place: too small and a card hits an invisible wall inside
 * the window, too large and the document scrolls sideways. Both happened. The
 * previous version was inline `-mx-6 px-6` on five elements, which was already
 * 8px wrong the moment the shell went from px-6 to px-8 and nothing said so.
 */
ok(
  'there is one place that knows how far a rail bleeds',
  /\.bleed-row \{/.test(css),
  'it was five copies of -mx-6 px-6, and they were already out of step',
)
ok(
  'the left bleed is the nav offset plus the shell padding',
  /\.bleed-row \{[\s\S]{0,600}margin-left: -7\.5rem/.test(css) &&
    /\.bleed-row \{[\s\S]{0,600}padding-left: 7\.5rem/.test(css),
  '5.5rem of md:pl on the content wrapper plus 2rem of md:px on the shell',
)
ok(
  'and the right is the shell padding alone, since nothing is over there',
  /\.bleed-row \{[\s\S]{0,600}margin-right: -2rem/.test(css),
)
ok(
  'a snapped card rests on the text column rather than under the nav',
  /\.bleed-row \{[\s\S]{0,600}scroll-padding-left: 7\.5rem/.test(css),
  'without this the snap points sit at the scroller edge and card one parks behind the glass',
)
/* Matched inside a className rather than anywhere in the file. The first
   version of this looked for the bare string and failed on the comment that
   explains why the string is gone. */
ok(
  'no rail still bleeds by the old inline amount',
  !['NudgeBanner', 'BirthdayBanner', 'MonthByMonth'].some((f) =>
    /className="(?:[^"]*\s)?-mx-6/.test(read(`src/components/${f}.jsx`)),
  ),
  'a rail that stops 8px short of another rail reads as a mistake',
)
ok(
  'the rails use it',
  ['NudgeBanner', 'BirthdayBanner', 'MonthByMonth'].every((f) =>
    /bleed-row/.test(read(`src/components/${f}.jsx`)),
  ),
)
/* The layering that lets a card go behind rather than over. It already existed
   and is asserted because the effect silently dies if either number moves. */
ok(
  'the nav sits above the page, so a card passes under it',
  /data-hook="side-rail"[\s\S]{0,200}z-30|z-30[\s\S]{0,200}data-hook="side-rail"/.test(shell) &&
    /<div className="relative z-10">/.test(shell),
)

/* --- the check-in has three steps now, not four ------------------------- */

/**
 * "Ensuite" is gone. The column and the RPC parameter stay, per the request to
 * leave the schema alone, so old rows keep whatever they recorded; nothing
 * writes a new one and nothing displays it.
 */
const checkin = read('src/pages/Checkin.jsx')
ok('the next-time step is gone from the wizard', !/id: 'next'/.test(checkin))
ok('and its pane with it', !/pane === 'next'/.test(checkin))
ok('nothing writes a next commitment any more', !/next_commitment/.test(checkin))
ok(
  'and the board does not show one that can no longer be written',
  !/next_commitment/.test(read('src/pages/Board.jsx')),
)
ok(
  'the icon it used is not left behind',
  !/ForwardIcon/.test(read('src/components/ActionBar.jsx')),
  'an exported glyph with no caller is the start of a sprite sheet',
)
ok(
  'and neither are its strings',
  !/checkin\.tab_next|checkin\.one_thing|'board\.next'/.test(read('src/lib/i18n.jsx')),
)

/* The second door to the calendar is gone. It existed because the bottom bar
   is capped at four tabs and the calendar could not be a fifth; the rail
   carries it at every width above md now, and the tab bar is one tap away
   below. */
ok(
  'the week strip no longer offers its own way into the calendar',
  !/to-calendar|week\.open_calendar/.test(read('src/components/WeekStrip.jsx')),
)
ok(
  'and the string went with it',
  !/week\.open_calendar/.test(read('src/lib/i18n.jsx')),
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
