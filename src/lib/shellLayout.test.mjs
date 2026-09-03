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
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/**
 * The same file with its comments removed.
 *
 * Assertions of the form "this string is gone" match the note explaining why it
 * is gone, so they fail against a codebase that is already correct. That has
 * happened twice here: once for CameraIcon, once for text-on-accent/70. Declared
 * beside read() rather than halfway down, for the temporal-dead-zone reason
 * recorded on the file reads below.
 */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

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
/**
 * Every file this suite reads, declared here rather than beside the block that
 * first needed it.
 *
 * Three separate runs died on "Cannot access 'x' before initialization": a
 * `const` declared halfway down is in the temporal dead zone for every
 * assertion above it, so moving one assertion, or adding one that reuses an
 * existing binding, crashes the whole file rather than failing a test. Read
 * once, at the top, and the order of the blocks stops mattering.
 */
const goalsPage = read('src/pages/Goals.jsx')
const gcard = read('src/components/GoalCard.jsx')
const carousel = read('src/components/CheckinCarousel.jsx')
const rail = read('src/components/CheckinRail.jsx')

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
/* Anchored to the rail's own source rather than to a character window from
   the hook. The window was 2600 and a comment added above the lockup pushed it
   out of range: the assertion failed on a file where the lockup was exactly
   where it should be. A distance in characters is not a structural fact. */
ok(
  'the rail carries a lockup of its own',
  /LockupInline/.test(shell.slice(shell.indexOf('function SideRail'), shell.indexOf('function TabBar'))),
)
/**
 * HOME IS IN BOTH NAVIGATIONS.
 *
 * The two swap wholesale, so walking into a group replaced every destination at
 * once and the dashboard left the screen. Getting back meant the wordmark,
 * which is a logo: it happens to link home and nothing said so.
 *
 * First in both, so the icon under your thumb does not move when you cross into
 * a group. A menu whose items relocate depending on where you are is one you
 * have to read rather than aim at.
 *
 * MEASURED, because five tabs is where this bar has clipped French labels
 * before and the group set has different words. At 320, 360, 390 and 430, with
 * scrollWidth compared against clientWidth per label: nothing clipped, and the
 * bar does not overflow. 320 is narrower than any phone this is built for.
 */
ok(
  'home is in the group navigation too',
  /const IN_GROUP = \(id\) => \[\s*\n\s*\{ to: '\/', key: 'nav\.home'/.test(shell),
  'the two navigations swap wholesale, so without this the dashboard is unreachable',
)
ok(
  'and it is first in both, so it does not move',
  /const MINE = \[\s*\n\s*\{ to: '\/', key: 'nav\.home'/.test(shell),
)

/**
 * AND THE LOCKUP IS NAMED FOR THE BRAND, NOT FOR WHERE IT GOES.
 *
 * It was aria-label="Accueil", which was right while the rail had no home item.
 * With one in both navigations that put two links with the same name and the
 * same destination inside one <nav>: read twice by a screen reader, tabbed
 * through twice by a keyboard. Verified in Chromium that each rail now lists
 * exactly one "Accueil".
 */
ok(
  'the wordmark does not claim to be the home control',
  /aria-label=\{t\('brand\.name'\)\}/.test(shell) &&
    !/aria-label=\{t\('nav\.home'\)\}[\s\S]{0,120}LockupInline/.test(shell),
  'two links, one name, one destination, in the same navigation',
)
ok(
  'and the brand name is the same string in both locales',
  (read('src/lib/i18n.jsx').match(/'brand\.name': 'Rich & Friends'/g) ?? []).length === 2,
  'a brand name is not translated',
)

ok(
  'and the group name has somewhere to be',
  /data-hook="rail-group"/.test(shell),
  'it was in the top bar, which no longer runs at this width',
)

/**
 * THE BADGE IS THE GROUP'S STICKER, NOT ITS FIRST LETTER.
 *
 * "F" is not a picture of FUTUR MILLIARDAIRE, it is a picture of the letter F,
 * and one letter in a rail of glyphs reads as a missing icon. The sticker is
 * already the group's face on the settings header, derived from the group id
 * so it is stable for the group's life and identical for everyone in it.
 *
 * Verified in Chromium that the two screens agree rather than each picking
 * their own: the rail badge and the settings header resolved to the same
 * asset path, and the rail image decoded (naturalWidth > 0) rather than being
 * an img tag with a good src painting nothing.
 *
 * The initial stays UNDER the image rather than being replaced by it. art.js
 * is explicit that a renamed PNG must not take a page down, and a 404 there is
 * a network failure rather than a page error, so nothing else would catch it.
 * An empty tinted disc looks like a design decision; a letter looks like a
 * group.
 */
ok(
  'the rail badge draws the group sticker',
  /data-hook="rail-group"[\s\S]{0,700}stickerFor\(activeId\)/.test(shell) &&
    /from '\.\.\/lib\/art'/.test(shell),
  'the settings header already uses stickerFor, so this is two surfaces agreeing',
)
ok(
  'and keeps the initial underneath as the fallback',
  /data-hook="rail-group"[\s\S]{0,600}group\.name\.trim\(\)\]\[0\]\?\.toUpperCase\(\)/.test(shell),
  'a renamed PNG is a 404, not a page error, so nothing else would catch it',
)
ok(
  'the picture is decorative, so the name is still the accessible one',
  /data-hook="rail-group"[\s\S]{0,900}alt=""[\s\S]{0,80}aria-hidden="true"/.test(shell) &&
    /aria-label=\{group\.name\}/.test(shell),
  'a screen reader gets the group name, not a sticker filename',
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

/**
 * THE COURSE CARD, WHICH IS THE ONE TINTED SURFACE ON THE LIBRARY PAGE.
 *
 * It was a white `glass-card` sitting above the shelf with no heading over it,
 * which put it in the same visual class as the three books and left the reader
 * to work out from an icon that this one is free and is not a book. It is now
 * a tinted card under a heading of its own.
 *
 * Measured at 1440 and 430 on both themes, off the screenshots rather than off
 * the computed styles:
 *
 *   sun   card ground 255,224,236 on a 255,245,247 page   title 14.25:1  sub 6.20:1
 *   sea   card ground 224,237,245 on a 240,249,255 page   title 14.44:1  sub 5.97:1
 *
 * Both pass 4.5:1 for normal text with room to spare, which is why the tint is
 * safe: cat-1-soft is the palest step of the ramp in both themes.
 */
const lib = read('src/pages/Library.jsx')
ok(
  'the course sits under a heading of its own',
  /<Section title=\{t\('library\.sec_course'\)\}>/.test(lib),
  'without one it reads as a fourth book',
)
ok(
  'and its ground is the theme token, not a fixed pink',
  /data-hook="formation-entry"[\s\S]{0,240}bg-cat-1-soft/.test(lib) &&
    !/data-hook="formation-entry"[\s\S]{0,240}glass-card/.test(lib),
  'a hardcoded #FF007A wash would be a pink card in the middle of a blue app on sea',
)
ok(
  'the tile and the chip invert so they are not their own ground',
  (lib.match(/bg-surface text-ink/g) ?? []).length >= 2,
  'they were the tinted things on a white card; on a tinted card that is pink on pink',
)
ok(
  'the heading is written in both locales',
  /'library\.sec_course': 'Course'/.test(read('src/lib/i18n.jsx')) &&
    /'library\.sec_course': 'Cours'/.test(read('src/lib/i18n.jsx')),
  'a key added to one locale only shows the other locale an English word',
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

/* --- the check-in screen is gone, and so is the tab that outlived it ----- */

/**
 * BRAVO WAS A PAGE MADE OF TWO LINKS, AND THIS IS WHAT KEEPS IT GONE.
 *
 * The tab was the check-in. The check-in moved onto the goals page, and what
 * was left on that route was a destination whose whole content was "Proof" and
 * "Celebrate", both of which only led somewhere else. Both jobs are sections
 * on the goals page now, so the screen has been deleted rather than emptied
 * again.
 *
 * The route survives as a redirect on purpose: links to /checkin exist in push
 * notifications already delivered, in browser history, and in whatever anybody
 * pasted into a chat. Without it those fall through to the catch-all, which is
 * the dashboard, and somebody following "you have not checked in" lands
 * somewhere that does not mention it.
 */
ok(
  'the check-in screen is deleted, not emptied',
  !existsSync(join(root, 'src/pages/Checkin.jsx')),
)
ok(
  'the tab is out of the group nav',
  !/nav\.checkin/.test(shell) && !/g\/\$\{id\}\/checkin/.test(shell),
)
ok(
  'but the route still resolves, as a redirect',
  /path="checkin" element=\{<CheckinRedirect \/>\}/.test(read('src/App.jsx')) &&
    /Navigate to=\{`\/g\/\$\{groupId\}\/goals`\}/.test(read('src/App.jsx')),
  'a dead link from a push notification would otherwise land on the dashboard',
)
for (const [file, what] of [
  ['src/pages/Board.jsx', 'the board'],
  ['src/pages/Dashboard.jsx', 'the dashboard'],
  ['src/components/TodayObjective.jsx', "today's objective"],
]) {
  ok(
    `${what} sends people to the goals page, not through the redirect`,
    !/\/checkin`/.test(read(file)),
    'a redirect is for links we do not control, not for our own',
  )
}
/* Comments stripped first, like cycCode below. The first version of this
   assertion failed against a codebase that was already correct, because the
   note explaining WHY CameraIcon was removed names CameraIcon. */
ok(
  'the glyphs it used are not left behind',
  !/ForwardIcon|CameraIcon|PartyIcon/.test(code('src/components/ActionBar.jsx')) &&
    !/IconCheckin/.test(code('src/components/NavIcons.jsx')),
  'an exported glyph with no caller is the start of a sprite sheet',
)
ok(
  'and neither are its strings',
  !/checkin\.tab_next|checkin\.one_thing|'board\.next'|'nav\.checkin'|'checkin\.tab_proof'|'checkin\.tab_celebrate'/.test(
    read('src/lib/i18n.jsx'),
  ),
)
ok(
  'the board does not show a next commitment that can no longer be written',
  !/next_commitment/.test(read('src/pages/Board.jsx')),
)

/**
 * THE DAILY QUESTION RUNS IN BOTH MODES, AND THEY WRITE TO DIFFERENT TABLES.
 *
 * A group goal is answered into a cycle: submit_checkin upserts the whole
 * checkin_items list, which is why the group branch posts every answer. A solo
 * goal has no cycle, because cycles.group_id is not null, so it is written to
 * goal_days one row at a time through the same setGoalDay the card's tick
 * calls. Asserting the split is asserting that neither branch was quietly
 * pointed at the other's table.
 */
ok(
  'the check-in opens for a solo goal too',
  /const openSolo = !groupId/.test(goalsPage) &&
    /const open = openGroup \|\| openSolo/.test(goalsPage),
)
ok(
  'solo writes goal_days through setGoalDay, not the cycle queue',
  /if \(openSolo\)[\s\S]{0,900}setGoalDay\(g, count, now\)/.test(goalsPage),
)
ok(
  'and the cycle queue is still what a group answer goes through',
  /enqueue\(\{ cycle_id: currentCycle\.id/.test(goalsPage),
)
ok(
  'the evidence picker is off where there is nowhere to store it',
  /proof=\{openGroup\}/.test(goalsPage) &&
    /wantProof && proof !== 'none'/.test(read('src/components/CheckinCarousel.jsx')),
  'goal_days has a count and a date and no column for a photograph',
)
ok(
  'and the carousel is still rendered for the link that opens it',
  /\{carousel && \(/.test(goalsPage) && /setCarousel\(true\)/.test(goalsPage),
  'a button that sets state nothing reads is a button that does nothing',
)
ok(
  'sitting a period out stays group-only',
  /\{openGroup && \(/.test(goalsPage),
  'away_periods is keyed by cycle_id, and nobody needs to notify themselves',
)
/**
 * THE CARDS CARRY NOTHING UNDER THE RULE, AND THE RAIL CARRIES THE QUESTION.
 *
 * The card had a tick, a "not due today" line, a streak and seven dots. Asked
 * for: "everything after the horizontal line after the objective disappears".
 * The information was not wrong, it was in the wrong place: the rail at the top
 * asks whether today is done, once, and repeating it under every card asked it
 * five more times and made a list of goals read as a list of chores.
 *
 * The `track` prop went with the block instead of being left accepted and
 * ignored. GoalDetail still takes one, because the expanded view is where a
 * streak and a history belong, and GoalCard derives it from the goal rather
 * than being told: a prop is a thing a caller can forget, and the answer is
 * written on the row.
 */
ok(
  'the goal card no longer asks the daily question',
  !/track=\{tracks\}/.test(goalsPage) && !/const tracks = /.test(goalsPage),
  'the rail asks it once, above the list',
)
ok(
  'and the card derives the history flag rather than taking a prop',
  /const solo = !goal\.group_id/.test(gcard) && !/^\s*track = false,$/m.test(gcard),
  'goal_days exists for goals with no group; the row already says which',
)
ok(
  'the detail view keeps its streak and history',
  /track=\{solo\}/.test(gcard),
  'that is where somebody goes when the history IS the question',
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

/* --- the calendar's three containers ------------------------------------- */

/**
 * One header carrying a title, three buttons, a view switch, a pager, the
 * month and four filter chips was nine controls of five kinds in one box.
 * The split is by WHAT A CONTROL DOES: row one opens things and turns layers
 * on and off, row two moves around inside what is already drawn, row three is
 * the drawing.
 */
ok('the actions and the filters are their own row', /data-hook="cal-actions"/.test(cal))
ok('the pager is its own card', /data-hook="cal-toolbar"/.test(cal))
ok(
  'and that card holds no filters',
  !/data-hook="cal-toolbar"[\s\S]{0,1400}data-hook="cal-layers"/.test(cal),
  'a toolbar that both changes what is drawn and where you look is one nobody can read',
)
/**
 * THE CANVAS ENDS WHERE THE PAGE DOES.
 *
 * The month grid was 6.5rem per row whatever the window, so on a laptop the
 * card stopped about 220px short of the bottom and left a band of empty ground
 * under it. Measured after: 32px, which is the page's own bottom padding.
 *
 * min-h-0 is the assertion worth having. A flex child defaults to
 * min-height:auto and refuses to shrink below its content, so flex-1 without
 * it does nothing at all and the fix looks applied while changing nothing.
 */
ok(
  'the page is a full-height column above md',
  /md:flex md:h-dvh md:max-w-none md:flex-col/.test(cal),
  'without a height to fill, nothing below can flex into it',
)
ok(
  'the canvas takes what is left, and can shrink',
  /md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto/.test(cal),
  'flex-1 without min-h-0 is a no-op, and the day list has to be able to scroll',
)
ok(
  'the month rows share the card',
  /\.month-fill \{[\s\S]{0,120}grid-template-rows: auto repeat\(var\(--weeks/.test(css),
  'a month is five or six weeks, so the count cannot be a literal',
)
ok(
  'and they can shrink below their content',
  /\.month-fill \{[\s\S]{0,120}minmax\(0, 1fr\)/.test(css),
  'a bare 1fr row will not shrink, so a busy month would push past the card',
)
ok(
  'the fill is above md only',
  /@media \(min-width: 768px\) \{\s*\.month-fill/.test(css),
  'six rows across a 600px phone is 90px each, which holds a date and nothing',
)
ok(
  'the week hours fill too, with a floor',
  /\.week-hours \{[\s\S]{0,200}min-height: calc\(var\(--hours/.test(css),
  'a short window scrolls the canvas rather than crushing a nine-hour day',
)
ok(
  'and the hour height is not inline',
  !/style=\{\{ height: `\$\{hours\.length \* 3\}rem` \}\}/.test(cal),
  'an inline style beats every class, so it could not be released at one breakpoint',
)

ok(
  'the month is the heading now that the page title has gone up',
  /<h1[^>]*first-letter:uppercase[\s\S]{0,80}fmt\.format\(anchor\)/.test(cal),
  'Intl returns "septembre 2026" in French and "September 2026" in English',
)

/* --- the secondary button is glass --------------------------------------- */

ok(
  'the secondary button is a raised sheet rather than an outline',
  /\.goal-action \{[\s\S]{0,400}var\(--glass-tint\)/.test(css),
  'an outline round transparent nothing reads as disabled beside a filled button',
)
ok(
  'it uses the token and not a literal white',
  !/\.goal-action \{[\s\S]{0,400}bg-white/.test(css),
  'a literal white stays white on a surface a token would have darkened',
)
ok('and it lifts on hover', /\.goal-action:hover \{[\s\S]{0,200}translateY\(-2px\)/.test(css))
ok(
  'with the motion opted out of',
  /prefers-reduced-motion[\s\S]{0,300}\.goal-action/.test(css),
)

/* --- the profile is an aside and a main column --------------------------- */

ok('there is a profile grid', /\.profile-grid \{/.test(css))
ok(
  'and it backfills, which is what puts the aside beside the form',
  /\.profile-grid \{[\s\S]{0,120}grid-auto-flow: row dense/.test(css),
  'measured without it the whole top-left of the page was empty',
)

/* --- the sign-in is a card, and only where there is room for one ---------- */

const signin = read('src/pages/SignIn.jsx')
ok(
  'the sign-in centres from sm up rather than pinning top and bottom',
  /sm:justify-center/.test(signin),
  'justify-between on a laptop put the pitch and the button 900px apart',
)
ok(
  'and there is no card on a phone',
  /sm:lg sm:lg-frost/.test(signin),
  'a card inside a 390px screen is a border drawn 16px from another border',
)

/* --- decoration stays where it has room --------------------------------- */

const stickers = read('src/components/Stickers.jsx')
ok(
  'the stickers are limited to the phone layout',
  /absolute inset-0 z-20 overflow-hidden md:hidden/.test(stickers),
  'measured at 1440px they landed on the page title, a calendar tile and the cycle panel',
)

/* --- a dialog is not chrome ---------------------------------------------- */

ok('there is a modal treatment of its own', /\.lg-modal \{/.test(css))
/**
 * NEITHER DIAL IS PINNED TO A NUMBER, AND THAT IS DELIBERATE.
 *
 * This pinned `--lg-a: 0.9x` for one round and then the alpha was asked to go
 * back to 0.75, so the test was a record of one afternoon's preference. The
 * replacement pinned the saturate instead, on the theory that it was the dial
 * carrying the tint. The sweep in index.css says otherwise: at a fixed alpha,
 * 120% and 200% land one unit apart. That theory was wrong.
 *
 * So what is asserted is the range each dial has to stay inside for the sheet
 * to be a sheet, and the numbers inside it are taste.
 */
ok(
  'the modal is glass rather than a white rectangle',
  /\.lg-modal \{[\s\S]{0,200}--lg-a: 0\.[5-9][0-9]?;/.test(css),
  'at 1 the backdrop-filter is dead weight and the sheet stops reading as a sheet',
)
ok(
  'and not so transparent that the page reads through the form',
  Number((css.match(/\.lg-modal \{[\s\S]{0,200}--lg-a: (0\.[0-9]+);/) ?? [])[1]) >= 0.7,
  'measured, 0.75 puts the sheet at #F1EFF0 over the real page; below that it keeps darkening',
)
ok(
  'the dialog floats on a two-layer shadow',
  /\.lg-modal \{[\s\S]{0,900}box-shadow:\s*\n?\s*0 25px 50px -12px rgb\(var\(--c-accent\)/.test(css),
  'the deep tinted drop and the white halo that were asked for',
)
ok(
  'and it wins over .lg, which sets box-shadow at the same specificity',
  /\.lg-modal \{[\s\S]{0,900}!important/.test(css),
  'without it the shadow is written and silently discarded on source order',
)
ok(
  'the modal input fill is scoped to the modal',
  /\.lg-modal \.field \{/.test(css),
  'unscoped, a 60 per cent white input over the coloured page is the rose fill again',
)
ok(
  'and it goes opaque on focus',
  /\.lg-modal \.field:focus \{[\s\S]{0,160}background-color: rgb\(var\(--c-surface\)\)/.test(css),
)

const wizard = read('src/components/TimetableWizard.jsx')
const cyclePanel = read('src/components/CyclePanel.jsx')
for (const [name, src] of [['the event form', cal], ['the wizard', wizard], ['the cycle drawer', cyclePanel]]) {
  ok(`${name} uses it`, /lg lg-modal/.test(src))
  ok(`and ${name} is not chrome any more`, !/lg lg-chrome relative/.test(src))
}
ok(
  'the nav still is chrome',
  /lg lg-chrome/.test(read('src/components/AppShell.jsx')),
  'the bar is a sheet you see the page through on purpose, that is orientation',
)

/* --- the input is white, not a rose well --------------------------------- */

ok(
  'the field is the surface token',
  /\.field \{[\s\S]{0,300}background-color: rgb\(var\(--c-surface\)\)/.test(css),
  'every input in the app sat on --c-raised, which is #FFECEF in sun',
)
ok(
  'and it is not the raised tint any more',
  !/\.field \{[\s\S]{0,300}var\(--c-raised\)/.test(css),
)
ok(
  'it keeps a border, because white on white has no edge',
  /\.field \{[\s\S]{0,300}border: 1px solid rgb\(var\(--c-ink\)/.test(css),
)
ok(
  'and the accent is on the focus ring, where it is a state and not a fill',
  /\.field:focus \{[\s\S]{0,200}box-shadow: 0 0 0 3px rgb\(var\(--c-accent\)/.test(css),
)

/* --- the event form is a centred dialog, not a panel in the page --------- */

ok(
  'the event form portals to the body',
  /data-hook="cal-form"[\s\S]{0,400}role="dialog"/.test(cal),
  'a form nested in the page scrolled with it and sat under the rail',
)
ok(
  'and it centres from sm up',
  /items-end justify-center sm:items-center"[\s\S]{0,60}data-hook="cal-form"/.test(cal),
  'a sheet from the bottom on a phone, a centred card on everything else',
)

/* --- deleting one of a series ------------------------------------------- */

ok('there is a delete dialog', /data-hook="cal-delete"/.test(cal))
ok('offering the one day', /data-hook="del-one"/.test(cal))
ok('and the whole rule', /data-hook="del-all"/.test(cal))
ok(
  'it sits above the form it was opened from',
  /data-hook="cal-delete"[\s\S]{0,80}/.test(cal) && /z-\[70\][\s\S]{0,200}data-hook="cal-delete"/.test(cal),
  'the form is z-60, so a dialog at the same level would have been a coin toss',
)
ok(
  'and only a repeating entry gets asked',
  /const recurring = Array\.isArray\(entry\?\.weekdays\)[\s\S]{0,120}if \(!recurring\) return removeSeries/.test(cal),
  'a one-off has one occurrence, so the question has one honest answer',
)

/* --- a write that did not happen says so --------------------------------- */

ok(
  'both deletes ask for a row count',
  (cal.match(/count: 'exact'/g) ?? []).length === 2,
  'RLS refuses by matching zero rows, with no error to catch',
)
ok(
  'and put the list back when nothing was written',
  (cal.match(/setEvents\(before\)/g) ?? []).length === 2,
  'the optimistic update is what makes a failed write invisible',
)
ok('with something on screen saying why', /data-hook="cal-notice"/.test(cal))
ok(
  'and it is an alert, not a status',
  /role="alert" data-hook="cal-notice"/.test(cal),
  'a row that just came back on its own needs the reason read out',
)

/* --- the calendar is in both navigations -------------------------------- */

/**
 * The one that was actually reported: it was in the rail and not in the tab
 * bar, so on a phone the menu simply did not have it. Both are built from one
 * list now, and this is the assertion that stops them drifting apart again.
 */
ok(
  'both navigations append the calendar to the same list',
  (shell.match(/\[\.\.\.tabs, CALENDAR\]/g) ?? []).length === 2,
  'one of them had it and the other did not, which is how it went missing on the phone',
)
ok(
  'and the tab bar renders that list rather than the raw tabs',
  /\{rows\.map\(\(tab, i\) => \(/.test(shell),
  'building rows and then mapping tabs is a fifth destination nobody can reach',
)

/* --- the rail has room to breathe --------------------------------------- */

ok(
  'the rail rows are spaced rather than stacked',
  /flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto/.test(shell),
  'at gap-0.5 the active pill touched its neighbours and read as a band',
)
ok(
  'and the lockup is separated from the destinations',
  /LockupInline[\s\S]{0,220}mb-10 mt-4 h-px shrink-0 bg-hairline/.test(shell),
  'asked for twice: 4px, then 24, now 40, which is about one empty row',
)

/* --- an exam does not look like a class --------------------------------- */

/**
 * THE CHIP HAS NO EDGE, AND THAT IS THE ASSERTION.
 *
 * It carried a 3px full-strength left rule for one round. That was rejected on
 * sight and the original chip was asked back, so this pins the absence: the
 * rule is the obvious thing to reach for the next time somebody measures the
 * washes and finds them close, and it is not available.
 */
ok(
  'no swatch carries a rule at its edge',
  !/border-l-\[3px\]/.test(cal),
  'the plain soft pill was asked back for explicitly',
)
ok(
  'and there is a dark option, which neither ramp otherwise has',
  /ink: 'bg-ink\/\[0\.30\] text-ink ring-ink\/35'/.test(cal),
  'at 0.12 an exam and a health entry were two greys 5.0 apart',
)
ok(
  'yellow gets the alpha it needs rather than the shared one',
  /field: 'bg-field\/\[0\.6[0-9]\]/.test(cal),
  'a quarter of #FFD60A over white is white',
)
ok(
  'the category pills show the colour they will paint in',
  /data-cat=\{c\}/.test(cal) && /SWATCH_BAR\[CATEGORY_COLOUR\[c\]\]/.test(cal),
  'picking a category decides what the chip looks like for the rest of the term',
)
ok(
  'and the pill dot goes white when selected, so it stays visible on the accent',
  /on \? 'bg-on-accent'/.test(cal),
)

/* --- the deletion dialog names what it is deleting ---------------------- */

ok(
  'the title is set apart from the sentence around it',
  /<strong className="font-semibold text-ink">\{entry\.title\}<\/strong>/.test(cal),
)
ok(
  'and the sentence is split on a sentinel, not concatenated',
  /t\('cal\.del_body', \{ what: SPLIT, when \}\)\.split\(SPLIT\)/.test(cal),
  'three strings hard-code the title coming before the date, which is not a property of translation',
)

/* --- the secondary button is glass everywhere --------------------------- */

ok(
  'the outline button has a ground now',
  /\.btn-ghost \{[\s\S]{0,200}var\(--glass-tint\)/.test(css),
  'text-ink with no background is a word floating beside a filled button',
)
ok('and it lifts on hover', /\.btn-ghost:hover \{[\s\S]{0,200}translateY\(-2px\)/.test(css))
ok(
  'with the motion opted out of',
  /prefers-reduced-motion[\s\S]{0,300}\.btn-ghost/.test(css),
)
ok(
  'the two glass secondaries blur by the same amount',
  (css.match(/backdrop-filter: blur\(16px\) saturate\(160%\)/g) ?? []).length >= 2,
  'they were 12 and 16, sitting next to each other on the calendar toolbar',
)

/* --- the cycle drawer ---------------------------------------------------- */

const cyc = read('src/components/CyclePanel.jsx')
ok(
  '"it started today" is a toggle',
  /aria-pressed=\{Boolean\(todayRow\)\}/.test(cyc),
  'it was one-way, and the only undo was finding today among the recorded dates',
)
ok(
  'and pressing it again removes only today',
  /if \(todayRow\) \{[\s\S]{0,120}removeEntry\(todayRow\.id\)/.test(cyc),
  'nothing else in the history is reachable from that button',
)
ok(
  'the state is not carried by the fill alone',
  /todayRow \? '✓' : '🌸'/.test(cyc),
  '1.4.1: colour is never the only thing saying it',
)
ok('deleting a date says so', /data-hook="cycle-said"/.test(cyc))
ok(
  'and the message clears itself off a ref, not off the function object',
  /clearTimeout\(saidTimer\.current\)/.test(cyc),
  'flash is rebuilt every render, so a timer hung off it would never be cleared',
)
ok(
  'the timer is cleaned up on unmount',
  /useEffect\(\(\) => \(\) => clearTimeout\(saidTimer\.current\), \[\]\)/.test(cyc),
  'the drawer unmounts every time it is closed, which is the normal path',
)
ok('the glasses are drawn, not emoji', /viewBox="0 0 16 20"/.test(cyc),
   'the droplet emoji is blue in every font, and this app has two themes')
ok(
  'there is a note about the phase',
  /data-hook="cycle-care"/.test(cyc),
)
/* Comments stripped first. The previous version of this assertion matched the
   comment written to explain it, which is a failure this repo has already paid
   for once: a test that reads its own prose is a test of nothing. */
const cycCode = cyc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
ok(
  'and it reads the phase rather than asking for anything',
  !/symptom|mood/i.test(cycCode),
  'migration 51 exists to make a "who is having a rough week" signal impossible',
)
ok(
  'phaseOn is called with three arguments, so periodDays keeps its default',
  /phaseOn\(new Date\(\), starts, prediction\)/.test(cyc),
  'passing the estimate object as the fourth makes every day inside a NaN window read as a period',
)
ok('the drawer has its warm wash', /cycle-warm/.test(cyc) && /\.cycle-warm::after \{/.test(css))
ok(
  'and the wash is the accent token rather than a literal rose',
  /\.cycle-warm::after \{[\s\S]{0,400}rgb\(var\(--c-accent\) \/ 0\.09\)/.test(css),
  'a hex here would be an unexplained pink glow inside a blue app',
)
ok(
  'it fades out rather than tinting the whole drawer',
  /\.cycle-warm::after \{[\s\S]{0,400}height: 12rem/.test(css),
  'a wash behind the history inputs is the pink-fields problem again',
)

/* --- one pink, and the artwork is part of the palette now --------------- */

/**
 * The complaint was inconsistent pinks and there were three: --c-accent at
 * #E60070, --c-mark and --c-cat-1 at #FF007A, and #DE3578 baked inside every
 * logo PNG. The third is the one nobody could have found by reading the CSS,
 * which is why the generator exists and why this asserts the generator rather
 * than the pixels.
 */
const POP = '255 0 122'
ok(
  'the accent, the mark and the head of the ramp are one value',
  (css.match(new RegExp(POP, 'g')) ?? []).length >= 5,
  'sun accent, sun mark, sun cat-1, public accent, public mark',
)
ok(
  'and #E60070 is gone, which was the second pink',
  !/--c-accent: 230 0 112/.test(css),
  'the accent and the ramp head were four degrees of hue apart',
)
/**
 * #FF007A IS 3.80:1 AND THAT IS A DECISION, NOT AN OVERSIGHT.
 *
 * It was named directly as the brand pink after a deeper one had been tried,
 * so this asserts that the trade is WRITTEN DOWN rather than asserting a ratio
 * the colour does not meet. A note somebody has to read before changing
 * --c-on-accent is the only thing that stops this becoming a discovery later.
 */
ok(
  'the accent contrast is documented where the token is',
  /3\.80:1/.test(css) && /--c-on-accent. #111111 on/.test(css),
  'the one-line fix has to be findable from the token itself',
)
const gen = read('scripts/brand-icons.py')
ok('the artwork is generated rather than hand-edited', /POP = \(255, 0, 122\)/.test(gen))
ok(
  'and the generator points at the token rather than restating the trade',
  /index\.css/.test(gen),
  'two copies of a contrast argument is how they end up disagreeing',
)
ok(
  'the small icons use the monogram, not the four-line wordmark',
  /tile\(mono, 32/.test(gen) && /tile\(mono, 64/.test(gen),
  'at 32px the words were a clipped smudge',
)
ok(
  'the apple icon is not pre-rounded',
  /tile\(word, 180, POP\)\.convert\('RGB'\)/.test(gen),
  'iOS masks it itself, and transparent corners inside that mask render black',
)
ok(
  'the icon URLs were bumped so Safari notices',
  /\?v=4/.test(read('index.html')) && /\?v=4/.test(read('public/manifest.webmanifest')),
  'a favicon is the most aggressively cached asset a browser has',
)

/* --- the recap knows what was on the day -------------------------------- */

const recap = read('src/components/DayRecap.jsx')
const strip = read('src/components/WeekStrip.jsx')
ok(
  'the strip passes the day it already loaded',
  /agenda=\{agenda\.get\(selected\) \?\? \[\]\}/.test(strip),
  'it read calendar_event for the dots and then did not hand it down',
)
ok('and the phase with it', /cyclePhase=\{phaseOn\(selectedDate, cycleStarts, prediction\)\}/.test(strip))
ok(
  'the prop is not called phase',
  !/^\s+phase = null,$/m.test(recap),
  'the component already has a phase for the morph state, and two would not build',
)
ok('the recap draws the agenda', /data-hook="recap-agenda"/.test(recap))
ok('and the cycle line', /data-hook="recap-cycle"/.test(recap))
ok(
  'a day with a class on it is not an empty day any more',
  /agenda\.length === 0 &&\s*\n\s*!cyclePhase/.test(recap),
  'the emptiness test did not mention the calendar, so a full day opened as "rien"',
)

/* --- the heads-up under the home calendar ------------------------------- */

const heads = read('src/components/CycleHeadsUp.jsx')
ok('there is a heads-up', /data-hook="cycle-headsup"/.test(heads))
ok(
  'it is gated on the reminder switch that already exists',
  /if \(!remind \|\| hidden/.test(heads),
  'no new consent was invented for a card on a screen people open in public',
)
ok(
  'and it reads without writing',
  !/supabase/.test(heads),
  'migration 51 exists to make a "who is having a rough week" signal impossible',
)
ok(
  'the predicted phase is bounded by the reminder days',
  /phase === 'predicted' && away > Math\.max\(1, days\)/.test(heads),
  'that window widens as the recorded cycles disagree, up to nine days',
)
ok(
  'dismissal is for the day rather than forever',
  /localStorage\.setItem\(KEY, today\)/.test(heads),
  'a card somebody can silence permanently is one they silence once by accident',
)
/* It moved OUT of the calendar card and became a sibling under it. "Under"
   was read the way it was written: under, as in another card. Inside, it was
   the last row of the calendar. */
ok(
  'it is a sibling of the calendar card, not a block inside it',
  /<\/div>\s*\n\s*<CycleHeadsUp/.test(strip),
  '"juste en bas du calendrier" means another card, not the last row of one',
)
ok(
  'and it is a card in its own right',
  /className="lg mt-4 overflow-hidden" data-hook="cycle-headsup"/.test(heads),
  'the same sheet every other card in that column is made of',
)

/* --- the daily question is its own act ---------------------------------- */

/**
 * THIS HAS MOVED TWICE AND BOTH MOVES WERE RIGHT.
 *
 * It began as a screen of its own listing every goal again with one Submit.
 * That was wrong because it asked the question away from the goal.
 *
 * It then went onto the goal cards, which was wrong for the opposite reason:
 * a card already holds a title, two badges, an owner, a progress row and four
 * management actions, and a question with a counter and a Save on top of that
 * is a form with a heading. "Modifier" and "Fait" are not the same kind of
 * thing and were adjacent.
 *
 * So the card is a card, and the question is a banner and a carousel. These
 * assert the separation in both directions, because the tempting fix next time
 * something feels far away is to put a control back on a card.
 */

ok('there is a banner when something is due', /data-hook="checkin-banner"/.test(goalsPage))
/**
 * THE CHECK-IN IS A RAIL YOU SLIDE, NOT A BUTTON THAT OPENS A MODAL.
 *
 * "A sliding chain of goals, like the UI in the groups when people are
 * missing. You could slide them, and they will be gray. And when you click
 * done today, there will be bright pink."
 *
 * So it is NudgeBanner's shape pointed at your own goals. The button it
 * replaced was one more tap before the first answer and a layer over a list
 * somebody was already looking at, on the section whose whole job is speed.
 */
ok('with a rail of goals under it', /data-hook="checkin-rail"/.test(rail))
ok(
  'that slides, with the next card showing',
  /snap-x snap-mandatory/.test(rail) && /w-\[78%\]/.test(rail),
  'a rail whose cards fill the width is indistinguishable from one card',
)
/**
 * PINK IS "NOT YET", GREY IS "DONE", WHICH IS THE SECOND TIME ROUND.
 *
 * It shipped the other way. The loud colour was being spent on the goals that
 * need nothing from you while the ones still waiting sat quiet; inverted, the
 * pink cards ARE the remaining work and finishing one takes it out of the
 * queue.
 *
 * THAT MOVED A KNOWN CONTRAST PROBLEM FROM THE EXCEPTION TO THE DEFAULT.
 * White on the accent is 3.80:1, documented in index.css as a decision. It
 * clears the 3:1 large text needs and fails the 4.5 normal text needs, and it
 * now applies to every unanswered card rather than the odd finished one.
 *
 * So the pink card carries exactly one piece of white-on-pink text, the title,
 * at 22px bold, which IS large text. Everything smaller sits in an opaque white
 * pill with ink on it. Audited in Chromium on the painted pixels, compositing
 * every translucent layer down, in BOTH states:
 *
 *   pink  title 3.80 (large, needs 3)   pills 17.48   button 17.48
 *   grey  title 6.45 (large, needs 3)   pills  5.74   button 12.92
 *
 *   0 failing across both states, out of 20 pieces of text.
 *
 * The one that did fail first was the counter's denominator at
 * text-on-accent/70, which composited to 2.28:1, under even the large-text
 * threshold. It is full opacity now.
 */
ok(
  'pink is unanswered and grey is done',
  /done \? 'bg-ink\/\[0\.05\]' : 'bg-accent shadow-raised'/.test(rail),
  'the loud colour belongs on the work that is left',
)
ok(
  'the only white-on-pink text is the title, and it is large',
  /text-safe line-clamp-2 text-h2 font-bold leading-tight/.test(rail),
  '22px bold is large text, so 3.80:1 clears the 3:1 it needs',
)
ok(
  'and the small facts sit on an opaque pill instead',
  /done\s*\n?\s*\? 'bg-ink\/\[0\.06\] text-muted'\s*\n?\s*: 'bg-on-accent text-ink'/.test(rail),
  'a translucent white would composite back down towards the 3.80',
)
/* Comments stripped, like the glyph assertion above. The first version of
   this matched the note explaining WHY text-on-accent/70 was removed, so it
   failed on a file that was already correct. */
ok(
  'nothing on the card is drawn at partial opacity',
  !/text-on-accent\/\d/.test(code('src/components/CheckinRail.jsx')),
  'text-on-accent/70 measured 2.28:1, under even the large-text threshold',
)

/**
 * AND THE CARDS SAY MORE THAN WHETHER THEY ARE DONE.
 *
 * Asked for: "the number of streak days for a recurring goal, or if you say
 * you are going to read 3 chapters but you just read 2 out of 3".
 *
 * The streak is only ever non-zero for a goal with no group: streakOf walks
 * goal_days, and a group goal is answered into checkin_items, so it has no
 * rows there. Showing nothing is the honest outcome rather than a zero. A
 * group streak would have to come out of completion.js over cycles, which is a
 * different number and a different piece of work.
 */
ok(
  'the card reports the run behind it',
  /data-hook="rail-streak"/.test(rail) && /streakOf\(goal, dayIndex, new Date\(\)\)/.test(rail),
)
ok(
  'and how far into today it is',
  /counted && count > 0/.test(rail) && /t\('goal\.today_count'/.test(rail),
  '2 of 3 is a started day, and the card should say so',
)
ok(
  'reading the same index the rest of the app reads',
  /dayIndex=\{dayIndex\}/.test(goalsPage),
  'a second source for the streak would disagree with the detail page',
)
ok(
  'and colour is not the only signal',
  /aria-pressed=\{done\}/.test(rail) &&
    /done \? t\('goal\.done_today'\) : t\('goal\.mark_today'\)/.test(rail),
  '1.4.1: the word and the pressed state carry it without the pink',
)
ok(
  'a counter is done only when it reaches its target',
  /const done = counted \? count >= target : a\.outcome === 'done'/.test(rail),
  'colouring 2 of 3 as finished is the card lying about the number on it',
)

/**
 * THE BANNER IS TYPE ON THE PAGE, NOT A CARD.
 *
 * It was a `lg` sheet, which put a white rectangle directly above a column of
 * white rectangles and made the daily question look like the first goal in the
 * list. Measured in Chromium at 430 and 1024 after the change: background
 * rgba(0,0,0,0), no shadow, no class list at all on the wrapper.
 */
ok(
  'the check-in banner has no card round it',
  /data-hook="checkin-banner"[\s\S]{0,200}/.test(goalsPage) &&
    !/className="lg overflow-hidden px-5 py-4"\s*\n\s*data-hook="checkin-banner"/.test(goalsPage) &&
    !/<div\s*\n\s*className="lg[^"]*"\s*\n\s*data-hook="checkin-banner"/.test(goalsPage),
  'a white rectangle above a column of white rectangles is another goal card',
)

/**
 * AND THE SLIDE IS SHAPED LIKE A NUDGE CARD, WITH VALIDATE AT THE BOTTOM.
 *
 * "un peu comme les notifications dans le groupe": heading, a grey line under
 * it, the control, one full-width action. What it replaces is dialog chrome, a
 * bordered header and a bordered footer holding Precedent and Suivant, which
 * made a small card read as a wizard and made the button that RECORDS the
 * answer look like the one that skips it.
 *
 * Measured at 430 and 1024: the action spans 88% and 81% of the sheet, which
 * is its full width inside px-6, and there are zero divider rules left.
 */
ok(
  'the slide action is full width, like the nudge card it is modelled on',
  /data-hook="carousel-next"[\s\S]{0,200}className="btn-primary press w-full"/.test(carousel),
)
ok(
  'and it says what pressing it does',
  /t\('checkin\.validate'\)/.test(carousel) &&
    /'checkin\.validate': 'Valider'/.test(read('src/lib/i18n.jsx')) &&
    /'checkin\.validate': 'Confirm'/.test(read('src/lib/i18n.jsx')),
  '"Suivant" describes paging, not answering',
)
ok(
  'back only exists once there is somewhere to go back to',
  /\{i > 0 && \(/.test(carousel) && !/disabled=\{i === 0\}/.test(carousel),
  'a permanently disabled control on card one of two teaches people it does nothing',
)
ok(
  'the dialog rules are gone from the slide',
  !/border-b border-hairline px-5 py-4/.test(carousel) &&
    !/border-t border-hairline px-5 py-4/.test(carousel),
  'three rules across a card this small read as a wizard',
)
ok(
  'the goal is the heading and the question is the line under it',
  /data-hook="carousel-title"[\s\S]{0,120}goal\.commitment[\s\S]{0,400}t\('checkin\.carousel_q'\)/.test(carousel),
  'the goal is what somebody is looking for, so it goes first',
)
ok(
  'and the French question is a question rather than a dangling colon',
  !/'checkin\.carousel_q': 'As-tu realise :'/.test(read('src/lib/i18n.jsx')),
  'the colon introduced the goal, which now sits above it',
)
ok('and it opens a carousel', /data-hook="checkin-carousel"/.test(carousel))
ok(
  'which asks one goal at a time',
  /data-hook="carousel-title"/.test(carousel) && /goals\[Math\.min\(i, goals\.length - 1\)\]/.test(carousel),
  'a list in a modal is the old screen with a scrim on it',
)
ok(
  'the cards carry no daily controls any more',
  !/checkinFor/.test(goalsPage) && !/footer=\{/.test(goalsPage),
  'that is the clutter this round removed',
)
ok(
  'and GoalCard still offers the slot, unused, rather than growing the job back',
  /footer = null,/.test(gcard),
)
ok(
  'the carousel saves nothing itself',
  !/supabase|enqueue/.test(carousel),
  'submit_checkin upserts the whole item list, so only the page can write it',
)

/**
 * THE ONE THAT WOULD HAVE DESTROYED DATA SILENTLY, AND STILL APPLIES.
 *
 * submit_checkin upserts on (cycle_id, user_id) and carries the whole item
 * list. The existing check-in has to be READ before anything is written, and
 * the payload built from every answered goal, or a save deletes what was there
 * with no error anywhere.
 */
ok(
  'the existing check-in is read before anything is written',
  /from\('checkins'\)[\s\S]{0,200}checkin_items\(goal_id/.test(goalsPage),
  'starting from an empty map means the first save deletes what was there',
)
ok(
  'and the payload is built from every answered goal',
  /const items = live\s*\n\s*\.filter\(\(g\) => current\[g\.id\]\)/.test(goalsPage),
)
/**
 * THE ANSWERS COME FROM A REF, AND THAT IS NOT A STYLE CHOICE.
 *
 * The carousel advances on a timer so a tapped chip has a moment to show as
 * pressed. That timer's closure holds the `onDone` it was handed at click
 * time, which closed over the answers as they were BEFORE the tap. On the last
 * card that is the save, so the goal somebody had just answered was the one
 * missing from the payload, every time.
 *
 * Nothing looked wrong: the celebration played, the modal closed, and the
 * request went out with every OTHER answer in it. It was found by reading the
 * request body. A ref cannot go stale from any closure of any age.
 */
ok(
  'the save reads a ref rather than the state it closed over',
  /const current = answersRef\.current/.test(goalsPage) &&
    /answersRef\.current = next/.test(goalsPage),
  'a timer-driven save loses the answer that started the timer',
)
ok(
  'and the hydrate seeds the ref too',
  /answersRef\.current = seeded/.test(goalsPage),
  'otherwise the first save posts only what was typed this session',
)

/* --- the card is a card ------------------------------------------------- */

ok(
  'the four management actions are behind one control',
  /data-hook="goal-menu"/.test(gcard) && /data-hook="goal-menu-items"/.test(gcard),
  'three filled pills and a red word at the bottom of every card is a settings screen',
)
ok(
  'the loud row is gone',
  !/goal-action-soft press[\s\S]{0,200}goal-action-done press/.test(gcard),
)
/**
 * THE ACTIONS EXPAND THE CARD. THEY ARE NOT A LAYER OVER IT.
 *
 * Three rounds landed here and the last one deletes the other two. They were
 * `absolute right-0 z-50` inside a card carrying overflow-hidden, so they were
 * painted and then clipped away: measured in Chromium at 430 and 1024, all
 * four items unreachable on the first card, and on the last card the menu sat
 * at top -400, entirely off screen. Then they were portalled to the body and
 * placed from the button's rect, which worked and cost a scrim, a measured
 * position, a flip, a scroll listener and a tab-bar floor.
 *
 * All of that machinery existed to hold a floating layer in the right place.
 * The rows are part of the card now, so there is no layer: nothing to
 * position, nothing to dismiss, nothing to re-measure on scroll, and nothing
 * an ancestor can clip, because no positioned element is left to clip.
 *
 * These assertions are the ones that keep it that way. Each of the three
 * previous designs fails at least one.
 */
ok(
  'the actions are rendered inside the card, not into the body',
  !/createPortal\(/.test(gcard) && !/document\.body/.test(gcard),
  'a portal is the design this replaced; it needed five other things to hold it up',
)
ok(
  'and are not positioned at all, so overflow-hidden cannot reach them',
  !/position: 'fixed'/.test(gcard) && !/data-hook="goal-menu-items"[\s\S]{0,300}absolute/.test(gcard),
  'the clipping bug and the off-screen bug were both position bugs',
)
ok(
  'no scrim, because there is no layer to dismiss',
  !/fixed inset-0/.test(gcard),
)
ok(
  'nothing re-measures on scroll',
  !/addEventListener\('scroll'/.test(gcard) && !/getBoundingClientRect\(\)[\s\S]{0,200}floor/.test(gcard),
  'the rows move with the card because they are in it',
)
ok(
  'the control sits at the top of the card',
  /data-hook="goal-menu"[\s\S]{0,400}absolute right-3 top-3/.test(gcard),
  'asked for: the dots at the top rather than under everything',
)
ok(
  'and is a sibling of the header rather than nested in it',
  /data-hook="goal-menu"[\s\S]{0,600}<\/button>\s*\n\s*\)\}/.test(gcard),
  'the header is a real button, so a control inside it would be a button in a button',
)
ok(
  'the header leaves room for it',
  /showControls && !finished \? 'pr-10' : ''/.test(gcard),
  'without it a long title runs under a control it cannot see',
)
ok(
  'the expanded rows are tied to the control for a screen reader',
  /aria-expanded=\{menu\}/.test(gcard) &&
    /aria-controls=\{`goal-actions-\$\{goal\.id\}`\}/.test(gcard) &&
    /id=\{`goal-actions-\$\{goal\.id\}`\}/.test(gcard),
  'aria-haspopup="menu" described a popup, and there is no popup any more',
)
ok(
  'and delete is separated from the three that can be undone',
  /border-t border-hairline[^"]*text-negative|text-negative[^"]*border-t border-hairline/.test(gcard),
)
ok(
  'only goals due today are asked',
  /dueOn\(live\.filter/.test(goalsPage),
  'a twice-a-week goal on a Thursday is not a question today can answer',
)
ok(
  'and only while the period is open',
  /phase === 'open'/.test(goalsPage),
)
ok(
  'the away button is on the page, not in the carousel',
  /data-hook="goals-away"/.test(goalsPage) && !/goals-away/.test(carousel),
)

/* --- a date nobody set is not "Invalid Date" ---------------------------- */

ok(
  'shortDate refuses a missing or unparseable date',
  /if \(!iso\) return null/.test(read('src/lib/time.js')) &&
    /Number\.isNaN\(d\.getTime\(\)\)/.test(read('src/lib/time.js')),
  'new Date(undefined) formats as the literal words "Invalid Date"',
)
ok(
  'and the card says something else instead of "by" with nothing after it',
  /: t\('goal\.once'\)/.test(gcard),
  'a due date is optional on a one-off, so the missing case is ordinary',
)

/* --- and where proof and praise ended up -------------------------------- */

/**
 * These five used to read Checkin.jsx, asserting that the goals pane, the
 * Submit, the away button and their leftover identifiers had gone from it. The
 * file is deleted now, which subsumes all of them: its absence is asserted up
 * with the Bravo block.
 *
 * What replaces them is the other half of that move. The two jobs the screen
 * was carrying had to land somewhere, and "the page is gone" is only half an
 * answer. These check they arrived.
 */
ok(
  'the proof strip is on the goals page',
  /data-hook="goals-proof"/.test(goalsPage) &&
    /<ProofGallery groupId=\{groupId\}/.test(goalsPage),
)
ok(
  'with the full grid still one link away',
  /data-hook="goals-proof-all"/.test(goalsPage) && /\/proofs`/.test(goalsPage),
  '/proofs already existed behind the same link from the tab that is gone',
)
ok(
  'and the compliment is there, behind a button rather than open',
  /data-hook="goals-celebrate-open"/.test(goalsPage) && /<CelebrateStep/.test(goalsPage),
  'a face row and a textarea between the goals and the archive, every day, unasked',
)
ok(
  'both are group-only, because both read a group',
  (goalsPage.match(/\{groupId && \(/g) ?? []).length >= 2,
  'group_proofs is a group view and celebrate() posts to a group',
)
ok(
  'the strip refreshes when the carousel attaches a photo',
  /setProofTick\(\(n\) => n \+ 1\)/.test(goalsPage),
  'it loads once on mount, which is the whole of "my photo did not appear"',
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
