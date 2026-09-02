/**
 * Turning stored events into the blocks a week or a month actually shows.
 *
 * A row in calendar_event is a rule, not an occurrence: "Biochimie, Tuesdays
 * and Thursdays, 10:00 to 12:00, from 1 September until 12 December". What a
 * grid needs is the list of days that rule lands on inside the range being
 * drawn, and nothing outside it.
 *
 * WHY EXPANSION IS BOUNDED BY THE RANGE AND NOT BY THE RULE.
 *
 * A weekly event with no end date is infinite. Expanding it and then filtering
 * is how a calendar hangs on a rule somebody left open, so the walk starts at
 * the later of the rule's first day and the range's first day, and stops at
 * the earlier of the rule's last day and the range's last day. Nothing is ever
 * generated that is not going to be drawn.
 */
import { addDays, dayKey, daysBetween, fromKey } from './cycle.js'

export const CATEGORIES = ['cours', 'examen', 'etude', 'perso']

/**
 * Which palette token each category paints in.
 *
 * Tokens rather than hex, for the reason the migration gives: a stored colour
 * is correct on exactly one of this app's two themes. These are the defaults
 * an event gets when it is created; the row can override the colour.
 */
export const CATEGORY_COLOUR = {
  cours: 'blue',
  examen: 'accent',
  etude: 'violet',
  perso: 'green',
}

/** 09:30 from 570, which is how times are stored. */
export function clockOf(minutes) {
  if (minutes == null) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 570 from "09:30". Null for anything that is not a clock. */
export function minutesOf(clock) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(clock ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * Every day one event lands on, within [from, to] inclusive.
 *
 * Returns Date objects rather than keys because the caller is about to sort
 * and compare them, and a string comparison that happens to work for ISO dates
 * is a trap the first time somebody passes a different format.
 */
export function occurrencesOf(event, from, to) {
  const first = event.starts_on instanceof Date ? event.starts_on : fromKey(event.starts_on)
  if (!first) return []

  const until = event.until_on ? (event.until_on instanceof Date ? event.until_on : fromKey(event.until_on)) : null
  const days = Array.isArray(event.weekdays) ? event.weekdays.filter((d) => d >= 0 && d <= 6) : []

  /* A one-off. It is either in the range or it is not, and no walk is needed
     to find that out. */
  if (days.length === 0) {
    return daysBetween(from, first) >= 0 && daysBetween(first, to) >= 0 ? [first] : []
  }

  /* The walk's bounds: never before the rule begins, never before the range,
     never after either ends. */
  const start = daysBetween(from, first) > 0 ? first : from
  const stop = until && daysBetween(until, to) > 0 ? until : to
  if (daysBetween(start, stop) < 0) return []

  const wanted = new Set(days)
  const out = []
  const span = daysBetween(start, stop)
  for (let i = 0; i <= span; i += 1) {
    const d = addDays(start, i)
    if (wanted.has(d.getDay())) out.push(d)
  }
  return out
}

/**
 * Every event in the range, keyed by day, each day's list in clock order.
 *
 * A Map rather than an object, because the keys are dates and an object would
 * sort them lexically the moment anybody enumerated it. All-day entries come
 * first within a day, since they have no time to sort by and a grid draws them
 * above the timed blocks.
 */
export function agendaFor(events, from, to) {
  const byDay = new Map()

  for (const event of events ?? []) {
    for (const day of occurrencesOf(event, from, to)) {
      const k = dayKey(day)
      const list = byDay.get(k) ?? []
      list.push({
        ...event,
        day,
        key: k,
        /* The occurrence's own identity. A recurring event has one row and
           many blocks, and React needs to tell those blocks apart. */
        occurrenceId: `${event.id}:${k}`,
        colour: event.colour ?? CATEGORY_COLOUR[event.category] ?? 'accent',
      })
      byDay.set(k, list)
    }
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => {
      const am = a.start_min ?? -1
      const bm = b.start_min ?? -1
      if (am !== bm) return am - bm
      return String(a.title).localeCompare(String(b.title))
    })
  }

  return byDay
}

/**
 * Where a block sits in a day column, as fractions of the visible span.
 *
 * The grid does not run midnight to midnight: nobody has a nine o'clock
 * lecture drawn a third of the way down a column of empty night. It runs from
 * dayFrom to dayTo, and anything outside is clipped to the edge rather than
 * positioned off it.
 */
export function blockStyle(event, dayFrom = 7 * 60, dayTo = 23 * 60) {
  const span = dayTo - dayFrom
  const start = event.start_min ?? dayFrom
  const end = event.end_min ?? start + 60

  const top = Math.max(0, Math.min(1, (start - dayFrom) / span))
  const bottom = Math.max(0, Math.min(1, (end - dayFrom) / span))

  return {
    top: `${(top * 100).toFixed(3)}%`,
    /* A floor on the height, because a fifteen-minute event at this scale is
       four pixels and cannot hold a word. */
    height: `${Math.max(2.2, (bottom - top) * 100).toFixed(3)}%`,
  }
}

/**
 * The earliest start and latest end across a set of events, so the grid can
 * fit itself to the day somebody actually has rather than to a fixed 7 to 23.
 *
 * Padded by an hour each way and clamped, and it never narrows past a sensible
 * default: a single 14:00 lecture should not produce a grid showing only the
 * afternoon, because the empty morning is information too.
 */
export function dayBounds(events, fallbackFrom = 7 * 60, fallbackTo = 23 * 60) {
  let lo = fallbackFrom
  let hi = fallbackTo
  for (const e of events ?? []) {
    if (e.start_min != null && e.start_min - 60 < lo) lo = Math.max(0, e.start_min - 60)
    if (e.end_min != null && e.end_min + 60 > hi) hi = Math.min(1440, e.end_min + 60)
  }
  return { from: lo, to: hi }
}
