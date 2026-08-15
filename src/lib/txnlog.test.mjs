/**
 * node src/lib/txnlog.test.mjs
 *
 * The assertions that matter are the ones about an update with nothing
 * visible in it. The trigger fires on any write, including one touching a
 * column this drawer does not render, and a line saying "modified" with
 * nothing underneath reads as the app having lost the detail.
 */
import { ACTIONS, FIELDS, isRealChange, logCount, readLog, valueShape } from './txnlog.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\ntxnlog')

const row = (action, changes, at) => ({ id: `l-${at}`, action, changes, at })

/* --- the shape ---------------------------------------------------------- */
eq('three actions', ACTIONS, ['created', 'updated', 'deleted'])
ok('amount is read first', FIELDS[0] === 'amount_cents')
ok('no id or user in the diff', !FIELDS.includes('id') && !FIELDS.includes('user_id'))
ok('no created_at, which never changes', !FIELDS.includes('created_at'))

/* --- readLog ------------------------------------------------------------ */
{
  const rows = [
    row('created', [], '2026-08-10T10:00:00Z'),
    row('updated', [{ field: 'amount_cents', from: 5000, to: 4500 }], '2026-08-14T09:00:00Z'),
    row('updated', [{ field: 'note', from: null, to: 'café' }], '2026-08-12T09:00:00Z'),
  ]
  const out = readLog(rows)
  eq('all three survive', out.length, 3)
  eq('newest first', out.map((r) => r.at.slice(0, 10)), ['2026-08-14', '2026-08-12', '2026-08-10'])
  eq('the diff comes through', out[0].changes[0].from, 5000)
  eq('and the action', out[2].action, 'created')
}
{
  const out = readLog([row('updated', [], '2026-08-14T09:00:00Z')])
  eq('an update with nothing visible is dropped', out.length, 0)
}
{
  const out = readLog([
    row('created', [], '2026-08-10T10:00:00Z'),
    row('deleted', [], '2026-08-15T10:00:00Z'),
  ])
  eq('created and deleted survive with no diff, because the action is the news', out.length, 2)
  eq('and deleted is on top', out[0].action, 'deleted')
}
{
  const out = readLog([row('vandalised', [{ field: 'note', from: 'a', to: 'b' }], '2026-08-14T09:00:00Z')])
  eq('an action we do not know is not rendered', out.length, 0)
}
{
  const out = readLog([
    row('updated', [{ field: 'secret_column', from: 1, to: 2 }], '2026-08-14T09:00:00Z'),
  ])
  eq('a field outside FIELDS is not rendered', out.length, 0)
}
{
  const mixed = [{ field: 'note', from: 'a', to: 'b' }, { field: 'amount_cents', from: 1, to: 2 }]
  const out = readLog([row('updated', mixed, '2026-08-14T09:00:00Z')])
  eq('changes are put in reading order, amount first', out[0].changes.map((c) => c.field), ['amount_cents', 'note'])
}
{
  // jsonb arrives parsed from Postgres, but a driver or an old row may not.
  const out = readLog([row('updated', '[{"field":"note","from":null,"to":"x"}]', '2026-08-14T09:00:00Z')])
  eq('a stringified diff is parsed', out.length, 1)
  eq('and read correctly', out[0].changes[0].to, 'x')
}
{
  const out = readLog([row('updated', 'not json at all', '2026-08-14T09:00:00Z')])
  eq('unparseable json is dropped, not thrown on', out.length, 0)
}
{
  eq('nothing at all is nothing', readLog([]), [])
  eq('junk rows do not throw', readLog([null, undefined, {}, 42]).length, 0)
}
{
  const out = readLog([row('created', null, '2026-08-10T10:00:00Z')])
  eq('a null diff on a created row is fine', out.length, 1)
  eq('and reads as no changes', out[0].changes, [])
}
{
  // created_at as the column name, which is what a hand-written row may use.
  const out = readLog([{ id: 'x', action: 'created', changes: [], created_at: '2026-08-10T10:00:00Z' }])
  eq('created_at is accepted as the timestamp', out.length, 1)
  eq('and carried through', out[0].at, '2026-08-10T10:00:00Z')
}
{
  const out = readLog([
    { id: 'a', action: 'created', changes: [], at: 'not a date' },
    row('deleted', [], '2026-08-15T10:00:00Z'),
  ])
  eq('an unparseable timestamp still renders', out.length, 2)
  ok('and sorts last rather than throwing', out[0].action === 'deleted')
}

eq('logCount counts what will be drawn', logCount([
  row('created', [], '2026-08-10T10:00:00Z'),
  row('updated', [], '2026-08-11T10:00:00Z'),
]), 1)

/* --- valueShape --------------------------------------------------------- */
eq('money stays cents for the caller to format', valueShape('amount_cents', 4500), { tag: 'money', value: 4500 })
eq('a string amount is coerced', valueShape('amount_cents', '4500').value, 4500)
eq('a date is cut to the day', valueShape('happened_on', '2026-08-14T00:00:00Z'), { tag: 'date', value: '2026-08-14' })
eq('a boolean', valueShape('excluded', true), { tag: 'bool', value: true })
eq('the string "true" too, because jsonb round trips', valueShape('excluded', 'true').value, true)
eq('false is a value, not an absence', valueShape('excluded', false), { tag: 'bool', value: false })
eq('a category is a term to translate', valueShape('category', 'food'), { tag: 'term', value: 'food' })
eq('a kind is too', valueShape('kind', 'income'), { tag: 'term', value: 'income' })
eq('a note is text', valueShape('note', 'café'), { tag: 'text', value: 'café' })
eq('null is empty, not an empty string', valueShape('note', null), { tag: 'empty', value: null })
eq('undefined is empty', valueShape('note', undefined).tag, 'empty')
eq('whitespace is empty', valueShape('note', '   ').tag, 'empty')
eq('emotions come back as a list', valueShape('emotions', ['gift']), { tag: 'emotions', value: ['gift'] })
eq('an empty emotions array is empty, not an empty list', valueShape('emotions', []).tag, 'empty')
eq('a non-array in emotions is empty', valueShape('emotions', 'gift').tag, 'empty')

/* --- isRealChange ------------------------------------------------------- */
ok('a real edit is real', isRealChange({ field: 'amount_cents', from: 5000, to: 4500 }))
ok('nothing to nothing is not', !isRealChange({ field: 'note', from: null, to: '' }))
ok('nothing to something is', isRealChange({ field: 'note', from: null, to: 'café' }))
ok('something to nothing is', isRealChange({ field: 'note', from: 'café', to: null }))
ok('the same value twice is not', !isRealChange({ field: 'amount_cents', from: 4500, to: 4500 }))
ok('false to true is', isRealChange({ field: 'excluded', from: false, to: true }))
ok('the same list twice is not', !isRealChange({ field: 'emotions', from: ['gift'], to: ['gift'] }))
ok('a changed list is', isRealChange({ field: 'emotions', from: ['gift'], to: ['gift', 'stress'] }))
ok('junk is not a change', !isRealChange(null) && !isRealChange({}))

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
