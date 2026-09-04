/**
 * node src/lib/nudgeHidden.test.mjs
 *
 * The cross on a nudge card, and when it stops applying.
 *
 * The interesting behaviour is not that the card goes away. It is that it
 * COMES BACK. tick() never raises a second nudge for somebody who is already
 * quiet, on purpose, so the row a cross hides is the same row next week and
 * the week after. Without an expiry, one tap took one friend off the rail for
 * as long as the silence lasted, and the longer they stayed quiet the more
 * permanent it got. That is the failure this file exists to keep out.
 *
 * dismissed.js already reasons this way about birthdays. These tests are the
 * same shape because it is the same mistake.
 */
import { HIDE_DAYS, openHides } from './nudgeHidden.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const NOW = new Date('2026-09-04T12:00:00Z')
/* n days before NOW, as the column stores it. */
const ago = (days) => new Date(NOW.getTime() - days * 86400000).toISOString()

/* --- the rule ------------------------------------------------------------- */

{
  const rows = [
    { nudge_id: 'today', hidden_at: ago(0) },
    { nudge_id: 'yesterday', hidden_at: ago(1) },
    { nudge_id: 'six-days', hidden_at: ago(6) },
    { nudge_id: 'eight-days', hidden_at: ago(8) },
    { nudge_id: 'a-month', hidden_at: ago(31) },
    { nudge_id: 'a-year', hidden_at: ago(365) },
  ]
  const out = openHides(rows, NOW)

  ok('a cross put there today still hides', out.includes('today'))
  ok('and yesterday', out.includes('yesterday'))
  ok('and on the sixth day, inside the week', out.includes('six-days'))

  ok('a cross from eight days ago does not', !out.includes('eight-days'))
  ok('nor one from a month ago', !out.includes('a-month'))
  ok(
    'nor one from a year ago, which is the bug',
    !out.includes('a-year'),
    'a friend removed from the rail for the rest of time',
  )
}

/* The boundary, from both sides. An off-by-one here is a card that returns a
   day early or a day late, which nobody would ever notice by looking. */
{
  const justInside = openHides(
    [{ nudge_id: 'x', hidden_at: ago(HIDE_DAYS - 0.01) }],
    NOW,
  )
  const justOutside = openHides(
    [{ nudge_id: 'x', hidden_at: ago(HIDE_DAYS + 0.01) }],
    NOW,
  )
  ok('a moment before the week is up, still hidden', justInside.length === 1)
  ok('a moment after, back on the rail', justOutside.length === 0)
}

/* --- the shapes that arrive when something is wrong ----------------------- */

{
  ok('no table at all hides nothing', openHides(null, NOW).length === 0)
  ok('an empty answer hides nothing', openHides([], NOW).length === 0)
  ok('undefined hides nothing', openHides(undefined, NOW).length === 0)

  /* A build that asked for fewer columns than it needed. Keeping the card
     hidden is the smaller mistake: showing one somebody dismissed contradicts
     them to their face, and this shape can only come from our own bug. */
  ok(
    'a row with no hidden_at is treated as still hiding',
    openHides([{ nudge_id: 'x' }], NOW).includes('x'),
  )
  ok(
    'and so is an unparseable one',
    openHides([{ nudge_id: 'x', hidden_at: 'not a date' }], NOW).includes('x'),
  )

  /* A row with no id cannot hide anything, and must not put undefined into a
     Set that is then asked whether it contains a nudge id. */
  ok(
    'a row with no nudge_id is dropped rather than passed on',
    openHides([{ hidden_at: ago(1) }, { nudge_id: 'x', hidden_at: ago(1) }], NOW)
      .every((id) => typeof id === 'string'),
  )
}

/* --- it returns ids, because that is what the caller builds a Set from ---- */

{
  const out = openHides([{ nudge_id: 'a', hidden_at: ago(1) }], NOW)
  ok('the result is a list of ids, not of rows', out[0] === 'a', JSON.stringify(out))
}

/* --- the window itself ---------------------------------------------------- */

{
  ok('the window is a week', HIDE_DAYS === 7)
  ok(
    'and it is a number of days, not milliseconds',
    HIDE_DAYS > 0 && HIDE_DAYS < 100,
    String(HIDE_DAYS),
  )
}

/* --- the default clock ---------------------------------------------------- */

{
  /* Called the way the app calls it, with no `now`. A cross written a second
     ago must still hide, or the rail would ignore the cross entirely. */
  const out = openHides([{ nudge_id: 'x', hidden_at: new Date().toISOString() }])
  ok('with no clock passed it uses the real one', out.includes('x'))
}

console.log(`\nnudge hidden\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
