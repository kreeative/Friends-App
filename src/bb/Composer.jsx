import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * Where a question is asked, the way Claude asks for one: a white box with
 * the words on top and a row of icons under them, the send arrow at the end.
 *
 * "As good as Claude, with the search bar to ask questions", and "instead of
 * big buttons with their names, just icons": the course, the four ways to
 * answer and the send button are icons here, each with its name in
 * aria-label and in title, and the way picked writes itself into the
 * placeholder ("Socratique · pose ta question"), so nothing is a bare icon
 * nobody can name.
 *
 * Used twice: the coach's own box (Coach.jsx) and the ask bar on Today,
 * which opens the coach with the question already sent.
 */
const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }

export const ArrowUp = (p) => (
  <svg {...S} strokeWidth={2.2} {...p}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
)
const Book = (p) => (
  <svg {...S} {...p}>
    <path d="M5 4.5h9.5A2.5 2.5 0 0117 7v12.5H7.5A2.5 2.5 0 015 17z" />
    <path d="M5 17a2.5 2.5 0 012.5-2.5H17" />
  </svg>
)
const Chevron = (p) => (
  <svg {...S} strokeWidth={2} {...p}>
    <path d="m7 10 5 5 5-5" />
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

/** The course the question is about, as a native select: the phone's own picker. */
function CoursePick({ courses, value, onChange }) {
  const { t } = useT()
  if (!courses?.length) return null
  return (
    <label className="relative flex h-9 min-w-0 items-center gap-1.5 rounded-pill border border-ink/15 pl-2.5 pr-7 text-ink hover:border-ink/30" title={t('bb.coach.course')}>
      <Book className="h-4 w-4 shrink-0" />
      <span className="sr-only">{t('bb.coach.course')}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="min-w-0 max-w-[8.5rem] cursor-pointer truncate appearance-none bg-transparent text-small text-ink outline-none sm:max-w-[12rem]" data-hook="bb-ask-course">
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code || c.name}
          </option>
        ))}
      </select>
      <Chevron className="pointer-events-none absolute right-2 h-3.5 w-3.5" />
    </label>
  )
}

/**
 * The box itself. `mode` and `onMode` are optional: the ask bar on Today has
 * no ways to answer, the coach has four.
 */
export function Composer({ value, onChange, onSubmit, busy = false, disabled = false, courses, courseId, onCourse, mode, onMode, label, hook, sticky = false }) {
  const { t } = useT()
  const placeholder = mode ? t('bb.coach.ph_mode', { mode: t(`bb.coach.mode.${mode}`) }) : label ?? t('bb.coach.ph')
  const can = Boolean(value.trim()) && !busy && !disabled
  function submit(e) {
    e?.preventDefault()
    if (can) onSubmit()
  }
  return (
    <form
      onSubmit={submit}
      aria-label={t('bb.ask.label')}
      className={`rounded-[1.5rem] border border-ink/15 bg-surface p-2 shadow-[var(--e-float)] transition-colors focus-within:border-ink ${sticky ? 'sticky bottom-28 z-20 md:bottom-4' : ''}`}
      data-hook={hook}
    >
      <label className="block px-2 pt-1">
        <span className="sr-only">{placeholder}</span>
        <textarea
          rows={1}
          value={value}
          placeholder={placeholder}
          maxLength={6000}
          onChange={(e) => {
            onChange(e.target.value)
            /* The box grows with the question, up to the max-h. */
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
          className="block max-h-40 min-h-[2.5rem] w-full resize-none border-0 bg-transparent px-1 py-2 text-body text-ink outline-none placeholder:text-[rgb(var(--quiet-ink))]"
          data-hook={hook ? `${hook}-input` : undefined}
        />
      </label>
      <div className="flex items-center gap-1 px-0.5 pt-1">
        <CoursePick courses={courses} value={courseId} onChange={onCourse} />
        {onMode && (
          <div className="flex items-center gap-0.5" role="group" aria-label={t('bb.coach.modes')} data-hook="bb-coach-modes">
            {MODES.map((m) => {
              const Icon = MODE_ICON[m]
              const on = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  aria-label={t(`bb.coach.mode.${m}`)}
                  title={t(`bb.coach.mode.${m}`)}
                  onClick={() => onMode(on ? null : m)}
                  className={`${ROUND} ${on ? 'bg-[#CFC2FF] text-ink' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink'}`}
                  data-hook={`bb-mode-${m}`}
                >
                  <Icon className="h-[1.15rem] w-[1.15rem]" />
                </button>
              )
            })}
          </div>
        )}
        <button
          type="submit"
          disabled={!can}
          aria-label={t('bb.coach.send')}
          title={t('bb.coach.send')}
          className={`${ROUND} ml-auto bg-ink text-white hover:opacity-90 active:bg-[#CFC2FF] active:text-ink disabled:bg-[#E4E4E7] disabled:text-[#52525B] disabled:opacity-100`}
          data-hook={hook ? `${hook}-send` : undefined}
        >
          {busy ? <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-r-transparent" aria-hidden="true" /> : <ArrowUp className="h-[1.1rem] w-[1.1rem]" />}
        </button>
      </div>
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
        onSubmit={() => navigate(`/nerd/coach/${id}?q=${encodeURIComponent(text.trim())}`)}
        courses={courses.length > 1 ? courses : null}
        courseId={id}
        onCourse={setCourseId}
        label={label ?? t('bb.ask.ph')}
        hook="bb-ask"
      />
    </div>
  )
}
