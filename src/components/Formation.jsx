import { useCallback, useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { Section } from './ui'
import { FURTHER, LESSONS, lessonIn, nextLesson, progress } from '../lib/lessons'

/**
 * The formation. Six lessons, two minutes each.
 *
 * WHY PROGRESS IS IN localStorage AND NOT IN THE DATABASE.
 *
 * "Lesson 3 read" is not somebody's money and it is not shared with anybody. It
 * costs a migration, a table, four policies and a round trip to store it on the
 * server, and buys nothing the reader can perceive except that a tick survives
 * reinstalling the app. Losing it costs a person one scroll.
 *
 * Keyed per user for the same reason the plan draft is: two people signing in
 * on one phone is ordinary, and inheriting somebody else's ticks would make the
 * course look half done to a person who has read none of it.
 *
 * WHY A LESSON ENDS IN A BUTTON.
 *
 * Every lesson names the pane it is about, so the last thing on the page is the
 * way to go and do it. A course that ends by returning you to a table of
 * contents is a course you did once. This one ends inside the budget.
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
       them are worth taking the pane down for. */
    return []
  }
}

export default function Formation({ userId, locale, onOpenPane, onReading }) {
  const { t } = useT()
  const [done, setDone] = useState(() => read(userId))
  const [open, setOpen] = useState(null)

  /* Re-read when the account changes, so switching users does not carry one
     person's progress into the other's screen. */
  useEffect(() => setDone(read(userId)), [userId])

  /**
   * A lesson takes the screen, the way the transaction history does.
   *
   * The menu is eight rows tall, which is fine for a pane you glance at and
   * wrong for four hundred words: you scrolled past the whole budget to reach
   * the first paragraph and past it again to reach the button at the end. The
   * app already had the answer in the history view, so this is the same move.
   *
   * Reported upward rather than handled here, because what has to disappear
   * lives in the page: the menu and the add-transaction button, neither of
   * which this component owns. The cleanup matters as much as the call, since
   * leaving the page while reading would otherwise hide the menu for good.
   */
  useEffect(() => {
    onReading?.(Boolean(open))
    return () => onReading?.(false)
  }, [open, onReading])

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
  const further = FURTHER[locale] ?? FURTHER.fr

  /* ------------------------------------------------------------ a lesson --- */
  if (open) {
    const lesson = LESSONS.find((l) => l.id === open)
    const text = lessonIn(lesson, locale)
    if (!lesson || !text) return null
    const isDone = done.includes(lesson.id)

    return (
      <Section>
        <button type="button" className="goal-action press mb-5" onClick={() => setOpen(null)}>
          {t('form.back')}
        </button>

        <article data-hook="lesson" className="glass-card rounded-3xl p-6">
          <p className="text-label font-semibold uppercase tracking-wider text-muted">
            {t('form.minutes', { n: lesson.minutes })}
          </p>
          <h3 className="mt-2 font-display text-h1 leading-tight text-ink">{text.title}</h3>
          <p className="mt-2 text-body font-semibold leading-snug text-ink">{text.summary}</p>

          <div className="mt-5 space-y-4">
            {text.body.map((para) => (
              <p key={para.slice(0, 24)} className="text-body leading-relaxed text-muted">
                {para}
              </p>
            ))}
          </div>

          {/* The one line worth keeping, marked as such. An accent wash rather
              than an accent rule: a coloured bar beside a paragraph is the
              pattern the field hints already lost, for looking like a second
              vertical mark rather than an emphasis. */}
          <p
            data-hook="takeaway"
            className="mt-6 rounded-2xl bg-accent/[0.14] p-4 text-body font-semibold leading-snug text-ink"
          >
            {text.takeaway}
          </p>

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
              }}
            >
              {isDone ? t('form.read_again') : t('form.mark_read')}
            </button>
          </div>
        </article>
      </Section>
    )
  }

  /* -------------------------------------------------------- the course --- */
  return (
    <>
      <Section>
        <div
          data-card="formation-hero"
          className="glass-card relative overflow-hidden rounded-3xl bg-gradient-to-br from-cat-1-soft via-white to-cat-5-soft p-6"
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
          <p className="mt-2.5 max-w-[30ch] text-small leading-relaxed text-muted">
            {next ? lessonIn(next, locale).summary : t('form.finished_note')}
          </p>
          {next && (
            <button
              type="button"
              className="goal-action-done press mt-5"
              onClick={() => setOpen(next.id)}
            >
              {p.done === 0 ? t('form.start') : t('form.continue')}
            </button>
          )}
        </div>
      </Section>

      <Section title={t('form.lessons')}>
        <ul className="space-y-2.5">
          {LESSONS.map((l, i) => {
            const text = lessonIn(l, locale)
            const isDone = done.includes(l.id)
            return (
              <li key={l.id}>
                <button
                  type="button"
                  data-hook="lesson-row"
                  onClick={() => setOpen(l.id)}
                  className="press flex w-full items-center gap-3 rounded-3xl border border-hairline
                             bg-[rgb(var(--glass-tint))] p-3 text-left shadow-raised"
                >
                  {/* The number, or a tick once it is read. Both, never colour
                      alone: 1.4.1, and a green disc with nothing in it says
                      nothing to somebody who cannot see green. */}
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.875rem]
                                text-body font-semibold ${
                                  isDone ? 'bg-accent text-on-accent' : 'bg-accent/15 text-ink'
                                }`}
                  >
                    {isDone ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12.5 4.5 4.5L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
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

      {/* Credited, not reproduced. See the note at the top of lessons.js. */}
      <Section title={further.label}>
        <p className="text-small leading-relaxed text-muted">{further.body}</p>
      </Section>
    </>
  )
}
