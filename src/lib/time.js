export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** "Closes in 6h" / "Opens Sunday". Short enough for a status line. */
export function untilLabel(iso, { prefix = '' } = {}) {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const mins = Math.round(abs / 60000)
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)

  let value
  if (mins < 60) value = `${Math.max(1, mins)}m`
  else if (hours < 48) value = `${hours}h`
  else value = `${days}d`

  return ms >= 0 ? `${prefix}${value}`.trim() : `${value} ago`
}

export function shortDate(iso, locale) {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

const ms = (iso) => new Date(iso).getTime()

/**
 * When a cycle actually stops accepting a check-in.
 *
 * This used to be the stored closes_at, which on the default settings was
 * opens_at plus thirty hours. On a weekly group that is a door open for a day
 * and a quarter and shut for the other five and three quarters, so almost
 * every time somebody opened the app there was nothing they could do in it.
 * That is the complaint, and it was the design, not a bug.
 *
 * A period now runs from when it opens until the next one opens. You write
 * whenever you like during the week; what happens at the appointed hour is
 * the reading, not the writing. The event is still an event, because the
 * board stays sealed until the period ends, but the door is never shut.
 *
 * The end is derived from the next period rather than read from the row so
 * that this holds on a database where 13_group_rhythm.sql has not been run
 * yet. Falling back to cadence, and only then to the stored value, means the
 * worst case is the old behaviour rather than a group with no window at all.
 */
export function cycleEnd(cycle, cycles = [], cadenceDays = null) {
  if (!cycle) return null

  const opens = ms(cycle.opens_at)
  let soonest = null
  for (const c of cycles) {
    const t = ms(c.opens_at)
    if (t > opens && (soonest === null || t < soonest)) soonest = t
  }
  if (soonest !== null) return new Date(soonest).toISOString()

  if (cadenceDays > 0) return new Date(opens + cadenceDays * 86400000).toISOString()
  return cycle.closes_at
}

/**
 * Where a cycle sits relative to now, independent of the stored state column.
 *
 * Pass the group's other cycles and it uses the real window above. Called
 * with one argument it still answers, using the stored close.
 */
export function cyclePhase(cycle, cycles = [], cadenceDays = null) {
  if (!cycle) return 'none'
  const now = Date.now()
  if (now < ms(cycle.opens_at)) return 'upcoming'
  if (now < ms(cycleEnd(cycle, cycles, cadenceDays))) return 'open'
  return 'closed'
}

/** The period you are in, or failing that the one you are waiting for. */
export function liveCycle(cycles = [], cadenceDays = null) {
  const open = cycles.find((c) => cyclePhase(c, cycles, cadenceDays) === 'open')
  if (open) return open
  return soonestUpcoming(cycles, cadenceDays)
}

/**
 * The next period to open, earliest first.
 *
 * The dashboard used to take the head of a list sorted newest-first, which is
 * the furthest cycle away, not the nearest. With four periods kept ahead that
 * rendered as "next one opens in 23d" on a group that meets every week, which
 * is where "blocked for a month" came from.
 */
export function soonestUpcoming(cycles = [], cadenceDays = null) {
  let best = null
  for (const c of cycles) {
    if (cyclePhase(c, cycles, cadenceDays) !== 'upcoming') continue
    if (best === null || ms(c.opens_at) < ms(best.opens_at)) best = c
  }
  return best
}

/** The period that just ended, latest first. What the board reveals. */
export function lastClosed(cycles = [], cadenceDays = null) {
  let best = null
  for (const c of cycles) {
    if (cyclePhase(c, cycles, cadenceDays) !== 'closed') continue
    if (best === null || ms(c.opens_at) > ms(best.opens_at)) best = c
  }
  return best
}
