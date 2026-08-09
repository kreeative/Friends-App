import { daysUntilBirthday, upcomingBirthdays } from './birthdays.js'
let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// ---- days until ------------------------------------------------------------
const aug10 = new Date(2026, 7, 10)

eq('today is zero',        daysUntilBirthday('1996-08-10', aug10), 0)
eq('tomorrow is one',      daysUntilBirthday('1996-08-11', aug10), 1)
eq('a week out',           daysUntilBirthday('1990-08-17', aug10), 7)
eq('eight days is eight',  daysUntilBirthday('1990-08-18', aug10), 8)
eq('yesterday waits a year', daysUntilBirthday('1990-08-09', aug10), 364)
eq('no birthday, no answer', daysUntilBirthday(null, aug10), null)
eq('junk is not a date',     daysUntilBirthday('not-a-date', aug10), null)

// The one that breaks in December if the year is not rolled forward.
const dec28 = new Date(2026, 11, 28)
eq('across new year', daysUntilBirthday('1990-01-03', dec28), 6)
eq('christmas has passed', daysUntilBirthday('1990-12-25', dec28), 362)

// A date column is a calendar date. Parsing it as an instant reads as the day
// before for everybody west of Greenwich, which is most of the users.
eq('not parsed as UTC', daysUntilBirthday('1996-08-10T00:00:00Z', aug10), 0)

// 29 February is observed every year, on 1 March in common years.
eq('leap day in a common year', daysUntilBirthday('2000-02-29', new Date(2027, 1, 27)), 2)
eq('leap day in a leap year',   daysUntilBirthday('2000-02-29', new Date(2028, 1, 27)), 2)

// A clock change inside the window must not shave the count to 6.
eq('across a spring forward', daysUntilBirthday('1990-03-15', new Date(2026, 2, 8)), 7)
eq('across a fall back',      daysUntilBirthday('1990-11-08', new Date(2026, 10, 1)), 7)

// ---- who is coming up ------------------------------------------------------
const people = [
  { id: 'a', display_name: 'Ann',  birthday: '1996-08-17' }, // 7 days
  { id: 'b', display_name: 'Ben',  birthday: '1994-08-10' }, // today
  { id: 'c', display_name: 'Cass', birthday: '1994-09-30' }, // outside
  { id: 'd', display_name: 'Dee',  birthday: null },
  { id: 'e', display_name: 'Eve',  birthday: '1994-08-12' }, // 2 days
]

let soon = upcomingBirthdays(people, { today: aug10 })
eq('only the ones inside the window', soon.map((p) => p.id), ['b', 'e', 'a'])
eq('days come back with them',        soon.map((p) => p.days), [0, 2, 7])

eq(
  'yourself is left out',
  upcomingBirthdays(people, { today: aug10, exclude: 'b' }).map((p) => p.id),
  ['e', 'a'],
)

eq(
  'one row per person across groups',
  upcomingBirthdays([...people, people[1]], { today: aug10 }).map((p) => p.id),
  ['b', 'e', 'a'],
)

eq('a shorter window holds', upcomingBirthdays(people, { today: aug10, within: 2 }).map((p) => p.id), ['b', 'e'])
eq('nothing in, nothing out', upcomingBirthdays(undefined, { today: aug10 }), [])

// Same day, so the tie is broken by name rather than by query order.
soon = upcomingBirthdays(
  [
    { id: 'z', display_name: 'Zoe', birthday: '1990-08-12' },
    { id: 'm', display_name: 'Mo',  birthday: '1990-08-12' },
  ],
  { today: aug10 },
)
eq('ties break by name', soon.map((p) => p.id), ['m', 'z'])

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
