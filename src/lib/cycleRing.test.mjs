/**
 * L'anneau du cycle (src/lib/cycleRing.js), sans navigateur.
 *
 * Les dates sont celles de la capture du tiroir: 9 juin, 9 juillet, 7 aout,
 * 5 septembre; aujourd'hui le 23 septembre. Les ecarts font 30, 29, 29, donc
 * un cycle de 29 jours, et le 23 est le jour 19.
 */
import { predict } from './cycle.js'
import { ESTIMATES, SEGMENT_ORDER, arcPath, dayAngle, polar, ringModel } from './cycleRing.js'

let faux = 0
let total = 0
const ok = (name, cond, why = '') => {
  total += 1
  if (!cond) faux += 1
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && why ? `  (${why})` : ''}`)
}
const close = (a, b, eps = 0.02) => Math.abs(a - b) < eps

const LOGS = [
  { id: 'l1', started_on: '2026-06-09', ended_on: null },
  { id: 'l2', started_on: '2026-07-09', ended_on: null },
  { id: 'l3', started_on: '2026-08-07', ended_on: null },
  { id: 'l4', started_on: '2026-09-05', ended_on: null },
]
const TODAY = new Date(2026, 8, 23)
const pred = predict(LOGS, null, TODAY)
const seg = (m, k) => m.segments.find((s) => s.kind === k)

console.log('\nringModel')
{
  const m = ringModel(LOGS, pred, { today: TODAY })
  ok('a 29-day ring, today is day 19, not late', m && m.length === 29 && m.day === 19 && m.marker === 19 && m.late === false, JSON.stringify(m))
  ok('the period is days 1 to 5, a fact', seg(m, 'period')?.from === 1 && seg(m, 'period')?.to === 5 && seg(m, 'period')?.estimate === false)
  /* ovulation = next - 14 = 4 Oct - 14 = 20 Sept = day 16; fertile = 15 to 20 Sept = days 11 to 16 */
  ok('the fertile window is days 11 to 16, an estimate', seg(m, 'fertile')?.from === 11 && seg(m, 'fertile')?.to === 16 && seg(m, 'fertile')?.estimate === true, JSON.stringify(seg(m, 'fertile')))
  /* pms = next - 5 .. next - 1 = 29 Sept .. 3 Oct = days 25 to 29 */
  ok('the run-up is days 25 to 29', seg(m, 'pms')?.from === 25 && seg(m, 'pms')?.to === 29, JSON.stringify(seg(m, 'pms')))
  /* window: spread 1 -> max(1, round(0.5)) = 1; predicted from day 30 - 1 = 29 to 29 */
  ok('the expected period shows at the very end, one day wide for a steady cycle', seg(m, 'predicted')?.from === 29 && seg(m, 'predicted')?.to === 29, JSON.stringify(seg(m, 'predicted')))
  ok('estimates come first so facts draw on top', m.segments.map((s) => s.kind).join() === 'fertile,pms,predicted,period')
  ok('every segment stays inside the ring', m.segments.every((s) => s.from >= 1 && s.to <= m.length && s.from <= s.to))
}
{
  const m = ringModel(LOGS, pred, { today: new Date(2026, 9, 10) })
  ok('a late cycle: day 36 of 29, the marker parks on the last day, late is said', m.day === 36 && m.marker === 29 && m.late === true)
}
{
  const withEnd = LOGS.map((r) => (r.id === 'l4' ? { ...r, ended_on: '2026-09-07' } : r))
  const m = ringModel(withEnd, predict(withEnd, null, TODAY), { today: TODAY })
  ok('a recorded end shortens the period segment: 3 days, not the default 5', seg(m, 'period')?.to === 3, JSON.stringify(seg(m, 'period')))
}
{
  /* Nothing recorded since June: predict rolls forward, missed > 0. */
  const old = LOGS.slice(0, 2)
  const p = predict(old, null, TODAY)
  const m = ringModel(old, p, { today: TODAY })
  ok('with periods missing, only the recorded period and the marker are drawn: no invented windows',
     p.missed > 0 && m.segments.length === 1 && m.segments[0].kind === 'period', JSON.stringify(m))
}
{
  const irregular = [
    { started_on: '2026-05-01' }, { started_on: '2026-05-25' }, { started_on: '2026-06-30' }, { started_on: '2026-07-24' },
  ]
  const p = predict(irregular, null, new Date(2026, 7, 1))
  const m = ringModel(irregular, p, { today: new Date(2026, 7, 1) })
  ok('an irregular cycle widens the expected segment to its window', p.window > 1 && seg(m, 'predicted')?.from === m.length - p.window + 1 && seg(m, 'predicted')?.from < seg(m, 'predicted')?.to, JSON.stringify({ window: p.window, seg: seg(m, 'predicted') }))
}
ok('no dates: no ring', ringModel([], pred) === null && ringModel(LOGS, null) === null)
ok('the order and the estimate set agree', SEGMENT_ORDER.filter((k) => ESTIMATES.has(k)).length === 3 && !ESTIMATES.has('period'))

console.log('\ngeometry')
{
  const p = polar(100, 100, 80, 0)
  ok('zero degrees is the top', close(p.x, 100) && close(p.y, 20))
  const q = polar(100, 100, 80, 90)
  ok('ninety degrees is the right, clockwise', close(q.x, 180) && close(q.y, 100))
  ok('the middle of day 1 of 4 is at 45 degrees', close(dayAngle(1, 4), 45))
  ok('the middle of the last day of 29 is just before the top', dayAngle(29, 29) > 350 && dayAngle(29, 29) < 360)
  const d = arcPath(100, 100, 80, 1, 2, 4)
  ok('days 1 to 2 of 4 is a half turn from the top to the bottom', /^M100 20A80 80 0 0 1 100 180$/.test(d), d)
  const big = arcPath(100, 100, 80, 1, 3, 4)
  ok('three quarters uses the large-arc flag', /A80 80 0 1 1 /.test(big), big)
  const full = arcPath(100, 100, 80, 1, 4, 4)
  ok('a full ring is shortened so the arc does not vanish', !/100 20$/.test(full) && /A80 80 0 1 1 /.test(full), full)
}

console.log(`\n${total - faux} passed, ${faux} failed`)
process.exit(faux ? 1 : 0)
