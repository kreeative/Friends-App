import { errorText, isMissingColumn, isNetworkError } from './dberr.js'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// ---- a column the database has never heard of --------------------------------
// The shape PostgREST actually returns when the app knows about a field a
// migration has not added yet. This is the one that is recoverable.
const pgrst204 = {
  code: 'PGRST204',
  message: "Could not find the 'proof_type' column of 'goals' in the schema cache",
  details: null,
  hint: null,
}
eq('PGRST204 is a missing column',  isMissingColumn(pgrst204), true)
eq('and it names the column',       isMissingColumn(pgrst204, 'proof_type'), true)
// Checked by name, so a missing column nobody expected is not quietly treated
// as the one we were ready to drop.
eq('a different column does not match', isMissingColumn(pgrst204, 'link_url'), false)

const pg42703 = { code: '42703', message: 'column "proof_type" of relation "goals" does not exist' }
eq('42703 is a missing column', isMissingColumn(pg42703), true)
eq('and names it too',          isMissingColumn(pg42703, 'proof_type'), true)

eq('a permission error is not', isMissingColumn({ code: '42501', message: 'permission denied for table goals' }), false)
eq('a constraint is not',       isMissingColumn({ code: '23514', message: 'violates check constraint' }), false)
eq('nothing is not',            isMissingColumn(null), false)
// A network failure must never be mistaken for this, or the retry strips a
// field for no reason and fails again identically.
eq('a network failure is not a missing column', isMissingColumn({ message: 'TypeError: Load failed' }), false)

// ---- the request never arrived ------------------------------------------------
// One message per engine, all meaning the same thing.
eq('Safari',  isNetworkError({ message: 'TypeError: Load failed' }), true)
eq('Chrome',  isNetworkError({ message: 'TypeError: Failed to fetch' }), true)
eq('Firefox', isNetworkError({ message: 'NetworkError when attempting to fetch resource.' }), true)
eq(
  'and the details supabase-js adds',
  isNetworkError({ message: 'x', details: 'Request failed due to network error' }),
  true,
)
eq('a real refusal is not a network error', isNetworkError(pgrst204), false)
eq('nor is a constraint',  isNetworkError({ code: '23514', message: 'violates check constraint' }), false)
eq('nothing is not',       isNetworkError(null), false)

// ---- what goes on screen ------------------------------------------------------
// The code is the difference between somebody who can search for their problem
// and somebody who can only describe a colour.
eq(
  'the code leads',
  errorText(pgrst204),
  "[PGRST204] Could not find the 'proof_type' column of 'goals' in the schema cache",
)
eq(
  'the hint is kept, because it is written for exactly this moment',
  errorText({ code: '42P16', message: 'cannot change name of view column', hint: 'Use ALTER VIEW instead.' }),
  '[42P16] cannot change name of view column Use ALTER VIEW instead.',
)
// PostgREST often repeats the message inside details, and the same sentence
// printed twice reads as a rendering fault.
eq('repeats collapse', errorText({ message: 'same', details: 'same' }), 'same')
eq('and case-insensitively', errorText({ message: 'Same', details: 'same' }), 'Same')
eq('no code is fine',  errorText({ message: 'plain' }), 'plain')
eq('nothing is empty', errorText(null), '')
eq('an empty error is empty', errorText({}), '')

// supabase-js puts the whole stack in details on a network failure. Four
// frames of bundler URLs is not more information, it is the same information
// with the useful part pushed off the screen.
const withStack = {
  message: 'TypeError: Failed to fetch',
  details:
    'TypeError: Failed to fetch\n    at http://localhost:5199/node_modules/.vite/deps/x.js?v=1:19812:23\n    at async save (http://localhost:5199/src/components/GoalForm.jsx:328:25)',
}
eq('the trace is dropped', errorText(withStack), 'TypeError: Failed to fetch')
eq('a bare frame yields nothing', errorText({ message: '   at async save (http://x/y.js:1:2)' }), '')
eq('a real multi-line message keeps its first line', errorText({ message: 'first line\nsecond line' }), 'first line')

// Long enough and it has stopped being a message.
const long = errorText({ message: 'x'.repeat(500) })
eq('a wall of text is cut', long.length <= 220, true)
eq('and says it was cut',   long.endsWith('…'), true)
eq('a short one is untouched', errorText({ message: 'short' }), 'short')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
