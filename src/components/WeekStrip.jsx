import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { money } from '../lib/money'
import { loadBudget } from '../lib/budgetData'
import { dayKey, weekOf } from '../lib/time'

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
  const { user } = useAuth()
  const { t, locale } = useT()

  const week = useMemo(() => weekOf(new Date()), [])
  const todayKey = dayKey()
  const [selected, setSelected] = useState(todayKey)

  /* Outcomes, keyed by the cycle they were filed against rather than by when
     they were typed. A check-in submitted at ten past midnight belongs to the
     day it was for, not to the one the clock had just rolled into. */
  const [itemsByCycle, setItemsByCycle] = useState({})
  const [budget, setBudget] = useState(null)

  const from = week[0]
  const to = week[6]

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

        if (dead || error) return
        const map = {}
        for (const c of data ?? []) map[c.cycle_id] = c.checkin_items ?? []
        setItemsByCycle(map)
      } catch {
        /* Offline. The strip still draws; the day panel just has less in it. */
      }

      const b = await loadBudget(user.id).catch(() => null)
      if (!dead) setBudget(b)
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

  const currency = budget?.plan?.currency || 'CAD'
  const fmt = (cents) => money(cents, currency, locale)

  /* What the selected day actually holds. */
  const rows = cyclesByDay[selected] ?? []
  const outcomes = new Map()
  for (const s of rows) {
    for (const item of itemsByCycle[s.cycle_id] ?? []) outcomes.set(item.goal_id, item)
  }

  const live = goals.filter((g) => {
    if (g.starts_on && dayKey(new Date(`${g.starts_on}T00:00:00`)) > selected) return false
    if (g.ends_on && dayKey(new Date(`${g.ends_on}T00:00:00`)) < selected) return false
    return true
  })

  const entries = entriesByDay[selected] ?? []
  const spent = entries
    .filter((e) => e.kind === 'expense')
    .reduce((sum, e) => sum + (e.amount_cents || 0), 0)

  const selectedDate = new Date(`${selected}T00:00:00`)
  const isFutureDay = selected > todayKey
  const nothing = live.length === 0 && entries.length === 0

  return (
    <div className="lg overflow-hidden p-4 sm:p-5">
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {week.map((d) => {
          const k = dayKey(d)
          const marked =
            (cyclesByDay[k] ?? []).some((s) => s.status === 'submitted') ||
            (entriesByDay[k] ?? []).length > 0
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
                <div className="flex items-baseline justify-between gap-3">
                  <span className="eyebrow">{t('money.title')}</span>
                  {spent > 0 && (
                    <span className="text-small text-muted">
                      {t('money.spent')} {fmt(spent)}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
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
