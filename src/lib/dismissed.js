/**
 * Cards this reader has put away.
 *
 * WHY LOCALSTORAGE AND NOT A TABLE.
 *
 * The nudge rail already has a cross, and it writes to nudge_hidden because a
 * nudge is a real situation with a lifetime of its own: it stays open on four
 * other screens after you dismiss it, and it has to still be there when you
 * open the app on a different device tomorrow.
 *
 * A birthday card is not that. It is derived entirely from a date, it removes
 * itself the day after, and nobody else's screen is affected by you deciding
 * you have already dealt with it. A table for that would be a migration, a
 * policy, a round trip and a row per person per year, to remember something
 * for at most seven days.
 *
 * So this is per device, and that is the honest trade rather than a shortcut:
 * dismissing on your phone and seeing it again on your laptop is a small cost,
 * and the alternative costs a schema.
 *
 * WHY EVERY ENTRY CARRIES AN EXPIRY.
 *
 * Without one this grows forever on the accounts that use the app most, and it
 * gets a birthday wrong in exactly the way that matters: dismiss Milo's card
 * this year and it would never come back, so the app would silently stop
 * telling you about one friend's birthday for the rest of time. Each entry
 * says when it stops applying, and reads prune whatever has passed.
 *
 * The functions below are pure and take the map, so the rules can be tested
 * without a browser. The three at the bottom are the only ones that touch
 * storage.
 */

const KEY = 'rf.dismissed'

/** Entries whose moment has passed, dropped. Never mutates the input. */
export function prune(map, now = new Date()) {
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const out = {}
  for (const [key, until] of Object.entries(map ?? {})) {
    const t = new Date(until).getTime()
    /* An unparseable value is dropped rather than kept forever. It can only
       come from a hand edit or a build that wrote a different shape, and the
       failure mode of keeping it is a card that never returns. */
    if (Number.isFinite(t) && t > at) out[key] = until
  }
  return out
}

/** The map with one more key in it, pruned on the way through. */
export function withDismissed(map, key, until, now = new Date()) {
  if (!key || !until) return prune(map, now)
  const t = new Date(until).getTime()
  if (!Number.isFinite(t)) return prune(map, now)
  return { ...prune(map, now), [key]: new Date(t).toISOString() }
}

/** Has this reader put this card away, and does that still apply? */
export function isDismissed(map, key, now = new Date()) {
  if (!key) return false
  return Object.prototype.hasOwnProperty.call(prune(map, now), key)
}

/**
 * The key for one person's birthday, and the moment it stops mattering.
 *
 * Keyed on the month and day rather than the year, with the expiry doing the
 * work of forgetting: the card comes back next year because the entry written
 * this year has expired, not because the key changed. That way a key written
 * by an older build cannot linger under a year nobody will look at again.
 *
 * The expiry is the END of the birthday itself, not the moment of dismissal
 * plus some window. Putting the card away on the 1st for a birthday on the 4th
 * has to keep it away on the 2nd and the 3rd, and let it back in next year.
 */
export function birthdayCard(personId, daysAway, now = new Date()) {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number(daysAway ?? 0))
  const mmdd = `${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
  /* Midnight at the end of the birthday, local. */
  const until = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1)
  return { key: `birthday:${personId}:${mmdd}`, until: until.toISOString() }
}

/* --- the three that touch storage ---------------------------------------- */

export function readDismissed(now = new Date()) {
  try {
    const raw = localStorage.getItem(KEY)
    return prune(raw ? JSON.parse(raw) : {}, now)
  } catch {
    /* Disabled, private mode, or something that is not JSON. Nothing is
       dismissed, which shows a card somebody put away rather than hiding one
       they did not. */
    return {}
  }
}

export function writeDismissed(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* Private modes throw on write. The card still goes for this session. */
  }
}

export function dismiss(key, until, now = new Date()) {
  const next = withDismissed(readDismissed(now), key, until, now)
  writeDismissed(next)
  return next
}
