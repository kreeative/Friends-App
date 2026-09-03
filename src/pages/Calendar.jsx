import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { addDays, dayKey, daysBetween, fromKey, phaseOn } from '../lib/cycle'
import {
  CATEGORIES,
  CATEGORY_COLOUR,
  LAYERS,
  LAYER_COLOUR,
  agendaFor,
  blockStyle,
  clockOf,
  dayBounds,
  minutesOf,
  visibleEvents,
  weekdayName,
} from '../lib/agenda'
import CyclePanel from '../components/CyclePanel'
import TimetableWizard from '../components/TimetableWizard'

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
 * cat-1 to cat-6 are the envelope shades. They are one ramp per theme rather
 * than six independent hues, which is the thing that made the sea theme hard:
 * see agenda.js for why only three of the six steps are spent. Migration 53
 * lets an event store all six, plus ink, negative and the three named tokens.
 *
 * A WASH AT 18 PER CENT IS NOT A COLOUR, WHICH IS WHY THESE GREW AN EDGE.
 *
 * Every chip was `bg-<c>/[0.18]` over white. Composited, cat-1 lands on
 * #FFE5F1 and cat-3 on #FFE7E4: fourteen units apart in one channel, on a
 * 10px chip, in a 48px tile. Three of the seven categories were magentas to
 * begin with, so what reached the screen was one pale pink for nearly
 * everything.
 *
 * Two changes. The mapping in agenda.js now spends three well-separated steps
 * of the ramp plus the four colours declared outside it, and each chip carries
 * a 3px left rule at FULL strength. The
 * rule is what actually does the work: a saturated 3px bar is legible at a
 * glance where a 6 per cent difference in a wash is not, and it survives the
 * chip being 10px tall.
 *
 * The wash goes up to 22 per cent at the same time. It is still a wash, still
 * ink on near-white, and the type stays above 4.5:1 in both themes, which is
 * checked against the painted pixels rather than argued from the tokens.
 *
 * ink is for exams. It is the only truly dark option in either palette and it
 * is the one people most need to spot. Its wash is ink at 12 per cent so the
 * black rule reads as deliberate rather than as the grey of `quiet`, which
 * is 6.
 *
 * negative is for parties, and agenda.js explains at length why the error
 * colour is in a category palette: it and `green` are the only saturated hues
 * declared once at :root rather than per theme, so they are the only two that
 * do not move between sun and sea.
 *
 * Whole class strings, because Tailwind scans source text and `bg-cat-${n}`
 * produces no class at build time.
 */
const SWATCH = {
  'cat-1': 'bg-cat-1/[0.22] text-ink ring-cat-1/40 border-l-[3px] border-cat-1',
  'cat-2': 'bg-cat-2/[0.22] text-ink ring-cat-2/40 border-l-[3px] border-cat-2',
  'cat-3': 'bg-cat-3/[0.22] text-ink ring-cat-3/40 border-l-[3px] border-cat-3',
  'cat-4': 'bg-cat-4/[0.22] text-ink ring-cat-4/40 border-l-[3px] border-cat-4',
  'cat-5': 'bg-cat-5/[0.22] text-ink ring-cat-5/40 border-l-[3px] border-cat-5',
  'cat-6': 'bg-cat-6/[0.28] text-ink ring-cat-6/50 border-l-[3px] border-cat-6',
  accent: 'bg-accent/[0.16] text-ink ring-accent/30 border-l-[3px] border-accent',
  green: 'bg-green/[0.16] text-ink ring-green/30 border-l-[3px] border-green',
  ink: 'bg-ink/[0.12] text-ink ring-ink/35 border-l-[3px] border-ink',
  negative: 'bg-negative/[0.14] text-ink ring-negative/35 border-l-[3px] border-negative',
  quiet: 'bg-ink/[0.06] text-ink ring-ink/15 border-l-[3px] border-ink/35',
}

/* The bar down the left of a row in the day list, which needs the colour at
   full strength rather than as a wash. Same reason the palette has
   `field-deep` alongside `field`: a 4px rule cannot be a tint. */
const SWATCH_BAR = {
  'cat-1': 'bg-cat-1', 'cat-2': 'bg-cat-2', 'cat-3': 'bg-cat-3',
  'cat-4': 'bg-cat-4', 'cat-5': 'bg-cat-5', 'cat-6': 'bg-cat-6',
  accent: 'bg-accent', green: 'bg-green', ink: 'bg-ink',
  negative: 'bg-negative', quiet: 'bg-ink/30',
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

/* The layer toggle's dot, filled when the layer is on and a ring when it is
   off. Whole class strings, because Tailwind scans source text and
   `bg-${token}` produces no class at build time. */
const LAYER_DOT = {
  scolaire: 'bg-cat-1',
  perso: 'bg-green',
  objectifs: 'bg-cat-3',
  cycle: 'bg-negative',
}
const LAYER_RING = {
  scolaire: 'border-cat-1',
  perso: 'border-green',
  objectifs: 'border-cat-3',
  cycle: 'border-negative',
}

const VIEWS = ['month', 'week', 'day']

/* A character no event title can contain, used to find where the title went in
   a translated sentence. U+0000 rather than something typeable: a title with a
   "|" or a "@" in it is ordinary and would split the sentence in the wrong
   place. See DeleteChoice for why this is a split and not three strings. */
const SPLIT = '\u0000'

/* Which layers are switched OFF, remembered per browser. Off rather than on,
   so a layer added by a later version is visible by default: somebody who has
   never opened this toolbar should not have new things silently hidden from
   them by a stored list that predates the feature. */
const HIDDEN_KEY = 'friends.cal.hidden'

const readHidden = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((l) => LAYERS.includes(l)) : [])
  } catch {
    return new Set()
  }
}

export default function Calendar() {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  })
  const [events, setEvents] = useState([])
  const [goals, setGoals] = useState([])
  const [cycle, setCycle] = useState({ starts: [], prediction: null })
  const [editing, setEditing] = useState(null)
  const [hidden, setHidden] = useState(readHidden)
  const [drawer, setDrawer] = useState(false)
  const [wizard, setWizard] = useState(false)
  const [added, setAdded] = useState(0)
  /* The occurrence somebody asked to delete, or null. It carries the whole
     entry rather than an id, because the dialog has to know the title to name
     it and the day to skip. */
  const [deleting, setDeleting] = useState(null)
  /* Whatever the last write said when it did not work. Null the rest of the
     time, which is nearly always. */
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('calendar_event').select('*')
    setEvents(data ?? [])

    /**
     * Goals with a deadline, as calendar entries.
     *
     * Only `once` goals have a due_on; a recurring goal has a cadence rather
     * than a date and there is nothing to draw. Only active ones, because a
     * completed goal's deadline is a fact about the past and putting it on
     * next week would be a lie.
     *
     * These are read-only here. They carry goalId, which is what stops the
     * grid opening the event form on one: see openEditor below.
     */
    const { data: g } = await supabase
      .from('goals')
      .select('id, commitment, due_on, group_id')
      .eq('status', 'active')
      .not('due_on', 'is', null)
    setGoals(g ?? [])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const toggleLayer = (layer) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
      } catch {
        /* A browser refusing storage is not a reason to refuse the toggle. */
      }
      return next
    })
  }

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

  /**
   * Everything drawn on the grid: stored events plus goals with a deadline,
   * minus whatever the toolbar has switched off.
   *
   * The goals are mapped into the event shape rather than drawn by a second
   * code path, so recurrence expansion, sorting, the month chips, the week
   * blocks and the day list all treat them as what they are on a calendar: an
   * all-day entry on one date. `weekdays: []` makes occurrencesOf take the
   * one-off branch and never walk.
   */
  const drawn = useMemo(() => {
    const asEvents = goals.map((g) => ({
      id: `goal:${g.id}`,
      goalId: g.id,
      title: g.commitment,
      category: 'objectif',
      colour: LAYER_COLOUR.objectifs,
      starts_on: g.due_on,
      start_min: null,
      end_min: null,
      weekdays: [],
      until_on: null,
      location: null,
    }))
    return visibleEvents([...events, ...asEvents], hidden)
  }, [events, goals, hidden])

  const agenda = useMemo(() => agendaFor(drawn, range.from, range.to), [drawn, range])

  /* The cycle overlay is a layer too, so switching it off has to empty what
     the grids read rather than just hiding a panel. */
  const shownCycle = hidden.has('cycle') ? { starts: [], prediction: null } : cycle

  /* A goal is drawn here and edited on the goals screen. Without this guard
     the form would open on one and then insert a brand new calendar_event
     carrying the goal's text, which is a duplicate nobody asked for. */
  const openEditor = (entry) => {
    if (entry?.goalId) return
    setEditing(entry)
  }

  const step = (n) => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1))
    else setAnchor(addDays(anchor, n * (view === 'week' ? 7 : 1)))
  }

  const fmt = new Intl.DateTimeFormat(localeTag(locale), {
    month: 'long',
    year: 'numeric',
    ...(view === 'day' ? { day: 'numeric', weekday: 'long' } : {}),
  })

  /**
   * Deleting, and the question that has to be asked first.
   *
   * A row is a RULE. Deleting the row for "Biochimie, Tuesdays and Thursdays
   * until December" because somebody wanted to cancel one Tuesday removes the
   * whole term, silently, with no undo. That was the behaviour and it is the
   * bug this pair of functions exists to fix.
   *
   * A one-off skips the dialog entirely: "only this one" and "the whole
   * series" are the same choice when the series is one day long, and a
   * confirmation that offers two identical options is a confirmation people
   * learn to click through.
   */
  const askRemove = (entry) => {
    const recurring = Array.isArray(entry?.weekdays) && entry.weekdays.length > 0
    if (!recurring) return removeSeries(entry.id)
    setDeleting(entry)
  }

  /**
   * BOTH OF THESE PUT THE ROW BACK IF THE WRITE DID NOT HAPPEN.
   *
   * The optimistic update is what makes the dialog feel instant, and it is
   * also what makes a failed write invisible: the row leaves the screen either
   * way and comes back on the next reload with no explanation. Two ways that
   * happens here, and neither is hypothetical:
   *
   *   * RLS refuses an UPDATE or a DELETE by matching zero rows. No error, no
   *     exception, an empty result. That is the documented behaviour and it is
   *     why `count` is asked for rather than trusted.
   *   * excluded_on does not exist until migration 52 has been run, and until
   *     it has, every "only this one" is a postgrest 400 that nothing reads.
   *
   * Both were made to happen against the running app rather than argued about:
   * the 400 puts the row back and prints what postgrest said, and a 200 whose
   * Content-Range reports zero rows puts it back and prints cal.err_gone.
   */
  const removeSeries = async (id) => {
    setDeleting(null)
    const before = events
    setEvents((e) => e.filter((x) => x.id !== id))
    const { error, count } = await supabase
      .from('calendar_event')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (error || count === 0) {
      setEvents(before)
      setNotice(error?.message ?? t('cal.err_gone'))
    }
  }

  /**
   * One occurrence: the rule stays, the day is added to its exception list.
   *
   * Read-modify-write rather than an array append in SQL, because the client
   * already holds the row and postgrest has no `array_append` in its update
   * syntax. The race is two tabs skipping two different days of the same rule
   * within the same second, which loses one exception; the cost of that is one
   * class reappearing, and the alternative is an RPC for a feature used a
   * handful of times a term.
   */
  const removeOne = async (entry) => {
    const key = dayKey(entry.day)
    const next = [...new Set([...(entry.excluded_on ?? []), key])]
    setDeleting(null)
    const before = events
    setEvents((list) => list.map((x) => (x.id === entry.id ? { ...x, excluded_on: next } : x)))
    const { error, count } = await supabase
      .from('calendar_event')
      .update({ excluded_on: next }, { count: 'exact' })
      .eq('id', entry.id)
    if (error || count === 0) {
      setEvents(before)
      setNotice(error?.message ?? t('cal.err_gone'))
    }
  }

  return (
    /**
     * The one page with no width cap above the tablet breakpoint.
     *
     * max-w-content is 40rem, which is right for the pages that are columns of
     * text and forms: a 1200px-wide settings form is worse, not better. A grid
     * is the exception. Seven day columns at 40rem are 80px each, which is why
     * the week view needed a horizontal scroller on a phone and still felt
     * cramped on an iPad that had 700px of empty margin either side.
     *
     * It was 68rem for a while and that was still a cap. A timetable is the
     * one thing here that gets better with every pixel: the hour rows stay the
     * same height and the columns get wider, so a 90-minute block goes from
     * holding an abbreviation to holding the course name and the room. The
     * rail's 7.5rem is already taken out by the shell, so `none` here means
     * the window minus the rail, not the window.
     */
    <div className="mx-auto w-full max-w-content space-y-4 px-4 pb-28 pt-4 md:flex md:h-dvh md:max-w-none md:flex-col md:pb-8">
      {/**
       * THREE CONTAINERS, NOT ONE HEADER.
       *
       * This was a single card carrying the title, three buttons, the view
       * switch, the pager, the month and four filter chips: nine controls of
       * five different kinds in one box, which is a box that says nothing
       * about what belongs with what.
       *
       * The split is by WHAT A CONTROL DOES rather than by how it looks.
       * Row one opens things and turns layers on and off. Row two moves
       * around inside what is already on screen. Row three is the screen.
       *
       * Row one is a flex row of separate pills rather than a card, so it
       * wraps to two lines on a phone without the box growing a second row of
       * empty space, and so nothing in it looks like a section heading.
       */}
      <div className="flex flex-wrap items-center gap-2" data-hook="cal-actions">
        {/* A term is transcribed from a printout, not composed. Doing it
            through the single-event form means retyping the term dates once
            per class and counting how many are left. */}
        <button type="button" onClick={() => setWizard(true)} className="goal-action press" data-hook="cal-wiz-open">
          {t('wiz.open')}
        </button>

        {/* The way in to everything about the cycle: the tracker, the recorded
            periods and the reminder settings. */}
        <button type="button" onClick={() => setDrawer(true)} className="goal-action press" data-hook="cal-cycle-open">
          {t('cycle.manage')}
        </button>

        {/**
         * The layers, as pressed-in toggles, beside the things that open.
         *
         * aria-pressed rather than a checkbox, because these do not submit
         * anything and a checkbox in a toolbar implies a form. The state is
         * carried three ways so it is never colour alone, per 1.4.1: the
         * button's fill, the dot going hollow, and the strikethrough on the
         * word. A greyscale screenshot still says which are off.
         */}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-hairline sm:block" />

        <div className="flex flex-wrap items-center gap-2" data-hook="cal-layers">
          {LAYERS.map((layer) => {
            const on = !hidden.has(layer)
            return (
              <button
                key={layer}
                type="button"
                aria-pressed={on}
                data-layer={layer}
                data-on={on}
                onClick={() => toggleLayer(layer)}
                className={`press flex items-center gap-1.5 rounded-pill px-3 py-2 text-small font-semibold transition-colors ${
                  on ? 'bg-ink/[0.06] text-ink' : 'text-muted hover:bg-ink/[0.04]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-pill ${
                    on ? LAYER_DOT[layer] : `border-2 ${LAYER_RING[layer]}`
                  }`}
                />
                <span className={on ? '' : 'line-through decoration-1'}>{t(`cal.layer_${layer}`)}</span>
              </button>
            )
          })}
        </div>

        {/* Pinned to the far end, and the only filled control in the row. The
            + is the icon and the word is the label. */}
        <button
          type="button"
          onClick={() => setEditing({ starts_on: dayKey(anchor), category: 'cours', weekdays: [] })}
          className="goal-action-done press ml-auto shrink-0"
          data-hook="cal-add"
        >
          <span aria-hidden="true" className="mr-1 text-body leading-none">
            +
          </span>
          {t('cal.add')}
        </button>
      </div>

      {/* Eight rows landing at once is a big change to a grid somebody was
          just looking at, and without a word it reads as the page having done
          something on its own. Dismissible, and it says how many. */}
      {added > 0 && (
        <p className="text-small font-semibold text-ink" role="status" data-hook="wiz-done">
          {t(added === 1 ? 'wiz.done_one' : 'wiz.done_other', { n: added })}{' '}
          {/* "Fermer", not "Annuler". Cancel on a notice that something was
              added reads as an offer to undo the add, which this is not. */}
          <button
            type="button"
            onClick={() => setAdded(0)}
            className="press underline decoration-1 underline-offset-2"
          >
            {t('wiz.close')}
          </button>
        </p>
      )}

      {/* A write that did not happen. role="alert" and not "status", because
          the thing that was on screen a second ago has just come back and the
          reason is the only way to make sense of that. */}
      {notice && (
        <p className="text-safe text-small font-semibold text-negative" role="alert" data-hook="cal-notice">
          {notice}{' '}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="press font-normal underline decoration-1 underline-offset-2"
          >
            {t('wiz.close')}
          </button>
        </p>
      )}

      {/**
       * Row two: moving around, and nothing else.
       *
       * No filters in here, deliberately. A toolbar that both changes what is
       * drawn and changes where you are looking is one where a person cannot
       * tell which of the two they just did.
       */}
      <header className="lg w-full overflow-hidden px-4 py-3" data-hook="cal-toolbar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* The month is the heading of this screen now that the h1 has gone
              up into the page. first-letter:uppercase because Intl gives
              "septembre 2026" in French and "September 2026" in English. */}
          <h1 className="text-safe text-h2 font-semibold text-ink first-letter:uppercase">
            {fmt.format(anchor)}
          </h1>

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
      </header>

      {/**
       * THE GRID GETS THE WHOLE WIDTH AT EVERY SIZE NOW.
       *
       * This was a two-column split with the cycle panel beside the grid from
       * xl up, and the measurement that produced xl is the same one that
       * eventually killed the column: at lg an iPad in landscape gave the grid
       * 572px, seven columns of 82px, on the device with the most room. Moving
       * the split to xl fixed the iPad and left a laptop paying 20rem for a
       * panel that is mostly a summary of four dates.
       *
       * A drawer costs one press and gives every screen the full seven
       * columns, and it is also where the editing this panel never had can
       * actually fit.
       */}
      {/**
       * The canvas takes whatever the two rows above it did not.
       *
       * The month grid was a fixed 6.5rem per row, so on a laptop the card
       * stopped about 220px short of the bottom of the window and left a band
       * of empty ground under it. A calendar is the one screen where the grid
       * IS the page, so it should end where the page does.
       *
       * min-h-0 is the part that is easy to miss: a flex child defaults to
       * min-height:auto, which means it refuses to shrink below its content
       * and flex-1 cannot do anything. Without it the grid would push the page
       * taller than the window instead of fitting inside it.
       *
       * overflow-y-auto so the views that genuinely can be longer than the
       * window, the day list with a full timetable on it, scroll INSIDE the
       * canvas rather than making the whole page scroll and taking the
       * toolbars off the top with them.
       */}
      <div className="min-w-0 space-y-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
        {view === 'month' && (
          <MonthGrid range={range} anchor={anchor} agenda={agenda} cycle={shownCycle} onPick={(d) => { setAnchor(d); setView('day') }} />
        )}
        {view === 'week' && <WeekGrid range={range} agenda={agenda} cycle={shownCycle} locale={locale} onEdit={openEditor} />}
        {view === 'day' && <DayList day={anchor} agenda={agenda} cycle={shownCycle} onEdit={openEditor} onRemove={askRemove} t={t} />}
      </div>

      {/* Mounted always, so the tracker's own load runs and the overlay is
          there before anybody opens the drawer. `open` only draws it. */}
      <CyclePanel onChange={setCycle} open={drawer} onClose={() => setDrawer(false)} />

      {/**
       * The choice, before anything is lost.
       *
       * Three buttons and no default. "Toute la serie" is the destructive one
       * and is styled as such rather than being the primary: the safe answer
       * should be the easy one to hit, and on a phone this is a sheet where
       * the first button is under the thumb.
       */}
      {deleting && (
        <DeleteChoice
          entry={deleting}
          onOne={() => removeOne(deleting)}
          onAll={() => removeSeries(deleting.id)}
          onCancel={() => setDeleting(null)}
          locale={locale}
          t={t}
        />
      )}

      <TimetableWizard
        open={wizard}
        startsOn={dayKey(anchor)}
        onClose={() => setWizard(false)}
        onSaved={async (n) => {
          setWizard(false)
          setAdded(n)
          await load()
        }}
      />

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
    <section
      className="lg w-full overflow-hidden p-3 md:flex md:min-h-0 md:flex-1 md:flex-col"
      data-hook="cal-month"
    >
      {/**
       * The rows share whatever height the card has, instead of being 6.5rem
       * each and leaving the rest of the window empty.
       *
       * The row count is not fixed: a month is five or six weeks depending on
       * where the first lands, so it is passed in as a custom property rather
       * than written into a class. An inline grid-template-rows would apply on
       * a phone too, where the tiles SHOULD be their natural height and the
       * page should scroll; --weeks plus a class means the fill only happens
       * above md. See .month-fill in index.css.
       *
       * `auto` for the first row is the weekday header, which wants its own
       * height and not a seventh of the card.
       */}
      <div
        className="month-fill grid grid-cols-7 gap-1 md:min-h-0 md:flex-1"
        style={{ '--weeks': Math.max(1, Math.round(days.length / 7)) }}
      >
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
    <section
      className="lg w-full overflow-hidden p-3 md:flex md:min-h-0 md:flex-1 md:flex-col"
      data-hook="cal-week"
    >
      {/* The grid scrolls sideways rather than squeezing seven columns into
          360px, where each would be 40px and hold no word at all.

          Three levels of flex plumbing to get the hour column to fill: every
          ancestor between the card and the grid has to be a flex column with
          min-h-0, or flex-1 on the grid has nothing to grow inside. */}
      <div className="overflow-x-auto md:flex md:min-h-0 md:flex-1 md:flex-col">
        <div className="min-w-[38rem] md:flex md:min-h-0 md:flex-1 md:flex-col">
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

          {/**
           * The hours fill the card above md, and are 3rem each below it.
           *
           * The height cannot stay inline: an inline style beats every class,
           * so there would be no way to release it at one breakpoint and not
           * the other. It is a custom property read by .week-hours instead.
           *
           * min-height keeps the 3rem-per-hour floor, so a short window makes
           * the canvas scroll rather than crushing a nine-hour day into 200px.
           * blockStyle positions everything as a percentage of the span, so a
           * taller column makes every block taller in proportion, which is
           * what was actually asked for.
           */}
          <div
            className="week-hours relative grid grid-cols-[3rem_repeat(7,1fr)] gap-1"
            style={{ '--hours': hours.length }}
          >
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

/**
 * "Just this one, or all of them?"
 *
 * Only ever shown for a rule that recurs. See askRemove for why a one-off
 * skips it: two options that do the same thing teach people to stop reading.
 *
 * A dialog rather than a window.confirm, because confirm() cannot offer three
 * answers and cannot say which day it is about. Naming the date is most of the
 * value here: "Supprimer le cours du jeudi 3 septembre" is a different
 * question from "Supprimer Biochimie".
 */
function DeleteChoice({ entry, onOne, onAll, onCancel, locale, t }) {
  const when = entry.day.toLocaleDateString(localeTag(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  /**
   * The title, set apart from the sentence it is inside.
   *
   * "Biochimie avancee et metabolisme se repete" is one run of grey text in
   * which the part naming what is about to be deleted is indistinguishable
   * from the part explaining the question. On a destructive dialog that is the
   * one word that has to land.
   *
   * SPLIT ON A SENTINEL RATHER THAN CONCATENATING THREE STRINGS.
   *
   * The obvious version is `pre + <strong>{title}</strong> + post`, which
   * hard-codes the title coming before the date and after nothing. That is
   * true in French and English and is not a property of translation: any
   * locale that fronts the date, or that needs a particle attached to the
   * name, would have to break the sentence to fit the markup. Interpolating a
   * character that cannot appear in a title and splitting on it keeps the
   * whole sentence in the string file where it belongs, and works whatever
   * order a translator puts the two parts in.
   *
   * The quotes live in the template, not here, because which marks a language
   * quotes with is part of the language.
   */
  const [before, after = ''] = t('cal.del_body', { what: SPLIT, when }).split(SPLIT)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" data-hook="cal-delete">
      <button
        type="button"
        aria-label={t('cal.cancel')}
        onClick={onCancel}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('cal.del_title')}
        className="lg lg-modal relative m-2 w-[min(26rem,calc(100vw-1rem))] p-5"
      >
        <h2 className="text-safe text-h2 font-semibold text-ink">{t('cal.del_title')}</h2>
        <p className="text-safe mt-1.5 text-small text-muted" data-hook="del-body">
          {before}
          <strong className="font-semibold text-ink">{entry.title}</strong>
          {after}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {/* The safe answer first, and it is the one under the thumb on a
              phone where this is a sheet rising from the bottom. */}
          <button type="button" onClick={onOne} className="goal-action press justify-center" data-hook="del-one">
            {t('cal.del_one')}
          </button>
          <button
            type="button"
            onClick={onAll}
            data-hook="del-all"
            className="press inline-flex items-center justify-center rounded-pill bg-negative/[0.10] px-4 py-2 text-small font-semibold text-negative transition-colors hover:bg-negative/[0.18]"
          >
            {t('cal.del_all')}
          </button>
          <button type="button" onClick={onCancel} className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]">
            {t('cal.cancel')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

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
                  onClick={() => onRemove(e)}
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
  const { t, locale } = useT()
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

  /**
   * A centred dialog, not a card at the bottom of the page.
   *
   * It was a section appended below the grid, which meant "+ Ajouter" scrolled
   * the calendar away and opened a long form where the month had been. The
   * wizard next door was already a modal, so pressing one button gave you a
   * dialog and pressing the other gave you a page: two answers to the same
   * kind of question.
   *
   * Same shell as TimetableWizard, deliberately down to the class list. Two
   * dialogs on one screen that are 90 per cent alike and 10 per cent different
   * is worse than either being wrong on its own.
   */
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-hook="cal-form">
      <button
        type="button"
        aria-label={t('cal.cancel')}
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={initial.id ? t('cal.edit_title') : t('cal.new_title')}
        className="lg lg-modal relative m-2 flex max-h-[92dvh] w-[min(42rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <h2 className="text-safe text-h2 font-semibold text-ink">
            {initial.id ? t('cal.edit_title') : t('cal.new_title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cal.cancel')}
            data-hook="cal-form-close"
            className="press -mr-1 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            &#215;
          </button>
        </div>

      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 space-y-3">
        <label className="block">
          <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('cal.f_title')}</span>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} className="field mt-1 w-full" />
        </label>

        {/**
         * The seven, each carrying the colour it will paint in.
         *
         * The dot is not decoration. Picking "Examen" here is the act that
         * decides what the entry looks like on the month grid for the rest of
         * the term, and without it the connection between the word and the
         * black chip that appears afterwards has to be learned by surprise.
         * SWATCH_BAR is reused rather than a second table, so a category whose
         * colour changes changes in both places or in neither.
         *
         * The active pill lifts one pixel with a tinted shadow under it. The
         * fill is still the thing that says "selected" and the lift is a
         * second signal on top of it, per 1.4.1, alongside the dot going white
         * so it stays visible on the accent.
         */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = f.category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setF({ ...f, category: c })}
                aria-pressed={on}
                data-cat={c}
                className={`press inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-small font-semibold transition-all duration-200 ease-settle ${
                  on
                    ? '-translate-y-px bg-accent text-on-accent shadow-[0_4px_12px_-2px_rgb(var(--c-accent)/0.45)]'
                    : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-pill ${
                    on ? 'bg-on-accent' : SWATCH_BAR[CATEGORY_COLOUR[c]] ?? SWATCH_BAR.accent
                  }`}
                />
                {t(`cal.cat_${c}`)}
              </button>
            )
          })}
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
                /* The visible text cannot be the accessible name here: mardi
                   and mercredi share an initial, so a screen reader would hear
                   "M" twice with nothing to tell them apart, and a 36px chip
                   has no room for a second letter. */
                aria-label={weekdayName(n, localeTag(locale))}
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
          <button type="button" onClick={onClose} className="goal-action press">
            {t('cal.cancel')}
          </button>
        </div>
      </form>
      </section>
    </div>,
    document.body,
  )
}
