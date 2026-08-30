/**
 * node src/lib/dismissed.test.mjs
 *
 * The rules behind the cross on a notification card.
 *
 * The interesting behaviour is not "the card goes away", which any probe can
 * see. It is that the card COMES BACK at the right time: dismiss a birthday
 * card and it has to stay gone for the days before the birthday, through the
 * birthday itself, and then return next year. Get the expiry wrong in one
 * direction and the card reappears the next morning; get it wrong in the other
 * and the app silently stops mentioning one friend's birthday forever.
 *
 * Pure functions, so all of that is testable at any date without a browser and
 * without waiting a year.
 */
import {
  birthdayCard,
  isDismissed,
  prune,
  withDismissed,
} from './dismissed.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const at = (s) => new Date(s)
const iso = (s) => at(s).toISOString()

/* --- prune ---------------------------------------------------------------- */

{
  const now = at('2026-03-10T12:00:00')
  const map = {
    gone: iso('2026-03-09T00:00:00'),
    edge: iso('2026-03-10T12:00:00'),
    live: iso('2026-03-11T00:00:00'),
  }
  const out = prune(map, now)

  ok('an entry whose moment has passed is dropped', !('gone' in out))
  ok('one still ahead is kept', 'live' in out)
  /* Exactly now counts as passed. A card whose expiry is this instant has
     served its purpose, and keeping it would mean a boundary that depends on
     millisecond timing. */
  ok('exactly now counts as passed', !('edge' in out))

  ok('the input is not mutated', Object.keys(map).length === 3)

  ok('rubbish is dropped rather than kept forever',
     Object.keys(prune({ bad: 'not a date', ok: iso('2026-03-11') }, now)).join() === 'ok')

  ok('null and undefined are empty maps',
     Object.keys(prune(null, now)).length === 0 && Object.keys(prune(undefined, now)).length === 0)
}

/* --- withDismissed and isDismissed ---------------------------------------- */

{
  const now = at('2026-03-10T12:00:00')
  const one = withDismissed({}, 'a', iso('2026-03-12'), now)

  ok('a dismissed card reads as dismissed', isDismissed(one, 'a', now))
  ok('another card does not', !isDismissed(one, 'b', now))
  ok('and neither does a missing key', !isDismissed(one, '', now))

  /* The one that matters: it must still be dismissed tomorrow. */
  ok('it is still dismissed the next day', isDismissed(one, 'a', at('2026-03-11T09:00:00')))
  ok('and no longer once its moment passes', !isDismissed(one, 'a', at('2026-03-13T09:00:00')))

  ok('adding a second keeps the first',
     Object.keys(withDismissed(one, 'b', iso('2026-03-12'), now)).sort().join() === 'a,b')

  /* Writing prunes, so the map cannot grow forever on an account that uses the
     app every day for years. */
  const stale = { old: iso('2020-01-01') }
  ok('writing prunes what has expired',
     !('old' in withDismissed(stale, 'new', iso('2026-03-12'), now)))

  ok('a bad expiry does not add an entry',
     !('c' in withDismissed(one, 'c', 'whenever', now)))
}

/* --- the birthday key and its expiry -------------------------------------- */

{
  /* A birthday three days out, dismissed on the 10th. */
  const now = at('2026-03-10T12:00:00')
  const { key, until } = birthdayCard('u1', 3, now)

  ok('the key names the person and the day, not the year',
     key === 'birthday:u1:03-13', key)

  const map = withDismissed({}, key, until, now)

  /* The whole point: it stays away for the run-up AND the day itself. */
  for (const day of ['2026-03-10T23:00:00', '2026-03-11T09:00:00', '2026-03-13T22:00:00']) {
    /* The key is recomputed from each day the way the component does, so this
       tests the pairing of key and expiry rather than a string I carried. */
    const daysAway = Math.round((at('2026-03-13') - at(day.slice(0, 10))) / 86400000)
    const k = birthdayCard('u1', daysAway, at(day)).key
    ok(`still dismissed on ${day.slice(0, 10)}`, isDismissed(map, k, at(day)), k)
  }

  /* And back next year, because the entry expired rather than because the key
     changed. Same key, later date. */
  const nextYear = at('2027-03-11T09:00:00')
  ok('the key is the same next year', birthdayCard('u1', 2, nextYear).key === key)
  ok('but the card is back', !isDismissed(map, key, nextYear))

  /* Today's birthday: dismissing it must not bring it back at 23:59. */
  const today = at('2026-06-01T08:00:00')
  const t = birthdayCard('u2', 0, today)
  ok('a birthday today expires at the end of that day',
     isDismissed(withDismissed({}, t.key, t.until, today), t.key, at('2026-06-01T23:59:00')))
  ok('and is gone the morning after',
     !isDismissed(withDismissed({}, t.key, t.until, today), t.key, at('2026-06-02T07:00:00')))

  /* Crossing a year boundary: a birthday on 2 January seen from 30 December
     must key to January, not to the December still on the clock. */
  const dec = at('2026-12-30T10:00:00')
  ok('a birthday across new year keys to its own month',
     birthdayCard('u3', 3, dec).key === 'birthday:u3:01-02', birthdayCard('u3', 3, dec).key)

  /* Two people, one date, are two cards. */
  ok('the key is per person',
     birthdayCard('u1', 3, now).key !== birthdayCard('u2', 3, now).key)
}

console.log(`\ndismissed\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
