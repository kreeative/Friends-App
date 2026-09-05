/**
 * Which screen a signed-in person with no group should land on.
 *
 * Pure and importless, so `npm test` runs it under plain node. It is four
 * lines of logic and it is worth testing because getting it wrong is not a
 * cosmetic fault: it either traps somebody on a welcome deck they already
 * dismissed, or it flashes that deck at them on every single sign-in.
 *
 * THE RACE THIS EXISTS TO LOSE SAFELY.
 *
 * Two things arrive from the server independently: the groups you belong to,
 * from GroupContext, and your profile, from AuthContext. The decision needs
 * both. If it guesses while the profile is still in flight, a person who
 * chose solo last month gets the welcome deck for a few hundred milliseconds
 * on every load, then it vanishes. That reads as a glitch and there is no
 * amount of animation that makes it not one.
 *
 * So an unresolved profile is its own answer: wait. It is the difference
 * between a blank moment, which people read as loading, and a wrong screen,
 * which people read as broken.
 */
import { needsSetup } from './setup.js'

/**
 * The three slides.
 *
 * Named rather than numbered so the i18n keys, the dots and the aria labels
 * cannot drift apart: adding a fourth is one entry here.
 */
export const SLIDES = ['welcome', 'together', 'solo']

/**
 * Where the choice is remembered when the database cannot hold it.
 *
 * Keyed by person, not global. Two people signing in on one phone is
 * ordinary, and one of them choosing solo must not answer the question on
 * behalf of the other.
 */
export const SOLO_KEY = 'friends.solo'

export const soloKeyFor = (userId) => (userId ? `${SOLO_KEY}.${userId}` : null)

/**
 * Has this person chosen to go it alone?
 *
 * The profile column is the truth. The local flag is a fallback for exactly
 * one situation: migration 30 has not been run, so the column does not exist,
 * the write fails, and without this the app would ask the same question every
 * time it loaded and never accept the answer. See Welcome.jsx.
 *
 * `=== true` rather than truthiness, because a profile fetched from a database
 * without the column returns undefined, and undefined must mean "not chosen"
 * rather than throwing or being coerced somewhere unhelpful.
 */
export function isSolo(profile, local = false) {
  return profile?.solo_mode === true || local === true
}

/**
 * @returns 'wait'      nothing is known yet, show whatever the app shows while loading
 *          'setup'     signed in, never asked who they are: the five questions
 *          'welcome'   no group, no choice made: the deck
 *          'app'       in a group, or chose solo: the dashboard
 */
export function landing({ loading = false, memberships = null, profile = null, local = false } = {}) {
  if (loading) return 'wait'

  /**
   * The five questions, before anything else this function can answer.
   *
   * Above the memberships shortcut on purpose: somebody who arrived through an
   * invite link is in a group from their first second, and sending them
   * straight to a board would mean the app never asks their name, never asks
   * their language, and addresses them by the part of their email before the
   * @ forever. See needsSetup, which answers false for a database where
   * migration 56 has not been run, so this line cannot trap anybody.
   */
  if (profile && needsSetup(profile)) return 'setup'

  /* A group outranks everything else. Somebody who joined one has answered the
     question the deck asks, whatever any flag says, and a person who was solo
     and then joined must not be shown the welcome again. */
  if (Array.isArray(memberships) && memberships.length > 0) return 'app'

  /* Groups not loaded yet. Not "no groups". */
  if (!Array.isArray(memberships)) return 'wait'

  /* No groups, and the profile has not arrived. This is the flash. */
  if (!profile) return 'wait'

  return isSolo(profile, local) ? 'app' : 'welcome'
}

/**
 * Should Settings offer a way back into having a group?
 *
 * Only to somebody who has none. Offering "create or join a group" to a person
 * who is already in three is offering them a thing they are already doing, and
 * the dashboard has that link anyway.
 */
export function offerGroup({ memberships = null } = {}) {
  return Array.isArray(memberships) && memberships.length === 0
}
