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
  ['src/pages/Checkin.jsx', /className="text-safe text-h2 text-ink"/, 'the check-in list'],
  ['src/components/DayRecap.jsx', /className="text-safe flex-1 text-body/, 'the daily recap'],
  ['src/components/TodayObjective.jsx', /className="text-safe mt-1\.5 text-h2/, "today's objective"],
]
for (const [file, re, what] of surfaces) {
  ok(`${what} contains the commitment`, re.test(read(file)), file)
}

/* WeekStrip is the exception and it is correct: it truncates to a single line
   rather than wrapping, which contains the text by a different route. Asserted
   so that removing the truncate is noticed. */
ok(
  'the week strip truncates instead, which is also containment',
  /min-w-0 flex-1 truncate/.test(read('src/components/WeekStrip.jsx')),
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
