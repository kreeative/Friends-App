/**
 * node src/lib/cycleDetails.test.mjs
 *
 * La carte du cycle du calendrier, ouverte.
 *
 *   "The period stuff on the calendar: you should be able to click and
 *    expand the tab when you click it for a long time."
 *
 * Les dates a venir, les dernieres regles, et le geste qui ouvre la carte.
 */
import { readFileSync } from 'node:fs'
import { cycleDetails, recentPeriods, upcoming } from './cycleDetails.js'
import { predict } from './cycle.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
const key = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null)
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

console.log('\ncycle details')

const ROWS = [
  { id: 'a', started_on: '2026-07-25', ended_on: '2026-07-30' },
  { id: 'b', started_on: '2026-08-22', ended_on: '2026-08-27' },
  { id: 'c', started_on: '2026-09-19', ended_on: null },
]
const TODAY = new Date(2026, 9, 15) // 15 octobre
const P = predict(ROWS, null, TODAY)

/* --- a venir ------------------------------------------------------------- */
const up = upcoming(P, TODAY)
eq('in date order', up.map((u) => u.kind), ['pms', 'predicted', 'fertile', 'ovulation'])
eq('the run-up is the five days before', [key(up[0].from), key(up[0].to)], ['2026-10-12', '2026-10-16'])
eq('the next period is the prediction', key(up[1].from), '2026-10-17')
ok('and carries its margin', up[1].window >= 1)
eq('the fertile window already passed this cycle, so it is the next one', [key(up[2].from), key(up[2].to)], ['2026-10-26', '2026-10-31'])
eq('and so is ovulation', key(up[3].from), '2026-10-31')

const early = upcoming(P, new Date(2026, 8, 25)) // 25 septembre, avant le milieu du cycle
const fert = early.find((u) => u.kind === 'fertile')
eq('before mid-cycle the fertile window is this cycle', [key(fert.from), key(fert.to)], ['2026-09-28', '2026-10-03'])
ok('a run-up that is over is not "coming up"', !upcoming(P, new Date(2026, 9, 17)).some((u) => u.kind === 'pms'))
eq('no prediction, nothing to show', upcoming(null, TODAY), [])

/* --- les dernieres regles ------------------------------------------------ */
const rec = recentPeriods(ROWS)
eq('newest first', rec.map((r) => key(r.from)), ['2026-09-19', '2026-08-22', '2026-07-25'])
eq('an end that was not noted stays unknown', [rec[0].to, rec[0].days], [null, null])
eq('a noted end gives the length, both days counted', rec[1].days, 6)
eq('the gap is counted from the start before', [rec[0].gap, rec[1].gap, rec[2].gap], [28, 28, null])
eq('three at most', recentPeriods([...ROWS, { started_on: '2026-06-27' }, { started_on: '2026-05-30' }]).length, 3)
eq('a date given twice counts once', recentPeriods([...ROWS, { started_on: '2026-09-19', ended_on: null }]).length, 3)
eq('an end before its start is ignored', recentPeriods([{ started_on: '2026-09-19', ended_on: '2026-09-10' }])[0].days, null)
eq('nothing recorded, nothing listed', recentPeriods([]), [])

/* --- l'ensemble ---------------------------------------------------------- */
const d = cycleDetails(ROWS, P, TODAY)
eq('the average is the prediction, not a new estimate', d.average.length, P.length)
eq('day of the cycle', d.day, 27)
eq('nothing went unrecorded', d.missed, 0)
eq('no prediction, no details', cycleDetails(ROWS, null, TODAY), null)

/* --- le geste et ce que la carte montre ---------------------------------- */
const strip = read('../components/CycleStrip.jsx')
ok('a long press toggles the card', /useLongPress\(\(\) => setOpen\(\(o\) => !o\), \{ capture: false \}\)/.test(strip))
ok('the handlers are on the card', /<section\s+\{\.\.\.handlers\}/.test(strip))
ok('the click that follows a hold is thrown away before the link', /onClickCapture=\{\(e\) => \{\s*if \(consumedClick\(\)\) \{\s*e\.preventDefault\(\)\s*e\.stopPropagation\(\)/.test(strip))
ok('the wait is shown, with the shared hold bar', /className="hold-bar /.test(strip) && /\{holding && \(/.test(strip))
ok('the bar stays absolute inside .lg', /hold-bar pointer-events-none !absolute/.test(strip))
ok('no system callout or selection under a long press', /select-none/.test(strip) && /\[-webkit-touch-callout:none\]/.test(strip))
ok('a button does the same in one tap, and says whether it is open', /aria-expanded=\{open\}/.test(strip) && /aria-controls="cal-cycle-more"/.test(strip) && /id="cal-cycle-more"/.test(strip))
ok('the details are only computed when open', /const more = open \? cycleDetails\(starts, prediction, today\) : null/.test(strip))
ok('the privacy line and the disclaimer travel with them', /t\('cycle\.private_line'\)/.test(strip) && /t\('cycle\.disclaimer'\)/.test(strip))
ok('and the line is capped to a reading width', /className="measure mt-5 text-small text-muted"/.test(strip))
ok('nothing is written: no supabase in the card', !/supabase/.test(strip))

const dict = read('./i18n.jsx')
const split = dict.indexOf('\n  fr: {')
for (const [lang, src] of [['en', dict.slice(0, split)], ['fr', dict.slice(split)]]) {
  for (const k of ['cal.cycle_more', 'cal.cycle_less', 'cal.cycle_upcoming', 'cal.cycle_ovulation', 'cal.cycle_average', 'cal.cycle_days_one', 'cal.cycle_days_other', 'cal.cycle_recent', 'cycle.gap_one', 'cycle.window_one', 'cycle.conf_low', 'cycle.stale_one']) {
    ok(`${lang} ${k}`, new RegExp(`'${k.replace(/\./g, '\\.')}':`).test(src))
  }
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
