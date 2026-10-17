import { useSyncExternalStore } from 'react'
import { DEFAULTS, IDLE, auto, endBlock, examBlock, extend, pause, prefsOf, restore, resume, running, start, startBreak, stop, tick } from '../lib/bb/pomodoro'
import { play, unlock } from '../lib/bb/chime'
import { logFocus } from './focus'

/**
 * THE POMODORO, ONE FOR THE WHOLE APP. Today's card, the badge in the bars
 * and in a session, and the purple and yellow screens all read this one
 * timer (src/bb/Pomodoro.jsx); its states and arithmetic are in
 * src/lib/bb/pomodoro.js.
 *
 * Kept in localStorage, per account, so it survives a reload, a closed tab
 * and the phone going to sleep: every time in it is an instant, and the
 * clock is only read, never counted. Ticks once a second while something
 * runs and someone is looking; a tab that comes back to the front catches up
 * at once. Two tabs share it through the storage event, and before a tick
 * reads what the other tab may have stored, so a block is ended (and
 * logged) once.
 *
 * The bells ring when the end is seen as it happens (within 90 seconds: a
 * tab in the background ticks about once a minute). A block that ended
 * while the phone slept ends without a bell; its screen is waiting.
 */
const PREFS = 'hakkilo.pomodoro.prefs'
const stateKey = (user) => `hakkilo.pomodoro.${user ?? 'anon'}`
const RING_LATE_MS = 90000

let user = null
let state = IDLE
let prefs = DEFAULTS
let snap = { state, prefs, now: Date.now() }
const listeners = new Set()
let interval = null

const read = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: the timer lasts as long as the tab */
  }
}

function emit(now = Date.now()) {
  snap = { state, prefs, now }
  listeners.forEach((l) => l())
}

function schedule() {
  const want = running(state) && listeners.size > 0
  if (want && !interval) interval = setInterval(step, 1000)
  if (!want && interval) {
    clearInterval(interval)
    interval = null
  }
}

/* A new state: its row of study time to the log, stored, shown. */
function apply({ state: next, log }) {
  if (log) logFocus(user, log)
  if (next === state && !log) return
  state = next
  write(stateKey(user), state)
  schedule()
  emit()
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function step() {
  /* What another tab stored wins; nothing stored (storage blocked) keeps this one. */
  const raw = read(stateKey(user))
  if (raw) {
    const stored = restore(raw)
    if (!same(stored, state)) state = stored
  }
  const now = Date.now()
  const before = state
  const r = tick(state, now)
  if (r.state === before) {
    schedule()
    return emit(now)
  }
  apply(r)
  if (prefs.sound && now - (before.endsAt ?? now) < RING_LATE_MS) play(before.phase === 'focus' ? 'focusEnd' : 'breakEnd')
}

/* --- what the page listens to --------------------------------------------- */

function onStorage(e) {
  if (e.key === stateKey(user)) {
    state = restore(read(stateKey(user)))
    schedule()
    emit()
  } else if (e.key === PREFS) {
    prefs = prefsOf(read(PREFS))
    emit()
  }
}
const onVisible = () => {
  if (document.visibilityState === 'visible') step()
}
/* The first touch opens the audio, so the bell can ring later on its own.
   pointerup and not pointerdown: a finger's pointerdown does not count as a
   gesture for audio, its pointerup does. */
const onGesture = () => {
  if (prefs.sound) unlock()
}

function attach() {
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pointerup', onGesture, true)
  window.addEventListener('keydown', onGesture, true)
}
function detach() {
  window.removeEventListener('storage', onStorage)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('pointerup', onGesture, true)
  window.removeEventListener('keydown', onGesture, true)
}

function subscribe(listener) {
  listeners.add(listener)
  if (listeners.size === 1) attach()
  schedule()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) detach()
    schedule()
  }
}

const SERVER = { state: IDLE, prefs: DEFAULTS, now: 0 }

/** { state, prefs, now }: re-rendered every second while a block or a break runs. */
export const usePomodoro = () => useSyncExternalStore(subscribe, () => snap, () => SERVER)

/** Whose timer this is: the account, set by the app (BBApp's Provider). */
export function timerUser(id) {
  if ((id ?? null) === user) return
  user = id ?? null
  state = restore(read(stateKey(user)))
  prefs = prefsOf(read(PREFS))
  step()
}

const now = () => Date.now()

/** Everything a button does to the timer. */
export const pomodoro = {
  start() {
    unlock()
    apply(start(state, now(), { focusMin: prefs.focusMin, breakMin: prefs.breakMin }))
    if (prefs.sound) play('start')
  },
  pause: () => apply(pause(state, now())),
  resume: () => apply(resume(state, now())),
  stop: () => apply(stop(state, now())),
  startBreak: () => apply(startBreak(state, now(), prefs.breakMin)),
  extend: () => apply(extend(state, now(), 5)),
  /* The break screen out of the way, the break still counting in the badge. */
  hide: () => state.phase === 'break' && apply({ state: { ...state, hidden: true }, log: null }),
  show: () => state.hidden && apply({ state: { ...state, hidden: false }, log: null }),
  /* A session began (src/bb/pages/Session.jsx). */
  session: (minutes) => apply(auto(state, now(), { focusMin: minutes, breakMin: prefs.breakMin, source: 'session' })),
  /* A mock exam began or came back (src/bb/pages/Exam.jsx), and was handed in. */
  exam: ({ minutes, endsAt }) => apply(examBlock(state, now(), { focusMin: minutes, endsAt, breakMin: prefs.breakMin })),
  examDone: () => apply(endBlock(state, now(), 'exam')),
  setPrefs(patch) {
    prefs = prefsOf({ ...prefs, ...patch })
    write(PREFS, prefs)
    if (prefs.sound) unlock()
    emit()
  },
}
