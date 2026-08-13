import {
  ITERATIONS,
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  PIN_LENGTH,
  attemptState,
  clearFailures,
  cryptoReady,
  emptyAttempts,
  hashPin,
  isValidPin,
  isWeakPin,
  makeLock,
  normalisePin,
  randomSalt,
  recordFailure,
  verifyPin,
  waitSeconds,
} from './lock.js'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// ---- what a keypad can produce ---------------------------------------------
eq('four digits is a passcode', normalisePin('1234'), '1234')
eq('letters are not digits',    normalisePin('12ab34'), '1234')
eq('spaces and dashes go',      normalisePin('1 2-3 4'), '1234')
eq('longer is truncated',       normalisePin('123456'), '1234')
eq('nothing is nothing',        normalisePin(null), '')
eq('a number works too',        normalisePin(1234), '1234')

eq('a complete passcode is valid', isValidPin('1234'), true)
eq('a short one is not',           isValidPin('123'), false)
eq('an empty one is not',          isValidPin(''), false)
eq('the length is four',           PIN_LENGTH, 4)
// Leading zeros are the case a numeric input would eat, and 0042 is a real
// passcode somebody will choose.
eq('leading zeros survive', normalisePin('0042'), '0042')
eq('and are valid',         isValidPin('0042'), true)

// ---- the ones worth a word --------------------------------------------------
eq('1234 is on the list', isWeakPin('1234'), true)
eq('0000 is on the list', isWeakPin('0000'), true)
eq('a birth year is too', isWeakPin('2024'), true)
eq('7413 is not',         isWeakPin('7413'), false)
// A warning, not a refusal: somebody who wants 1234 has decided.
eq('a weak passcode is still valid', isValidPin('1234'), true)

// ---- derivation -------------------------------------------------------------
eq('web crypto is here', cryptoReady(), true)

const salt = randomSalt()
eq('a salt is 128 bits of hex', salt.length, 32)
eq('and it is hex',             /^[0-9a-f]+$/.test(salt), true)
eq('two salts differ',          randomSalt() === randomSalt(), false)

// Fewer rounds in the test than in life: this file runs on every commit and
// the property being checked is the same at any count.
const ROUNDS = 1000

const h1 = await hashPin('1234', salt, ROUNDS)
const h2 = await hashPin('1234', salt, ROUNDS)
eq('the same passcode and salt give the same hash', h1, h2)
eq('a hash is 256 bits of hex', h1.length, 64)
eq('a different passcode gives a different hash', (await hashPin('4321', salt, ROUNDS)) === h1, false)
// The point of the salt: one precomputed table must not cover every user.
eq('a different salt gives a different hash', (await hashPin('1234', randomSalt(), ROUNDS)) === h1, false)
eq('a different count gives a different hash', (await hashPin('1234', salt, ROUNDS + 1)) === h1, false)
eq('the shipped count is OWASP-grade', ITERATIONS >= 200000, true)

// ---- locking and unlocking --------------------------------------------------
const lock = await makeLock('7413', ROUNDS)
eq('a lock carries its salt',  lock.salt.length, 32)
eq('and its count',            lock.iterations, ROUNDS)
eq('and its hash',             lock.hash.length, 64)
eq('the right passcode opens it', await verifyPin('7413', lock), true)
eq('a wrong one does not',        await verifyPin('7412', lock), false)
eq('a short one does not',        await verifyPin('741', lock), false)
eq('an empty one does not',       await verifyPin('', lock), false)
eq('no lock opens for nothing',   await verifyPin('7413', null), false)
eq('a lock with no salt is not a lock', await verifyPin('7413', { hash: 'x' }), false)

// Two locks on the same passcode must not look alike, or the database shows
// who shares a code with whom.
const twin = await makeLock('7413', ROUNDS)
eq('two locks on one passcode differ', twin.hash === lock.hash, false)
eq('but both open',                    await verifyPin('7413', twin), true)

// The count is read from the record, so raising the constant later does not
// lock out everybody who set a passcode before it moved.
eq('an old lock still opens at its own count', await verifyPin('7413', { ...lock }), true)

// ---- getting it wrong -------------------------------------------------------
const fresh = emptyAttempts()
eq('a fresh keypad answers',   attemptState(fresh, 0).locked, false)
eq('with a full slate',        attemptState(fresh, 0).remaining, MAX_ATTEMPTS)

let rec = fresh
for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) rec = recordFailure(rec, 0)
eq('four wrong guesses still answers', attemptState(rec, 0).locked, false)
eq('with one left',                    attemptState(rec, 0).remaining, 1)

rec = recordFailure(rec, 0)
eq('the fifth stops it',        attemptState(rec, 0).locked, true)
eq('and it says how long',      attemptState(rec, 0).waitMs, LOCKOUT_MS)
eq('and offers no more guesses', attemptState(rec, 0).remaining, 0)
eq('still stopped a moment before', attemptState(rec, LOCKOUT_MS - 1).locked, true)

// It ends on its own, on the clock, rather than on the next thing anybody
// writes back to storage.
eq('the wait ends by itself',  attemptState(rec, LOCKOUT_MS).locked, false)
eq('with a full slate again',  attemptState(rec, LOCKOUT_MS).remaining, MAX_ATTEMPTS)

// And the next mistake starts a fresh run, or the second lockout would land
// on the first slip after the first one expired.
const after = recordFailure(rec, LOCKOUT_MS)
eq('a slip after the wait is the first of a new run', after.fails, 1)
eq('and does not re-lock',                            attemptState(after, LOCKOUT_MS).locked, false)

eq('getting in clears the slate', clearFailures(), { fails: 0, until: 0 })
eq('recordFailure does not mutate', fresh.fails, 0)

eq('a wait reads in whole seconds', waitSeconds(60000), 60)
eq('and rounds up',                 waitSeconds(1200), 2)
eq('and never says zero',           waitSeconds(1), 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
