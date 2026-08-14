import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { localeTag, useT } from '../lib/i18n'
import { money } from '../lib/money'
import { MoodBadge } from './MoodBoard'

/**
 * One day, in full.
 *
 * The panel under the calendar answers "what happened on Tuesday" in about
 * five lines, which is the right size for something permanently open under a
 * strip of dates. It has to stay that size: it sits on the dashboard, and a
 * panel that grows to forty lines when you tap a busy day pushes everything
 * below it off the screen.
 *
 * So the detail moved here. This is the same day with the parts the panel
 * cannot afford: the proof attached to each commitment rather than only the
 * outcome chip, every transaction with its note rather than its category, and
 * the day's net rather than two totals to subtract in your head.
 *
 * WHY THE PROOF IS THE POINT.
 *
 * A photograph, a link or a note is attached to a check-in and then, until
 * now, was only ever visible from the group's proof gallery, filed under the
 * goal. Nobody thinks in goals when they are looking back. They think in days:
 * what did I do on the Tuesday I remember being hard. This is the first screen
 * that answers that with the evidence in it.
 *
 * Portalled to the body for the reason every overlay in this app is: the page
 * wrapper keeps an animated transform forever, which makes it the containing
 * block for anything positioned fixed inside it. See components/ui.jsx.
 */

const OUTCOME_TONE = {
  done: 'chip-green',
  partial: 'chip-accent',
  missed: 'chip-quiet',
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

/** A titled block, or nothing at all when there is nothing to put in it. */
function Part({ title, children }) {
  if (!children) return null
  return (
    <section className="pt-7 first:pt-0">
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function DayRecap({
  open,
  date,
  isFuture = false,
  mood = null,
  goals = [],
  outcomes = new Map(),
  entries = [],
  currency = 'CAD',
  hasJournal = false,
  onClose,
}) {
  const { t, locale } = useT()
  const tag = localeTag(locale)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !date) return null

  const fmt = (cents) => money(cents, currency, locale)

  const total = (kind) =>
    entries.filter((e) => e.kind === kind).reduce((sum, e) => sum + (e.amount_cents || 0), 0)
  const spent = total('expense')
  const earned = total('income')

  const heading = date.toLocaleDateString(tag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const yearLabel =
    date.getFullYear() === new Date().getFullYear() ? null : String(date.getFullYear())

  const empty = !mood && goals.length === 0 && entries.length === 0 && !hasJournal

  return createPortal(
    <div
      className="animate-scrim fixed inset-0 z-50 flex flex-col justify-end bg-ink/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('recap.title')}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto h-1 w-10 rounded-pill bg-ink/15" aria-hidden="true" />
          <div className="mx-auto mt-3 flex w-full max-w-content items-start gap-3 pb-4">
            <button
              type="button"
              onClick={onClose}
              aria-label={t('ui.close')}
              className="press -ml-2 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <CloseIcon />
            </button>
            {/* The date is the title. A heading reading "The day" over a sheet
                about one particular day is a label for the component rather
                than for what is in it, so the name of the day gets the size
                and the component's name is only the accessible one. */}
            <div className="min-w-0 flex-1">
              <h2 className="text-h2 leading-tight text-ink first-letter:uppercase">{heading}</h2>
              {yearLabel && <p className="mt-0.5 text-small text-muted">{yearLabel}</p>}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
          <div className="mx-auto w-full max-w-content">
            {empty ? (
              <p className="py-6 text-body text-muted">
                {isFuture ? t('recap.future') : t('recap.nothing')}
              </p>
            ) : (
              <>
                {/* The mood first, because it is the frame the rest is read
                    in. Asking how somebody was before what they got done is
                    the order this whole product argues for. */}
                <Part title={t('recap.mood')}>
                  {mood ? (
                    <p className="flex items-center gap-3 text-body text-ink">
                      <MoodBadge id={mood} size={28} />
                      {t(`mood.${mood}`)}
                    </p>
                  ) : null}
                </Part>

                <Part title={t('recap.goals')}>
                  {goals.length ? (
                    <ul className="lg divide-y divide-hairline px-5">
                      {goals.map((g) => {
                        const item = outcomes.get(g.id)
                        return (
                          <li key={g.id} className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0 flex-1 text-body text-ink">
                                {g.commitment}
                              </span>
                              {item ? (
                                <span
                                  className={`${OUTCOME_TONE[item.outcome] ?? 'chip-quiet'} shrink-0`}
                                >
                                  {item.outcome === 'done'
                                    ? t('board.did_it')
                                    : item.outcome === 'partial'
                                      ? t('board.partly')
                                      : t('board.not_this_week')}
                                </span>
                              ) : (
                                !isFuture && (
                                  <span className="shrink-0 text-small text-muted/70">
                                    {t('week.not_recorded')}
                                  </span>
                                )
                              )}
                            </div>

                            {/* The evidence, which is the whole reason this
                                sheet exists. Only for a day that was actually
                                recorded: "no proof attached" under a goal
                                nobody has checked in on yet is a complaint
                                about something that was never due. */}
                            {item && (
                              <Proof item={item} t={t} />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </Part>

                <Part title={t('recap.money')}>
                  {entries.length ? (
                    <>
                      {/* Three figures, not two. The pair on the strip leaves
                          the reader subtracting, and the answer to "was this
                          a day that cost me" is the difference. */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          [t('money.spent'), spent, ''],
                          [t('money.kind_income'), earned, earned > 0 ? '+' : ''],
                          [t('recap.net'), earned - spent, earned - spent > 0 ? '+' : ''],
                        ].map(([label, cents, sign]) => (
                          <div key={label} className="rounded-inner bg-ink/[0.035] px-3 py-3">
                            <div className="text-small font-semibold text-muted">{label}</div>
                            <div className="mt-1 break-words font-display text-body font-semibold leading-tight text-ink [font-variant-numeric:tabular-nums]">
                              {sign}
                              {fmt(Math.abs(cents))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <ul className="lg mt-3 divide-y divide-hairline px-5">
                        {entries.map((e) => (
                          <li key={e.id} className="flex items-baseline justify-between gap-3 py-3">
                            <span className="min-w-0 flex-1 text-body text-ink">
                              <span className="block truncate">
                                {e.note ||
                                  (e.kind === 'income'
                                    ? t('money.kind_income')
                                    : t(`money.cat_${e.category ?? 'other'}`))}
                              </span>
                              {e.note && e.kind === 'expense' && (
                                <span className="block text-small text-muted">
                                  {t(`money.cat_${e.category ?? 'other'}`)}
                                </span>
                              )}
                            </span>
                            <span
                              className={`shrink-0 text-body font-semibold [font-variant-numeric:tabular-nums] ${
                                e.excluded ? 'text-muted line-through' : 'text-ink'
                              }`}
                            >
                              {e.kind === 'income' ? '+' : ''}
                              {fmt(e.amount_cents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </Part>

                {/* Said, never shown. The journal is behind a passcode by
                    design, and a recap that printed the entry would be a way
                    around the lock reached by tapping a date. That there IS
                    one is not private; what is in it is. */}
                <Part title={t('recap.journal')}>
                  {hasJournal ? (
                    <div className="lg flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <span className="text-body text-ink">{t('recap.journal_has')}</span>
                      <Link to="/journal" className="goal-action press" onClick={onClose}>
                        {t('recap.journal_open')}
                      </Link>
                    </div>
                  ) : null}
                </Part>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Whatever was attached to a check-in, in whatever form it took.
 *
 * The columns are read defensively rather than switched on the goal's
 * proof_type. A goal moved from photo to link in March still has February's
 * photographs hanging off it, so what is on the row is the only reliable
 * account of what the proof actually is. It is also what makes this survive a
 * database where migration 28 has not been run: those columns come back
 * undefined and the block simply does not draw.
 */
function Proof({ item, t }) {
  const note = String(item.evidence ?? '').trim()
  const link = item.link_url ?? null
  const photo = item.photo_url ?? null

  if (!note && !link && !photo) {
    return <p className="mt-2 text-small text-muted/70">{t('recap.no_proof')}</p>
  }

  return (
    <div className="mt-3 space-y-3">
      {photo && (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="w-full rounded-inner bg-ink/[0.04] object-cover"
          style={{ maxHeight: '18rem' }}
        />
      )}
      {note && <p className="whitespace-pre-wrap text-small text-ink">{note}</p>}
      {link && (
        /* rel is not optional here. The proof is a URL somebody typed, and
           without noopener the page it opens gets a handle on this one. */
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-block max-w-full truncate text-small font-semibold text-ink underline underline-offset-2"
        >
          {t('recap.proof_link')}
        </a>
      )}
    </div>
  )
}
