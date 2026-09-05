/**
 * node src/lib/chapterText.test.mjs
 *
 * Both faults reported off one screenshot of chapter 2, and both of them are
 * one fact: the database is still holding the seed that 07 writes and 08
 * replaces. The tests that matter are the ones about NOT acting: a real
 * chapter that opens on a heading keeps it, and a real chapter that uses the
 * word placeholder in a sentence is still a real chapter.
 */
import { readFileSync } from 'node:fs'
import { FILLER_MARK, chapterText, isFiller, stripEchoedTitle } from './chapterText.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nchapterText')

/* The seed, built the way _placeholder_body() builds it. */
const SEED = `## Bandura's four sources\n\n${FILLER_MARK} in for the finished manuscript so the reader can be tested.\n\n${FILLER_MARK} in for the finished manuscript so the reader can be tested.`

/* --- the marker is the one the database actually writes ----------------- */

/**
 * Read out of the migration rather than retyped.
 *
 * If somebody edits the seed sentence in 07_books_all_in_one.sql, this test
 * fails here instead of the app silently painting filler again. A constant
 * copied by hand into two files is a constant that will disagree with itself.
 */
{
  const sql = readFileSync(new URL('../../supabase/07_books_all_in_one.sql', import.meta.url), 'utf8')
  ok('the marker is the sentence the seed writes', sql.includes(FILLER_MARK),
     `07 does not contain: ${FILLER_MARK}`)
  ok('and the seed still opens with the title as a heading',
     /'## ' \|\| chapter_title/.test(sql),
     'if this changed, the duplicate title has a different cause')
}

/* --- isFiller ------------------------------------------------------------ */

eq('the seed is filler', isFiller(SEED), true)
eq('a manuscript is not', isFiller('Bandura had four sources, and one does the work.'), false)
eq('nothing is not', isFiller(''), false)
eq('null is not', isFiller(null), false)
eq('undefined is not', isFiller(undefined), false)
/* The long phrase, not the bare word. A chapter about writing may well say
   "placeholder" in a sentence, and losing a real chapter to that would be a
   worse bug than the one this fixes. */
eq('a chapter that merely uses the word is not filler',
   isFiller('Every habit tracker is a placeholder for the thing you meant to do.'), false)

/* --- stripEchoedTitle ---------------------------------------------------- */

eq('the echoed title goes',
   stripEchoedTitle("## Bandura's four sources\n\nIf confidence is built.", "Bandura's four sources"),
   'If confidence is built.')
eq('at any heading level',
   stripEchoedTitle('# Chapter one\n\nBody.', 'Chapter one'), 'Body.')

/* Curly against straight. The seed concatenates the title from the database;
   a manuscript is typed by a person whose editor smartens quotes. */
eq('curly and straight apostrophes are the same heading',
   stripEchoedTitle("## Bandura’s four sources\n\nBody.", "Bandura's four sources"), 'Body.')
eq('and the other way round',
   stripEchoedTitle("## Bandura's four sources\n\nBody.", 'Bandura’s four sources'), 'Body.')
eq('case does not matter', stripEchoedTitle('## THE MOMENT AFTER\n\nBody.', 'The moment after'), 'Body.')

/* THE ONES THAT MUST NOT ACT. */
eq('a different opening heading stays',
   stripEchoedTitle('## One: enactive mastery\n\nBody.', "Bandura's four sources"),
   '## One: enactive mastery\n\nBody.')
eq('a body that opens on a paragraph is untouched',
   stripEchoedTitle('If confidence is built.\n\n## One\n\nMore.', 'Anything'),
   'If confidence is built.\n\n## One\n\nMore.')
eq('a later heading matching the title stays, because it is not the echo',
   stripEchoedTitle('Opening line.\n\n## The title\n\nMore.', 'The title'),
   'Opening line.\n\n## The title\n\nMore.')
eq('no title, no stripping', stripEchoedTitle('## Something\n\nBody.', ''), '## Something\n\nBody.')
eq('null title', stripEchoedTitle('## Something\n\nBody.', null), '## Something\n\nBody.')
eq('empty body', stripEchoedTitle('', 'A title'), '')
eq('null body', stripEchoedTitle(null, 'A title'), '')

/* --- chapterText, which is what the screen calls ------------------------- */

{
  const r = chapterText(SEED, "Bandura's four sources")
  eq('the seed renders nothing', r.text, '')
  eq('and says so', r.filler, true)
}

{
  const real = "If confidence is built rather than summoned.\n\n## One: enactive mastery\n\nYou did the thing."
  const r = chapterText(real, "Bandura's four sources")
  eq('a manuscript comes through whole', r.text, real)
  eq('and is not filler', r.filler, false)
}

{
  /* A manuscript that DOES open by repeating its title: the heading goes and
     the chapter is still a chapter. Both halves in one call, which is the
     combination the screen actually met. */
  const r = chapterText('## The moment after\n\nYou failed. Now what.', 'The moment after')
  eq('an echoed title is removed from a real chapter too', r.text, 'You failed. Now what.')
  eq('and it is still not filler', r.filler, false)
}

{
  const r = chapterText(null, 'A title')
  eq('nothing at all renders nothing', r.text, '')
  eq('and is not called filler, because it is not the seed', r.filler, false)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
