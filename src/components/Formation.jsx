import { useCallback, useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { Section } from './ui'
import { LESSONS, lessonIn, nextLesson, progress } from '../lib/lessons'

/**
 * The formation, in three stages rather than one long page.
 *
 * WHY THE LIST IS HIDDEN UNTIL YOU START.
 *
 * It used to sit under the hero, so the first thing the course showed was six
 * rows of things you had not done. That is a to-do list, and a to-do list is
 * the least inviting way to open something optional: the reader's first job
 * becomes scrolling past it rather than reading anything.
 *
 * So the front is one card carrying the module you are on, the progress, and a
 * single button. Everything else is behind it. Pressing Commencer opens a
 * player, and the player is where the six live.
 *
 *   intro    the hero and nothing else
 *   list     the player: six modules, ticks, progress, a way out
 *   lesson   one module, with the way back into the list
 *
 * There is deliberately no McGill note anywhere. The copy here is written for
 * this app, so there is nothing to attribute.
 *
 * WHY PROGRESS IS IN localStorage AND NOT IN THE DATABASE.
 *
 * "Module 3 read" is not somebody's money and is not shared with anybody. It
 * costs a migration, a table, four policies and a round trip to store on the
 * server, and buys nothing the reader can perceive except a tick that survives
 * a reinstall. Losing it costs one scroll.
 *
 * Keyed per user for the same reason the plan draft is: two people signing in
 * on one phone is ordinary, and inheriting somebody else's ticks would make the
 * course look half done to a person who has read none of it.
 */
const KEY = 'rich_friends_lessons'

function read(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(`${KEY}.${userId}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    /* A private window, a full disk, a value somebody edited by hand. None of
       them are worth taking the course down for. */
    return []
  }
}

const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
)

export default function Formation({ userId, locale, onOpenPane, onStageChange }) {
  const { t } = useT()
  const [done, setDone] = useState(() => read(userId))
  const [stage, setStage] = useState('intro')
  const [open, setOpen] = useState(null)

  /* Re-read when the account changes, so switching users does not carry one
     person's progress into the other's screen. */
  useEffect(() => setDone(read(userId)), [userId])

  /**
   * The host hides its own chrome once the course takes over.
   *
   * Reported upward rather than handled here, because what has to disappear
   * belongs to the page, not to this component. The cleanup matters as much as
   * the call: leaving the page mid-course would otherwise hide the chrome for
   * good.
   */
  useEffect(() => {
    onStageChange?.(stage)
    return () => onStageChange?.('intro')
  }, [stage, onStageChange])

  const mark = useCallback(
    (id) => {
      setDone((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id]
        try {
          if (userId) localStorage.setItem(`${KEY}.${userId}`, JSON.stringify(next))
        } catch {
          /* Storage refused. The tick still shows for this session, which is
             the whole of what it was ever going to do. */
        }
        return next
      })
    },
    [userId],
  )

  const p = progress(done)
  const next = nextLesson(done)

  /* ------------------------------------------------------- one module --- */
  if (stage === 'lesson' && open) {
    const lesson = LESSONS.find((l) => l.id === open)
    const text = lessonIn(lesson, locale)
    if (!lesson || !text) return null
    const isDone = done.includes(lesson.id)

    return (
      <Section>
        <button
          type="button"
          className="goal-action press mb-5"
          onClick={() => { setOpen(null); setStage('list') }}
        >
          {t('form.back_list')}
        </button>

        <article data-hook="lesson" className="glass-card rounded-3xl p-6">
          <p className="text-label font-semibold uppercase tracking-wider text-muted">
            {t('form.module_n', { n: LESSONS.indexOf(lesson) + 1, m: lesson.minutes })}
          </p>
          <h3 className="mt-2 font-display text-h1 leading-tight text-ink">{text.title}</h3>
          <p className="mt-2 text-body font-semibold leading-snug text-ink">{text.concept}</p>

          <div className="mt-5 space-y-4">
            {text.body.map((para) => (
              <p key={para.slice(0, 24)} className="text-body leading-relaxed text-muted">
                {para}
              </p>
            ))}
          </div>

          {/* The thing to go and do, marked as the one line worth keeping. An
              accent wash rather than a coloured rule beside it: a vertical bar
              next to a paragraph is the pattern the field hints already lost,
              for reading as a second mark rather than as emphasis. */}
          <div data-hook="exercise" className="mt-6 rounded-2xl bg-accent/[0.14] p-4">
            <p className="text-label font-semibold uppercase tracking-wider text-muted">
              {t('form.exercise')}
            </p>
            <p className="mt-1.5 text-body font-semibold leading-snug text-ink">{text.exercise}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {lesson.pane && (
              <button
                type="button"
                className="goal-action-soft press"
                onClick={() => onOpenPane?.(lesson.pane)}
              >
                {t(`form.go_${lesson.pane}`)}
              </button>
            )}
            <button
              type="button"
              className={isDone ? 'goal-action press' : 'goal-action-done press'}
              onClick={() => {
                mark(lesson.id)
                setOpen(null)
                setStage('list')
              }}
            >
              {isDone ? t('form.read_again') : t('form.mark_read')}
            </button>
          </div>
        </article>
      </Section>
    )
  }

  /* ---------------------------------------------------- the player --- */
  if (stage === 'list') {
    return (
      <Section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button type="button" className="goal-action press" onClick={() => setStage('intro')}>
            {t('form.exit')}
          </button>
          <span
            data-hook="progress"
            className="shrink-0 rounded-pill bg-accent/[0.35] px-3 py-1 text-label font-semibold text-ink"
          >
            {t('form.of', { done: p.done, total: p.total })}
          </span>
        </div>

        {/* The tracker, so "X sur 6" has something to move against. */}
        <div className="mb-5 h-2 w-full overflow-hidden rounded-pill bg-ink/10">
          <div
            data-hook="track"
            className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-settle"
            style={{ width: `${p.pct}%` }}
          />
        </div>

        <ul className="space-y-2.5">
          {LESSONS.map((l, i) => {
            const text = lessonIn(l, locale)
            const isDone = done.includes(l.id)
            return (
              <li key={l.id}>
                <button
                  type="button"
                  data-hook="lesson-row"
                  data-done={isDone ? '' : undefined}
                  onClick={() => { setOpen(l.id); setStage('lesson') }}
                  className="press flex w-full items-center gap-3 rounded-3xl border border-hairline
                             bg-[rgb(var(--glass-tint))] p-3 text-left shadow-raised"
                >
                  {/* The number, or a tick once it is read. Never colour alone:
                      1.4.1, and a filled disc with nothing in it says nothing
                      to somebody who cannot see the fill. */}
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.875rem]
                                text-body font-semibold ${
                                  isDone ? 'bg-accent text-on-accent' : 'bg-accent/15 text-ink'
                                }`}
                  >
                    {isDone ? <Tick /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold leading-tight text-ink">
                      {text.title}
                    </span>
                    <span className="mt-0.5 block truncate text-small text-muted">
                      {isDone ? t('form.done') : t('form.minutes', { n: l.minutes })}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Section>
    )
  }

  /* ------------------------------------------------------------ intro --- */
  return (
    <Section>
      <div
        data-card="formation-hero"
        className="glass-card relative overflow-hidden rounded-3xl bg-surface p-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-label font-semibold uppercase tracking-wider text-muted">
            {t('form.title')}
          </p>
          <span
            data-hook="progress"
            className="shrink-0 rounded-pill bg-accent/[0.35] px-3 py-1 text-label font-semibold text-ink"
          >
            {t('form.of', { done: p.done, total: p.total })}
          </span>
        </div>
        <p className="mt-2 font-display text-h1 leading-tight text-ink">
          {next ? lessonIn(next, locale).title : t('form.finished')}
        </p>
        <p className="mt-2.5 max-w-[32ch] text-small leading-relaxed text-muted">
          {next ? lessonIn(next, locale).concept : t('form.finished_note')}
        </p>
        <button
          type="button"
          data-hook="start"
          className="goal-action-done press mt-5"
          onClick={() => setStage('list')}
        >
          {p.done === 0 ? t('form.start') : p.done === p.total ? t('form.review') : t('form.continue')}
        </button>
      </div>
    </Section>
  )
}
