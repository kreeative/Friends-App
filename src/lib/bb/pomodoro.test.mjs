/**
 * node src/lib/bb/pomodoro.test.mjs
 *
 * The Pomodoro timer's states and arithmetic (src/lib/bb/pomodoro.js): every
 * step with a clock passed in, so a block that runs out while the phone
 * sleeps, a pause, a stop halfway and the week's total are all checked
 * without a browser.
 */
import {
  BREAK_CHOICES, DEFAULTS, FOCUS_CHOICES, IDLE, MIN_LOG_SECONDS,
  auto, clock, doneShare, endBlock, examBlock, extend, leftOf, logAdd, logPending, logSent, pause, prefsOf, restore, resume, running, spent, start, startBreak, stop, tick, totalsOf,
} from './pomodoro.js'
import { NOTES, play } from './chime.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const MIN = 60000
const T0 = Date.UTC(2026, 9, 16, 14, 0, 0)

console.log('\nthe pomodoro timer')

/* --- the lengths ---------------------------------------------------------- */
ok('25 and 5 by default, the sound on', DEFAULTS.focusMin === 25 && DEFAULTS.breakMin === 5 && DEFAULTS.sound === true)
ok('the lengths offered', FOCUS_CHOICES.includes(25) && BREAK_CHOICES.includes(5))
ok('stored preferences are made safe', JSON.stringify(prefsOf({ focusMin: 'x', breakMin: -3, sound: false })) === JSON.stringify({ focusMin: 25, breakMin: 5, sound: false }))
ok('and kept when they are sound', prefsOf({ focusMin: 50, breakMin: 10 }).focusMin === 50 && prefsOf({ focusMin: 50, breakMin: 10 }).breakMin === 10)

/* --- a whole block -------------------------------------------------------- */
let { state: s, log } = start(IDLE, T0, { focusMin: 25, breakMin: 5 })
ok('starting counts down 25 minutes', s.phase === 'focus' && leftOf(s, T0) === 25 * MIN && running(s) && log === null)
ok('the clock reads it', clock(leftOf(s, T0 + 1000)) === '24:59' && clock(0) === '00:00')
ok('the ring fills', doneShare(s, T0 + 12.5 * MIN) === 0.5)
;({ state: s, log } = tick(s, T0 + 10 * MIN))
ok('before the end, nothing moves', s.phase === 'focus' && log === null)

/* The phone slept through the end: the block is over at the moment it ran
   out, and its 25 minutes are logged, not the two hours it slept. */
;({ state: s, log } = tick(s, T0 + 120 * MIN))
ok('a block that ran out while away is done', s.phase === 'focusDone' && s.doneAt === T0 + 25 * MIN)
ok('and its 25 minutes are logged, from when it started', log?.seconds === 25 * 60 && log.started_at === new Date(T0).toISOString() && log.source === 'timer')

/* --- the break ------------------------------------------------------------ */
;({ state: s } = startBreak(s, T0 + 121 * MIN))
ok('the break counts down its own length', s.phase === 'break' && leftOf(s, T0 + 121 * MIN) === 5 * MIN)
;({ state: s, log } = tick(s, T0 + 126 * MIN))
ok('and ends in breakDone, logging nothing', s.phase === 'breakDone' && log === null)

/* --- pausing and stopping ------------------------------------------------- */
;({ state: s } = start(s, T0 + 130 * MIN, { focusMin: 25 }))
;({ state: s } = pause(s, T0 + 140 * MIN))
ok('a pause keeps what is left', s.left === 15 * MIN && !running(s) && leftOf(s, T0 + 999 * MIN) === 15 * MIN)
;({ state: s } = resume(s, T0 + 200 * MIN))
ok('and gives it back when resumed', leftOf(s, T0 + 200 * MIN) === 15 * MIN && running(s))
;({ state: s, log } = stop(s, T0 + 205 * MIN))
ok('stopping halfway logs the work and not the pause', s.phase === 'idle' && log?.seconds === 15 * 60)

;({ state: s } = start(IDLE, T0, { focusMin: 25 }))
;({ state: s, log } = stop(s, T0 + 30 * 1000))
ok('under a minute is a mis-tap, not study time', log === null && MIN_LOG_SECONDS === 60)

/* "Encore 5 minutes" after the purple screen. */
;({ state: s } = start(IDLE, T0, { focusMin: 25 }))
;({ state: s } = tick(s, T0 + 25 * MIN))
;({ state: s } = extend(s, T0 + 26 * MIN, 5))
ok('five more minutes is a short block of its own', s.phase === 'focus' && leftOf(s, T0 + 26 * MIN) === 5 * MIN && doneShare(s, T0 + 28.5 * MIN) === 0.5)
;({ state: s, log } = tick(s, T0 + 31 * MIN))
ok('logged when it ends', s.phase === 'focusDone' && log?.seconds === 5 * 60)

/* A session started over a block in progress replaces it, keeping its time. */
;({ state: s } = start(IDLE, T0, { focusMin: 25 }))
;({ state: s, log } = start(s, T0 + 10 * MIN, { focusMin: 25, source: 'session' }))
ok('a new block keeps the time of the one it replaces', log?.seconds === 10 * 60 && s.source === 'session' && leftOf(s, T0 + 10 * MIN) === 25 * MIN)

/* --- a session starts one by itself ---------------------------------------- */
;({ state: s, log } = auto(IDLE, T0, { focusMin: 15 }))
ok('a session with no block running starts one of its length', s.phase === 'focus' && s.source === 'session' && leftOf(s, T0) === 15 * MIN && log === null)
const running25 = start(IDLE, T0, { focusMin: 25 }).state
;({ state: s, log } = auto(running25, T0 + 5 * MIN, { focusMin: 15 }))
ok('a block already running goes on, the session inside it', s === running25 && log === null)
;({ state: s } = pause(running25, T0 + 5 * MIN))
;({ state: s } = auto(s, T0 + 9 * MIN, { focusMin: 15 }))
ok('a paused one picks up again', running(s) && leftOf(s, T0 + 9 * MIN) === 20 * MIN && s.source === 'timer')
;({ state: s } = auto(startBreak(IDLE, T0, 5).state, T0 + 2 * MIN, { focusMin: 10 }))
ok('a session started during a break ends the break', s.phase === 'focus' && leftOf(s, T0 + 2 * MIN) === 10 * MIN)

/* --- a mock exam is the block ----------------------------------------------- */
const examEnd = T0 + 60 * MIN
;({ state: s, log } = examBlock(running25, T0 + 10 * MIN, { focusMin: 60, endsAt: examEnd + 10 * MIN }))
ok('an exam replaces the block that ran, keeping its time', s.source === 'exam' && log?.seconds === 10 * 60 && s.endsAt === examEnd + 10 * MIN)
const same = examBlock(s, T0 + 11 * MIN, { focusMin: 60, endsAt: examEnd + 10 * MIN })
ok('and is left alone when it already is this exam', same.state === s && same.log === null)
;({ state: s } = examBlock(IDLE, T0 + 40 * MIN, { focusMin: 60, endsAt: examEnd }))
ok('an exam that resumes after a reload ends with the exam', s.endsAt === examEnd && leftOf(s, T0 + 40 * MIN) === 20 * MIN)
;({ state: s, log } = endBlock(s, T0 + 52 * MIN, 'exam'))
ok('handing it in ends the block with the time it took, and offers the break', s.phase === 'focusDone' && log?.seconds === 12 * 60)
ok('a block that is not the exam is left alone', endBlock(running25, T0 + 5 * MIN, 'exam').state === running25)
{
  const quick = examBlock(IDLE, T0, { focusMin: 60, endsAt: T0 + 60 * MIN }).state
  const r = endBlock(quick, T0 + 30 * 1000, 'exam')
  ok('an exam handed in after half a minute offers no break and logs nothing', r.state.phase === 'idle' && r.log === null)
}
ok('a long exam is not cut to the default length', examBlock(IDLE, T0, { focusMin: 180, endsAt: T0 + 180 * MIN }).state.endsAt === T0 + 180 * MIN)

/* --- what is read back from storage --------------------------------------- */
ok('garbage is idle', restore(null) === IDLE && restore({ phase: 'nope' }) === IDLE && restore({ phase: 'focus' }) === IDLE)
ok('a real state comes back as it was', restore({ phase: 'break', endsAt: 5, breakMin: 5 }).phase === 'break')

/* --- the totals ----------------------------------------------------------- */
const now = new Date(2026, 9, 16, 15, 0) // a Friday, local time
const rows = [
  { started_at: new Date(2026, 9, 16, 9, 0).toISOString(), seconds: 25 * 60 },
  { started_at: new Date(2026, 9, 14, 9, 0).toISOString(), seconds: 50 * 60 }, // Wednesday
  { started_at: new Date(2026, 9, 11, 9, 0).toISOString(), seconds: 25 * 60 }, // last Sunday
  { started_at: new Date(2026, 8, 1, 9, 0).toISOString(), seconds: 60 * 60 },
]
const tot = totalsOf(rows, now)
ok('today, this week from Monday, and in all', tot.today === 25 * 60 && tot.week === 75 * 60 && tot.total === 160 * 60, JSON.stringify(tot))
ok('said in words', spent(25 * 60) === '25 min' && spent(160 * 60) === '2 h 40' && spent(65 * 60, { h: 'h', min: 'min' }) === '1 h 05' && spent(0) === '0 min')

/* --- the log kept in the browser -------------------------------------------- */
const r1 = { started_at: new Date(T0).toISOString(), seconds: 1500, source: 'timer' }
let list = logAdd([], r1)
ok('a block goes in the log, waiting to be sent', list.length === 1 && list[0].sent === false && logPending(list).length === 1)
ok('the same block twice (two tabs) is one row', logAdd(list, { ...r1 }).length === 1)
list = logSent(list, [r1.started_at])
ok('sent, it stops waiting', logPending(list).length === 0 && list[0].sent === true)
let full = []
for (let i = 0; i < 5; i += 1) full = logAdd(full, { started_at: new Date(T0 + i * MIN).toISOString(), seconds: 600 }, 4)
ok('full, the oldest goes', full.length === 4 && full[0].started_at === new Date(T0 + MIN).toISOString())
full = logSent(full, [full[1].started_at])
full = logAdd(full, { started_at: new Date(T0 + 9 * MIN).toISOString(), seconds: 600 }, 4)
ok('and one already sent goes before one still waiting', full.length === 4 && full.every((r) => !r.sent) && full[0].started_at === new Date(T0 + MIN).toISOString())
ok('nothing that is not a block gets in', logAdd([], { started_at: null, seconds: 5 }).length === 0 && logAdd([], { started_at: 'x', seconds: 0 }).length === 0)

/* --- the sounds (src/lib/bb/chime.js), on a pretend audio context ----------- */
{
  const made = []
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} })
  const node = (kind) => {
    const n = { kind, gain: param(), frequency: param(), connect() {}, start(at) { n.at = at }, stop() {} }
    made.push(n)
    return n
  }
  const fake = { state: 'running', currentTime: 10, destination: {}, createGain: () => node('gain'), createOscillator: () => node('osc') }
  ok('nothing plays before a tap opened the audio', play('focusEnd') === false)
  ok('the end of a block rings', play('focusEnd', fake) === true)
  const oscs = made.filter((n) => n.kind === 'osc')
  ok('two notes, each a bell of three partials', oscs.length === NOTES.focusEnd.length * 3 && oscs.some((o) => o.frequency.value === 784) && oscs.some((o) => o.frequency.value === 587))
  ok('the end of a break goes up in three notes', NOTES.breakEnd.length === 3 && NOTES.breakEnd.every((n, i, a) => i === 0 || n[0] > a[i - 1][0]))
  ok('an unknown sound plays nothing', play('nope', fake) === false)
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
