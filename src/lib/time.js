export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** "Closes in 6h" / "Opens Sunday" — short enough for a status line. */
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

export function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Where a cycle sits relative to now, independent of the stored state column. */
export function cyclePhase(cycle) {
  if (!cycle) return 'none'
  const now = Date.now()
  if (now < new Date(cycle.opens_at).getTime()) return 'upcoming'
  if (now < new Date(cycle.closes_at).getTime()) return 'open'
  return 'closed'
}
