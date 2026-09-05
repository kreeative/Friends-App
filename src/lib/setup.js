/**
 * The five questions asked once, and what the answers decide.
 *
 * Pure and importless, so `npm test` runs it under plain node. Everything here
 * is a one-line predicate and every one of them is worth testing, because each
 * has a wrong version that is invisible in review and obvious to a user:
 * trapping somebody in a form, showing a period tracker to a man, or taking one
 * away from a woman who was using it yesterday.
 */

/**
 * The three answers, in the order they are offered.
 *
 * 'other' is last because it is the one that is not a guess about you, not
 * because it matters least.
 */
export const GENDERS = ['woman', 'man', 'other']

/**
 * Should this person be shown the setup screen?
 *
 * `=== null` and not `!profile.setup_done_at`, and the difference is the whole
 * function. Three states arrive here and only one of them is a yes:
 *
 *   undefined  the column does not exist, because migration 56 has not been
 *              run yet on this database. NO: a bundle deployed before its SQL
 *              must not put a form in front of every person who signs in, and
 *              a write to a column that is not there would fail anyway.
 *   null       the column exists and this account has not been through it. YES.
 *   a date     done, on that date. NO.
 *
 * The same lesson as isSolo in onboarding.js, which is where this shape comes
 * from: a missing column has to mean "do not", never "do".
 */
export function needsSetup(profile) {
  return profile?.setup_done_at === null
}

/**
 * Does answering the gender question this way turn the cycle tracker on?
 *
 * Only 'woman'. A man does not get a period tracker, which is the point of
 * asking, and 'other' does not get one turned on for them by an app that has
 * decided what their answer meant. Both can turn it on from their profile, and
 * that switch is not a consolation prize: it is the only correct answer for a
 * question the app cannot infer.
 */
export function cycleForGender(gender) {
  return gender === 'woman'
}

/**
 * Is the cycle tracker part of this person's app right now?
 *
 * Reads the switch, not the gender, everywhere the feature appears. Gender set
 * the switch once; after that the switch is the truth, because somebody who
 * turned it on or off meant it.
 *
 * `!== false` so both unknowns mean yes: an account written before migration 56
 * (undefined) and a profile still in flight (null). Every account that exists
 * today has this feature, and a fetch that has not landed must not blink it out
 * of the calendar for a second on every load.
 */
export function cycleOn(profile) {
  return profile?.cycle_on !== false
}

/**
 * What the name box will actually save.
 *
 * display_name is `not null` in the schema and a row of spaces is not a name,
 * so this is the one answer the setup screen refuses to finish without. Trimmed
 * here rather than at the call site, because the check and the value saved have
 * to be the same string or the button enables on something the database
 * rejects.
 */
export function cleanName(text) {
  return String(text ?? '').trim().slice(0, 60)
}

/** Can the setup screen be finished with this name in the box? */
export function canFinish(text) {
  return cleanName(text).length > 0
}

/**
 * What the setup screen writes, from what it collected.
 *
 * Built here, away from the JSX, because this object is the entire product of
 * that screen and it is worth reading in one place. Two rules live in it:
 *
 *   - pronouns and gender are written as null when unanswered rather than as
 *     an empty string, since "" is a value a column would keep and null is the
 *     absence the rest of the app already tests for.
 *   - cycle_on is derived here and never asked. See cycleForGender.
 *
 * `now` is a parameter so a test can assert the timestamp rather than the
 * shape of a Date.
 */
export function setupPatch({ name, theme, locale, pronouns, gender }, now = new Date()) {
  return {
    display_name: cleanName(name),
    theme: theme ?? null,
    locale: locale ?? null,
    pronouns: pronouns ? pronouns : null,
    gender: gender ?? null,
    cycle_on: cycleForGender(gender),
    setup_done_at: now.toISOString(),
  }
}
