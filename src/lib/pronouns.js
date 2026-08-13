/**
 * Which words to use about somebody.
 *
 * The app writes sentences about people who are not reading them: "Rue will
 * see it when they open the app", "Milo missed their goal". Until now every
 * one of those was hard-coded to they/them, which is the right default and is
 * not an answer for somebody who has told you otherwise.
 *
 * WHY THE DEFAULT STAYS they/them.
 *
 * It is correct for a person who has not said, and it is the only option that
 * cannot be wrong about somebody. A name does not tell you what to call them,
 * so guessing from one is how the app misgenders a real person in a way the
 * neutral default never does. "Prefer not to say" resolves here too: somebody
 * declining the question has still not asked to be called anything else.
 *
 * WHAT IS STORED.
 *
 * The display string itself, "they/them", "she/her", "ze/hir", rather than a
 * code with a lookup table. Two reasons: it is what a person would write, and
 * it means a set this file has never heard of still renders correctly on their
 * profile even though the grammar helpers fall back. A column of codes would
 * need a migration every time somebody used a set nobody had thought of.
 *
 * Pure and importless, so the grammar is testable without a browser.
 */

/** The one everything falls back to. */
export const FALLBACK = 'they/them'

/** What the picker offers, in order. `custom` is a free text box. */
export const PRONOUN_OPTIONS = ['they/them', 'she/her', 'he/him', 'custom', 'none']

/** Somebody who answered the question by declining it. */
export const DECLINED = 'none'

/**
 * The five forms English actually needs, for the sets it can inflect.
 *
 * `plural` is about verb agreement, not about number: "they open" against "she
 * opens". It is the thing a caller cannot work out from the pronoun alone and
 * the thing that makes a sentence read as written by a person.
 */
const SETS = {
  'they/them': {
    subject: 'they',
    object: 'them',
    possessive: 'their',
    possessivePronoun: 'theirs',
    reflexive: 'themselves',
    plural: true,
  },
  'she/her': {
    subject: 'she',
    object: 'her',
    possessive: 'her',
    possessivePronoun: 'hers',
    reflexive: 'herself',
    plural: false,
  },
  'he/him': {
    subject: 'he',
    object: 'him',
    possessive: 'his',
    possessivePronoun: 'his',
    reflexive: 'himself',
    plural: false,
  },
}

const CASES = ['subject', 'object', 'possessive', 'possessivePronoun', 'reflexive']

/** The raw stored value for a profile, or null. Tolerates a bare user id. */
function stored(user) {
  const raw = typeof user === 'string' ? user : user?.pronouns
  const text = (raw ?? '').trim()
  return text || null
}

/**
 * The stored string, resolved to a set of forms.
 *
 * A custom set is met halfway. "ze/hir" gives a subject and an object that are
 * right, and the three forms it does not carry come from the neutral set
 * rather than from a guess: "zir" cannot be derived from "ze/hir" by any rule,
 * and inventing one would put a word in somebody's mouth that they did not
 * write. A third slash-separated part, "ze/hir/hirs", is taken as the
 * possessive, because that is the order people write them in.
 */
export function pronounSet(user) {
  const raw = stored(user)
  if (!raw) return SETS[FALLBACK]

  const key = raw.toLowerCase()
  if (key === DECLINED) return SETS[FALLBACK]
  if (SETS[key]) return SETS[key]

  const parts = key.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return SETS[FALLBACK]

  return {
    ...SETS[FALLBACK],
    subject: parts[0],
    object: parts[1] ?? parts[0],
    ...(parts[2] ? { possessive: parts[2], possessivePronoun: parts[2] } : {}),
    /* Anything unrecognised conjugates as a singular, which is right for every
       neopronoun in common use. The one exception is somebody typing "they"
       into the custom box, which SETS catches above. */
    plural: false,
  }
}

/**
 * One form, for one person.
 *
 * @param user      a profile, or the stored string itself
 * @param caseType  subject | object | possessive | possessivePronoun | reflexive
 */
export function getUserPronoun(user, caseType = 'subject') {
  const set = pronounSet(user)
  return set[CASES.includes(caseType) ? caseType : 'subject']
}

/** Does a verb after this pronoun take the plural form? "they open", "she opens". */
export function isPluralPronoun(user) {
  return pronounSet(user).plural
}

/**
 * What to show on a profile.
 *
 * Null rather than the fallback: a profile that has not answered should say
 * nothing, not assert they/them on somebody's behalf. Declining shows nothing
 * either, which is the whole of what declining means.
 */
export function pronounLabel(user) {
  const raw = stored(user)
  if (!raw || raw.toLowerCase() === DECLINED) return null
  return raw
}
