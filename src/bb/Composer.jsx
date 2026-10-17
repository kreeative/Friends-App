import { useNavigate } from 'react-router-dom'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { dictationNote, dictationSupport, heard, speechLang, withSpeech } from '../lib/bb/dictation'

/**
 * Where a question is asked, the way Claude asks for one: a white box with
 * the words on top and one row under them, a "+" at the start, the mic and
 * the send arrow at the end.
 *
 * "Au lieu que toutes les icones soient serrees ensemble, regroupe-les dans
 * un bouton en forme de plus": the course and the four ways to answer are in
 * the menu the "+" opens, each with its icon and its name. What was chosen
 * sits beside the "+" as a chip: the course in outline, the way to answer in
 * soft lilac (picked) with a cross to take it off. A chip opens the menu
 * again. Every button carries its name in aria-label and title.
 *
 * The mic dictates into the box with the browser's own speech recognition;
 * where it is hidden and why is in src/lib/bb/dictation.js.
 *
 * Used twice: the coach's own box (Coach.jsx) and the ask bar on Today and
 * on a course, which opens the coach with the question already sent.
 */
const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }

export const ArrowUp = (p) => (
  <svg {...S} strokeWidth={2.2} {...p}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
)
const Plus = (p) => (
  <svg {...S} strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const Mic = (p) => (
  <svg {...S} {...p}>
    <rect x="9" y="3" width="6" height="11.5" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" />
  </svg>
)
const Cross = (p) => (
  <svg {...S} strokeWidth={2.2} {...p}>
    <path d="m7 7 10 10M17 7 7 17" />
  </svg>
)
const Check = (p) => (
  <svg {...S} strokeWidth={2.2} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
const Book = (p) => (
  <svg {...S} {...p}>
    <path d="M5 4.5h9.5A2.5 2.5 0 0117 7v12.5H7.5A2.5 2.5 0 015 17z" />
    <path d="M5 17a2.5 2.5 0 012.5-2.5H17" />
  </svg>
)
/* A bulb: explain it simply. */
const Bulb = (p) => (
  <svg {...S} {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0012 3z" />
  </svg>
)
/* A question in a bubble: the coach answers with questions. */
const Ask = (p) => (
  <svg {...S} {...p}>
    <path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H10l-4.5 4v-4H5.5A1.5 1.5 0 014 14.5z" />
    <path d="M10 8.2a2 2 0 113 1.7c-.6.4-1 .8-1 1.6M12 13.3v.1" />
  </svg>
)
/* A tick in a circle: check my answer. */
const Tick = (p) => (
  <svg {...S} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
  </svg>
)
/* A target: quiz me. */
const Target = (p) => (
  <svg {...S} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </svg>
)
export const MODES = ['explain', 'socratic', 'check', 'quiz']
const MODE_ICON = { explain: Bulb, socratic: Ask, check: Tick, quiz: Target }

const ROUND = 'press flex h-9 w-9 shrink-0 items-center justify-center rounded-pill transition-colors duration-150'

/**
 * The mic. What is said goes into the box after what was typed, as it is
 * heard. It stops at a second tap, when the student types or sends, and on
 * a phone when she stops talking.
 */
function useDictation(value, onChange) {
  const { locale } = useT()
  const [support] = useState(() => dictationSupport())
  const [on, setOn] = useState(false)
  const [note, setNote] = useState(null)
  const rec = useRef(null)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }

  useEffect(() => () => rec.current?.abort(), [])

  function start() {
    const r = new support.Recognition()
    r.lang = speechLang(locale, navigator.language)
    r.continuous = support.continuous
    r.interimResults = true
    const base = latest.current.value
    r.onresult = (e) => {
      if (rec.current === r) latest.current.onChange(withSpeech(base, heard(e.results)))
    }
    r.onerror = (e) => {
      if (rec.current === r) setNote(dictationNote(e.error))
    }
    r.onend = () => {
      if (rec.current !== r) return
      rec.current = null
      setOn(false)
    }
    rec.current = r
    setNote(null)
    try {
      r.start()
      setOn(true)
    } catch {
      rec.current = null
      setNote('off')
    }
  }

  /* Typing or sending takes over: what was heard stays, the mic goes off. */
  function cancel() {
    const r = rec.current
    if (!r) return
    rec.current = null
    setOn(false)
    r.abort()
  }

  return {
    ready: Boolean(support),
    on,
    note,
    toggle: () => (rec.current ? rec.current.stop() : start()),
    cancel,
    hush: () => setNote(null),
  }
}

/* Where the menu has room: above the "+" or below it, between the top bar
   and the tab bar (from md there are neither, the rail is at the side). */
function room(el) {
  const r = el.getBoundingClientRect()
  const ceiling = Math.max(0, document.querySelector('[data-hook="bb-topbar"]')?.getBoundingClientRect().bottom ?? 0)
  const bar = document.querySelector('[data-hook="tab-bar"]')?.getBoundingClientRect()
  const floor = bar?.height ? bar.top : window.innerHeight
  const above = r.top - ceiling - 12
  const below = floor - r.bottom - 12
  return above > below ? { up: true, max: Math.max(above, 160) } : { up: false, max: Math.max(below, 160) }
}

function Item({ checked, onPick, icon: Icon, hook, children }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      onClick={onPick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-[0.875rem] px-3 py-2 text-left text-body text-ink transition-colors duration-150 focus-visible:outline-offset-[-2px] ${checked ? 'bg-[#E6DFFF]' : 'hover:bg-ink/[0.06]'}`}
      data-hook={hook}
    >
      <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {checked && <Check className="h-4 w-4 shrink-0" />}
    </button>
  )
}

/**
 * The menu of the "+": a WAI-ARIA menu of radio items. Focus goes to the
 * item that is on, the arrows move, Escape and Tab close it, and so do a
 * tap outside and a pick.
 */
function Menu({ id, place, courses, courseId, onCourse, mode, onMode, onPick, onLeave }) {
  const { t } = useT()
  const box = useRef(null)
  const items = () => [...box.current.querySelectorAll('[role="menuitemradio"]')]

  useEffect(() => {
    const all = items()
    ;(all.find((el) => el.getAttribute('aria-checked') === 'true') ?? all[0])?.focus({ preventScroll: true })
  }, [])

  function key(e) {
    const all = items()
    const at = all.indexOf(document.activeElement)
    const go = (i) => {
      e.preventDefault()
      all[(i + all.length) % all.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(all.length - 1)
    else if (e.key === 'Tab') onLeave()
  }

  return (
    <div
      ref={box}
      id={id}
      role="menu"
      aria-label={t('bb.compose.more')}
      onKeyDown={key}
      style={{ maxHeight: place.max }}
      className={`absolute left-0 z-30 w-[17rem] max-w-[calc(100vw-2.5rem)] overflow-y-auto overscroll-contain rounded-[1.25rem] border border-ink/15 bg-surface p-1.5 shadow-[var(--e-float)] ${place.up ? 'bottom-full mb-2' : 'top-full mt-2'}`}
      data-hook="bb-compose-menu"
    >
      {courses && (
        <div role="group" aria-labelledby={`${id}-courses`}>
          <p id={`${id}-courses`} aria-hidden="true" className="px-3 pb-1 pt-2 text-small font-semibold text-muted">
            {t('bb.coach.course')}
          </p>
          {courses.map((c) => (
            <Item key={c.id} checked={c.id === courseId} icon={Book} onPick={() => onPick(() => onCourse(c.id))} hook="bb-compose-course">
              <span className="line-clamp-2">{c.name}</span>
              {c.code && <span className="block truncate text-small text-muted">{c.code}</span>}
            </Item>
          ))}
        </div>
      )}
      {courses && onMode && <div role="separator" className="mx-2 my-1.5 h-px bg-hairline" />}
      {onMode && (
        <div role="group" aria-labelledby={`${id}-modes`}>
          <p id={`${id}-modes`} aria-hidden="true" className="px-3 pb-1 pt-2 text-small font-semibold text-muted">
            {t('bb.coach.modes')}
          </p>
          {MODES.map((m) => (
            <Item key={m} checked={mode === m} icon={MODE_ICON[m]} onPick={() => onPick(() => onMode(mode === m ? null : m))} hook={`bb-mode-${m}`}>
              {t(`bb.coach.mode.${m}`)}
            </Item>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The box itself. `courses` (more than one) and `onMode` are optional: the
 * ask bar on a course has neither, and then there is no "+" at all.
 * `showCourse={false}` leaves the course out of the chips where the page
 * already names it (the coach's header): at 390px two chips beside the mic
 * and the arrow wrapped onto a line of their own.
 */
export function Composer({ value, onChange, onSubmit, busy = false, disabled = false, courses, courseId, onCourse, mode, onMode, label, hook, showCourse = true }) {
  const { t } = useT()
  const id = useId()
  const area = useRef(null)
  const wrap = useRef(null)
  const plus = useRef(null)
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ up: true, max: 320 })
  const voice = useDictation(value, onChange)
  const list = courses?.length > 1 && onCourse ? courses : null
  const course = (showCourse && list?.find((c) => c.id === courseId)) || null
  const menu = Boolean(list || onMode)
  const can = Boolean(value.trim()) && !busy && !disabled
  const ask = label ?? t('bb.coach.ph')
  const placeholder = voice.on ? t('bb.dictate.listening') : ask

  /* The box grows with the question, typed or said, up to its max-h, and
     with a placeholder too long for one line (a course with a long name). */
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, placeholder])

  useLayoutEffect(() => {
    if (!open) return undefined
    const measure = () => plus.current && setPlace(room(plus.current))
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  function close() {
    setOpen(false)
    plus.current?.focus()
  }

  function submit(e) {
    e?.preventDefault()
    if (!can) return
    voice.cancel()
    onSubmit()
  }

  const ModeIcon = mode ? MODE_ICON[mode] : null
  const modeName = mode ? t(`bb.coach.mode.${mode}`) : ''

  return (
    <form
      onSubmit={submit}
      aria-label={t('bb.ask.label')}
      className="rounded-[1.5rem] border border-ink/15 bg-surface p-2 shadow-[var(--e-float)] transition-colors focus-within:border-ink"
      data-hook={hook}
    >
      <label className="block px-2 pt-1">
        <span className="sr-only">{ask}</span>
        <textarea
          ref={area}
          rows={1}
          value={value}
          placeholder={placeholder}
          maxLength={6000}
          onChange={(e) => {
            voice.cancel()
            voice.hush()
            onChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
          }}
          className="block max-h-40 min-h-[2.5rem] w-full resize-none border-0 bg-transparent px-1 py-2 text-body text-ink outline-none placeholder:text-[rgb(var(--quiet-ink))]"
          data-hook={hook ? `${hook}-input` : undefined}
        />
      </label>
      <div className="flex items-end gap-1 px-0.5 pt-1">
        {menu && (
          <div
            ref={wrap}
            className="relative shrink-0"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && open) {
                e.preventDefault()
                close()
              }
            }}
          >
            <button
              ref={plus}
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? `${id}-menu` : undefined}
              aria-label={t('bb.compose.more')}
              title={t('bb.compose.more')}
              onClick={() => setOpen((o) => !o)}
              className={`${ROUND} ${open ? 'bg-[#CFC2FF] text-ink' : 'text-ink hover:bg-ink/[0.06]'}`}
              data-hook="bb-compose-more"
            >
              <Plus className={`h-5 w-5 transition-transform duration-200 ease-settle ${open ? 'rotate-45' : ''}`} />
            </button>
            {open && (
              <Menu
                id={`${id}-menu`}
                place={place}
                courses={list}
                courseId={courseId}
                onCourse={onCourse}
                mode={mode}
                onMode={onMode}
                onPick={(change) => {
                  change()
                  close()
                }}
                onLeave={() => setOpen(false)}
              />
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {course && (
            <button
              type="button"
              aria-haspopup="menu"
              aria-label={t('bb.compose.course_is', { name: course.code || course.name })}
              title={course.name}
              onClick={() => setOpen(true)}
              className="press flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-pill border border-ink/15 pl-2.5 pr-3 text-small text-ink hover:border-ink/30"
              data-hook="bb-compose-course-chip"
            >
              <Book className="h-4 w-4 shrink-0" />
              <span className="truncate">{course.code || course.name}</span>
            </button>
          )}
          {onMode && mode && (
            /* The short name ("Vérifie" for "Vérifie ma réponse"): the long
               ones were cut to "Explique simpl..." at 390px. The icon goes
               below 360px, where even "Socratique" did not fit beside it. */
            <span className="flex h-9 min-w-0 max-w-full items-center rounded-pill border border-ink bg-[#E6DFFF] text-ink" data-hook="bb-compose-mode">
              <button
                type="button"
                aria-haspopup="menu"
                aria-label={t('bb.compose.mode_is', { mode: modeName })}
                title={modeName}
                onClick={() => setOpen(true)}
                className="press flex h-full min-w-0 items-center gap-1.5 pl-2.5 pr-0.5 text-small"
              >
                <ModeIcon className="hidden h-4 w-4 shrink-0 min-[360px]:block" />
                <span className="truncate">{t(`bb.coach.mode_short.${mode}`)}</span>
              </button>
              <button
                type="button"
                aria-label={t('bb.compose.clear_mode', { mode: modeName })}
                title={t('bb.compose.clear_mode', { mode: modeName })}
                onClick={() => onMode(null)}
                className="press flex h-full w-7 shrink-0 items-center justify-center rounded-pill hover:bg-ink/[0.08]"
                data-hook="bb-compose-clear"
              >
                <Cross className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        {voice.ready && (
          <button
            type="button"
            aria-pressed={voice.on}
            aria-label={t('bb.dictate.start')}
            title={t(voice.on ? 'bb.dictate.stop' : 'bb.dictate.start')}
            onClick={voice.toggle}
            className={`${ROUND} relative ${voice.on ? 'bg-[#CFC2FF] text-ink' : 'text-ink hover:bg-ink/[0.06]'}`}
            data-hook="bb-compose-mic"
          >
            <Mic className="h-5 w-5" />
            {voice.on && <span aria-hidden="true" className="absolute right-[0.4rem] top-[0.4rem] h-2 w-2 rounded-pill bg-ink motion-safe:animate-pulse" />}
          </button>
        )}
        <button
          type="submit"
          disabled={!can}
          aria-label={t('bb.coach.send')}
          title={t('bb.coach.send')}
          className={`${ROUND} bg-ink text-white hover:opacity-90 active:bg-[#CFC2FF] active:text-ink disabled:bg-[#E4E4E7] disabled:text-[#52525B] disabled:opacity-100`}
          data-hook={hook ? `${hook}-send` : undefined}
        >
          {busy ? <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-r-transparent" aria-hidden="true" /> : <ArrowUp className="h-[1.1rem] w-[1.1rem]" />}
        </button>
      </div>
      {voice.note && (
        <p role="status" className="px-2.5 pb-1 pt-2 text-small text-muted" data-hook="bb-compose-note">
          {t(`bb.dictate.${voice.note}`)}
        </p>
      )}
    </form>
  )
}

/**
 * The ask bar, on Today and at the top of a course: a question about one
 * of your courses, sent to the coach, which opens with it already asked
 * (the ?q= in Coach.jsx).
 */
export function AskBar({ courses, label, className = '' }) {
  const { t } = useT()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [courseId, setCourseId] = useState(courses?.[0]?.id ?? null)
  if (!courses?.length) return null
  const id = courses.some((c) => c.id === courseId) ? courseId : courses[0].id
  return (
    <div className={className}>
      <Composer
        value={text}
        onChange={setText}
        onSubmit={() => navigate(`/hakkilo/coach/${id}?q=${encodeURIComponent(text.trim())}`)}
        courses={courses.length > 1 ? courses : null}
        courseId={id}
        onCourse={setCourseId}
        label={label ?? t('bb.ask.ph')}
        hook="bb-ask"
      />
    </div>
  )
}
