import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { money } from '../lib/money'
import { loadBudget } from '../lib/budgetData'
import { dayKey, weekOf } from '../lib/time'
import { isDueOn } from '../lib/schedule'
import { MoodBadge } from './MoodBoard'

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

/** One date. The circle is the target; the label and the dot ride with it. */
function DayBadge({ date, isToday, isSelected, isFuture, marked, label, onSelect }) {
  const circle = isToday
    ? 'bg-accent text-on-accent font-bold'
    : isSelected
      ? 'bg-ink text-white font-bold'
      : isFuture
        ? 'text-muted/60'
        : 'text-ink'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={label}
      className="press flex flex-col items-center gap-1.5 rounded-card py-1"
    >
      <span className="text-label font-bold uppercase tracking-[0.08em] text-muted">
        {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
      </span>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-pill text-small [font-variant-numeric:tabular-nums] transition-colors duration-200 ${circle} ${
          isSelected && isToday ? 'ring-2 ring-ink/25 ring-offset-2 ring-offset-transparent' : ''
        }`}
      >
        {date.getDate()}
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

  const week = weeks[CURRENT]
  const todayKey = dayKey()
  const [selected, setSelected] = useState(todayKey)

  /**
   * The track, and where it starts.
   *
   * Scrolled to the current week before the browser paints, so the strip is
   * never briefly showing six weeks ago. useLayoutEffect rather than useEffect
   * for exactly that: an effect that ran after paint would show the jump.
   *
   * `behavior: 'instant'` because this is not a movement, it is the initial
   * position. Smooth-scrolling on arrival would animate a journey the reader
   * did not ask for and did not see the start of.
   */
  const track = useRef(null)
  const [page, setPage] = useState(CURRENT)

  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: el.clientWidth * CURRENT, behavior: 'instant' })
  }, [])

  /* Which week is under the reader, for the label above the dates. Read off
     the scroll position rather than tracked as state per slide: the whole
     point of a snap track is that the browser owns the position. */
  const onScroll = () => {
    const el = track.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setPage((prev) => (prev === i ? prev : i))
  }

  const step = (delta) => {
    const el = track.current
    if (!el) return
    const next = Math.min(weeks.length - 1, Math.max(0, page + delta))
    el.scrollTo({ left: el.clientWidth * next, behavior: 'smooth' })
  }

  /* Outcomes, keyed by the cycle they were filed against rather than by when
     they were typed. A check-in submitted at ten past midnight belongs to the
     day it was for, not to the one the clock had just rolled into. */
  const [itemsByCycle, setItemsByCycle] = useState({})
  const [budget, setBudget] = useState(null)
  const [moodByDay, setMoodByDay] = useState({})

  /* The whole slider, not the visible week. One read covering every slide,
     because a fetch per swipe would mean an empty strip for a moment every
     time somebody flicked back through a month. */
  const from = weeks[0][0]
  const to = weeks[weeks.length - 1][6]

  useEffect(() => {
    if (!user) return
    let dead = false

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('checkins')
          .select('id, cycle_id, checkin_items(goal_id, outcome, count_done, evidence)')
          .eq('user_id', user.id)
          .gte('submitted_at', new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString())
          .lt('submitted_at', new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString())

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
        const { data, error } = await supabase
          .from('daily_mood')
          .select('day, mood')
          .eq('user_id', user.id)
          .gte('day', dayKey(from))
          .lte('day', dayKey(to))

        if (dead || error) return
        const byDay = {}
        for (const row of data ?? []) if (row.mood) byDay[row.day] = row.mood
        setMoodByDay(byDay)
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
  const mood = moodByDay[selected] ?? null
  const nothing = live.length === 0 && entries.length === 0 && !mood

  const shownWeek = weeks[page] ?? week
  const monthLabel = shownWeek[3].toLocaleDateString(localeTag(locale), {
    month: 'long',
    year: shownWeek[3].getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })

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
            onClick={() => step(-1)}
            disabled={page === 0}
            aria-label={t('week.previous')}
            className="press flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={page >= weeks.length - 1}
            aria-label={t('week.next')}
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
      <div
        ref={track}
        onScroll={onScroll}
        className="-mx-1 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {weeks.map((w) => (
          <div
            key={dayKey(w[0])}
            className="grid w-full shrink-0 snap-center grid-cols-7 gap-0.5 sm:gap-1"
          >
            {w.map((d) => {
              const k = dayKey(d)
              const marked =
                (cyclesByDay[k] ?? []).some((s) => s.status === 'submitted') ||
                (entriesByDay[k] ?? []).length > 0 ||
                Boolean(moodByDay[k])
              return (
                <DayBadge
                  key={k}
                  date={d}
                  isToday={k === todayKey}
                  isSelected={k === selected}
                  isFuture={k > todayKey}
                  marked={marked}
                  label={d.toLocaleDateString(localeTag(locale), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  onSelect={() => setSelected(k)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Always open, never a disclosure. There is always a selected day, so a
          panel that had to be opened would be a second tap between you and the
          only thing the strip is for. */}
      <div className="mt-4 border-t border-hairline pt-4">
        <p className="text-small font-semibold text-ink">
          {selected === todayKey
            ? t('week.today')
            : selectedDate.toLocaleDateString(localeTag(locale), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
        </p>

        {nothing ? (
          <p className="mt-2 text-small text-muted">{t('week.nothing')}</p>
        ) : (
          <>
            {/* First, because the day's mood is the frame the rest of it is
                read in. Asking how somebody was before what they got done is
                the order this whole product argues for. */}
            {mood && (
              <p className="mt-3 flex items-center gap-2.5 text-small text-ink">
                <MoodBadge id={mood} size={22} />
                {t(`mood.${mood}`)}
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
                      <div className="text-small font-bold text-muted">{label}</div>
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
    </div>
  )
}
