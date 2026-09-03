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

/**
 * The seven kinds of thing that can be on this calendar.
 *
 * It was four, all academic, and the request was that the calendar stop being
 * a timetable with a personal section bolted on: a shift, a party and a
 * doctor's appointment are as much "what is on Thursday" as a lecture is.
 *
 * THE ORDER IS THE ORDER THEY APPEAR AS PILLS, and it is grouped rather than
 * alphabetical: the three school ones, then the two that are somebody else's
 * clock, then the two that are yours. Somebody adding a shift should not have
 * to read past "Etude" to find it.
 *
 * Every value here must also be in the check constraint. Migration 52 widens
 * it from the original four; a category the database refuses is a form that
 * fails on save with a constraint name rather than a sentence.
 */
export const CATEGORIES = [
  'cours',
  'examen',
  'etude',
  'travail',
  'evenement',
  'perso',
  'sante',
]

/**
 * The layers the filter toolbar turns on and off.
 *
 * WHY THESE ARE NOT THE CATEGORIES, WHICH IS THE OBVIOUS DESIGN.
 *
 * The request asked for four toggles, "Emploi du temps / Personnel /
 * Objectifs / Cycle et Sante", and separately for the event form to offer four
 * types with the same names. Those are not the same list, and making them one
 * list would have cost something real in both directions.
 *
 * Downward: "Scolaire" as a single category throws away cours / examen /
 * etude, which is the distinction a student actually wants on the grid. An
 * exam and a revision block are not the same thing and the colours already say
 * so. So the categories stay as they are and a layer is a GROUP of them.
 *
 * Upward: "Objectifs" and "Cycle et Sante" cannot be categories of
 * calendar_event at all. A goal is a row in `goals` with its own deadline,
 * owner and status, and duplicating one into an event would give it two
 * places to be edited and one of them would go stale. A period is a row in
 * cycle_log, and 51_calendar_and_cycle.sql is explicit that the timetable and
 * the cycle share a migration and not a table, because one set of policies
 * over data with two sensitivities always ends up at the looser one. Adding a
 * `category = 'menstrual'` to calendar_event would be exactly that merge.
 *
 * So a layer is a view over more than one source: two of them filter events,
 * one reads goals, one switches the cycle overlay. What the toolbar controls
 * is what is DRAWN, which is what somebody toggling it means.
 */
export const LAYERS = ['scolaire', 'perso', 'objectifs', 'cycle']

/**
 * Which layer an event's category belongs to.
 *
 * 'objectif' is the odd one and is deliberately NOT in CATEGORIES. It is a
 * synthetic category the calendar page puts on goals it has read out of the
 * `goals` table so they can go through the same expander and the same grid as
 * everything else. The database has never heard of it and the check constraint
 * would refuse it, which is correct: those rows are drawn here and edited on
 * the goals screen, and nothing on this page ever writes one back.
 */
const LAYER_OF = {
  cours: 'scolaire',
  examen: 'scolaire',
  etude: 'scolaire',
  /* Work, a party and an appointment all live on the personal layer. A fourth
     toggle for each would be four switches nobody flips; the layer is "not
     school and not a goal", which is one idea. */
  travail: 'perso',
  evenement: 'perso',
  perso: 'perso',
  sante: 'perso',
  objectif: 'objectifs',
}

/* Unknown categories fall to 'perso' rather than vanishing. A row written by a
   later version of the app, or by hand, should still be visible: an event you
   cannot see and cannot delete is worse than one filed under the wrong
   heading. */
export const layerOf = (event) => LAYER_OF[event?.category] ?? 'perso'

/** The dot on each toggle. Same tokens the events themselves paint in. */
export const LAYER_COLOUR = {
  scolaire: 'cat-1',
  perso: 'green',
  objectifs: 'cat-3',
  cycle: 'negative',
}

/**
 * The events left after the hidden layers are taken out.
 *
 * `hidden` is whatever a Set-like thing is to hand, and an absent one means
 * nothing is hidden, so the caller never has to build an empty Set to ask for
 * everything. Filtering here rather than inside agendaFor keeps the expansion
 * honest: a hidden layer costs no walk at all, rather than being expanded and
 * then dropped.
 */
export function visibleEvents(events, hidden) {
  if (!hidden || typeof hidden.has !== 'function') return events ?? []
  return (events ?? []).filter((e) => !hidden.has(layerOf(e)))
}

/**
 * Which palette token each category paints in.
 *
 * Tokens rather than hex, for the reason the migration gives: a stored colour
 * is correct on exactly one of this app's two themes. These are the defaults
 * an event gets when it is created; the row can override the colour.
 *
 * Every name here must be a token tailwind.config.js actually declares. The
 * first version used 'blue' and 'violet', which are not among them, so the
 * chips painted transparent: Tailwind builds each colour as var(--c-<name>)
 * and an undefined variable is nothing at all. A screenshot did not show it;
 * sampling the painted pixels did, at 1:1 against the tile behind.
 */
/**
 * SEVEN CATEGORIES, SEVEN COLOURS THAT ARE ACTUALLY DIFFERENT.
 *
 * The first mapping used what the constraint already allowed and three of the
 * seven were the same colour. accent is #E60070, cat-1 is #FF007A and cat-2 is
 * #FF2D6B: three magentas within 15 degrees of hue, painted at 18 per cent
 * over white, which is three chips nobody can tell apart on a month grid.
 * "Un exam peut etre d'une couleur differente d'un cours" is the report and it
 * was correct.
 *
 * Each theme has ONE six-step ramp and four colours declared outside it, and
 * the four are what make seven possible:
 *
 *   cours      cat-1      rose vif in sun, navy in sea
 *   examen     ink        noir, the one you cannot miss, which is the point
 *   etude      cat-4      orange in sun, mid blue in sea
 *   travail    cat-6      jaune in sun, light blue in sea
 *   evenement  negative   deep red, the same in both themes
 *   perso      green      the same in both themes
 *   sante      quiet      gris
 *
 * ONLY THREE OF THE SIX RAMP STEPS ARE USED, AND THAT IS THE WHOLE TRICK.
 *
 * The first version of this mapping took four (1, 3, 4, 6) and measured fine
 * in sun and badly in sea, where the ramp is monotone blue: cat-3 and cat-4
 * came back 7.6 apart in CIE76, and anything under about 10 reads as one
 * colour. Four picks from six adjacent steps always leaves one neighbouring
 * pair, so the fix is not a better set of four, it is taking three.
 *
 * `negative` is the fourth, and it is worth saying out loud that this is the
 * error colour being used as a palette entry. It is not a slip. It and `green`
 * are the only saturated hues in this file declared once at :root instead of
 * per theme, so they are the only two that are the same colour in sun and sea,
 * and a party needs a hue that does not move. Nothing about the chip says
 * "error": it is a 3px red rule beside the name of a party.
 *
 * cat-2, cat-3 and cat-5 are skipped. They sit between steps already in use.
 *
 * Migration 53 widens the check constraint on `colour` to accept the whole
 * ramp plus ink and negative. Every name here must be a token
 * tailwind.config.js declares AND a value that constraint allows; the test
 * reads the constraint out of the SQL and asserts both directions.
 */
export const CATEGORY_COLOUR = {
  cours: 'cat-1',
  examen: 'ink',
  etude: 'cat-4',
  travail: 'cat-6',
  evenement: 'negative',
  perso: 'green',
  /* Grey, and deliberately the quietest of the seven. A health entry sitting
     on a shared screen should be the one that draws the least attention. */
  sante: 'quiet',
}

/**
 * The full name of a weekday, for the accessible name on a one-letter chip.
 *
 * THE CHIPS SAY "L M M J V S D" AND TWO OF THOSE ARE THE SAME LETTER.
 *
 * French abbreviates mardi and mercredi to the same initial, so a screen
 * reader reading the visible text hears "M" twice with nothing to separate
 * them, and a 32px chip has no room for a second letter. Intl already knows
 * every day name in every locale the app will ever add, which is better than
 * fourteen more translation keys that have to be kept in step.
 *
 * 4 January 1970 was a Sunday, so day 0 lands on the 4th and the arithmetic
 * needs no offset table.
 */
export function weekdayName(day, localeTag = 'fr-FR') {
  const d = new Date(Date.UTC(1970, 0, 4 + Number(day)))
  return new Intl.DateTimeFormat(localeTag, { weekday: 'long', timeZone: 'UTC' }).format(d)
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

  /**
   * The dates this rule has been told to skip.
   *
   * WHY A LIST OF EXCEPTIONS AND NOT A DELETE.
   *
   * "Delete only this one" on a weekly class has no other honest
   * implementation. Deleting the row removes the whole term. Setting until_on
   * to the day before removes the rest of the term as well as the one day.
   * Splitting the rule into two rows makes one class into two, which then
   * drift apart the first time somebody edits the room.
   *
   * So the rule stays whole and records the days it does not land on, which is
   * what an iCalendar EXDATE is and what every calendar that has solved this
   * settled on. Migration 52 adds the column.
   */
  const skipped = new Set(
    (Array.isArray(event.excluded_on) ? event.excluded_on : []).map((d) =>
      d instanceof Date ? dayKey(d) : String(d),
    ),
  )

  /* A one-off. It is either in the range or it is not, and no walk is needed
     to find that out. An excluded one-off is a row somebody deleted "just this
     one" of, which for a single occurrence means all of it. */
  if (days.length === 0) {
    if (skipped.has(dayKey(first))) return []
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
    if (wanted.has(d.getDay()) && !skipped.has(dayKey(d))) out.push(d)
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
 * A term's worth of classes, from the rows somebody typed into the wizard.
 *
 * WHY THIS IS A FUNCTION AND NOT PART OF THE FORM.
 *
 * A timetable is the one thing here entered in bulk, so it is also the one
 * place where a validation mistake costs somebody eight rows of typing rather
 * than one field. Keeping the rules out of the component means they can be
 * tested without a browser, and the awkward cases below are the ones a form
 * written straight into JSX gets wrong.
 *
 * A blank row is SKIPPED, not rejected. The wizard opens with empty rows and
 * offers more; refusing to save because the last two were never filled in is
 * the single most annoying thing a form of this shape can do.
 *
 * A row that is filled in but wrong REJECTS THE WHOLE BATCH, and the error
 * names which one. A partial save would leave somebody with four of their six
 * classes and no way to tell which two are missing without checking the grid.
 *
 * Returns `{ rows }` or `{ error, at }`. The caller turns the error into a
 * sentence, because this file does not know what language anybody reads.
 */
export function timetableRows(entries, { userId, startsOn, untilOn } = {}) {
  if (untilOn && startsOn && untilOn < startsOn) return { error: 'until' }

  const rows = []
  for (const entry of entries ?? []) {
    const title = String(entry?.title ?? '').trim()
    if (!title) continue

    const start = minutesOf(entry.start)
    const end = minutesOf(entry.end)

    /* The same pairing rule as the check constraint. Both empty is an all-day
       entry and is allowed everywhere else in the app; in a timetable it is
       almost always a half-filled row, but it is still legal and the database
       accepts it, so this does not invent a stricter rule than the schema. */
    if ((start == null) !== (end == null)) return { error: 'times', at: title }
    if (start != null && end != null && end <= start) return { error: 'order', at: title }

    /* Deduplicated and sorted. Somebody who taps Tuesday twice means Tuesday
       once, and a duplicate would not error: occurrencesOf builds a Set, so
       the day would draw correctly and the stored row would be quietly wrong
       forever. */
    const weekdays = [
      ...new Set((entry.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
    ].sort((a, b) => a - b)

    /* A class with no day is not a timetable entry. The constraint would
       accept it as a one-off on the term's first day, which is not what
       anybody filling in this form meant, and it would look like the
       recurrence being broken. */
    if (!weekdays.length) return { error: 'days', at: title }

    const category = CATEGORIES.includes(entry.category) ? entry.category : 'cours'

    rows.push({
      user_id: userId,
      title: title.slice(0, 120),
      category,
      location: String(entry.location ?? '').trim().slice(0, 160) || null,
      starts_on: startsOn,
      until_on: untilOn || null,
      start_min: start,
      end_min: end,
      weekdays,
      colour: CATEGORY_COLOUR[category] ?? 'accent',
    })
  }

  if (!rows.length) return { error: 'empty' }
  return { rows }
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
