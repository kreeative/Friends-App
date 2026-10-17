/**
 * The Pomodoro timer: its states and its arithmetic, with no clock and no
 * storage of its own, so node can test every step (pomodoro.test.mjs).
 *
 *   "Ajoute un timer pomodoro sur la page d'accueil, qui peut te suivre sur
 *    toutes tes pages comme une petite icone, et si les 25 minutes ou le temps
 *    que tu as programme arrive, tout l'ecran devient violet avec un message
 *    prends une pause, et pendant la pause l'ecran devient jaune et decompte
 *    le temps de pause" (Kee), then "quand tu commences une session, ca compte
 *    aussi comme un pomodoro, comme ca l'app calcule au total combien de temps
 *    tu passes".
 *
 *   idle       nothing runs
 *   focus      counting down a block of work (paused when `left` is set)
 *   focusDone  the block is over: the purple screen, "prends une pause"
 *   break      counting down the break: the yellow screen
 *   breakDone  the break is over: back to work, or stop
 *
 * Every time is an absolute instant (`endsAt`, in ms), never a count of
 * ticks: a phone puts a background tab to sleep, and a timer that counted
 * its own ticks would come back late. The time worked is banked when a block
 * ends, is stopped or is paused, and handed back as `log` for the caller to
 * save: one row per stretch of work, its start and its seconds.
 */

export const FOCUS_CHOICES = [15, 25, 50]
export const BREAK_CHOICES = [5, 10, 15]
export const DEFAULTS = { focusMin: 25, breakMin: 5, sound: true }

/* Under a minute is a mis-tap, not study time. */
export const MIN_LOG_SECONDS = 60

export const IDLE = { phase: 'idle' }

const minutes = (n, fallback) => {
  const m = Number(n)
  return Number.isFinite(m) && m > 0 && m <= 240 ? m : fallback
}

/** The preferences as stored, made safe: unknown lengths fall back to the defaults. */
export function prefsOf(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return {
    focusMin: minutes(p.focusMin, DEFAULTS.focusMin),
    breakMin: minutes(p.breakMin, DEFAULTS.breakMin),
    sound: p.sound !== false,
  }
}

/** Is a block of work or a break counting down right now (not paused)? */
export const running = (s) => (s?.phase === 'focus' || s?.phase === 'break') && s.endsAt != null && s.left == null

/** Milliseconds left in the block or the break, never below zero. */
export function leftOf(s, now) {
  if (!s || (s.phase !== 'focus' && s.phase !== 'break')) return 0
  if (s.left != null) return Math.max(0, s.left)
  return Math.max(0, (s.endsAt ?? now) - now)
}

/** The share of the block or break already gone, 0 to 1, for the ring. */
export function doneShare(s, now) {
  const total = s?.phase === 'break' ? s.breakMin * 60000 : s?.phase === 'focus' ? s.spanMs ?? s.focusMin * 60000 : 0
  if (!total) return 0
  return Math.min(1, Math.max(0, 1 - leftOf(s, now) / total))
}

/** "18:42". */
export function clock(ms) {
  const sec = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/* The row to save for what was worked since `from`, or null under a minute. */
function rowOf(s, until) {
  const ms = (s.bankedMs ?? 0) + (s.from != null ? Math.max(0, until - s.from) : 0)
  const seconds = Math.round(ms / 1000)
  if (seconds < MIN_LOG_SECONDS) return null
  return { started_at: new Date(s.blockStart ?? until - ms).toISOString(), seconds, source: s.source ?? 'timer' }
}

/**
 * Start a block of work. From idle, from a finished break, or to replace a
 * block in progress (whose time is banked and handed back first).
 *
 * `endsAt` sets the end instead of the length: a mock exam that resumes
 * after a reload ends when the exam does, not a whole exam later.
 */
export function start(s, now, { focusMin, breakMin, source = 'timer', endsAt = null } = {}) {
  const prior = s?.phase === 'focus' ? rowOf(s, now) : null
  const f = minutes(focusMin, DEFAULTS.focusMin)
  const end = Number.isFinite(endsAt) && endsAt > now ? Math.min(endsAt, now + 240 * 60000) : now + f * 60000
  return {
    state: {
      phase: 'focus',
      focusMin: f,
      breakMin: minutes(breakMin, s?.breakMin ?? DEFAULTS.breakMin),
      spanMs: f * 60000,
      endsAt: end,
      left: null,
      from: now,
      bankedMs: 0,
      blockStart: now,
      source,
    },
    log: prior,
  }
}

/**
 * A session began: "quand tu commences une session, ca compte aussi comme
 * un pomodoro" (Kee). A block of the session's length starts unless one is
 * already under way, which goes on (a paused one picks up again): the
 * session is inside it, and its minutes are counted once.
 */
export function auto(s, now, { focusMin, breakMin, source = 'session' } = {}) {
  if (s?.phase === 'focus') return s.left != null ? resume(s, now) : { state: s, log: null }
  return start(s, now, { focusMin, breakMin, source })
}

/**
 * A mock exam began, or came back after a reload: the exam is the block,
 * from now to its own end. Whatever ran before is banked first, so a block
 * of 25 minutes never ends in the middle of an exam with a purple screen.
 * Nothing changes when the block already is this exam's.
 */
export function examBlock(s, now, { focusMin, endsAt, breakMin }) {
  if (s?.phase === 'focus' && s.source === 'exam' && s.left == null && Math.abs((s.endsAt ?? 0) - endsAt) < 5000) return { state: s, log: null }
  return start(s, now, { focusMin, breakMin, source: 'exam', endsAt })
}

/**
 * The exam was handed in: its block ends now, with the time it took, and
 * the break is offered as at the end of any block (not after a minute: that
 * was a mis-tap, not work). A block that is not the exam's is left alone.
 */
export function endBlock(s, now, source) {
  if (s?.phase !== 'focus' || (source && s.source !== source)) return { state: s, log: null }
  const log = rowOf(s, s.left != null ? now : Math.min(now, s.endsAt))
  if (!log) return { state: IDLE, log: null }
  return { state: { phase: 'focusDone', focusMin: s.focusMin, breakMin: s.breakMin, doneAt: now, source: s.source }, log }
}

/** Pause the countdown; the time worked so far is kept in the block. */
export function pause(s, now) {
  if (!running(s)) return { state: s, log: null }
  const left = Math.max(0, s.endsAt - now)
  if (s.phase === 'focus') return { state: { ...s, left, endsAt: null, bankedMs: (s.bankedMs ?? 0) + Math.max(0, now - s.from), from: null }, log: null }
  return { state: { ...s, left, endsAt: null }, log: null }
}

export function resume(s, now) {
  if (!s || s.left == null || (s.phase !== 'focus' && s.phase !== 'break')) return { state: s, log: null }
  if (s.phase === 'focus') return { state: { ...s, endsAt: now + s.left, left: null, from: now }, log: null }
  return { state: { ...s, endsAt: now + s.left, left: null }, log: null }
}

/**
 * Where the clock has got to. A block that ran out while the phone slept is
 * done at the moment it ran out, not when the app woke up: its time is the
 * block's, and the purple screen waits for whoever comes back.
 */
export function tick(s, now) {
  if (!running(s) || s.endsAt > now) return { state: s, log: null }
  if (s.phase === 'focus') {
    const log = rowOf(s, s.endsAt)
    return { state: { phase: 'focusDone', focusMin: s.focusMin, breakMin: s.breakMin, doneAt: s.endsAt, source: s.source }, log }
  }
  return { state: { phase: 'breakDone', focusMin: s.focusMin, breakMin: s.breakMin, doneAt: s.endsAt, source: s.source }, log: null }
}

/** "Commencer la pause". */
export function startBreak(s, now, breakMin) {
  const b = minutes(breakMin, s?.breakMin ?? DEFAULTS.breakMin)
  return { state: { phase: 'break', focusMin: s?.focusMin ?? DEFAULTS.focusMin, breakMin: b, endsAt: now + b * 60000, left: null, source: s?.source ?? 'timer' }, log: null }
}

/** "Encore 5 minutes": the same work goes on, a short block of its own. */
export function extend(s, now, min = 5) {
  const m = minutes(min, 5)
  return {
    state: { phase: 'focus', focusMin: s?.focusMin ?? DEFAULTS.focusMin, breakMin: s?.breakMin ?? DEFAULTS.breakMin, spanMs: m * 60000, endsAt: now + m * 60000, left: null, from: now, bankedMs: 0, blockStart: now, source: s?.source ?? 'timer' },
    log: null,
  }
}

/** "Terminer": back to idle, keeping what was worked in a block cut short. */
export function stop(s, now) {
  const log = s?.phase === 'focus' ? rowOf(s, now) : null
  return { state: IDLE, log }
}

/**
 * The state as read back from storage: anything that is not one of the five
 * phases with the numbers it needs is nothing at all.
 */
export function restore(raw) {
  const s = raw && typeof raw === 'object' ? raw : null
  if (!s || !['idle', 'focus', 'focusDone', 'break', 'breakDone'].includes(s.phase)) return IDLE
  if ((s.phase === 'focus' || s.phase === 'break') && s.endsAt == null && s.left == null) return IDLE
  return s
}

/**
 * Seconds of study in a list of rows, for today, this week (from Monday) and
 * in all, in the reader's own time zone (`now` is a Date in it).
 */
export function totalsOf(rows, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monday = new Date(day)
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  let today = 0
  let week = 0
  let total = 0
  for (const r of rows ?? []) {
    const sec = Number(r?.seconds) || 0
    if (sec <= 0) continue
    const at = new Date(r.started_at)
    total += sec
    if (at >= monday) week += sec
    if (at >= day) today += sec
  }
  return { today, week, total }
}

/*
 * The log kept in the browser (src/bb/focus.js): every row, `sent` once the
 * database has it. A row is known by its start, so the same block logged by
 * two tabs is one row here as it is one row there (the key of bb_focus).
 * The oldest rows already sent go first when it is full.
 */
export const LOG_KEEP = 1500

export function logAdd(list, row, keep = LOG_KEEP) {
  const rows = Array.isArray(list) ? list.filter((r) => r && r.started_at && Number(r.seconds) > 0) : []
  if (!row?.started_at || !(Number(row.seconds) > 0) || rows.some((r) => r.started_at === row.started_at)) return rows
  const next = [...rows, { started_at: row.started_at, seconds: Math.round(row.seconds), source: row.source ?? 'timer', sent: false }]
  let over = next.length - keep
  if (over <= 0) return next
  return next.filter((r) => (over > 0 && r.sent ? (over--, false) : true)).slice(-keep)
}

export const logPending = (list) => (Array.isArray(list) ? list.filter((r) => !r.sent) : [])

export function logSent(list, startedAts) {
  const done = new Set(startedAts)
  return (Array.isArray(list) ? list : []).map((r) => (done.has(r.started_at) ? { ...r, sent: true } : r))
}

/** "1 h 05", "50 min", "0 min": a length of study, in words a person reads. */
export function spent(seconds, { h = 'h', min = 'min' } = {}) {
  const m = Math.floor((Number(seconds) || 0) / 60)
  if (m < 60) return `${m} ${min}`
  return `${Math.floor(m / 60)} ${h} ${String(m % 60).padStart(2, '0')}`
}
