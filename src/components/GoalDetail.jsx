import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { localeTag, useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { dragOffset, flipTransform, rectOf, shouldDismiss } from '../lib/gesture'
import { monthGrid, monthStart, sameMonth } from '../lib/calendar'
import { dateCaps, dateFull } from '../lib/datecaps'
import {
  countOn,
  dayKey,
  dayStatus,
  nextCount,
  progressFor,
  recentDays,
  shiftDay,
  startedOn,
  streakOf,
  totalDone,
} from '../lib/streak'
import ConfirmDialog from './ConfirmDialog'

/**
 * One goal, in full, grown out of the card you tapped.
 *
 * A card in a list has room for a title, a cadence and three buttons. That is
 * the right size for a list and it is why everything a goal actually
 * accumulates has had nowhere to live: how long you have kept it, which days
 * you kept it on, what you attached as proof, when you started. All of it
 * existed in the database and none of it was on screen.
 *
 * WHY IT GROWS FROM THE CARD RATHER THAN SLIDING IN.
 *
 * A panel that arrives from the edge is a new place, and the reader has to
 * work out where they now are. A card that expands under the thumb is the same
 * object, larger. That difference is the entire argument for the animation, and
 * it is why the origin rectangle is passed in rather than the view simply
 * appearing.
 *
 * WHY NOT FRAMER MOTION.
 *
 * `layoutId` is FLIP with a library around it, and this app already has FLIP:
 * fifteen tested lines in src/lib/gesture.js, driving DayRecap, which is this
 * same movement from a calendar square. Adding a motion dependency for a second
 * copy of a thing that works would be a bigger bundle, a second animation
 * vocabulary in one codebase, and two implementations to keep in step. See the
 * note on flipFrom.
 *
 * Portalled for the reason every overlay here is: the page wrapper keeps an
 * animated transform forever, which makes it the containing block for anything
 * positioned fixed inside it.
 */

/** Matched by the transition below, and by the exit timer, which is in JS. */
const MORPH_MS = 380
const CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Two weeks of dots. A month is the calendar's job, below. */
const DOT_DAYS = 14

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="M15 19l-7-7 7-7" />
  </svg>
)

const CheckIcon = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Movement is a preference, not a given. */
const stillness = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const DONE = {
  completed: { label: 'goal.done', chip: 'chip-green' },
  abandoned: { label: 'goal.dropped', chip: 'chip-quiet' },
}

export default function GoalDetail({
  goal,
  origin = null,
  owner = null,
  track = false,
  deletable = false,
  editHref = null,
  onClose,
}) {
  const { t, locale } = useT()
  const tag = localeTag(locale)
  const { dayIndex, setGoalDay, removeGoal, reloadGroup } = useGroup()

  const open = Boolean(goal)

  /* closed, coming in, sitting there, going out. A fourth state rather than
     rendering straight from `goal`, because the morph back into the card takes
     380ms and there is nothing to animate once the panel is gone. */
  const [phase, setPhase] = useState('closed')
  const panel = useRef(null)
  const exiting = useRef(null)

  const [drag, setDrag] = useState(0)
  const dragFrom = useRef(null)

  const [ticking, setTicking] = useState(false)
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [month, setMonth] = useState(() => monthStart(new Date()))

  /* The one thing on this screen that is not already in memory. Solo goals are
     drawn entirely from dayIndex, which the context already holds; a goal in a
     group has check-ins with proof on them, and those are worth a query only
     once somebody is actually looking at this goal. */
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (open && phase === 'closed') {
      setDrag(0)
      setPhase('in')
      return
    }
    if (!open && (phase === 'in' || phase === 'idle')) {
      setPhase('out')
      if (exiting.current) window.clearTimeout(exiting.current)
      exiting.current = window.setTimeout(() => setPhase('closed'), stillness() ? 0 : MORPH_MS)
    }
  }, [open, phase])

  useEffect(() => () => exiting.current && window.clearTimeout(exiting.current), [])

  /* Reset per goal, so opening a second one never shows the first one's
     history or leaves last month on the calendar. */
  useEffect(() => {
    setHistory(null)
    setAsking(false)
    setDeleteError(null)
    setMonth(monthStart(new Date()))
  }, [goal?.id])

  useEffect(() => {
    if (!goal?.id || !goal.group_id || history !== null) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('checkin_items')
        .select('id, outcome, count_done, evidence, photo_url, link_url, checkin_id, checkins(submitted_at, user_id)')
        .eq('goal_id', goal.id)
        .limit(60)
      if (cancelled) return
      /* Ordered here rather than in the query: PostgREST cannot order on an
         embedded table's column, and the alternative is a view for one list. */
      setHistory(
        (data ?? []).slice().sort((a, b) =>
          String(b.checkins?.submitted_at ?? '').localeCompare(String(a.checkins?.submitted_at ?? '')),
        ),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [goal?.id, goal?.group_id, history])

  const close = useCallback(() => onClose?.(), [onClose])

  useEffect(() => {
    if (phase === 'closed') return
    const onKey = (e) => e.key === 'Escape' && close()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [phase, close])

  /**
   * Invert, then play.
   *
   * Measured in a layout effect so the panel is never painted at full size for
   * a frame before being put back on the card, which is the exact flash this
   * avoids. The second half waits for a frame, because setting a transform and
   * removing it in the same tick is one style computation and animates nothing.
   */
  useLayoutEffect(() => {
    const el = panel.current
    if (phase !== 'in' || !el) return

    const to = rectOf(el)
    const still = stillness()

    if (!still && origin) {
      el.style.transition = 'none'
      el.style.transform = flipTransform(origin, to)
      el.style.opacity = '0.4'
      /* Read back, so the browser commits this frame before the next replaces
         it. Without it the two coalesce and the FLIP silently does nothing. */
      void el.offsetWidth
    }

    const id = window.requestAnimationFrame(() => {
      if (!panel.current) return
      panel.current.style.transition = still
        ? 'opacity 140ms linear'
        : `transform ${MORPH_MS}ms ${CURVE}, opacity ${Math.round(MORPH_MS * 0.55)}ms linear`
      panel.current.style.transform = 'none'
      panel.current.style.opacity = '1'
      setPhase('idle')
    })
    return () => window.cancelAnimationFrame(id)
  }, [phase, origin])

  /** And back into the card it came from. */
  useLayoutEffect(() => {
    const el = panel.current
    if (phase !== 'out' || !el) return

    if (stillness()) {
      el.style.transition = 'opacity 120ms linear'
      el.style.opacity = '0'
      return
    }

    el.style.transition = `transform ${MORPH_MS}ms ${CURVE}, opacity ${MORPH_MS}ms linear`
    /* Dragged away rather than dismissed: it leaves the way the finger was
       already taking it. Morphing back up into a card from under a thumb
       pushing it down is the animation arguing with the gesture. */
    el.style.transform = dragFrom.current?.dismissed
      ? `translateY(${Math.max(drag, 40)}px) translateY(100%)`
      : flipTransform(origin, rectOf(el))
    el.style.opacity = '0'
  }, [phase, origin, drag])

  const today = useMemo(() => new Date(), [goal?.id, phase])
  const progress = goal ? progressFor(goal, dayIndex, today) : null
  const streak = goal && track ? streakOf(goal, dayIndex, today) : 0
  const total = goal && track ? totalDone(goal, dayIndex, today) : 0
  const started = goal ? startedOn(goal) : null

  const grid = useMemo(() => (goal ? monthGrid(month) : []), [goal, month])

  if (phase === 'closed' || !goal) return null

  const finished = DONE[goal.status] ?? null
  const paused = goal.status === 'paused'

  const cadence =
    goal.cadence === 'recurring'
      ? t('goal.times_a_day', { n: goal.target_per_cycle })
      : t('goal.by_date', { date: fmtDay(goal.due_on, tag) })

  async function tick() {
    if (ticking) return
    setTicking(true)
    await setGoalDay(goal, nextCount(goal, countOn(dayIndex, goal.id, progress.day)))
    setTicking(false)
  }

  async function setStatus(status) {
    await supabase.from('goals').update({ status }).eq('id', goal.id)
    await reloadGroup()
    /* Pausing or finishing from in here leaves the page open on purpose: the
       card behind has changed and this is where you can see that it did. */
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await removeGoal(goal)
    if (error) {
      setDeleting(false)
      setDeleteError(errorText(error))
      return
    }
    /* The goal has left the list, so the card this would morph back into is
       gone. Closing is still right; there is simply nothing to return to. */
    close()
  }

  /* --- swipe down to dismiss -------------------------------------------- */
  /* Capture waits until the finger has actually travelled: capturing on
     pointerdown retargets the following mouse events to the element that
     captured, so a tap on the close button inside the header lands on the
     header instead and the button stops closing anything. */
  const CAPTURE_AFTER = 4

  const onGrabDown = (e) => {
    if (e.button != null && e.button !== 0) return
    dragFrom.current = { y: e.clientY, at: Date.now(), dismissed: false, held: false }
  }

  const onGrabMove = (e) => {
    const from = dragFrom.current
    if (!from) return
    const dy = dragOffset(from.y, e.clientY)

    if (!from.held && Math.abs(e.clientY - from.y) > CAPTURE_AFTER) {
      from.held = true
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        /* Uncapturable pointer. pointerup on the header still ends the drag. */
      }
      if (panel.current) panel.current.style.transition = 'none'
    }
    if (from.held) setDrag(dy)
  }

  const onGrabUp = (e) => {
    const from = dragFrom.current
    if (!from) return
    if (!from.held) {
      dragFrom.current = null
      return
    }
    const dy = dragOffset(from.y, e.clientY)
    if (shouldDismiss(dy, Date.now() - from.at)) {
      dragFrom.current = { ...from, dismissed: true }
      setDrag(dy)
      close()
      return
    }
    dragFrom.current = null
    if (panel.current) panel.current.style.transition = `transform ${MORPH_MS}ms ${CURVE}`
    setDrag(0)
  }

  const panelStyle = phase === 'idle' && drag !== 0 ? { transform: `translateY(${drag}px)` } : undefined
  const body = {
    opacity: phase === 'idle' ? 1 : 0,
    transitionDuration: `${Math.round(MORPH_MS * 0.6)}ms`,
    transitionDelay: phase === 'idle' ? `${Math.round(MORPH_MS * 0.35)}ms` : '0ms',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300 ease-settle"
      style={{ opacity: phase === 'in' || phase === 'out' ? 0 : 1 }}
      onClick={close}
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={goal.commitment}
        onClick={(e) => e.stopPropagation()}
        style={panelStyle}
        /* origin at the top left, because that is the corner FLIP measures
           from. Any other origin and the two rectangles do not line up. */
        className="absolute inset-0 flex origin-top-left flex-col overflow-hidden bg-bg will-change-transform"
      >
        {/* --- header, and the whole strip is the drag handle -------------- */}
        <div
          className="shrink-0 cursor-grab touch-none select-none border-b border-hairline bg-surface px-5 active:cursor-grabbing"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        >
          <div className="mx-auto h-1 w-10 rounded-pill bg-ink/15" aria-hidden="true" />
          <div className="mx-auto mt-3 flex w-full max-w-content items-start gap-3 pb-4">
            <button
              type="button"
              onClick={close}
              aria-label={t('ui.back')}
              className="press -ml-2 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <BackIcon />
            </button>
            <div className="min-w-0 flex-1">
              {/* The commitment is the title. A heading reading "Goal" over a
                  page about one particular goal names the component rather
                  than what is on it. */}
              {/* text-safe, but deliberately not clamped. This is the view the
                  card's three-line clamp defers to, so it has to be the place
                  the whole thing is readable. It still needs permission to
                  break a long word, or the sheet scrolls sideways instead. */}
              <h2 className="text-safe text-h1 leading-tight text-ink">{goal.commitment}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-pill bg-accent/[0.14] px-3 py-1 text-label font-semibold text-ink ring-1 ring-inset ring-accent/25">
                  {cadence}
                </span>
                {finished && <span className={finished.chip}>{t(finished.label)}</span>}
                {paused && (
                  <span className="inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
                    {t('goal.paused')}
                  </span>
                )}
                {owner && (
                  <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
                    {owner.display_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- the body ---------------------------------------------------- */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-6 transition-opacity"
          style={body}
        >
          <div className="mx-auto w-full max-w-content space-y-7">
            {/* The one big action. Everything else on this page is a record;
                this is the only thing you came to do. */}
            {track && !finished && (
              <section>
                {progress.due ? (
                  <button
                    type="button"
                    onClick={tick}
                    disabled={ticking}
                    aria-pressed={progress.complete}
                    className={`press flex w-full items-center justify-center gap-3 rounded-card py-5 text-body font-semibold transition-colors duration-200 ease-settle disabled:opacity-60 ${
                      progress.complete ? 'bg-accent text-on-accent' : 'bg-surface text-ink ring-1 ring-inset ring-ink/10 hover:bg-ink/[0.03]'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-[0.55rem] border-2 transition-colors duration-200 ease-settle ${
                        progress.complete ? 'border-on-accent' : 'border-ink/25'
                      }`}
                    >
                      {progress.complete && <CheckIcon className="h-5 w-5" />}
                    </span>
                    {progress.target > 1
                      ? t('goal.today_count', { done: progress.done, total: progress.target })
                      : progress.complete
                        ? t('goal.done_today')
                        : t('goal.mark_today')}
                  </button>
                ) : (
                  <p className="rounded-card bg-surface px-5 py-4 text-small text-muted">
                    {t('goal.not_due_today')}
                  </p>
                )}
              </section>
            )}

            {/* --- the numbers --------------------------------------------- */}
            {track && (
              <section>
                <h3 className="eyebrow">{t('goal.stats')}</h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat value={total} label={t('goal.stat_total')} />
                  <Stat value={streak} label={t('goal.stat_streak')} />
                  {/* The date is set as a figure, not as a caption. It sat at
                      text-body next to two numbers at text-h1 and wrapped onto
                      two lines inside a 111px tile, so one of three equal
                      cards read as a different component. dateCaps caps the
                      month at four characters in both languages, which is a
                      width this tile can be sized for and never exceed. */}
                  <Stat
                    value={dateCaps(started, tag) ?? '—'}
                    title={dateFull(started, tag) ?? undefined}
                    label={t('goal.stat_since')}
                    date
                  />
                </div>

                {/* Two weeks of dots, the same row the card shows, at a size
                    you can actually count. */}
                <div className="mt-5 flex items-end gap-1.5" aria-hidden="true">
                  {recentDays(goal, dayIndex, DOT_DAYS, today).map((d) =>
                    !d.due ? (
                      <span key={d.day} className="h-1.5 w-1.5 shrink-0 rounded-pill bg-ink/15" />
                    ) : (
                      <span
                        key={d.day}
                        className={`h-3.5 min-w-0 flex-1 rounded-pill transition-colors duration-200 ease-settle ${
                          d.done ? 'bg-accent' : 'bg-ink/[0.13]'
                        }`}
                      />
                    ),
                  )}
                </div>
                <p className="mt-2 text-small text-muted">{t('goal.last_days', { n: DOT_DAYS })}</p>
              </section>
            )}

            {/* --- the month ------------------------------------------------ */}
            {track && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="eyebrow">{monthLabel(month, tag)}</h3>
                  <div className="flex gap-1">
                    <MonthStep dir={-1} onClick={() => setMonth((m) => shiftMonth(m, -1))} label={t('goal.prev_month')} />
                    <MonthStep
                      dir={1}
                      onClick={() => setMonth((m) => shiftMonth(m, 1))}
                      label={t('goal.next_month')}
                      disabled={sameMonth(month, new Date())}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {weekdayNames(tag).map((w, i) => (
                    <div key={i} className="pb-1 text-center text-label font-semibold text-muted">
                      {w}
                    </div>
                  ))}
                  {grid.map((date) => {
                    const inMonth = sameMonth(date, month)
                    const st = dayStatus(goal, dayIndex, date, today)
                    return (
                      <div
                        key={dayKey(date)}
                        title={dayKey(date)}
                        className={`flex aspect-square items-center justify-center rounded-[0.6rem] text-small font-semibold transition-colors ${cellClass(st, inMonth)}`}
                      >
                        {inMonth ? date.getDate() : ''}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* --- what was attached ---------------------------------------- */}
            <section>
              <h3 className="eyebrow">{t('goal.history')}</h3>
              <div className="mt-3">
                {goal.group_id ? (
                  history === null ? (
                    <p className="text-small text-muted">{t('txn.history_loading')}</p>
                  ) : history.length === 0 ? (
                    <p className="text-small text-muted">{t('goal.history_empty')}</p>
                  ) : (
                    <ul className="lg divide-y divide-hairline px-5">
                      {history.map((item) => (
                        <CheckinRow key={item.id} item={item} t={t} tag={tag} />
                      ))}
                    </ul>
                  )
                ) : (
                  <SoloHistory goal={goal} index={dayIndex} today={today} t={t} tag={tag} />
                )}
              </div>
            </section>
          </div>
        </div>

        {/* --- the footer, outside the scroller ---------------------------- */}
        {/* Under the thumb whatever is scrolled above it, and the safe-area
            inset is added rather than assumed: on a phone with a home
            indicator a row flush to the edge has a gesture bar drawn on it. */}
        <div
          className="shrink-0 border-t border-hairline bg-surface px-5 pt-4 transition-opacity"
          style={{ ...body, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="mx-auto flex w-full max-w-content flex-wrap items-center gap-2">
            {editHref && (
              <Link to={editHref} className="goal-action press" onClick={close}>
                {t('goal.edit')}
              </Link>
            )}
            {!finished ? (
              <>
                <button onClick={() => setStatus(paused ? 'active' : 'paused')} className="goal-action-soft press">
                  {paused ? t('goal.resume') : t('goal.pause')}
                </button>
                <button onClick={() => setStatus('completed')} className="goal-action-done press">
                  {t('goal.mark_done')}
                </button>
              </>
            ) : (
              <button onClick={() => setStatus('active')} className="goal-action-soft press">
                {t('goal.reopen')}
              </button>
            )}
            {deletable && (
              <button
                type="button"
                onClick={() => setAsking(true)}
                className="press ml-auto inline-flex items-center rounded-pill px-4 py-2 text-small font-semibold text-negative transition-colors duration-200 ease-settle hover:bg-negative/[0.09]"
              >
                {t('goal.delete')}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title={t('goal.delete_title')}
        body={t('goal.delete_body')}
        cancelLabel={t('goal.delete_cancel')}
        confirmLabel={deleting ? t('goal.deleting') : t('goal.delete_confirm')}
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          setAsking(false)
          setDeleteError(null)
        }}
        onConfirm={confirmDelete}
      />
    </div>,
    document.body,
  )
}

/**
 * One figure and what it is.
 *
 * `date` is the third tile rather than a size prop, because what makes it
 * different is not only that it is smaller. A date is letters, so it takes the
 * uppercase treatment and the tracking that caps want, and it must not break
 * mid-string: nowrap is what keeps "17 SEPT 2025" on one line instead of
 * hyphenating a month across two. The number tiles keep tabular figures, which
 * a date has no use for.
 */
function Stat({ value, label, title, date = false }) {
  return (
    /* px-2 rather than px-3: at 320px the three tiles are 88px each, and four
       pixels a side is the difference between the widest month fitting and
       not. Restored above 640px, where there is room to spare. */
    <div className="rounded-card bg-surface px-2 py-4 text-center sm:px-3">
      <div
        title={title}
        /**
         * 18px, not the 22 the neighbours use, and the number is measured
         * rather than chosen. Poppins at this weight sets "17 SEPT" to 86px,
         * against 95px of tile at 390px wide; at 20px it is 95px and at 22px
         * it is 105px, so the tile that started this was overflowing at every
         * size that looked right next to a one-digit number. Below 360px the
         * tile is 72px and only 14px goes in.
         *
         * A date cannot be set at the size of the figure beside it in a third
         * of a phone. Matching the neighbours means taking their treatment,
         * bold and uppercase and tracked, not their pixels.
         *
         * No nowrap. It was there and it turned a wrap into a clip, which is
         * worse: the year simply vanished off the edge of the tile. The break
         * is controlled in dateCaps instead, by which space is a normal one.
         */
        className={
          date
            ? 'font-display text-small font-bold uppercase leading-tight tracking-[0.03em] text-ink min-[360px]:text-[1.125rem]'
            : 'font-display text-h1 font-semibold leading-none text-ink [font-variant-numeric:tabular-nums]'
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-label font-semibold text-muted">{label}</div>
    </div>
  )
}

function MonthStep({ dir, onClick, label, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="press flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" {...stroke}>
        <path d={dir < 0 ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )
}

/**
 * How a calendar square is painted.
 *
 * Five cases, and the two that are easy to conflate are the point: a day the
 * goal was not due and a day it has not arrived on yet are both empty of a
 * tick and neither is a miss. Painting them like one turns the rest of the
 * month into a picture of a month already lost.
 */
function cellClass(st, inMonth) {
  if (!inMonth) return 'text-transparent'
  if (st.complete) return 'bg-accent text-on-accent'
  if (st.partial) return 'bg-accent/[0.3] text-ink'
  if (st.before || !st.due) return 'text-muted/40'
  if (st.future) return 'text-muted/60'
  return 'bg-ink/[0.06] text-muted'
}

/** Mon..Sun in the reader's own language, one letter. */
function weekdayNames(tag) {
  const fmt = new Intl.DateTimeFormat(tag, { weekday: 'narrow' })
  /* 2026-08-02 is a Sunday, and monthGrid's columns start on Sunday. */
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 7, 2 + i)))
}

function monthLabel(d, tag) {
  return new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(d)
}

/* Not addMonths from calendar.js: that one is bound to the month strip's own
   clamping. This is the plain arithmetic, and Date normalises the overflow. */
const shiftMonth = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)

function fmtDay(value, tag) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

/**
 * The days a solo goal was kept, newest first.
 *
 * There are no check-ins to list: a solo goal has no cycles, which is the
 * whole reason goal_days exists. So the history is the ticks themselves, which
 * are already in memory and need no query.
 */
function SoloHistory({ goal, index, today, t, tag }) {
  const days = useMemo(() => {
    const out = []
    for (let i = 0; i < 120; i += 1) {
      const date = shiftDay(today, -i)
      const n = countOn(index, goal.id, dayKey(date))
      if (n > 0) out.push({ day: dayKey(date), n, date })
    }
    return out
  }, [goal.id, index, today])

  if (days.length === 0) return <p className="text-small text-muted">{t('goal.history_empty')}</p>

  return (
    <ul className="lg divide-y divide-hairline px-5">
      {days.slice(0, 30).map(({ day, n, date }) => (
        <li key={day} className="flex items-baseline justify-between gap-3 py-3">
          <span className="text-body text-ink first-letter:uppercase">
            {new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}
          </span>
          <span className="shrink-0 text-small font-semibold text-muted [font-variant-numeric:tabular-nums]">
            {n > 1 ? `${n}×` : ''}
            <CheckIcon className="ml-1 inline h-4 w-4 text-accent" />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * One check-in on a goal inside a group, with whatever was attached to it.
 *
 * The proof columns are read defensively rather than switched on the goal's
 * proof_type: a goal moved from photo to link in March still has February's
 * photographs hanging off it, so what is on the row is the only reliable
 * account of what the proof actually is.
 */
function CheckinRow({ item, t, tag }) {
  const when = item.checkins?.submitted_at
  const note = String(item.evidence ?? '').trim()
  const label =
    item.outcome === 'done' ? t('board.did_it') : item.outcome === 'partial' ? t('board.partly') : t('board.not_this_week')
  const tone = item.outcome === 'done' ? 'chip-green' : item.outcome === 'partial' ? 'chip-accent' : 'chip-quiet'

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1 text-body text-ink first-letter:uppercase">
          {when
            ? new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(when))
            : '—'}
        </span>
        <span className={`${tone} shrink-0`}>{label}</span>
      </div>

      {(item.photo_url || note || item.link_url) && (
        <div className="mt-3 space-y-3">
          {item.photo_url && (
            <img
              src={item.photo_url}
              alt=""
              loading="lazy"
              className="w-full rounded-inner bg-ink/[0.04] object-cover"
              style={{ maxHeight: '16rem' }}
            />
          )}
          {note && <p className="whitespace-pre-wrap text-small text-ink">{note}</p>}
          {item.link_url && (
            /* rel is not optional: the proof is a URL somebody typed, and
               without noopener the page it opens gets a handle on this one. */
            <a
              href={item.link_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-block max-w-full truncate text-small font-semibold text-ink underline underline-offset-2"
            >
              {t('recap.proof_link')}
            </a>
          )}
        </div>
      )}
    </li>
  )
}
