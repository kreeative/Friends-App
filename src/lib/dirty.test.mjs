/**
 * node src/lib/dirty.test.mjs
 *
 * "Si rien n'a changé, le bouton enregistrer reste grisé": the comparison
 * every save button waits on (src/lib/dirty.js).
 */
import { readFileSync } from 'node:fs'
import { changed, same } from './dirty.js'

let pass = 0
let fail = 0
const ok = (name, cond) => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}`)
  }
}

console.log('\nsave waits for a change')

const saved = { first_name: 'Kee', school: null, weekly_hours: 6, level: 'uni_2', term_start: '2026-09-02', types: ['mcq', 'short'] }
ok('an untouched form has nothing to save', !changed(saved, { ...saved }))
ok('a number typed in a field is the number saved', same({ weekly_hours: 6 }, { weekly_hours: '6' }))
ok('spaces round a word change nothing', same({ first_name: 'Kee' }, { first_name: '  Kee ' }))
ok('an empty field is the empty value saved', same({ school: null }, { school: '' }) && same({ school: undefined }, { school: '' }))
ok('the same set ticked in another order is the same', same({ types: ['mcq', 'short'] }, { types: ['short', 'mcq'] }))
ok('an empty list is no list', same({ chapters: [] }, {}))
ok('a real edit is a change', changed(saved, { ...saved, first_name: 'Anne-Kelly' }))
ok('so is clearing a field', changed(saved, { ...saved, term_start: '' }))
ok('so is a number moved', changed(saved, { ...saved, weekly_hours: '7' }))
ok('so is a choice added to a set', changed(saved, { ...saved, types: ['mcq', 'short', 'tf'] }))
ok('a switch turned on is a change', changed({ unknown: false }, { unknown: true }))
ok('a list of rows keeps its order', changed([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }]))
ok('zero is a value, not an empty field', changed({ n: null }, { n: 0 }))
ok('dates compare by the moment', same({ at: new Date('2026-10-25T14:00:00Z') }, { at: '2026-10-25T14:00:00.000Z' }))

/**
 * EVERY SAVE THAT EDITS SOMETHING SAVED WAITS ON IT, IN THE SOURCE.
 *
 * Read off the files rather than trusted to memory: each of these buttons is
 * found by its data-hook, and the tag that carries it must name its gate in
 * `disabled`. A form that forgets is a Save that works on an untouched form,
 * which is what Kee asked to be rid of "partout dans l'app". Measured in
 * Chromium as well (grey as it opens, live after an edit, grey again once it
 * is undone or saved); this keeps the next form from being written without.
 */
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const tagOf = (text, hook) => {
  const at = text.indexOf(`data-hook="${hook}"`)
  if (at < 0) return null
  const open = text.lastIndexOf('<', at)
  const close = text.indexOf('>', at)
  return text.slice(open, close + 1)
}
const GATES = [
  ['components/GoalForm.jsx', 'goal-save', 'untouched'],
  ['pages/Calendar.jsx', 'event-save', 'changed('],
  ['pages/Calendar.jsx', 'cal-period-save', 'reconcile('],
  ['components/TimetableWizard.jsx', 'wiz-save', 'title.trim()'],
  ['components/TransactionSheet.jsx', 'txn-save', 'changed('],
  ['pages/Money.jsx', 'plan-save', 'changed('],
  ['components/MoodToday.jsx', 'mood-save', 'changed('],
  ['components/CyclePanel.jsx', 'cycle-setup-save', 'changed('],
  ['components/ProofEditSheet.jsx', 'proof-edit-save', 'untouched'],
  ['components/ShareChoices.jsx', 'share-save', 'changed('],
  ['components/ReminderSettings.jsx', 'water-serving-save', 'servingChanged'],
  ['bb/course/Exams.jsx', 'bb-exam-save', 'dirty'],
  ['bb/course/Blueprint.jsx', 'bb-bp-save', 'changed('],
  ['bb/pages/Profile.jsx', 'bb-prof-save', 'changed('],
]
for (const [file, hook, gate] of GATES) {
  const tag = tagOf(src(file), hook) ?? ''
  const disabled = tag.match(/disabled=\{([\s\S]*?)\}\s*(?:className|data-hook|onClick|type|\/?>)/)?.[1] ?? ''
  ok(`${hook}: grey until there is something to save (${gate})`, disabled.includes(gate))
}
const exams = src('bb/course/Exams.jsx')
ok('an exam being added is itself the change', /const dirty = [^\n]*adding \|\| changed\(initial, draft\)/.test(exams))
ok('the blueprint form can be left without saving', /data-hook="bb-bp-cancel"/.test(src('bb/course/Blueprint.jsx')))

/* And grey is grey everywhere: #52525B on #E4E4E7, not the live colour faded. */
const css = src('index.css')
const rule = css.match(/:root :is\(([^)]*)\):disabled \{([^}]*)\}/)
ok('one disabled rule covers every button family', Boolean(rule) && ['.btn', '.btn-primary', '.btn-ghost', '.goal-action-done', '.goal-action-soft'].every((c) => rule[1].split(',').map((s) => s.trim()).includes(c)))
ok('it paints #E4E4E7 with #52525B words, at full opacity', Boolean(rule) && /background: rgb\(228 228 231\)/.test(rule[2]) && /color: rgb\(82 82 91\)/.test(rule[2]) && /opacity: 1/.test(rule[2]))

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
