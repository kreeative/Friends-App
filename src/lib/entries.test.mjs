import { SNIPPET_MAX, entryKind, isEmptyEntry, snippet, wasEdited, wasTrimmed } from './entries.js'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

const ink = { v: 1, w: 1000, h: 620, strokes: [{ t: 'pen', c: '#000', s: 3, p: [[0, 0, 1]] }] }
const blank = { v: 1, w: 1000, h: 620, strokes: [] }

// ---- snippets ---------------------------------------------------------------
eq('a short entry is shown whole', snippet('Une phrase.'), 'Une phrase.')
eq('nothing is nothing',           snippet(null), '')
eq('nothing is nothing, again',    snippet(undefined), '')

// The reason this is not line-clamp: a journal entry written in paragraphs is
// mostly newlines, and a card of newlines is a card showing nothing.
eq('newlines collapse', snippet('Deux\n\nlignes'), 'Deux lignes')
eq('runs of space collapse', snippet('a     b'), 'a b')
eq('the ends are trimmed', snippet('  padded  '), 'padded')

const long = 'a'.repeat(200)
eq('a long entry is cut',      snippet(long).length <= SNIPPET_MAX + 1, true)
eq('and says it was cut',      snippet(long).endsWith('…'), true)
eq('exactly the budget is whole', snippet('b'.repeat(SNIPPET_MAX)), 'b'.repeat(SNIPPET_MAX))
eq('one over is cut',             snippet('b'.repeat(SNIPPET_MAX + 1)).endsWith('…'), true)

// Broken at a word: "reconnaissa…" reads as a fault, "reconnaissante…" reads
// as a preview.
const words = 'Trois choses pour lesquelles je suis reconnaissante aujourd’hui : la marche du matin avant que personne ne soit levé'
const s = snippet(words, 90)
eq('it breaks at a space',   s.slice(0, -1).endsWith(' '), false)
eq('and never mid-word',     words.startsWith(s.slice(0, -1)), true)
eq('and the word is whole',  words[s.length - 1] === ' ' || words[s.length - 1] === undefined, true)

// A single unbroken run must not shrink the preview to nothing.
const runOn = `short ${'x'.repeat(100)}`
eq('an unbreakable run takes the hard cut', snippet(runOn, 40).length, 41)

eq('a custom budget is honoured', snippet('hello world', 5).length <= 6, true)

// ---- did anything get lost? -------------------------------------------------
// Only the entries that genuinely continue get the fade. One that happens to
// fill the card exactly is complete, and fading it would say otherwise.
eq('a short entry loses nothing',      wasTrimmed('Une phrase.'), false)
eq('exactly the budget loses nothing', wasTrimmed('c'.repeat(SNIPPET_MAX)), false)
eq('one over loses something',         wasTrimmed('c'.repeat(SNIPPET_MAX + 1)), true)
eq('nothing loses nothing',            wasTrimmed(null), false)
// Measured after the whitespace collapses, or an entry padded with blank lines
// would claim to continue when the visible text ends.
eq('blank lines do not count', wasTrimmed(`short${'\n'.repeat(200)}`), false)

// ---- is there anything here? ------------------------------------------------
eq('an empty form is empty',        isEmptyEntry({}), true)
eq('whitespace is still empty',     isEmptyEntry({ body: '   \n ' }), true)
eq('a blank canvas is still empty', isEmptyEntry({ ink: blank }), true)
eq('text is something',             isEmptyEntry({ body: 'x' }), false)
eq('a stroke is something',         isEmptyEntry({ ink }), false)
eq('no argument is empty',          isEmptyEntry(), true)

// ---- which kind -------------------------------------------------------------
eq('typed with nothing drawn is text', entryKind({ body: 'x', mode: 'text' }), 'text')
// Even on the drawing tab: an empty canvas is not handwriting, and saving it
// as `ink` would make a card with a blank thumbnail.
eq('an empty canvas on the ink tab is still text', entryKind({ body: 'x', ink: blank, mode: 'ink' }), 'text')
eq('drawn with nothing typed is ink', entryKind({ ink, mode: 'text' }), 'ink')
// Both halves filled: the tab decides, because a drawn page with a typed title
// is handwriting and a typed page with a doodle is writing.
eq('both, on the ink tab, is ink',   entryKind({ body: 'title', ink, mode: 'ink' }), 'ink')
eq('both, on the text tab, is text', entryKind({ body: 'title', ink, mode: 'text' }), 'text')
eq('nothing at all is text',         entryKind({}), 'text')

// ---- edited -----------------------------------------------------------------
const t0 = '2026-08-13T10:00:00Z'
eq('a fresh entry is not edited', wasEdited({ created_at: t0, updated_at: t0 }), false)
// The insert default and the trigger fire microseconds apart, so an exact
// comparison called every new entry edited.
eq('a few milliseconds apart is not edited', wasEdited({ created_at: t0, updated_at: '2026-08-13T10:00:00.400Z' }), false)
eq('an hour later is edited',   wasEdited({ created_at: t0, updated_at: '2026-08-13T11:00:00Z' }), true)
eq('a missing timestamp is not', wasEdited({ created_at: t0 }), false)
eq('no entry is not',            wasEdited(null), false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
