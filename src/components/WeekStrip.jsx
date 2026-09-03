import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { money } from '../lib/money'
import { loadBudget } from '../lib/budgetData'
import { dayKey, weekOf } from '../lib/time'
import { isDueOn } from '../lib/schedule'
import { isMissingColumn } from '../lib/dberr'
import { cleanMoods } from '../lib/moods'
import { rectOf } from '../lib/gesture'
import { useLongPress } from '../lib/useLongPress'
import {
  CURRENT_MONTH,
  calendarRange,
  monthGrid,
  monthsAround,
  sameMonth,
} from '../lib/calendar'
import { MoodBadges } from './MoodBoard'
import DayRecap from './DayRecap'

/**
 * The week, as seven circles.
 *
 * The dashboard could tell you about today and about the last fourteen
 * cycles, and nothing in between. That is a strange gap: the question people
 * actually ask of a habit app is "what did I do on Tuesday", and answering it
 * meant opening a group, finding the right board and reading a roster.
 *
 * So the week is a row of dates you can tap. It is the pattern Flo uses and it
 * is right for the same reason there: a week is small enough to hold in one
 * glance, the current day is obvious, and the days on either side of it are
 * one tap rather than one navigation.
 *
 * Tapping a date opens the same in-place panel MoodToday uses rather than
 * pushing a screen. A day's detail is three lines; a route change for three
 * lines loses your place on the dashboard to tell you less than a card does.
 *
 * The strip never disappears. A week with nothing in it is still a true
 * answer, and a component that vanishes when it has nothing to say is one
 * people stop looking for.
 */

const OUTCOME_TONE = {
  done: 'chip-green',
  partial: 'chip-accent',
  missed: 'chip-quiet',
}

/**
 * How far back the slider goes, and how far forward.
 *
 * Six weeks of history is about as far as anybody swipes before they would
 * rather tap a date, and it is a bounded number of DOM nodes: rendering every
 * week since the account opened would grow the strip forever on exactly the
 * accounts that use the app most.
 *
 * One week forward, not none. A track that refuses to move in one direction
 * reads as broken rather than as finished, and next week is a real answer:
 * these are the days you have coming.
 */
const WEEKS_BACK = 6
const WEEKS_FORWARD = 1
const CURRENT = WEEKS_BACK

/** Drawn, one path, so it inherits the ink colour and the type's weight. */
function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * One date, in either view.
 *
 * TAP SELECTS. HOLD OPENS.
 *
 * Two things on one square, which works because they are the same intent at
 * two depths: a tap says "tell me about this day" and answers in the panel
 * below, a hold says "tell me everything" and answers in a card grown out of
 * the square itself. Nobody has to learn a second control, and the tap is
 * untouched for anybody who never discovers the hold.
 *
 * The ring under the finger is not decoration. A gesture with a delay in it
 * has to say it has started, or the half second before anything happens is
 * indistinguishable from a control that does not work. It fills over exactly
 * HOLD_MS, so what the reader sees is the actual remaining wait rather than a
 * generic pulse.
 *
 * `weekday` is what tells the two views apart. In the month grid the column
 * already says which day it is, and repeating it forty-two times is a wall of
 * tiny type over the numbers people came to read.
 */
function DayCell({
  date,
  isToday,
  isSelected,
  isFuture,
  outside = false,
  marked,
  label,
  weekday = false,
  onSelect,
  onOpen,
}) {
  /* The element is passed through, not dropped. It is the rectangle the card
     grows out of, and `() => onOpen?.()` silently discards it: the card then
     appears from nowhere, which looks exactly like a transition that was never
     applied and is nothing of the sort. */
  const { holding, handlers, consumedClick } = useLongPress((el) => onOpen?.(el))

  const circle = isToday
    ? 'bg-accent text-on-accent font-semibold'
    : isSelected
      ? 'bg-ink text-white font-semibold'
      : outside
        ? 'text-muted/40'
        : isFuture
          ? 'text-muted/60'
          : 'text-ink'

  return (
    <button
      type="button"
      {...handlers}
      onClick={() => {
        /* The hold already opened the card. Letting the click through as well
           would move the selection to whatever the finger was over, so the
           sheet would be about one day while the strip highlighted another. */
        if (consumedClick()) return
        onSelect?.()
      }}
      aria-pressed={isSelected}
      aria-label={label}
      className={`press relative flex touch-manipulation select-none flex-col items-center rounded-card py-1 [-webkit-touch-callout:none] ${
        weekday ? 'gap-1.5' : 'gap-1'
      }`}
    >
      {weekday && (
        <span className="text-label font-semibold uppercase tracking-[0.08em] text-muted">
          {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
        </span>
      )}

      <span className="relative flex items-center justify-center">
        {/* Drawn behind the number and outside its box, so a circle that is
            already filled does not have to give up any of itself to show the
            hold. Pointer events off, or the ring would steal the pointermove
            events the hold is watching for drift. */}
        {holding && (
          <span
            aria-hidden="true"
            className="hold-ring pointer-events-none absolute inset-[-5px] rounded-pill"
          />
        )}
        <span
          className={`flex items-center justify-center rounded-pill text-small [font-variant-numeric:tabular-nums] transition-transform duration-300 ease-settle ${
            weekday ? 'h-10 w-10' : 'h-9 w-9'
          } ${circle} ${holding ? 'scale-95' : ''} ${
            /* The accent, not the ink. This ring said "today, and selected" in a
               pale tint of the ink; the ink is a near-black now, so it came out
               as a silver band round a pink dot and read as a disabled state. */
            isSelected && isToday ? 'ring-2 ring-accent/30 ring-offset-2 ring-offset-transparent' : ''
          }`}
          style={{ transitionProperty: 'transform, background-color, color' }}
        >
          {date.getDate()}
        </span>
      </span>

      {/* Presence, not performance. One dot means the day has something in it,
          which is all a badge this size can honestly carry. */}
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-pill ${marked ? 'bg-green' : 'bg-transparent'}`}
      />
    </button>
  )
}

/**
 * A horizontal snap track, and where in it the reader is.
 *
 * One slide per page, each exactly the track's width, with mandatory snapping
 * so a flick always lands on a slide rather than halfway between two. The
 * browser does the whole gesture: no drag handler, no velocity maths and no
 * library, which is why it works with a finger, a trackpad, a shift-wheel and
 * a keyboard without any of them being handled separately.
 *
 * Extracted because there are two of these now, weeks and months, and the part
 * that is easy to get wrong is not the markup. scrollLeft is a number of
 * pixels and the slide it points at is that number divided by the track's
 * width, so any change of width relocates the reader: rotating a phone,
 * opening the keyboard or dragging a desktop window used to move the strip to
 * a week nobody asked for. `page` is the truth; the pixel offset is derived
 * from it, and the observer restores it whenever the width moves.
 *
 * @param active false while the track is unmounted, so the alignment runs on
 *               the render it first appears in rather than never.
 */
function useSnapTrack(initial, active = true) {
  const ref = useRef(null)
  const page = useRef(initial)
  const [shown, setShown] = useState(initial)

  useLayoutEffect(() => {
    const el = ref.current
    if (!active || !el) return

    const align = () => el.scrollTo({ left: el.clientWidth * page.current, behavior: 'instant' })
    align()

    const ro = new ResizeObserver(align)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  /* Read off the scroll position rather than tracked per slide: the whole
     point of a snap track is that the browser owns the position. */
  const onScroll = () => {
    const el = ref.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i === page.current) return
    page.current = i
    setShown(i)
  }

  /**
   * Jump to a slide.
   *
   * `page` is written here rather than left to the scroll handler, because a
   * track that is not on screen yet fires no scroll event: expanding the card
   * sets the month before the month track has ever been scrolled, and without
   * this the arrows would then be disabled against the wrong index.
   */
  const goTo = (i, count, behavior = 'instant') => {
    const next = Math.min(count - 1, Math.max(0, i))
    page.current = next
    setShown(next)
    ref.current?.scrollTo({ left: ref.current.clientWidth * next, behavior })
  }

  const step = (delta, count) => goTo(page.current + delta, count, 'smooth')

  return { ref, page, shown, onScroll, goTo, step }
}

export default function WeekStrip({ goals = [], statuses = [] }) {
  const { user, profile } = useAuth()
  const { t, locale } = useT()

  /**
   * Eight weeks, one per slide, oldest first.
   *
   * Built from the current week's Sunday by stepping the day-of-month, which
   * is the same trick weekOf uses and for the same reason: adding multiples of
   * 604800000 to a timestamp gets a week wrong twice a year.
   */
  const weeks = useMemo(() => {
    const base = weekOf(new Date())[0]
    return Array.from({ length: WEEKS_BACK + 1 + WEEKS_FORWARD }, (_, i) =>
      weekOf(
        new Date(base.getFullYear(), base.getMonth(), base.getDate() + (i - CURRENT) * 7),
      ),
    )
  }, [])

  /**
   * The months, for when the card is opened out.
   *
   * A separate track from the weeks rather than one grid clipped to a row.
   * Clipping is the prettier animation and it makes the two modes disagree
   * about what a swipe means: collapsed, a flick has always moved a week, and
   * a single month grid can only page by month. Two tracks keeps the gesture
   * that already works and adds the one the month view wants.
   */
  const months = useMemo(() => monthsAround(new Date()), [])

  const week = weeks[CURRENT]
  const todayKey = dayKey()
  const [selected, setSelected] = useState(todayKey)

  /**
   * Open or shut, and what that costs to fetch.
   *
   * The strip reads eight weeks. The calendar can page a year back, and doing
   * that read on every dashboard load would slow the first screen of the app
   * down for the majority of people who never open the calendar at all. So the
   * wide read happens the first time somebody expands, and never unhappens:
   * collapsing again keeps what was already fetched rather than throwing it
   * away and refetching on the next tap.
   */
  const [expanded, setExpanded] = useState(false)
  const [wide, setWide] = useState(false)

  /* The recap, and the square it grows out of. The rectangle is measured at
     the moment of the press rather than looked up later, because by the time
     the card is closing the track may have been paged and the cell that
     opened it may not be on screen at all. */
  const [recap, setRecap] = useState(false)
  const [origin, setOrigin] = useState(null)

  /**
   * The two tracks.
   *
   * Both scrolled to the current period before the browser paints, so neither
   * is ever briefly showing a year ago. useLayoutEffect inside the hook rather
   * than useEffect for exactly that: an effect that ran after paint would show
   * the jump.
   */
  const weekTrack = useSnapTrack(CURRENT, !expanded)
  const monthTrack = useSnapTrack(CURRENT_MONTH, expanded)

  /* Outcomes, keyed by the cycle they were filed against rather than by when
     they were typed. A check-in submitted at ten past midnight belongs to the
     day it was for, not to the one the clock had just rolled into. */
  const [itemsByCycle, setItemsByCycle] = useState({})
  const [budget, setBudget] = useState(null)
  const [moodByDay, setMoodByDay] = useState({})

  /* Which select shape this database can answer. A ref rather than state: it
     changes at most once per session and nothing renders from it. */
  const proofShape = useRef(null)

  /* The whole slider, not the visible week. One read covering every slide,
     because a fetch per swipe would mean an empty strip for a moment every
     time somebody flicked back through a month.

     Which slider depends on whether the calendar has ever been opened. See
     `wide` above: the dashboard's first load stays at eight weeks. */
  const span = wide ? calendarRange(months) : { from: weeks[0][0], to: weeks[weeks.length - 1][6] }
  const from = span.from
  const to = span.to

  useEffect(() => {
    if (!user) return
    let dead = false

    /**
     * The proof columns, if the database has them.
     *
     * link_url and photo_url arrived with migration 28, and a select naming a
     * column that does not exist is a 400 for the whole query: on a database
     * that has not run it, asking for the proof would take the entire calendar
     * down rather than just the proof. So it asks once, and if the answer is
     * that the column is unknown, asks again for what has always been there.
     *
     * The narrow shape is remembered for the rest of the session, so the
     * fallback costs one extra request and not one per refetch.
     */
    const FULL = 'id, cycle_id, checkin_items(goal_id, outcome, count_done, evidence, link_url, photo_url)'
    const SAFE = 'id, cycle_id, checkin_items(goal_id, outcome, count_done, evidence)'

    const readCheckins = async (shape) =>
      supabase
        .from('checkins')
        .select(shape)
        .eq('user_id', user.id)
        .gte('submitted_at', new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString())
        .lt('submitted_at', new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString())

    const run = async () => {
      try {
        let { data, error } = await readCheckins(proofShape.current ?? FULL)

        if (error && isMissingColumn(error)) {
          proofShape.current = SAFE
          ;({ data, error } = await readCheckins(SAFE))
        }

        /* Not an early return. This sits above the budget and the mood, and
           `return` here exits the whole of run(), so one failing query was
           quietly cancelling two unrelated ones. */
        if (!dead && !error) {
          const map = {}
          for (const c of data ?? []) map[c.cycle_id] = c.checkin_items ?? []
          setItemsByCycle(map)
        }
      } catch {
        /* Offline. The strip still draws; the day panel just has less in it. */
      }

      const b = await loadBudget(user.id).catch(() => null)
      if (!dead) setBudget(b)

      /**
       * How the week felt, alongside how it went.
       *
       * daily_mood has stored this per day since migration 12 and nothing has
       * ever read it back except today's own card, so the record existed and
       * was invisible the moment the day turned over. A mood the app tells you
       * it is keeping had better be somewhere you can find it.
       *
       * A missing table is a state, not an error: the mood line simply does
       * not appear, exactly as MoodToday handles it.
       */
      try {
        let { data, error } = await supabase
          .from('daily_mood')
          .select('day, mood, moods')
          .eq('user_id', user.id)
          .gte('day', dayKey(from))
          .lte('day', dayKey(to))

        /* No `moods` column before migration 36, and naming it fails the whole
           select rather than returning less. Falling back keeps the mood line
           working there instead of removing it from every day at once. */
        if (error && isMissingColumn(error, 'moods')) {
          ;({ data, error } = await supabase
            .from('daily_mood')
            .select('day, mood')
            .eq('user_id', user.id)
            .gte('day', dayKey(from))
            .lte('day', dayKey(to)))
        }

        if (!dead && !error) {
          const byDay = {}
          /* An ARRAY per day now, not one id. A day held several feelings from
             the moment migration 36 landed, and reading only `mood` showed the
             one that stands for the rest: somebody who picked three saw one in
             their own history. The compact dots below still use the first of
             the set, because seven days each wearing four faces is not a strip
             anybody can read, but the expanded day shows all of them. */
          for (const row of data ?? []) {
            const list = cleanMoods(row.moods?.length ? row.moods : row.mood)
            if (list.length) byDay[row.day] = list
          }
          setMoodByDay(byDay)
        }
      } catch {
        /* Offline. The rest of the panel still draws. */
      }

    }

    run()
    /* The money screen and the check-in both write things this panel reads,
       and both are one tap away, so coming back to the tab refetches. */
    const onShow = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [user?.id, from.getTime(), to.getTime()])

  /* Which cycles belong to which day. statuses carries every group at once, so
     a day can have more than one, and all of them count as that day. */
  const cyclesByDay = useMemo(() => {
    const map = {}
    for (const s of statuses) {
      if (!s.opens_at) continue
      const k = dayKey(new Date(s.opens_at))
      ;(map[k] ??= []).push(s)
    }
    return map
  }, [statuses])

  const entriesByDay = useMemo(() => {
    const map = {}
    for (const e of budget?.entries ?? []) {
      ;(map[e.happened_on] ??= []).push(e)
    }
    return map
  }, [budget])

  /* The person's, not the plan's. See summarise() in budget.js for why the
     plan's column is not an answer. */
  const currency = profile?.currency || budget?.plan?.currency || 'CAD'
  const fmt = (cents) => money(cents, currency, locale)

  /* What the selected day actually holds. */
  const rows = cyclesByDay[selected] ?? []
  const outcomes = new Map()
  for (const s of rows) {
    for (const item of itemsByCycle[s.cycle_id] ?? []) outcomes.set(item.goal_id, item)
  }

  const selectedDate = new Date(`${selected}T00:00:00`)

  /* What that particular day was actually asking for, which is the same rule
     the check-in uses. A Thursday should not list a Monday-and-Wednesday goal
     and then show it as unrecorded. */
  const live = goals.filter((g) => isDueOn(g, selectedDate))

  const entries = entriesByDay[selected] ?? []
  const total = (kind) =>
    entries.filter((e) => e.kind === kind).reduce((sum, e) => sum + (e.amount_cents || 0), 0)
  const spent = total('expense')
  const earned = total('income')

  const isFutureDay = selected > todayKey
  /* An array now. Empty rather than null so every reader can ask for .length
     and nothing has to remember which of the two shapes it is holding. */
  const moods = moodByDay[selected] ?? []
  const nothing = live.length === 0 && entries.length === 0 && moods.length === 0

  /**
   * Which month the header names, in whichever mode is showing.
   *
   * A week's month is taken from its middle day rather than its first: the
   * week of 29 September to 5 October is mostly October, and labelling it
   * September because of where it starts is the answer nobody means.
   */
  const shownWeek = weeks[weekTrack.shown] ?? week
  const shownMonth = months[monthTrack.shown] ?? months[CURRENT_MONTH]
  const labelDate = expanded ? shownMonth : shownWeek[3]
  const monthLabel = labelDate.toLocaleDateString(localeTag(locale), {
    month: 'long',
    year: labelDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })

  const track = expanded ? monthTrack : weekTrack
  const slides = expanded ? months.length : weeks.length

  /* Whether a day has anything on it at all, which is what the dot under it
     means. Presence, not performance: one dot is all a badge that size can
     honestly carry, and it must not become a score. */
  const isMarked = (k) =>
    (cyclesByDay[k] ?? []).some((s) => s.status === 'submitted') ||
    (entriesByDay[k] ?? []).length > 0 ||
    Boolean(moodByDay[k]?.length)

  const dayLabel = (d) =>
    d.toLocaleDateString(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'long' })

  /**
   * Opening out, and folding back, without losing your place.
   *
   * Expanding pages the month track to the month the selected day is in, and
   * collapsing pages the week track to its week. Without this the calendar
   * opens on today no matter which day you were reading, so tapping a date in
   * March and then asking to see the month takes you to the current one, which
   * is the opposite of what the tap meant.
   */
  /**
   * Held a date: select it, remember the square, and open the day.
   *
   * This used to also fetch that day's journal entry, behind the passcode, and
   * that was most of the function. The journal is gone from the app, so what is
   * left is what the name always said.
   */
  function openDay(k, el) {
    setSelected(k)
    setOrigin(rectOf(el))
    setRecap(true)
  }

  const toggleExpanded = () => {
    const target = new Date(`${selected}T00:00:00`)
    if (!expanded) {
      setWide(true)
      const i = months.findIndex((m) => sameMonth(m, target))
      monthTrack.goTo(i < 0 ? CURRENT_MONTH : i, months.length)
      setExpanded(true)
      return
    }
    const i = weeks.findIndex((w) => w.some((d) => dayKey(d) === selected))
    weekTrack.goTo(i < 0 ? CURRENT : i, weeks.length)
    setExpanded(false)
  }

  return (
    <div className="lg overflow-hidden p-4 sm:p-5">
      {/**
       * Which week you are looking at, and two ways to leave it.
       *
       * The dates alone cannot say this: "9 10 11 12" is the same row of
       * numbers in August as it is in September, and once the strip can move,
       * a reader who has swiped twice has no way to know where they landed.
       *
       * The arrows are not the primary control, the swipe is. They are here
       * because a swipe is invisible until somebody tries it, and because a
       * mouse has no swipe at all.
       */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="eyebrow">{monthLabel}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => track.step(-1, slides)}
            disabled={track.shown === 0}
            aria-label={expanded ? t('week.previous_month') : t('week.previous')}
            className="press flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            onClick={() => track.step(1, slides)}
            disabled={track.shown >= slides - 1}
            aria-label={expanded ? t('week.next_month') : t('week.next')}
            className="press flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>

      {/**
       * The slider.
       *
       * One slide per week, each exactly the track's width, with mandatory
       * snapping so a flick always lands on a week rather than halfway between
       * two. The browser does the whole of the gesture: there is no drag
       * handler, no velocity maths and no library, which is why it feels right
       * on a phone and works with a trackpad, a shift-wheel and a keyboard
       * without any of them being handled separately.
       *
       * overscroll-x-contain stops a swipe past the last week from turning
       * into the browser's back gesture, which on iOS would navigate away from
       * the dashboard entirely.
       */}
      {expanded ? (
        <>
          {/* The weekday letters, once at the top, rather than above all
              forty-two cells. In a grid the column is what says which day it
              is; repeating it in every cell is a wall of small type over the
              numbers people came to read. */}
          <div className="grid grid-cols-7 gap-0.5 pb-1 sm:gap-1" aria-hidden="true">
            {week.map((d) => (
              <span
                key={d.getDay()}
                className="text-center text-label font-semibold uppercase tracking-[0.08em] text-muted"
              >
                {d.toLocaleDateString(localeTag(locale), { weekday: 'narrow' })}
              </span>
            ))}
          </div>

          <div
            ref={monthTrack.ref}
            data-track="month"
            onScroll={monthTrack.onScroll}
            className="animate-rise flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {months.map((m) => (
              <div
                key={dayKey(m)}
                className="grid w-full shrink-0 snap-center grid-cols-7 gap-0.5 sm:gap-1"
              >
                {monthGrid(m).map((d) => {
                  const k = dayKey(d)
                  return (
                    <DayCell
                      key={k}
                      date={d}
                      isToday={k === todayKey}
                      isSelected={k === selected}
                      isFuture={k > todayKey}
                      outside={!sameMonth(m, d)}
                      marked={isMarked(k)}
                      label={dayLabel(d)}
                      onSelect={() => setSelected(k)}
                      onOpen={(el) => openDay(k, el)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          ref={weekTrack.ref}
          data-track="week"
          onScroll={weekTrack.onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {weeks.map((w) => (
            <div
              key={dayKey(w[0])}
              className="grid w-full shrink-0 snap-center grid-cols-7 gap-0.5 sm:gap-1"
            >
              {w.map((d) => {
                const k = dayKey(d)
                return (
                  <DayCell
                    key={k}
                    date={d}
                    weekday
                    isToday={k === todayKey}
                    isSelected={k === selected}
                    isFuture={k > todayKey}
                    marked={isMarked(k)}
                    label={dayLabel(d)}
                    onSelect={() => setSelected(k)}
                    onOpen={(el) => openDay(k, el)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/**
       * The handle that opens the card out.
       *
       * At the bottom edge of the dates rather than beside the month name,
       * because that is the edge the card grows from and a control that lives
       * where the movement happens needs no explaining. The grabber is the
       * same one every sheet in this app puts at its top edge, which is
       * already the app's word for "this thing can be dragged open".
       *
       * It is a button and not a drag. A one-directional drag gesture on a
       * card that also scrolls horizontally is two gestures competing for the
       * same pixels, and the loser is whichever one the reader meant.
       */}
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? t('week.show_week') : t('week.show_month')}
        data-hook="week-toggle"
        /**
         * Back to the word between two rules, no pill.
         *
         * The pill was asked for and then asked back out again. Two things
         * survive it: the hook, which the contrast probe reads, and the rules
         * being in the ACCENT rather than the ink. They used to be a tint of
         * the ink, and the ink is a near-black now, so leaving them there
         * would paint them grey instead of the pink they have always been on
         * this card.
         */
        className="press group mt-1 flex w-full items-center justify-center gap-2 rounded-inner py-2 transition-colors hover:bg-accent/[0.06]"
      >
        <span className="h-1 w-8 rounded-pill bg-accent/40 transition-colors group-hover:bg-accent/60" />
        <span className="text-label font-semibold uppercase tracking-[0.08em] text-ink">
          {expanded ? t('week.week') : t('week.month')}
        </span>
        <span className="h-1 w-8 rounded-pill bg-accent/40 transition-colors group-hover:bg-accent/60" />
      </button>

      {/**
       * THE "OPEN THE CALENDAR" LINK IS GONE.
       *
       * It existed because the bottom bar is capped at four tabs and the
       * calendar could not be a fifth, so this strip was the way out to the
       * full timetable. That premise expired when the side rail arrived: the
       * calendar is a permanent destination in it at every width above md, and
       * on a phone the tab bar is one tap away at the bottom of the screen.
       *
       * So the link was a second door to a room that already has one, sitting
       * in the middle of a card about this week. Removed on request, and the
       * reason it can go without leaving anything unreachable is the rail.
       */}

      {/* Always open, never a disclosure. There is always a selected day, so a
          panel that had to be opened would be a second tap between you and the
          only thing the strip is for. */}
      <div className="mt-2 border-t border-hairline pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-small font-semibold text-ink first-letter:uppercase">
            {selected === todayKey
              ? t('week.today')
              : selectedDate.toLocaleDateString(localeTag(locale), {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
          </p>

          {/**
           * The way to the whole day.
           *
           * Offered only when there is something to open. A card that always
           * shows a button leading to "nothing was recorded on this day" is a
           * card that teaches people the button is not worth pressing, and
           * they stop pressing it on the days it would have paid off.
           */}
          {!nothing && (
            <button
              type="button"
              /* The same card the hold opens, grown out of this button when it
                 is the thing that was pressed. A tap here is not a hold, so
                 there is no cell rectangle to use, and the button's own is
                 the honest origin: the card comes from what you touched. */
              onClick={(e) => openDay(selected, e.currentTarget)}
              className="goal-action press shrink-0"
            >
              {t('recap.open')}
            </button>
          )}
        </div>

        {nothing ? (
          <p className="mt-2 text-small text-muted">{t('week.nothing')}</p>
        ) : (
          <>
            {/* First, because the day's mood is the frame the rest of it is
                read in. Asking how somebody was before what they got done is
                the order this whole product argues for. */}
            {moods.length > 0 && (
              <p className="mt-3 flex items-center gap-2.5 text-small text-ink">
                <MoodBadges ids={moods} size={22} />
                {moods.map((id) => t(`mood.${id}`)).join(' · ')}
              </p>
            )}

            {live.length > 0 && (
              <div className="mt-3 space-y-2">
                {live.map((g) => {
                  const item = outcomes.get(g.id)
                  return (
                    <div key={g.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-small text-ink">
                        {g.commitment}
                      </span>
                      {/* A future day has no outcome to be missing, so it is
                          left blank rather than labelled "not recorded",
                          which would read as a failure you have not had the
                          chance to avoid yet. */}
                      {item ? (
                        <span className={`${OUTCOME_TONE[item.outcome] ?? 'chip-quiet'} shrink-0`}>
                          {item.outcome === 'done'
                            ? t('board.did_it')
                            : item.outcome === 'partial'
                              ? t('board.partly')
                              : t('board.not_this_week')}
                        </span>
                      ) : (
                        !isFutureDay && (
                          <span className="shrink-0 text-small text-muted/70">
                            {t('week.not_recorded')}
                          </span>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {entries.length > 0 && (
              <div className="mt-4 border-t border-hairline pt-3">
                <span className="eyebrow">{t('money.title')}</span>

                {/**
                 * Out and in, as a pair, before the itemised list.
                 *
                 * A single "Spent CA$46.50" over a list of categories is a
                 * receipt, not a summary: it answers half the question and
                 * leaves the other half to be worked out by reading every row
                 * and noticing which of them were income. Two figures side by
                 * side is the whole day in one glance.
                 *
                 * Both are always shown, including a day where nothing came
                 * in. A zero is the answer to "did anything come in today",
                 * and hiding it makes the pair jump around from day to day so
                 * that neither figure ever lands in the same place twice.
                 */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    [t('money.spent'), spent],
                    [t('money.kind_income'), earned],
                  ].map(([label, cents]) => (
                    <div key={label} className="rounded-inner bg-ink/[0.035] px-4 py-3">
                      <div className="text-small font-semibold text-muted">{label}</div>
                      <div className="mt-1 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
                        {fmt(cents)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-2">
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-small text-ink">
                        {e.kind === 'income'
                          ? t('money.kind_income')
                          : t(`money.cat_${e.category ?? 'other'}`)}
                      </span>
                      <span className="shrink-0 text-small [font-variant-numeric:tabular-nums] text-muted">
                        {e.kind === 'income' ? '+' : ''}
                        {fmt(e.amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DayRecap
        open={recap}
        origin={origin}
        date={selectedDate}
        isFuture={isFutureDay}
        moods={moods}
        goals={live}
        outcomes={outcomes}
        entries={entries}
        currency={currency}
        onClose={() => setRecap(false)}
      />
    </div>
  )
}
