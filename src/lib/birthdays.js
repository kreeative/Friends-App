/**
 * When the next one comes round.
 *
 * Kept as pure functions with no imports, for the same reason budget.js is:
 * date arithmetic is the part worth being certain about, and a function taking
 * `today` as an argument can be tested at midnight on the 31st of December in
 * a way that a component reading `new Date()` cannot.
 *
 * The year is never used for anything but arithmetic. It is stored because
 * Postgres has no date-without-year (see supabase/20_quiet_and_birthdays.sql)
 * and it is never displayed anywhere in the app.
 */

const DAY = 86400000

/** Local midnight, so the difference between two dates is whole days. */
function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Days from today until this birthday next occurs. 0 means today.
 *
 * Parsed from the string rather than through `new Date(birthday)`, which
 * treats a bare "1996-04-12" as UTC midnight and therefore reads as the 11th
 * for everybody west of Greenwich. A date column is a calendar date; it has no
 * instant in it to convert.
 *
 * A 29th of February rolls to the 1st of March in common years, which is what
 * the Date constructor does with month 1 day 29 and is the behaviour we want:
 * the birthday is observed every year rather than three years out of four.
 */
export function daysUntilBirthday(birthday, today = new Date()) {
  if (!birthday) return null

  const [, month, day] = String(birthday)
    .slice(0, 10)
    .split('-')
    .map((n) => Number(n))

  if (!month || !day) return null

  const from = midnight(today)
  let next = new Date(from.getFullYear(), month - 1, day)
  if (next < from) next = new Date(from.getFullYear() + 1, month - 1, day)

  // Rounded, not floored: a clock change inside the window makes the
  // difference 6.958 days rather than 7, and 7 is the honest answer.
  return Math.round((next - from) / DAY)
}

/**
 * Everybody whose birthday lands inside the window, soonest first.
 *
 * Deduplicated by id, because somebody in two of your groups is still one
 * person with one birthday, and the dashboard reads across every group.
 *
 * `exclude` is your own id. A banner telling you when your own birthday is
 * would be a strange thing for an app to volunteer, and it is not what the
 * banner is for: the point is to give somebody else a week's notice.
 */
export function upcomingBirthdays(people, { within = 7, today = new Date(), exclude = null } = {}) {
  const seen = new Set()
  const out = []

  for (const person of people ?? []) {
    if (!person?.id || person.id === exclude || seen.has(person.id)) continue
    const days = daysUntilBirthday(person.birthday, today)
    if (days === null || days > within) continue
    seen.add(person.id)
    out.push({ ...person, days })
  }

  return out.sort(
    (a, b) => a.days - b.days || String(a.display_name ?? '').localeCompare(String(b.display_name ?? '')),
  )
}
