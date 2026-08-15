/**
 * node src/lib/datecaps.test.mjs
 *
 * The assertions that matter walk all twelve months in both languages. The
 * bug this file exists to prevent is not visible in May, which is why it
 * survived a screenshot: "mai" is already three letters and carries no full
 * stop, so the one month somebody happened to be looking at was the one month
 * where uppercasing alone would have been enough.
 */
import { MONTH_LETTERS, dateCaps, dateFull } from './datecaps.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\ndatecaps')

const FR = 'fr-FR'
const EN = 'en-GB'
/* Fixed "today", so the drop-the-current-year rule is tested rather than
   whatever year this happens to be run in. */
const TODAY = new Date(2026, 7, 15)
/* U+00A0 joins the day to the month so the pair can never be split across two
   lines. The year is joined with an ordinary space, which is where the string
   is meant to break. */
const NB = '\u00a0'

/* --- the shape ---------------------------------------------------------- */
eq('four letters, not three', MONTH_LETTERS, 4)

/* --- every month, both languages ---------------------------------------- */
{
  const months = []
  for (let m = 0; m < 12; m += 1) months.push(`2026-${String(m + 1).padStart(2, '0')}-17`)

  for (const [tag, name] of [[FR, 'fr'], [EN, 'en']]) {
    const all = months.map((d) => dateCaps(d, tag, TODAY))
    ok(`${name}: no full stop survives anywhere`, all.every((s) => !s.includes('.')), all.join(' '))
    ok(`${name}: every month is uppercase`, all.every((s) => s === s.toUpperCase()), all.join(' '))
    const abbr = all.map((s) => s.split(NB)[1].split(' ')[0])
    ok(
      `${name}: no month is wider than four`,
      abbr.every((m) => m.length <= 4),
      abbr.join(' '),
    )
    /* THE ONE THAT MATTERS. Cutting to three letters made juin and juil. both
       JUI, so June and July were the same string and a start date was
       ambiguous by a month. Every other assertion here passed while that was
       true. */
    ok(
      `${name}: all twelve months are distinguishable`,
      new Set(abbr).size === 12,
      abbr.join(' '),
    )
    ok(`${name}: the day survives`, all.every((s) => s.startsWith(`17${NB}`)))
  }
}

/* The two that would have got through a May-only check. */
eq('fr January loses its stop', dateCaps('2026-01-17', FR, TODAY), `17${NB}JANV`)
eq('fr February loses its stop', dateCaps('2026-02-17', FR, TODAY), `17${NB}FÉVR`)
eq('fr December loses its stop', dateCaps('2026-12-17', FR, TODAY), `17${NB}DÉC`)
eq('fr September loses its stop', dateCaps('2026-09-17', FR, TODAY), `17${NB}SEPT`)

/* June and July, named separately, because this is the pair that collided. */
eq('fr June', dateCaps('2026-06-17', FR, TODAY), `17${NB}JUIN`)
eq('fr July', dateCaps('2026-07-17', FR, TODAY), `17${NB}JUIL`)
ok(
  'and they are not the same string',
  dateCaps('2026-06-17', FR, TODAY) !== dateCaps('2026-07-17', FR, TODAY),
)
eq('en June', dateCaps('2026-06-17', EN, TODAY), `17${NB}JUN`)
eq('en July', dateCaps('2026-07-17', EN, TODAY), `17${NB}JUL`)

/* Accents survive uppercasing rather than being stripped. */
ok('fr keeps its accents', dateCaps('2026-02-17', FR, TODAY).includes('É'))
ok('and in August', dateCaps('2026-08-17', FR, TODAY).includes('Û'))

/* --- the year ----------------------------------------------------------- */
eq('this year is left off', dateCaps('2026-05-17', FR, TODAY), `17${NB}MAI`)
eq('and in English', dateCaps('2026-05-17', EN, TODAY), `17${NB}MAY`)
eq('last year is named', dateCaps('2025-05-17', FR, TODAY), `17${NB}MAI 2025`)
eq('and in English', dateCaps('2025-05-17', EN, TODAY), `17${NB}MAY 2025`)
eq('a future year is named too', dateCaps('2027-01-02', EN, TODAY), `2${NB}JAN 2027`)
{
  /* The boundary: 31 December of this year, and 1 January of the next. */
  eq('31 Dec of this year has no year', dateCaps('2026-12-31', EN, TODAY), `31${NB}DEC`)
  eq('1 Jan of next year has one', dateCaps('2027-01-01', EN, TODAY), `1${NB}JAN 2027`)
}

/* --- where it may and may not break ------------------------------------- */
{
  const withYear = dateCaps('2025-09-17', EN, TODAY)
  ok('day and month are joined unbreakably', withYear.includes(`17${NB}SEPT`), JSON.stringify(withYear))
  ok('the year is joined by an ordinary space', withYear.includes('SEPT 2025'), JSON.stringify(withYear))
  ok('so there is exactly one place it can break', withYear.split(' ').length === 2, JSON.stringify(withYear))
  const noYear = dateCaps('2026-09-17', EN, TODAY)
  ok('and none at all without a year', !noYear.includes(' '), JSON.stringify(noYear))
}

/* --- the day is not padded ---------------------------------------------- */
eq('a single-digit day stays single', dateCaps('2026-05-07', EN, TODAY), `7${NB}MAY`)
eq('and in French', dateCaps('2026-05-07', FR, TODAY), `7${NB}MAI`)

/* --- timezone ------------------------------------------------------------ */
{
  /* new Date('2026-05-17') is UTC midnight, which is the 16th in Montréal. The
     helper adds T00:00:00 so it parses locally; without that, every goal in
     the western hemisphere would report starting a day early. */
  eq('a date column is read as a local calendar day', dateCaps('2026-05-17', EN, TODAY), `17${NB}MAY`)
  eq('and a timestamp is cut to its day first', dateCaps('2026-05-17T23:30:00Z', EN, TODAY), `17${NB}MAY`)
}

/* --- junk ---------------------------------------------------------------- */
eq('null is null, not a crash', dateCaps(null, EN, TODAY), null)
eq('empty is null', dateCaps('', EN, TODAY), null)
eq('nonsense is null', dateCaps('not a date', EN, TODAY), null)
eq('a half date is null', dateCaps('2026-05', EN, TODAY), null)
eq('an impossible day is null', dateCaps('2026-13-45', EN, TODAY), null)
eq('a number is null', dateCaps(20260517, EN, TODAY), null)

/* --- dateFull ------------------------------------------------------------ */
eq('the long form spells the month', dateFull('2026-05-17', FR), '17 mai 2026')
eq('and in English', dateFull('2026-05-17', EN), '17 May 2026')
ok('the long form always carries the year', dateFull('2026-01-17', EN).includes('2026'))
eq('junk is null there too', dateFull('nope', EN), null)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
