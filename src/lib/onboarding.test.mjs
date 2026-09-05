/**
 * node src/lib/onboarding.test.mjs
 *
 * The assertions that matter are the ones about waiting. Every other branch
 * here is obvious; the flash of a welcome deck at somebody who dismissed it
 * months ago is the bug this file exists to prevent, and it only happens in
 * the moment before one of two independent fetches has landed.
 */
import { SLIDES, isSolo, landing, offerGroup, soloKeyFor } from './onboarding.js'

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

console.log('\nonboarding')

/* --- the deck ---------------------------------------------------------- */
eq('three slides', SLIDES.length, 3)
eq('no duplicates', new Set(SLIDES).size, SLIDES.length)
ok('every slide has a name to build keys from', SLIDES.every((s) => typeof s === 'string' && s.length > 2))

/* --- the local fallback key -------------------------------------------- */
ok('keyed by person', soloKeyFor('u1') !== soloKeyFor('u2'))
ok('and carries the id', soloKeyFor('u1').includes('u1'))
eq('nobody signed in, no key', soloKeyFor(null), null)
eq('nor for an empty id', soloKeyFor(''), null)

/* --- isSolo ------------------------------------------------------------ */
eq('flagged on the profile', isSolo({ solo_mode: true }), true)
eq('not flagged', isSolo({ solo_mode: false }), false)
/* A database without migration 30 returns a profile with no such key. That
   must read as "has not chosen", not as an error and not as true. */
eq('a profile from a database without the column', isSolo({ display_name: 'Ann' }), false)
eq('no profile at all', isSolo(null), false)
eq('the local fallback alone is enough', isSolo({ solo_mode: false }, true), true)
eq('and with no profile', isSolo(null, true), true)
eq('a truthy non-boolean flag does not count', isSolo({ solo_mode: 1 }), false)
eq('nor a string', isSolo({ solo_mode: 'true' }), false)

/* --- landing: the waiting cases ---------------------------------------- */
eq('still loading', landing({ loading: true }), 'wait')
eq('loading, even with everything else present', landing({ loading: true, memberships: [], profile: { solo_mode: true } }), 'wait')
eq('groups not fetched yet', landing({ memberships: null, profile: { solo_mode: false } }), 'wait')
eq('groups undefined is not groups empty', landing({ profile: { solo_mode: false } }), 'wait')

/* THE FLASH. No groups, profile still in flight. Answering 'welcome' here is
   what shows the deck to a solo user on every single load. */
eq('no groups and no profile yet is a wait, not a welcome', landing({ memberships: [], profile: null }), 'wait')

eq('called with nothing', landing(), 'wait')
eq('called with literally nothing', landing(undefined), 'wait')

/* --- landing: the real answers ----------------------------------------- */
eq('no groups, never chose', landing({ memberships: [], profile: { solo_mode: false } }), 'welcome')
eq('no groups, chose solo', landing({ memberships: [], profile: { solo_mode: true } }), 'app')
eq('no groups, chose solo, remembered locally only', landing({ memberships: [], profile: { display_name: 'Ann' }, local: true }), 'app')
eq('a database without the column shows the deck', landing({ memberships: [], profile: { display_name: 'Ann' } }), 'welcome')

eq('in a group', landing({ memberships: [{ group_id: 'g1' }], profile: { solo_mode: false } }), 'app')
eq('in three groups', landing({ memberships: [1, 2, 3], profile: { solo_mode: false } }), 'app')

/* A group outranks the flag in both directions. Somebody who was solo and
   then joined must not be sent back to the deck, and the flag going stale is
   not a reason to re-ask. */
eq('a group beats the solo flag', landing({ memberships: [{ group_id: 'g1' }], profile: { solo_mode: true } }), 'app')
eq('and beats a missing profile', landing({ memberships: [{ group_id: 'g1' }], profile: null }), 'app')
eq('and beats a stale local flag', landing({ memberships: [{ group_id: 'g1' }], profile: null, local: true }), 'app')

/* --- landing: the five questions ---------------------------------------- */
eq('signed in, never asked', landing({ memberships: [], profile: { setup_done_at: null } }), 'setup')

/* Above the deck AND above a membership. Somebody who joined through an invite
   link has a group from their first second; without this the app would never
   ask their name and would address them by their email prefix forever. */
eq('even inside a group', landing({ memberships: [{ group_id: 'g1' }], profile: { setup_done_at: null } }), 'setup')
eq('even having chosen solo', landing({ memberships: [], profile: { setup_done_at: null, solo_mode: true } }), 'setup')

eq('done, and back to the usual answers', landing({ memberships: [], profile: { setup_done_at: '2026-09-05T10:00:00Z', solo_mode: true } }), 'app')
eq('done, no group, never chose', landing({ memberships: [], profile: { setup_done_at: '2026-09-05T10:00:00Z' } }), 'welcome')

/* A database without migration 56 answers exactly as it did before this
   existed. The bundle ships before the SQL is run, every time, on purpose. */
eq('no such column, no setup', landing({ memberships: [], profile: { display_name: 'Ann' } }), 'welcome')
eq('and a member still lands in the app', landing({ memberships: [1], profile: { display_name: 'Ann' } }), 'app')

/* The profile has not arrived. Not a setup, and not a guess either way. */
eq('nothing is known about the profile yet', landing({ memberships: [1], profile: null }), 'app')

/* --- offerGroup -------------------------------------------------------- */
eq('somebody with no group is offered one', offerGroup({ memberships: [] }), true)
eq('somebody in a group is not', offerGroup({ memberships: [{ group_id: 'g1' }] }), false)
eq('not before the groups have loaded', offerGroup({ memberships: null }), false)
eq('nor with no argument', offerGroup(), false)

/* --- the whole flow, in order ------------------------------------------ */
{
  /* A first sign-in, watching both fetches land. Nothing but 'wait' may
     appear before both are in, and the answer must not change afterwards. */
  const steps = [
    landing({ loading: true }),
    landing({ memberships: null, profile: null }),
    landing({ memberships: [], profile: null }),
    landing({ memberships: [], profile: { solo_mode: false } }),
  ]
  eq('a first sign-in waits, waits, waits, then decides', steps.join(','), 'wait,wait,wait,welcome')

  /* The same person, next week, having chosen solo. The deck must never
     appear at any point in the sequence. */
  const later = [
    landing({ loading: true }),
    landing({ memberships: null, profile: null }),
    landing({ memberships: [], profile: null }),
    landing({ memberships: [], profile: { solo_mode: true } }),
  ]
  ok('a returning solo user never sees the deck', !later.includes('welcome'), later.join(','))
  eq('and lands in the app', later[later.length - 1], 'app')
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
