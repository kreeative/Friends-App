/**
 * How long the cross on a nudge card lasts.
 *
 * IT HAS TO EXPIRE, AND IT DID NOT.
 *
 * The cross writes a row to nudge_hidden and that row had no end. tick() is
 * deliberate about never raising a second nudge for somebody already quiet:
 * "one person who has gone quiet is one situation, and it stays one situation
 * until somebody deals with it". So the row the cross hides is not replaced
 * next week by a fresh one with a new id. It is the same row for as long as
 * the silence lasts, which means one tap removed one friend from the rail
 * permanently, and the longer they stayed quiet the more permanent it got.
 *
 * That is the exact failure dismissed.js already reasons about for birthdays,
 * in the same words: dismiss a card once and the app "would silently stop
 * telling you about one friend's birthday for the rest of time". The rule was
 * written there, for a case it had been drawn from, and never carried back.
 *
 * WHY SEVEN DAYS.
 *
 * The cross means "not this one, not now". It never meant "not this person".
 * If they are still quiet a week later, that is a new week of silence and it
 * is worth being asked about again. Shorter and the cross does not do its job,
 * because the card is back the next morning and the reader has been overruled.
 * Longer and a friend can be a month into a bad stretch with nobody prompted.
 *
 * WHY NOTHING IS DELETED WHEN IT EXPIRES.
 *
 * The row stays. It is the record that this reader considered this card and
 * decided, and deleting it would also delete the answer to "how long has this
 * been hidden", which is the only thing that makes the expiry checkable.
 */
export const HIDE_DAYS = 7

/**
 * The crosses that still apply, given when they were put there.
 *
 * Pure, and applied in JavaScript rather than as a .gte() on the request, so
 * that a probe can actually drive it. A Playwright stub answers whatever it
 * likes regardless of what is in the query string, so a cutoff pushed into the
 * request is a rule no test in this repo can fail.
 *
 * Takes the rows and returns the ids, because the caller wants a Set of ids
 * and every intermediate shape between here and there is somewhere the two
 * could disagree.
 *
 * A row with no hidden_at is treated as still hiding. The column is not null
 * with a default, so a missing value can only mean a build asked for fewer
 * columns than it needed, and keeping a card hidden that somebody dismissed is
 * the smaller of the two mistakes.
 */
export function openHides(rows, now = new Date()) {
  const cutoff = now.getTime() - HIDE_DAYS * 86400000
  const out = []
  for (const r of rows ?? []) {
    if (!r?.nudge_id) continue
    if (!r.hidden_at) {
      out.push(r.nudge_id)
      continue
    }
    const t = new Date(r.hidden_at).getTime()
    /* Unparseable is kept, for the same reason as a missing value. */
    if (!Number.isFinite(t) || t > cutoff) out.push(r.nudge_id)
  }
  return out
}
