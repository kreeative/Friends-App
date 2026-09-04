/**
 * node src/lib/cardOverflow.test.mjs
 *
 * User-typed text must not paint outside the thing that contains it.
 *
 * WHAT WAS MEASURED, BEFORE ANY OF THIS WAS WRITTEN.
 *
 * A goal whose title is a pasted URL, rendered at a 320px card width in
 * headless Chromium:
 *
 *   title    461px outside a 296px card
 *   trigger  218px outside
 *   proof    218px outside
 *   document 749px wide inside a 360px viewport, so the whole app scrolled
 *            sideways on a phone
 *
 * The screenshot showed the text painted onto the page background, outside the
 * white card, which is exactly what was reported.
 *
 * WHAT THIS FILE CAN AND CANNOT DO.
 *
 * It cannot lay anything out. Playwright is not a dependency of this project
 * and the real check was a browser measuring painted geometry, which is what
 * CLAUDE.md asks for and what was actually done. What survives here is the
 * contract that fix depends on: the two classes exist and do the two things
 * they have to do, and every surface that prints a person's own words carries
 * one of them.
 *
 * That is a weaker test than the measurement and it is the one that runs on
 * every commit. It catches the realistic regression, which is not CSS
 * subtlety, it is somebody adding a new card or restyling an old one and not
 * knowing this rule exists.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/* The same file with its comments gone. An assertion of the form "this string
   is absent" matches the comment explaining why it is absent and then fails
   against a file that is correct. Four other suites here already carry this;
   this is the fifth, and it is declared at module scope for the same reason
   they are: a const inside a block is invisible to every block after it. */
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

console.log('\ncard overflow')

/* --- the two classes, and what they have to contain --------------------- */

const css = read('src/index.css')

const block = (name) => {
  const at = css.indexOf(`.${name} {`)
  if (at < 0) return null
  return css.slice(at, css.indexOf('}', at) + 1)
}

const textSafe = block('text-safe')
ok('.text-safe is defined', Boolean(textSafe))
ok(
  '.text-safe sets min-width 0, which is what lets a flex child shrink',
  /min-w-0/.test(textSafe ?? ''),
  'without it a title beside a chip widens the card instead of wrapping',
)
ok(
  '.text-safe permits a long word to break',
  /overflow-wrap:\s*break-word/.test(textSafe ?? ''),
  'a URL is one word, and a single word does not truncate, it spills',
)

const pillSafe = block('pill-safe')
ok('.pill-safe is defined', Boolean(pillSafe))
ok(
  '.pill-safe caps the pill at the width available',
  /max-w-full/.test(pillSafe ?? ''),
  'without it the pill sizes to its content and escapes',
)

/* The clamp lives on the inner element, because an inline-flex box cannot
   carry one. If that inner rule goes, pills silently grow unbounded again. */
const pillInner = css.slice(css.indexOf('.pill-safe > span {'), css.indexOf('}', css.indexOf('.pill-safe > span {')) + 1)
ok('.pill-safe > span exists to carry the clamp', css.includes('.pill-safe > span {'))
ok('.pill-safe > span clamps to two lines', /-webkit-line-clamp:\s*2/.test(pillInner))
ok('.pill-safe > span hides the overflow', /overflow:\s*hidden/.test(pillInner))

/* --- neither of the two things this repo has already tried --------------- */

ok(
  'no hyphens:auto, which needs a dictionary Chromium does not ship for French',
  !/hyphens:\s*auto/.test(textSafe ?? '') && !/hyphens:\s*auto/.test(pillSafe ?? ''),
)
ok(
  'no word-break:break-all, which cuts ordinary sentences at the margin',
  !/word-break:\s*break-all/.test(textSafe ?? '') && !/word-break:\s*break-all/.test(pillSafe ?? ''),
)

/* --- every surface that prints what somebody typed ---------------------- */

const card = read('src/components/GoalCard.jsx')

ok(
  'the goal card clips as a backstop',
  /overflow-hidden/.test(card),
  'so the next field somebody adds cannot paint onto the page background',
)
ok(
  'the card title is contained',
  /className="text-safe line-clamp-3 text-h2/.test(card),
  'title carries neither text-safe nor the clamp',
)

/* The three pills carry whatever went into the form, so they are the ones that
   escaped. Counted rather than matched one by one: the assertion is that none
   of them was missed, and a fourth added later has to be counted too. */
const pillCount = (card.match(/pill-safe inline-flex/g) ?? []).length
ok(`all three user-content pills are contained (found ${pillCount})`, pillCount === 3, 'expected 3')

const surfaces = [
  ['src/components/GoalDetail.jsx', /className="text-safe text-h1/, 'the expanded view, deliberately unclamped'],
  /* Checkin.jsx used to be here. It listed every goal again with the
     commitment as an h2, and that list has moved onto the goal cards, where
     GoalCard's own containment is asserted at the top of this file. The row is
     replaced below by the assertion that it does not come back uncontained. */
  ['src/components/DayRecap.jsx', /className="text-safe flex-1 text-body/, 'the daily recap'],
  ['src/components/TodayObjective.jsx', /className="text-safe mt-1\.5 text-h2/, "today's objective"],
]
for (const [file, re, what] of surfaces) {
  ok(`${what} contains the commitment`, re.test(read(file)), file)
}

/**
 * The check-in screen is gone entirely, and that is the assertion now.
 *
 * It was one of the four surfaces carrying user text. Then the check-in moved
 * onto this page and it held only proof and praise, so the assertion was that
 * it printed no commitment. Now proof and praise are sections on the goals
 * page and the file itself has been deleted, so the honest check is that it
 * has not come back: a screen re-added under that name would arrive without
 * any of this file's containment on it.
 */
ok(
  'the old check-in screen is gone rather than emptied',
  !existsSync(join(root, 'src/pages/Checkin.jsx')),
  'proof and praise are sections on the goals page now',
)
/**
 * The daily question is a carousel now, and it DOES print the commitment: one
 * goal on screen at a time, with its title as the heading. That is the one
 * place the words should appear twice, because the card is not on screen.
 *
 * So it needs containment like every other surface here. A single unbroken
 * word has nowhere to wrap; it does not truncate, it spills.
 */
/**
 * Keyed to the hook and the one class that matters, not to the whole class
 * list.
 *
 * This pinned the exact string `className="text-safe mt-1 text-h2 font-semibold
 * text-ink" data-hook="carousel-title"` and broke the moment the slide was
 * restyled, on a change that kept text-safe throughout. It reported a
 * containment failure that was not one, which is worse than reporting nothing:
 * the repo's own rule is that selectors keyed to class names have broken on
 * every restyle and told us nothing about the app when they did.
 *
 * The contract is that the element carrying carousel-title also carries
 * text-safe. That is what is asserted, in either attribute order.
 */
const carouselSrc = read('src/components/CheckinCarousel.jsx')
ok(
  'the check-in carousel contains the commitment it prints',
  /className="[^"]*\btext-safe\b[^"]*"[^>]*data-hook="carousel-title"/.test(carouselSrc) ||
    /data-hook="carousel-title"[^>]*className="[^"]*\btext-safe\b[^"]*"/.test(carouselSrc),
  'it is the heading of the card, so it is user text on a surface',
)

/* WeekStrip is the exception and it is correct: it truncates to a single line
   rather than wrapping, which contains the text by a different route. Asserted
   so that removing the truncate is noticed. */
ok(
  'the week strip truncates instead, which is also containment',
  /min-w-0 flex-1 truncate/.test(read('src/components/WeekStrip.jsx')),
)

/**
 * THE "?" PANEL CANNOT LEAVE THE PAGE.
 *
 * Reported from a phone with the sentence cut mid-word: "Nobody else can see
 * the". The panel was `absolute left-0` on the question mark itself, capped at
 * min(20rem, calc(100vw - 3rem)).
 *
 * That cap looks like it prevents overflow and does not. `100vw - 3rem` is the
 * width available to something starting at the page margin; this started at
 * the marker, which sits beside a heading and is therefore a long way in. At
 * 390px the panel's right edge measured 490.
 *
 * Choosing the other side does not fix it either: `right-0` works for a marker
 * near the right edge and breaks one near the left, and which of those it is
 * depends on how long the heading is once translated.
 *
 * So it anchors to the header, which is exactly the width of the content
 * column. left-0 right-0 there cannot leave the page in either direction, in
 * either language, at any width.
 *
 * Measured in Chromium at 390, 430 and 1180 in both languages: the painted
 * rectangle inside the viewport, nothing clipped by its own box, and the last
 * six characters painted on screen. Reverting only this pair of classes put
 * five of those assertions back to failing.
 */
{
  const ui = read('src/components/ui.jsx')

  ok(
    'the hint panel spans the header rather than hanging off the marker',
    /absolute left-0 right-0 top-full/.test(ui),
    'left-0 alone on the marker is what ran off the screen',
  )
  ok(
    'and the marker is not a positioned ancestor that would recapture it',
    /<details className="group ml-2 inline-block align-middle" data-hook="hint">/.test(ui),
    '`relative` here would anchor the panel back to the marker',
  )
  ok(
    'the header it anchors to is positioned',
    /<header className={`relative pb-2/.test(ui),
    'without this the panel escapes to whatever ancestor happens to be relative',
  )
  ok(
    'the viewport-width cap that never worked is gone',
    !/calc\(100vw-3rem\)/.test(code('src/components/ui.jsx')),
    'it measured space from the page margin, not from the marker',
  )
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
