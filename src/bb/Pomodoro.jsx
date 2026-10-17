import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { lockScroll } from '../lib/scrollLock'
import { SegTabs } from '../components/ui'
import { BREAK_CHOICES, FOCUS_CHOICES, clock, doneShare, leftOf, spent } from '../lib/bb/pomodoro'
import { pomodoro, usePomodoro } from './timer'
import { useFocusTotals } from './focus'
import { BigButton, LILAC, LOGO_YELLOW, PILL, PILL_ROUND } from './kit'

/**
 * THE POMODORO, WHAT YOU SEE OF IT.
 *
 *   "Ajoute un timer pomodoro sur la page d'accueil, qui peut te suivre sur
 *    toutes tes pages comme une petite icone, et si les 25 minutes ou le
 *    temps que tu as programme arrive, tout l'ecran devient violet avec un
 *    message prends une pause avec les differents boutons necessaires, et
 *    pendant la pause l'ecran devient jaune et decompte le temps de pause,
 *    avec des sound effects desactivables" (Kee).
 *
 *   PomodoroCard     on Today: the lengths, the start, the clock in its
 *                    ring, and the study time counted (src/bb/focus.js).
 *   PomodoroBadge    the little clock that follows: in the top bar on a
 *                    phone, in the rail from md, in a session's bar. Tapping
 *                    it opens the same controls in a sheet.
 *   PomodoroScreens  the end of a block, the whole screen lilac ("prends une
 *                    pause"), and the break, the whole screen the logo
 *                    yellow, counting down.
 *
 * Lilac is Hakkilo's purple (src/bb/kit.jsx: the saturated violet was
 * refused), so ink on it is 11.5:1; ink on the yellow is 12.2:1. The words
 * say what the colour says: the colour is never the only sign.
 *
 * A mock exam is a room nobody walks into: the screens wait while its page
 * is open (its block ends when the paper is handed in) and show once the
 * student leaves it.
 */

const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }
const IconPause = (p) => (
  <svg {...S} {...p}>
    <path d="M9 6v12M15 6v12" />
  </svg>
)
const IconPlay = (p) => (
  <svg {...S} {...p}>
    <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
  </svg>
)
const IconStop = (p) => (
  <svg {...S} {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" />
  </svg>
)
const IconSound = (p) => (
  <svg {...S} {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
  </svg>
)
const IconMute = (p) => (
  <svg {...S} {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
)
/* A cup: the break. */
const IconCup = (p) => (
  <svg {...S} {...p}>
    <path d="M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5z" />
    <path d="M16 10.5h1.5a2.5 2.5 0 010 5H16M8.5 3.5v2.5M12 3.5v2.5" />
  </svg>
)
const IconDown = (p) => (
  <svg {...S} {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </svg>
)

/**
 * The ring that fills as the block goes. Yellow, the colour of what is
 * switched on, as the progress bars are; the clock in it says the time, so
 * the 1.3:1 of yellow on the grey track only shows what the number says.
 * No round cap at zero: it would paint a dot (CLAUDE.md).
 */
function Ring({ share = 0, size = 112, stroke = 8, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const s = Math.max(0, Math.min(1, share))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} data-hook="bb-pomo-ring" data-share={Math.round(s * 100)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(17 17 17 / 0.1)" strokeWidth={stroke} />
        {s > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LOGO_YELLOW} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s)} />
        )}
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  )
}

/** The sound of the bells, on or off: the yellow of switched on, and the words. */
function SoundSwitch({ className = '' }) {
  const { t } = useT()
  const { prefs } = usePomodoro()
  const on = prefs.sound
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => pomodoro.setPrefs({ sound: !on })}
      data-hook="bb-pomo-sound"
      className={`${PILL} shrink-0 whitespace-nowrap ${on ? '!border-ink/25 !bg-[#F8CB02]' : ''} ${className}`}
    >
      {on ? <IconSound className="h-4 w-4" /> : <IconMute className="h-4 w-4" />}
      {on ? t('bb.pomo.sound_on') : t('bb.pomo.sound_off')}
    </button>
  )
}

/** The clock in its ring, what is happening, and what can be done about it. */
function Live() {
  const { t } = useT()
  const { state, now } = usePomodoro()
  const focus = state.phase === 'focus'
  const held = focus && state.left != null
  const status = focus ? (held ? t('bb.pomo.held') : t('bb.pomo.running')) : t('bb.pomo.on_break')
  return (
    <div className="mt-4" data-hook="bb-pomo-live" data-phase={held ? 'held' : state.phase}>
      <div className="flex items-center gap-5">
        <Ring share={doneShare(state, now)}>
          <span className="text-[1.625rem] font-bold tabular-nums text-ink" data-hook="bb-pomo-clock">
            {clock(leftOf(state, now))}
          </span>
        </Ring>
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink" data-hook="bb-pomo-status">
            {status}
          </p>
          {focus && <p className="mt-1 text-small text-muted">{t('bb.pomo.next_break', { n: state.breakMin })}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {focus && !held && (
          <button type="button" className={PILL} onClick={pomodoro.pause} data-hook="bb-pomo-hold">
            <IconPause className="h-4 w-4" />
            {t('bb.pomo.hold')}
          </button>
        )}
        {held && (
          <button type="button" className={PILL} onClick={pomodoro.resume} data-hook="bb-pomo-resume">
            <IconPlay className="h-4 w-4" />
            {t('bb.pomo.resume')}
          </button>
        )}
        {state.phase === 'break' && (
          <button type="button" className={PILL} onClick={pomodoro.show} data-hook="bb-pomo-show">
            <IconCup className="h-4 w-4" />
            {t('bb.pomo.show_break')}
          </button>
        )}
        <button type="button" className={PILL} onClick={pomodoro.stop} data-hook="bb-pomo-stop">
          <IconStop className="h-4 w-4" />
          {t('bb.pomo.stop')}
        </button>
      </div>
    </div>
  )
}

/** Today, this week, in all: a list, so a long total never breaks a column. */
function Totals() {
  const { t } = useT()
  const totals = useFocusTotals()
  const words = { h: t('bb.pomo.h'), min: t('bb.pomo.m') }
  const rows = [
    ['today', totals.today],
    ['week', totals.week],
    ['total', totals.total],
  ]
  return (
    <div className="mt-5 border-t border-hairline pt-4" data-hook="bb-pomo-totals">
      <h3 className="text-small font-bold text-ink">{t('bb.pomo.time')}</h3>
      <dl className="mt-2 space-y-1.5">
        {rows.map(([key, seconds]) => (
          <div key={key} className="flex items-baseline justify-between gap-4" data-total={key}>
            <dt className="text-small text-muted">{t(`bb.pomo.${key}`)}</dt>
            <dd className="text-body font-bold tabular-nums text-ink">{totals.ready ? spent(seconds, words) : '…'}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-small text-muted">{t('bb.pomo.counts')}</p>
    </div>
  )
}

/** On Today: the timer itself. */
export function PomodoroCard({ className = '' }) {
  const { t } = useT()
  /* "50 min" is one word to the eye: it never breaks between the two. */
  const nbsp = (n) => t('bb.course.minutes', { n }).replace(' ', '\u00a0')
  const { state, prefs } = usePomodoro()
  const idle = state.phase === 'idle' || state.phase === 'focusDone' || state.phase === 'breakDone'
  return (
    <section className={`lg p-5 ${className}`} aria-labelledby="bb-pomo-title" data-hook="bb-pomodoro">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="bb-pomo-title" className="text-body font-bold text-ink">
          {t('bb.pomo.title')}
        </h2>
        <SoundSwitch />
      </div>
      {idle ? (
        <>
          <p className="mt-1 text-small text-muted">{t('bb.pomo.lede', { focus: prefs.focusMin, pause: prefs.breakMin })}</p>
          {/* 8px a side in these tabs on a phone, not 12: at 320 three
              "50 min" got 230px and the last one broke onto two lines. */}
          <div className="mt-4 space-y-3 [&_[role=tab]]:px-2 sm:[&_[role=tab]]:px-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="w-14 shrink-0 text-small font-semibold text-ink">{t('bb.pomo.focus')}</p>
              <SegTabs value={prefs.focusMin} options={FOCUS_CHOICES} onChange={(n) => pomodoro.setPrefs({ focusMin: n })} label={t('bb.pomo.focus')} hook="bb-pomo-focus" labelOf={nbsp} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="w-14 shrink-0 text-small font-semibold text-ink">{t('bb.pomo.break')}</p>
              <SegTabs value={prefs.breakMin} options={BREAK_CHOICES} onChange={(n) => pomodoro.setPrefs({ breakMin: n })} label={t('bb.pomo.break')} hook="bb-pomo-break" labelOf={nbsp} />
            </div>
          </div>
          <BigButton className="mt-5 w-full" onClick={pomodoro.start} data-hook="bb-pomo-start">
            {t('bb.pomo.start', { n: prefs.focusMin })}
          </BigButton>
        </>
      ) : (
        <Live />
      )}
      <Totals />
    </section>
  )
}

/* Keys stay with the screen on top: the session under it listens on the
   window (A to D, Space, Enter) and must not answer for it. Tab goes round
   the screen's own buttons. */
function useOwnKeys(ref, onEscape) {
  useEffect(() => {
    const onKey = (e) => {
      const box = ref.current
      if (!box) return
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
      } else if (e.key === 'Tab') {
        const items = [...box.querySelectorAll('button:not(:disabled)')]
        if (items.length) {
          const first = items[0]
          const last = items[items.length - 1]
          if (!box.contains(document.activeElement)) {
            e.preventDefault()
            first.focus()
          } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [ref, onEscape])
}

/** A round pill on the screens: the sound, and on the break, out of the way. */
function MuteRound() {
  const { t } = useT()
  const { prefs } = usePomodoro()
  const label = prefs.sound ? t('bb.pomo.mute') : t('bb.pomo.unmute')
  return (
    <button type="button" className={PILL_ROUND} aria-label={label} title={label} aria-pressed={!prefs.sound} onClick={() => pomodoro.setPrefs({ sound: !prefs.sound })} data-hook="bb-pomo-mute">
      {prefs.sound ? <IconSound className="h-[1.125rem] w-[1.125rem]" /> : <IconMute className="h-[1.125rem] w-[1.125rem]" />}
    </button>
  )
}

const SECOND = 'btn press bg-white px-4 font-bold text-ink ring-1 ring-inset ring-ink/15 hover:ring-ink/40'

/** The whole screen, in one colour, its words in the middle and its buttons within reach. */
function Screen({ ground, phase, eyebrow, title, body, big, onEscape, corner, children }) {
  const box = useRef(null)
  useOwnKeys(box, onEscape)
  useEffect(() => lockScroll(), [])
  /* The screen itself takes the focus, so a screen reader starts on it and
     not on the page under it. Not its first button: in a session Space and
     Enter move on, and a student pressing one as the block ends would start
     the break without having read a word. */
  useEffect(() => {
    box.current?.focus({ preventScroll: true })
  }, [phase])
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bb-pomo-screen-title"
      tabIndex={-1}
      className="fixed inset-0 z-[60] overflow-y-auto outline-none"
      style={{ background: ground }}
      data-hook="bb-pomo-screen"
      data-phase={phase}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[28rem] flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <MuteRound />
          {corner}
        </div>
        <div className="flex flex-1 flex-col justify-center py-10 text-ink">
          <p className="text-small font-bold uppercase tracking-[0.04em]">{eyebrow}</p>
          {big != null && (
            <p className="mt-2 text-[clamp(4.5rem,24vw,8rem)] font-bold leading-none tabular-nums" data-hook="bb-pomo-countdown" aria-live="off">
              {big}
            </p>
          )}
          <h2 id="bb-pomo-screen-title" className={`${big != null ? 'mt-4 text-h2' : 'mt-2 text-[clamp(2rem,9vw,2.75rem)] leading-tight'} font-bold`}>
            {title}
          </h2>
          {body && <p className="mt-3 max-w-[36ch] text-body">{body}</p>}
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** The screens, over every page of the app but a mock exam's. */
export function PomodoroScreens() {
  const { t } = useT()
  const { pathname } = useLocation()
  const { state, prefs, now } = usePomodoro()
  const hide = useCallback(() => pomodoro.hide(), [])
  if (pathname.startsWith('/hakkilo/examen/')) return null

  if (state.phase === 'focusDone') {
    return (
      <Screen ground={LILAC} phase="focusDone" eyebrow={t('bb.pomo.done_eyebrow', { n: state.focusMin })} title={t('bb.pomo.done_title')} body={t('bb.pomo.done_body')}>
        <BigButton data-primary onClick={pomodoro.startBreak} data-hook="bb-pomo-take-break">
          {t('bb.pomo.take_break', { n: prefs.breakMin })}
        </BigButton>
        <button type="button" className={SECOND} onClick={pomodoro.extend} data-hook="bb-pomo-more">
          {t('bb.pomo.more')}
        </button>
        <button type="button" className={SECOND} onClick={pomodoro.stop} data-hook="bb-pomo-end">
          {t('bb.pomo.end')}
        </button>
      </Screen>
    )
  }
  if (state.phase === 'break' && !state.hidden) {
    const label = t('bb.pomo.hide')
    return (
      <Screen
        ground={LOGO_YELLOW}
        phase="break"
        eyebrow={t('bb.pomo.break_eyebrow')}
        big={clock(leftOf(state, now))}
        title={prefs.sound ? t('bb.pomo.break_body') : t('bb.pomo.break_body_quiet')}
        onEscape={hide}
        corner={
          <button type="button" className={PILL_ROUND} aria-label={label} title={label} onClick={hide} data-hook="bb-pomo-hide">
            <IconDown className="h-[1.125rem] w-[1.125rem]" />
          </button>
        }
      >
        <BigButton data-primary onClick={pomodoro.start} data-hook="bb-pomo-back">
          {t('bb.pomo.back_now')}
        </BigButton>
        <button type="button" className={SECOND} onClick={pomodoro.stop} data-hook="bb-pomo-end">
          {t('bb.pomo.end')}
        </button>
      </Screen>
    )
  }
  if (state.phase === 'breakDone') {
    return (
      <Screen ground={LOGO_YELLOW} phase="breakDone" eyebrow={t('bb.pomo.over_eyebrow')} title={t('bb.pomo.over_title')}>
        <BigButton data-primary onClick={pomodoro.start} data-hook="bb-pomo-again">
          {t('bb.pomo.again', { n: prefs.focusMin })}
        </BigButton>
        <button type="button" className={SECOND} onClick={pomodoro.stop} data-hook="bb-pomo-end">
          {t('bb.pomo.end')}
        </button>
      </Screen>
    )
  }
  return null
}

/** The controls, from the badge, wherever the student is. */
function Sheet({ onClose }) {
  const { t } = useT()
  const panel = useRef(null)
  useOwnKeys(panel, onClose)
  useEffect(() => lockScroll(), [])
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/25 md:items-center md:justify-center md:p-6" onClick={onClose} data-hook="bb-pomo-sheet">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bb-pomo-sheet-title"
        className="w-full rounded-t-[1.75rem] bg-surface px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 outline-none md:max-w-[26rem] md:rounded-card md:px-6 md:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="bb-pomo-sheet-title" className="text-body font-bold text-ink">
            {t('bb.pomo.title')}
          </h2>
          <button type="button" className={PILL} onClick={onClose} data-hook="bb-pomo-sheet-close">
            {t('bb.pomo.close')}
          </button>
        </div>
        <Live />
        <SoundSwitch className="mt-4" />
      </div>
    </div>,
    document.body,
  )
}

/**
 * The little clock that follows the student. A pill in a bar, a tile of the
 * rail with `rail`. Nothing while no block runs, or `fallback` (the
 * session's own minutes). The break, out of the way, is a yellow pill with a
 * cup that brings its screen back.
 */
export function PomodoroBadge({ rail = false, fallback = null, className = '' }) {
  const { t } = useT()
  const { state, now } = usePomodoro()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const onBreak = state.phase === 'break' && state.hidden
  const shown = state.phase === 'focus' || onBreak
  useEffect(() => {
    if (!shown) setOpen(false)
  }, [shown])
  if (!shown) return fallback
  const held = state.phase === 'focus' && state.left != null
  const time = clock(leftOf(state, now))
  const label = onBreak ? t('bb.pomo.badge_break', { time }) : held ? t('bb.pomo.badge_held', { time }) : t('bb.pomo.badge_focus', { time })
  const tone = onBreak ? 'border-ink/25 bg-[#F8CB02]' : 'border-ink/15 bg-surface'
  const icon = rail ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'
  const mark = onBreak ? <IconCup className={icon} /> : held ? <IconPause className={icon} /> : <Ring share={doneShare(state, now)} size={rail ? 14 : 16} stroke={rail ? 2.5 : 3} />
  /* In the rail, a 44px row like the others: a tile taller than the rows
     was what put the H "pas bien dispose dans la grille" (Kee). */
  const look = rail
    ? `press flex h-11 w-full flex-col items-center justify-center gap-[3px] rounded-inner border text-[0.75rem] font-semibold leading-none tabular-nums text-ink transition-colors active:bg-[#CFC2FF] ${tone}`
    : `press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-2.5 text-small font-semibold tabular-nums text-ink transition-colors active:bg-[#CFC2FF] ${tone}`
  return (
    <>
      <button
        type="button"
        onClick={() => (onBreak ? pomodoro.show() : setOpen(true))}
        aria-label={label}
        title={label}
        data-hook="bb-pomo-badge"
        data-phase={onBreak ? 'break' : held ? 'held' : 'focus'}
        className={`${look} ${className}`}
      >
        {mark}
        <span aria-hidden="true">{time}</span>
      </button>
      {open && <Sheet onClose={close} />}
    </>
  )
}
