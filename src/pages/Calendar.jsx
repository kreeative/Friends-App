import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { addDays, dayKey, daysBetween, fromKey, phaseOn } from '../lib/cycle'
import {
  CATEGORIES,
  CATEGORY_COLOUR,
  agendaFor,
  blockStyle,
  clockOf,
  dayBounds,
  minutesOf,
} from '../lib/agenda'
import CyclePanel from '../components/CyclePanel'

/**
 * The whole timetable, on one screen.
 *
 * WHY THREE VIEWS AND NOT ONE.
 *
 * They answer different questions and none of them answers the other two.
 * Month is "when is the exam"; week is "what does Tuesday look like against
 * Thursday", which is the one a timetable is actually for; day is "what is
 * next", which is the only one that works at 360px with six overlapping
 * things on it.
 *
 * The dashboard's WeekStrip is not replaced by any of this. It is a glance at
 * the current week inside a page about something else, and it stays.
 *
 * WHY THE CYCLE OVERLAY IS TINTS ON TILES AND NOT ROWS IN THE GRID.
 *
 * A period is not an appointment. It has no start time, it is frequently a
 * prediction rather than a fact, and putting it in the same column as a
 * lecture would say it is the same kind of thing. It also has to be possible
 * to look at this screen in a lecture theatre without the person beside you
 * learning something. So it is a small mark in the corner of a date, and the
 * words are behind a tap.
 */

/**
 * The palette tokens an event may paint in.
 *
 * THESE ARE THE ONES THAT EXIST, WHICH IS NOT WHAT THE FIRST VERSION USED.
 *
 * It reached for `bg-blue`, `bg-violet` and `bg-yellow`. None of those is a
 * token in this project: tailwind.config.js builds every colour as
 * var(--c-<name>), so an invented name resolves to nothing and paints
 * transparent. The chips looked plausible in a screenshot and a probe that
 * sampled painted pixels found them at 1:1 against the tile behind them.
 *
 * cat-1 to cat-6 are the envelope shades, six hues already chosen to be
 * distinguishable from one another in both themes, which is exactly what a
 * category palette needs and exactly why there is not a seventh.
 *
 * Whole class strings, because Tailwind scans source text and `bg-cat-${n}`
 * produces no class at build time.
 */
const SWATCH = {
  'cat-1': 'bg-cat-1/[0.18] text-ink ring-cat-1/40',
  'cat-2': 'bg-cat-2/[0.18] text-ink ring-cat-2/40',
  'cat-3': 'bg-cat-3/[0.18] text-ink ring-cat-3/40',
  'cat-4': 'bg-cat-4/[0.18] text-ink ring-cat-4/40',
  accent: 'bg-accent/[0.16] text-ink ring-accent/30',
  green: 'bg-green/[0.16] text-ink ring-green/30',
  quiet: 'bg-ink/[0.06] text-ink ring-ink/15',
}

/* The bar down the left of a row in the day list, which needs the colour at
   full strength rather than as a wash. Same reason the palette has
   `field-deep` alongside `field`: a 4px rule cannot be a tint. */
const SWATCH_BAR = {
  'cat-1': 'bg-cat-1', 'cat-2': 'bg-cat-2', 'cat-3': 'bg-cat-3', 'cat-4': 'bg-cat-4',
  accent: 'bg-accent', green: 'bg-green', quiet: 'bg-ink/30',
}

/**
 * The cycle marks. A dot, not a fill: a tinted tile competes with the event
 * blocks on it, and this has to be readable without being announced.
 *
 * SOLID, AND NOT ONLY A COLOUR.
 *
 * The first version drew these at 45 to 60 per cent opacity, which put a 6px
 * graphic well under the 3:1 that WCAG 1.4.11 asks of anything carrying
 * meaning. Worse, the four states differed by hue alone, which 1.4.1 forbids
 * outright and which is useless to the roughly one person in twelve who
 * cannot separate these particular hues.
 *
 * TWO COLOURS AND TWO SHAPES, NOT FOUR HUES.
 *
 * The second attempt used cat-3 and cat-5 for the soft phases. Measured on the
 * painted pixels, cat-5 came out at 1.83:1 against the sun theme's white, well
 * under the 3:1 that 1.4.11 asks. tailwind.config.js already answers this: it
 * declares `mark` as "the one colour a small mark may be" and says explicitly
 * that there is one of these and not six.
 *
 * So there are two colours, both of which carry at that size, and the pairs
 * within each are told apart by SHAPE: a fact is filled, an estimate is a
 * ring. Four states, no hue doing work on its own, which is what 1.4.1 asks
 * and what survives a greyscale screenshot. The accessible name on every tile
 * carries the whole answer regardless.
 */
const PHASE_DOT = {
  period: 'bg-negative',
  predicted: 'border-2 border-negative bg-transparent',
  pms: 'bg-mark',
  fertile: 'border-2 border-mark bg-transparent',
}

const VIEWS = ['month', 'week', 'day']

export default function Calendar() {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  })
  const [events, setEvents] = useState([])
  const [cycle, setCycle] = useState({ starts: [], prediction: null })
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('calendar_event').select('*')
    setEvents(data ?? [])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  /* The span being drawn. Month is padded to whole weeks so the grid is
     rectangular; week runs Monday to Sunday, which is what a European
     timetable looks like even though getDay() calls Sunday zero. */
  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor }
    if (view === 'week') {
      const back = (anchor.getDay() + 6) % 7
      const from = addDays(anchor, -back)
      return { from, to: addDays(from, 6) }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from: addDays(first, -((first.getDay() + 6) % 7)), to: addDays(last, 6 - ((last.getDay() + 6) % 7)) }
  }, [view, anchor])

  const agenda = useMemo(() => agendaFor(events, range.from, range.to), [events, range])

  const step = (n) => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1))
    else setAnchor(addDays(anchor, n * (view === 'week' ? 7 : 1)))
  }

  const fmt = new Intl.DateTimeFormat(localeTag(locale), {
    month: 'long',
    year: 'numeric',
    ...(view === 'day' ? { day: 'numeric', weekday: 'long' } : {}),
  })

  const remove = async (id) => {
    setEvents((e) => e.filter((x) => x.id !== id))
    await supabase.from('calendar_event').delete().eq('id', id)
  }

  return (
    /**
     * Wider than the rest of the app, and only here.
     *
     * max-w-content is 40rem, which is right for the pages that are columns of
     * text and forms: a 1200px-wide settings form is worse, not better. A grid
     * is the exception. Seven day columns at 40rem are 80px each, which is why
     * the week view needed a horizontal scroller on a phone and still felt
     * cramped on an iPad that had 700px of empty margin either side.
     */
    <div className="mx-auto w-full max-w-content space-y-4 px-4 pb-28 pt-4 md:max-w-[68rem] md:pb-8">
      <header className="lg w-full overflow-hidden p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-safe text-h1 font-semibold text-ink">{t('cal.title')}</h1>
          <button
            type="button"
            onClick={() => setEditing({ starts_on: dayKey(anchor), category: 'cours', weekdays: [] })}
            className="goal-action-done press shrink-0"
            data-hook="cal-add"
          >
            {t('cal.add')}
          </button>
        </div>

        {/* View switch and the pager, on one row that is allowed to wrap. At
            360px in French these two do not fit side by side. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-pill bg-ink/[0.06] p-1" role="tablist" data-hook="cal-views">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`press rounded-pill px-3 py-1.5 text-small font-semibold transition-colors ${
                  view === v ? 'bg-surface text-ink shadow-raised' : 'text-muted hover:text-ink'
                }`}
              >
                {t(`cal.${v}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => step(-1)} aria-label={t('cal.prev')} className="press h-9 w-9 rounded-pill hover:bg-ink/[0.06]">
              &#8249;
            </button>
            <button
              type="button"
              onClick={() => setAnchor(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))}
              className="press rounded-pill px-3 py-1.5 text-small font-semibold text-ink hover:bg-ink/[0.06]"
            >
              {t('cal.today')}
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t('cal.next')} className="press h-9 w-9 rounded-pill hover:bg-ink/[0.06]">
              &#8250;
            </button>
          </div>
        </div>

        <p className="mt-3 text-small font-semibold uppercase tracking-[0.06em] text-muted">
          {fmt.format(anchor)}
        </p>
      </header>

      {/**
       * Grid beside panel on a laptop, stacked on a phone.
       *
       * xl and not lg, which was measured rather than guessed. At the lg
       * breakpoint an iPad in landscape is 1180px, and taking 20rem for the
       * panel left the grid at 572px: seven columns of 82px, barely wider than
       * the phone gets, on the device with the most room. The split now waits
       * for 1280px, so both iPad orientations give the whole width to the grid
       * and only a real laptop shows the two side by side.
       *
       * items-start so the panel keeps its own height instead of stretching to
       * match a month grid, which would leave it as a mostly empty card.
       */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {view === 'month' && (
            <MonthGrid range={range} anchor={anchor} agenda={agenda} cycle={cycle} onPick={(d) => { setAnchor(d); setView('day') }} />
          )}
          {view === 'week' && <WeekGrid range={range} agenda={agenda} cycle={cycle} locale={locale} onEdit={setEditing} />}
          {view === 'day' && <DayList day={anchor} agenda={agenda} cycle={cycle} onEdit={setEditing} onRemove={remove} t={t} />}
        </div>

        <CyclePanel onChange={setCycle} />
      </div>

      {editing && (
        <EventForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

/* --- month --------------------------------------------------------------- */

/**
 * A media query React can act on.
 *
 * Needed because how many chips fit in a tile is a number passed to slice(),
 * and a class cannot change a number. The alternative is rendering three and
 * hiding the last with `hidden md:block`, which leaves the "+1 more" count
 * lying on a phone: it would say there is one hidden when there are two.
 *
 * Guarded for the server and for older Safari, which had addListener and not
 * addEventListener on a MediaQueryList until 14.
 */
function useWide(query = '(min-width: 768px)') {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true,
  )
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [query])
  return wide
}

function MonthGrid({ range, anchor, agenda, cycle, onPick }) {
  const { t, locale } = useT()
  /* Two chips on a phone tile, three once the tile is 6.5rem tall. */
  const shown = useWide() ? 3 : 2
  const days = []
  for (let i = 0; i <= daysBetween(range.from, range.to); i += 1) days.push(addDays(range.from, i))

  const dow = new Intl.DateTimeFormat(localeTag(locale), { weekday: 'short' })
  const today = dayKey(new Date())

  return (
    <section className="lg w-full overflow-hidden p-3" data-hook="cal-month">
      <div className="grid grid-cols-7 gap-1">
        {days.slice(0, 7).map((d) => (
          <div key={`h${dayKey(d)}`} className="truncate px-1 pb-1 text-center text-label font-semibold uppercase text-muted">
            {dow.format(d)}
          </div>
        ))}

        {days.map((d) => {
          const k = dayKey(d)
          const list = agenda.get(k) ?? []
          const phase = phaseOn(d, cycle.starts, cycle.prediction)
          const outside = d.getMonth() !== anchor.getMonth()
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(d)}
              data-hook="cal-day"
              data-phase={phase ?? ''}
              /* The phase belongs in the name, not only in the mark. A screen
                 reader gets "12 September, fertile window" rather than a
                 number and a decorative span it is told to ignore. */
              aria-label={phase ? `${d.getDate()} · ${t(`cycle.phase_${phase}`)}` : String(d.getDate())}
              /* Taller once there is room, which is what lets a third chip
                 show instead of collapsing into "+2 autres". The count line is
                 information about what is hidden; three visible entries is
                 information about the day. */
              className={`press relative flex min-h-[3.4rem] flex-col items-stretch overflow-hidden rounded-inner p-1 text-left transition-colors hover:bg-ink/[0.04] md:min-h-[6.5rem] md:p-1.5 ${
                outside ? 'opacity-40' : ''
              } ${k === today ? 'ring-1 ring-inset ring-accent/50' : ''}`}
            >
              <span className="flex items-center justify-between">
                <span className="text-small font-semibold text-ink">{d.getDate()}</span>
                {/* The cycle mark. A dot in the corner, never a word, and
                    never a fill that would fight the event chips below. */}
                {phase && <span className={`h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[phase]}`} aria-hidden="true" />}
              </span>

              {/* Two, then a count. Four chips in a 48px tile is a smear. */}
              {list.slice(0, shown).map((e) => (
                <span
                  key={e.occurrenceId}
                  className={`mt-0.5 truncate rounded-[0.35rem] px-1 py-px text-[10px] font-semibold md:px-1.5 md:py-0.5 md:text-[11px] ${SWATCH[e.colour] ?? SWATCH.accent}`}
                >
                  {e.title}
                </span>
              ))}
              {list.length > shown && (
                <span className="mt-0.5 px-1 text-[10px] font-semibold text-muted">
                  {t('cal.more', { n: list.length - shown })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* --- week ---------------------------------------------------------------- */

function WeekGrid({ range, agenda, cycle, locale, onEdit }) {
  const { t } = useT()
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.from, i))
  const all = days.flatMap((d) => agenda.get(dayKey(d)) ?? [])
  const bounds = dayBounds(all)
  const hours = []
  for (let m = Math.ceil(bounds.from / 60) * 60; m <= bounds.to; m += 60) hours.push(m)

  const dow = new Intl.DateTimeFormat(localeTag(locale), { weekday: 'short' })
  const today = dayKey(new Date())

  return (
    <section className="lg w-full overflow-hidden p-3" data-hook="cal-week">
      {/* The grid scrolls sideways rather than squeezing seven columns into
          360px, where each would be 40px and hold no word at all. */}
      <div className="overflow-x-auto">
        <div className="min-w-[38rem]">
          <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
            <div />
            {days.map((d) => {
              const phase = phaseOn(d, cycle.starts, cycle.prediction)
              return (
                <div key={dayKey(d)} className="pb-1 text-center">
                  <div className="truncate text-label font-semibold uppercase text-muted">{dow.format(d)}</div>
                  <div className="flex items-center justify-center gap-1">
                    <span className={`text-small font-semibold ${dayKey(d) === today ? 'text-accent' : 'text-ink'}`}>
                      {d.getDate()}
                    </span>
                    {phase && (
                      <span
                        className={`h-2 w-2 rounded-pill ${PHASE_DOT[phase]}`}
                        role="img"
                        aria-label={t(`cycle.phase_${phase}`)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="relative grid grid-cols-[3rem_repeat(7,1fr)] gap-1" style={{ height: `${hours.length * 3}rem` }}>
            <div className="relative">
              {hours.map((m, i) => (
                <span
                  key={m}
                  className="absolute right-1 -translate-y-1/2 text-[10px] font-semibold text-muted"
                  style={{ top: `${(i / (hours.length - 1 || 1)) * 100}%` }}
                >
                  {clockOf(m)}
                </span>
              ))}
            </div>

            {days.map((d) => (
              <div key={`c${dayKey(d)}`} className="relative rounded-inner bg-ink/[0.025]">
                {(agenda.get(dayKey(d)) ?? []).map((e) => (
                  <button
                    key={e.occurrenceId}
                    type="button"
                    onClick={() => onEdit(e)}
                    style={blockStyle(e, bounds.from, bounds.to)}
                    data-hook="cal-block"
                    className={`press absolute inset-x-0.5 overflow-hidden rounded-[0.4rem] px-1 py-0.5 text-left ring-1 ring-inset ${
                      SWATCH[e.colour] ?? SWATCH.accent
                    }`}
                  >
                    <span className="block truncate text-[10px] font-bold leading-tight">{e.title}</span>
                    {e.start_min != null && (
                      <span className="block truncate text-[9px] leading-tight opacity-70">{clockOf(e.start_min)}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {all.length === 0 && <p className="px-1 pt-3 text-small text-muted">{t('cal.empty_week')}</p>}
    </section>
  )
}

/* --- day ----------------------------------------------------------------- */

function DayList({ day, agenda, cycle, onEdit, onRemove, t }) {
  const list = agenda.get(dayKey(day)) ?? []
  const phase = phaseOn(day, cycle.starts, cycle.prediction)

  return (
    <section className="lg w-full overflow-hidden p-4" data-hook="cal-day-list" data-phase={phase ?? ''}>
      {phase && (
        <p className="mb-3 flex items-center gap-2 text-small font-semibold text-muted">
          <span className={`h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[phase]}`} aria-hidden="true" />
          {t(`cycle.phase_${phase}`)}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-small text-muted">{t('cal.empty_day')}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {list.map((e) => (
            <li key={e.occurrenceId} className="flex items-start gap-3 py-3">
              <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-pill ${SWATCH_BAR[e.colour] ?? SWATCH_BAR.accent}`} />
              <span className="min-w-0 flex-1">
                <span className="text-safe block text-body font-semibold text-ink">{e.title}</span>
                <span className="block text-small text-muted">
                  {e.start_min != null ? `${clockOf(e.start_min)} - ${clockOf(e.end_min)}` : t('cal.all_day')}
                  {e.location ? ` · ${e.location}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => onEdit(e)} className="goal-action press">
                  {t('cal.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  className="press rounded-pill px-3 py-2 text-small font-semibold text-negative hover:bg-negative/[0.09]"
                >
                  {t('cal.delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* --- the form ------------------------------------------------------------ */

function EventForm({ initial, onClose, onSaved }) {
  const { user } = useAuth()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [f, setF] = useState({
    title: initial.title ?? '',
    category: initial.category ?? 'cours',
    location: initial.location ?? '',
    starts_on: initial.starts_on ?? dayKey(new Date()),
    until_on: initial.until_on ?? '',
    start: clockOf(initial.start_min) ?? '',
    end: clockOf(initial.end_min) ?? '',
    weekdays: initial.weekdays ?? [],
  })

  const toggleDay = (n) =>
    setF((s) => ({
      ...s,
      weekdays: s.weekdays.includes(n) ? s.weekdays.filter((x) => x !== n) : [...s.weekdays, n].sort(),
    }))

  const save = async (e) => {
    e.preventDefault()
    setError(null)

    const start = minutesOf(f.start)
    const end = minutesOf(f.end)

    /* The same rule as the check constraint, checked here so the message is
       about the form rather than about a constraint name. Both empty is an
       all-day entry and is allowed; one of the two is a half-filled form. */
    if ((start == null) !== (end == null)) return setError(t('cal.err_times'))
    if (start != null && end != null && end <= start) return setError(t('cal.err_order'))
    if (!f.title.trim()) return setError(t('cal.err_title'))

    setBusy(true)
    const row = {
      user_id: user.id,
      title: f.title.trim().slice(0, 120),
      category: f.category,
      location: f.location.trim() ? f.location.trim().slice(0, 160) : null,
      starts_on: f.starts_on,
      until_on: f.until_on || null,
      start_min: start,
      end_min: end,
      weekdays: f.weekdays,
      colour: CATEGORY_COLOUR[f.category] ?? 'accent',
    }

    const { error: err } = initial.id
      ? await supabase.from('calendar_event').update(row).eq('id', initial.id)
      : await supabase.from('calendar_event').insert(row)

    setBusy(false)
    if (err) return setError(err.message)
    await onSaved()
  }

  return (
    <section className="lg w-full overflow-hidden p-5" data-hook="cal-form">
      <h2 className="text-h2 font-semibold text-ink">{initial.id ? t('cal.edit_title') : t('cal.new_title')}</h2>

      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="block">
          <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_title')}</span>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} className="field mt-1 w-full" />
        </label>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setF({ ...f, category: c })}
              aria-pressed={f.category === c}
              className={`press rounded-pill px-3 py-1.5 text-small font-semibold transition-colors ${
                f.category === c ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
              }`}
            >
              {t(`cal.cat_${c}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_start')}</span>
            <input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="field mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_end')}</span>
            <input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="field mt-1 w-full" />
          </label>
        </div>

        <label className="block">
          <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_where')}</span>
          <input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={160} className="field mt-1 w-full" />
        </label>

        <div>
          <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_repeat')}</span>
          {/* Monday first, because that is what a timetable looks like, while
              the stored numbers are getDay()'s, where Sunday is 0. The mapping
              lives here and nowhere else. */}
          <div className="mt-1 flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleDay(n)}
                aria-pressed={f.weekdays.includes(n)}
                className={`press h-9 w-9 rounded-pill text-small font-semibold transition-colors ${
                  f.weekdays.includes(n) ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                }`}
              >
                {t(`cal.dow_${n}`)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-small text-muted">
            {f.weekdays.length ? t('cal.repeats') : t('cal.once')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_from')}</span>
            <input type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} className="field mt-1 w-full" />
          </label>
          {f.weekdays.length > 0 && (
            <label className="block">
              <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_until')}</span>
              <input type="date" value={f.until_on} min={f.starts_on} onChange={(e) => setF({ ...f, until_on: e.target.value })} className="field mt-1 w-full" />
            </label>
          )}
        </div>

        {error && (
          <p className="text-safe text-small text-negative" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" disabled={busy} className="goal-action-done press">
            {busy ? t('cal.saving') : t('cal.save')}
          </button>
          <button type="button" onClick={onClose} className="goal-action-soft press">
            {t('cal.cancel')}
          </button>
        </div>
      </form>
    </section>
  )
}
