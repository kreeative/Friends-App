/**
 * The passcode on the journal.
 *
 * WHAT THIS IS, PLAINLY.
 *
 * It is a screen, not a safe. Four digits is ten thousand combinations, which
 * is nothing to a machine, and the entries themselves are stored in plain text
 * in the database: anybody holding the database reads them regardless of what
 * is typed here. What this stops is the thing that actually happens, which is
 * somebody picking up an unlocked phone, or a person looking over a shoulder
 * while the app is open on a table. That is a real problem and this is a real
 * answer to it, and it is worth being clear that it is not the other one.
 *
 * The other one is end-to-end encryption: derive a key from the passcode and
 * encrypt each entry with it, so the server stores ciphertext and nobody
 * without the passcode can read anything. It is buildable on top of exactly
 * this file. It also means a forgotten passcode is a permanently unreadable
 * journal, with no reset, no support, no recovery, and that is a decision
 * about somebody's diary that should be theirs to make rather than a surprise
 * they discover the day they forget four digits.
 *
 * WHERE THE HASH LIVES, AND WHY NOT ON THE PROFILE.
 *
 * The obvious place is a column on `profiles`, next to the pronouns and the
 * birthday. That would be a hole. profiles_select lets anybody who shares a
 * group with you read your whole row, so the passcode hash of every person in
 * your group would be one ordinary query away, and ten thousand candidates
 * against a known hash is a loop that finishes over lunch even at two hundred
 * thousand iterations. So it lives in its own table whose select policy is
 * `user_id = auth.uid()` and nothing else: see supabase/27_journal.sql.
 *
 * WHY PBKDF2 AND NOT A PLAIN SHA.
 *
 * Because ten thousand candidates against a plain SHA-256 is a few
 * milliseconds. The iteration count is what buys the time back, and salting
 * is what stops one precomputed table covering every user of the app at once.
 * It does not make four digits strong; it makes cracking it cost something
 * rather than nothing.
 *
 * Pure and importless. Uses Web Crypto, which Node has had as a global since
 * 18, so the derivation is testable without a browser.
 */

/** Four digits, which is the iPhone shape and what people expect. */
export const PIN_LENGTH = 4

/** Wrong guesses before the keypad stops answering. */
export const MAX_ATTEMPTS = 5

/** How long it stops for. Long enough to be a wall, short enough to survive. */
export const LOCKOUT_MS = 60_000

/**
 * OWASP's floor for PBKDF2-SHA256 at the time of writing. On a phone this is
 * roughly a tenth of a second, which nobody notices once per unlock and which
 * turns ten thousand guesses into about twenty minutes of dedicated work.
 */
export const ITERATIONS = 210_000

/** 128 bits of salt. Enough that no two users share one, which is the job. */
export const SALT_BYTES = 16

/**
 * The passcodes worth a word of warning.
 *
 * Not refused. Somebody who wants 1234 has decided what this is worth to them
 * and being lectured by a notebook is worse than the risk. But a quarter of
 * all four digit codes really are on a list this short, so it is worth saying
 * once, quietly, before it is set.
 */
const WEAK = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '0123',
  '4321', '5432', '6543', '7654', '8765', '9876', '3210',
  '1212', '2020', '2021', '2022', '2023', '2024', '2025', '1004', '1122', '6969',
])

/** Digits only, and never more than fit. What a keypad can produce. */
export function normalisePin(input) {
  return String(input ?? '').replace(/\D/g, '').slice(0, PIN_LENGTH)
}

/** Is this a complete passcode? */
export function isValidPin(input) {
  const pin = normalisePin(input)
  return pin.length === PIN_LENGTH
}

/** One of the few thousand people pick first? */
export function isWeakPin(input) {
  return WEAK.has(normalisePin(input))
}

/** Is Web Crypto actually here? Not on plain http, and not in old engines. */
export function cryptoReady() {
  return Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues)
}

function toHex(bytes) {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function fromHex(hex) {
  const clean = String(hex ?? '')
  const out = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** A fresh salt, as hex, because it travels as a column and reads in a console. */
export function randomSalt() {
  const bytes = new Uint8Array(SALT_BYTES)
  globalThis.crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/**
 * The passcode, stretched.
 *
 * Returns hex rather than base64 so the stored value is the same shape as the
 * salt beside it and neither needs decoding to be compared by eye.
 */
export async function hashPin(pin, salt, iterations = ITERATIONS) {
  const bytes = new TextEncoder().encode(normalisePin(pin))
  const key = await globalThis.crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

/**
 * Compare without leaking where the difference is.
 *
 * The timing here is not the realistic attack: whoever can time this can
 * already read the hash. It costs four lines, so it is four lines rather than
 * a `===` and a paragraph explaining why the shortcut is fine.
 */
function sameHash(a, b) {
  const x = String(a ?? '')
  const y = String(b ?? '')
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return diff === 0
}

/** Everything needed to store a newly chosen passcode. */
export async function makeLock(pin, iterations = ITERATIONS) {
  const salt = randomSalt()
  return { salt, iterations, hash: await hashPin(pin, salt, iterations) }
}

/**
 * Does this passcode open that lock?
 *
 * The iteration count is read from the stored record rather than the constant,
 * so raising the constant later does not lock out everybody who set a passcode
 * before it changed.
 */
export async function verifyPin(pin, lock) {
  if (!lock?.hash || !lock?.salt) return false
  if (!isValidPin(pin)) return false
  const got = await hashPin(pin, lock.salt, lock.iterations || ITERATIONS)
  return sameHash(got, lock.hash)
}

/**
 * The keypad's own memory of going wrong.
 *
 * Kept on the device rather than on the server, which means it is clearable by
 * anybody who knows to clear it. That is the honest limit of a client-side
 * throttle and it is still worth having: the attack it stops is a person
 * standing there thumbing in guesses, and that person is not opening devtools.
 *
 * A record is `{ fails, until }`, both plain numbers, so it survives
 * JSON.stringify into storage and back with nothing to reconstruct.
 */
export function emptyAttempts() {
  return { fails: 0, until: 0 }
}

/** What the keypad should do right now. */
export function attemptState(record, now = Date.now()) {
  const fails = record?.fails ?? 0
  const until = record?.until ?? 0
  if (until > now) {
    return { locked: true, waitMs: until - now, remaining: 0 }
  }
  /* The wait has passed, so the count is spent whether or not anybody has
     written that back yet. Reporting a full slate here is what makes the
     lockout end on its own rather than on the next successful write. */
  if (until > 0) return { locked: false, waitMs: 0, remaining: MAX_ATTEMPTS }
  return { locked: false, waitMs: 0, remaining: Math.max(0, MAX_ATTEMPTS - fails) }
}

/** One more wrong guess. Returns the new record; does not mutate the old one. */
export function recordFailure(record, now = Date.now()) {
  const state = attemptState(record, now)
  /* A failure after the wait expired starts a fresh run rather than adding to
     the old one, otherwise the second lockout arrives on the first mistake. */
  const base = state.remaining === MAX_ATTEMPTS ? 0 : record?.fails ?? 0
  const fails = base + 1

  if (fails >= MAX_ATTEMPTS) return { fails, until: now + LOCKOUT_MS }
  return { fails, until: 0 }
}

/** Getting in clears the slate. */
export function clearFailures() {
  return emptyAttempts()
}

/** "in 42s", without pulling in a formatter for one string. */
export function waitSeconds(waitMs) {
  return Math.max(1, Math.ceil(waitMs / 1000))
}
