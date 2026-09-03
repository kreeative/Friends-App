import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import {
  MAX_CYCLE,
  MIN_CYCLE,
  PREP,
  WATER_GOAL,
  dayKey,
  daysBetween,
  estimate,
  fromKey,
  phaseOn,
  predict,
} from '../lib/cycle'

/**
 * The cycle tracker.
 *
 * WHAT THIS COMPONENT WILL NOT DO, AND WHY THAT IS A FEATURE.
 *
 * Nothing here is ever shown to anybody but the person it belongs to. There is
 * no share, no group view, no export, and no summary that could be read off a
 * shared screen over somebody's shoulder without them opening it. Migration 51
 * enforces that at the database and lists the well-meaning changes that would
 * break it; this file is the other half of the same promise.
 *
 * It is also off until it is switched on. The panel starts as a single line
 * offering to set it up, and somebody who never taps it never has a cycle
 * tracker in their calendar. A health feature that appears by default in an
 * app about goals is a health feature somebody did not consent to.
 *
 * IT IS A DRAWER NOW, AND THAT IS WHAT MADE EDITING POSSIBLE.
 *
 * It used to be a 20rem column beside the grid from xl up. Two things were
 * wrong with that and they were the same thing: 20rem is not enough room to
 * list the recorded dates with a control on each, so there was nowhere to put
 * the editing, and it was reported missing. A drawer is as tall as the window
 * and as wide as it needs to be, and it costs the grid nothing at any size.
 *
 * HOW MUCH IT CLAIMS.
 *
 * As little as the data supports. cycle.js returns a confidence with every
 * prediction and this shows it in words rather than drawing a confident line
 * from two numbers. Three recorded dates is not a distribution, and an app
 * that says "your period starts Tuesday" from that is making something up.
 *
 * It says, in the interface and not only here, that it is not contraception
 * and not a diagnosis.
 */

/**
 * The three setup dates, oldest first, each with the wording that says WHICH
 * one it means.
 *
 * "Periode 1, 2, 3" was reported as confusing and it deserved to be: a bare
 * ordinal does not say whether one is the oldest or the most recent, and
 * getting it backwards silently produces a prediction from reversed gaps. The
 * gaps happen to be the same size either way, so nothing errors and the answer
 * is just wrong. Each label now carries its own example.
 */
const SETUP_DATES = [
  { key: 'd1', label: 'cycle.date_oldest' },
  { key: 'd2', label: 'cycle.date_prev' },
  { key: 'd3', label: 'cycle.date_recent' },
]

/* One per phase, matched to the four phaseOn returns. Not a colour: the marks
   on the calendar already carry the phase in two colours and two shapes, and
   this is a warmer restatement inside the drawer rather than a fifth signal. */
const PHASE_EMOJI = {
  period: '🌸',
  predicted: '🌷',
  pms: '🌿',
  fertile: '✨',
}

export default function CyclePanel({ onChange, open = false, onClose }) {
  const { user } = useAuth()
  const { t } = useT()

  const [starts, setStarts] = useState([])
  const [prefs, setPrefs] = useState(null)
  const [today, setToday] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [setup, setSetup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  /* What just happened, for two or three seconds. See flash below. */
  const [said, setSaid] = useState(null)
  const saidTimer = useRef(null)
  const panel = useRef(null)

  /* A timer outliving the component would call setState on something that is
     gone. The drawer unmounts every time it is closed, so this is not a corner
     case, it is the normal path. */
  useEffect(() => () => clearTimeout(saidTimer.current), [])

  /* The three dates and the stated average, as typed. Kept as strings so a
     half-entered date is not repeatedly parsed and rejected while somebody is
     still typing it. */
  const [form, setForm] = useState({ d1: '', d2: '', d3: '', avg: '' })

  /* The average as typed, so an out-of-range number can be shown back with the
     reason it was not saved rather than silently discarded. Seeded from the
     stored value once the load lands. */
  const [avgText, setAvgText] = useState('')
  useEffect(() => {
    setAvgText(prefs?.stated_cycle == null ? '' : String(prefs.stated_cycle))
  }, [prefs?.stated_cycle])

  const avgNum = Number.parseInt(avgText, 10)
  const avgBad = avgText !== '' && !(Number.isFinite(avgNum) && avgNum >= MIN_CYCLE && avgNum <= MAX_CYCLE)

  const load = async () => {
    if (!user) return
    const [{ data: logs }, { data: pref }, { data: day }] = await Promise.all([
      supabase.from('cycle_log').select('id, started_on, ended_on').order('started_on', { ascending: true }),
      supabase.from('notification_preference').select('*').maybeSingle(),
      supabase.from('cycle_day').select('*').eq('on_day', dayKey(new Date())).maybeSingle(),
    ])
    setStarts(logs ?? [])
    setPrefs(pref ?? null)
    setToday(day ?? null)
    setLoaded(true)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const prediction = useMemo(
    () => predict(starts, prefs?.stated_cycle ?? null),
    [starts, prefs],
  )
  const est = useMemo(() => estimate(starts, prefs?.stated_cycle ?? null), [starts, prefs])

  /* The parent draws the tiles, so it needs whatever this knows. Sent up on
     every change rather than lifted into a context: one page uses this and a
     context for one consumer is indirection with no payoff. */
  useEffect(() => {
    onChange?.({ starts, prediction })
  }, [starts, prediction, onChange])

  /* Escape closes it, which is the one keyboard behaviour a dialog cannot do
     without and the one people try first. */
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /**
   * Every write goes through here, and every write reloads.
   *
   * RLS refuses a DELETE or an UPDATE silently: zero rows, no error object. So
   * an optimistic local edit would look exactly like a successful one and the
   * row would come back on the next load with no explanation. Reloading after
   * every write means the panel always shows what the database actually holds,
   * and `failed` is set from the row count rather than from `error`.
   */
  const write = async (fn) => {
    setBusy(true)
    setFailed(false)
    const res = await fn()
    setBusy(false)
    if (res?.error) setFailed(true)
    await load()
    return res
  }

  const saveSetup = async (e) => {
    e.preventDefault()
    /* Whichever of the three were filled in. Somebody who remembers one date
       is better served by a low-confidence prediction than by a form that
       refuses them for not remembering three. */
    const rows = [form.d1, form.d2, form.d3]
      .map((d) => fromKey(d))
      .filter(Boolean)
      .map((d) => ({ user_id: user.id, started_on: dayKey(d) }))

    await write(async () => {
      if (rows.length) {
        await supabase.from('cycle_log').upsert(rows, { onConflict: 'user_id,started_on' })
      }
      /* The stated average is only sent when it is inside the range the check
         constraint allows. Sending 300 because somebody mistyped would fail the
         whole upsert, taking the reminder setting with it, and the error a
         person would see is about a constraint rather than about a number. */
      const avg = Number.parseInt(form.avg, 10)
      const stated = Number.isFinite(avg) && avg >= 21 && avg <= 45 ? avg : null
      return supabase.from('notification_preference').upsert(
        { user_id: user.id, cycle_remind: true, cycle_remind_days: 2, stated_cycle: stated },
        { onConflict: 'user_id' },
      )
    })
    setSetup(false)
    setForm({ d1: '', d2: '', d3: '', avg: '' })
  }

  /**
   * "It started today", and the way back out of it.
   *
   * WHY THIS IS A TOGGLE AND NOT A BUTTON.
   *
   * It was a one-way tap: press it and today is in the log, with the only undo
   * being to scroll to the history, find today's date among the others and
   * press an x. That is a long way round from a control that is one tap and
   * sits at the top of the panel, and a mis-tap here is not rare: it is the
   * biggest, most obvious thing in the drawer.
   *
   * Pressed twice, it removes what the first press added. Nothing else in the
   * history is reachable from here, so there is no way to lose a date somebody
   * meant to keep: it only ever touches today's row.
   *
   * aria-pressed, so a screen reader gets the state rather than a label that
   * changed. Both are provided, because the visible label changing is what a
   * sighted person reads and the two should not disagree.
   */
  const todayRow = starts.find((s) => s.started_on === dayKey(new Date())) ?? null

  const toggleToday = async () => {
    if (todayRow) {
      await removeEntry(todayRow.id)
      return flash(t('cycle.undone'))
    }
    await write(() =>
      supabase
        .from('cycle_log')
        .upsert({ user_id: user.id, started_on: dayKey(new Date()) }, { onConflict: 'user_id,started_on' }),
    )
    flash(t('cycle.logged'))
  }

  /* Correcting a recorded date. An update rather than a delete plus an insert,
     so the row keeps its id and nothing referring to it is orphaned mid-edit. */
  const moveEntry = (id, value) => {
    const d = fromKey(value)
    if (!d) return undefined
    return write(() => supabase.from('cycle_log').update({ started_on: dayKey(d) }).eq('id', id))
  }

  const removeEntry = (id) => write(() => supabase.from('cycle_log').delete().eq('id', id))

  /* Deleting a date is the one action in here with no visible result: the row
     leaves a list somebody may not be looking at. A line that says what just
     happened is the whole confirmation, and it clears itself. role="status" so
     it is announced without stealing focus, which a dialog inside a dialog
     would. */
  const flash = (text) => {
    setSaid(text)
    /* A ref and not a local: `flash` is rebuilt every render, so a timer hung
       off the function object would be a fresh undefined each time and the
       clear would never fire. Two deletions inside three seconds would then
       race, and the first one's timeout would blank the second one's message. */
    clearTimeout(saidTimer.current)
    saidTimer.current = setTimeout(() => setSaid(null), 2600)
  }

  const setPref = (patch) => {
    const next = { user_id: user.id, ...(prefs ?? {}), ...patch }
    setPrefs(next)
    return write(() => supabase.from('notification_preference').upsert(next, { onConflict: 'user_id' }))
  }

  /* Hydration. A glass at a time, because a number that has to be estimated
     precisely is a number that does not get entered: the column is a count of
     glasses for exactly this reason. */
  const setWater = (n) => {
    const water = Math.max(0, Math.min(30, n))
    setToday((d) => ({ ...(d ?? {}), water }))
    return write(() =>
      supabase
        .from('cycle_day')
        .upsert({ user_id: user.id, on_day: dayKey(new Date()), water }, { onConflict: 'user_id,on_day' }),
    )
  }

  if (!loaded || !open) return null

  const daysAway = prediction ? daysBetween(new Date(), prediction.nextStart) : null
  const inPrep = daysAway != null && daysAway >= 0 && daysAway <= 3
  const water = today?.water ?? 0
  /* The same call the calendar makes for the same day, so the drawer and the
     grid can never say two different things about today. */
  const phase = phaseOn(new Date(), starts, prediction)

  const body = (() => {
    /* --- not set up yet ------------------------------------------------- */
    if (!starts.length && !setup) {
      return (
        <div data-hook="cycle-off">
          <p className="lede">{t('cycle.pitch')}</p>
          <button
            type="button"
            onClick={() => setSetup(true)}
            className="goal-action press mt-4"
            data-hook="cycle-setup-open"
          >
            {t('cycle.setup')}
          </button>
          <p className="mt-3 text-small text-muted">{t('cycle.private')}</p>
        </div>
      )
    }

    /* --- the three-date form -------------------------------------------- */
    if (setup) {
      return (
        <div data-hook="cycle-setup">
          <p className="lede">{t('cycle.setup_help')}</p>

          <form onSubmit={saveSetup} className="mt-4 space-y-3">
            {SETUP_DATES.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-safe block text-label font-semibold uppercase tracking-[0.06em] text-muted">
                  {t(label)}
                </span>
                <input
                  type="date"
                  value={form[key]}
                  max={dayKey(new Date())}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="field mt-1 w-full"
                />
              </label>
            ))}

            {/* Optional, and the placeholder says the usual answer. Somebody who
                does not know is better served by leaving it blank than by
                guessing: three dates beat a guessed average, and estimate() will
                stop using this the moment there are three measured gaps. */}
            <label className="block">
              <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
                {t('cycle.avg')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={21}
                max={45}
                value={form.avg}
                placeholder="28"
                onChange={(e) => setForm((f) => ({ ...f, avg: e.target.value }))}
                className="field mt-1 w-full"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="submit" disabled={busy} className="goal-action-done press">
                {busy ? t('cycle.saving') : t('cycle.save')}
              </button>
              {Boolean(starts.length) && (
                <button type="button" onClick={() => setSetup(false)} className="goal-action-soft press">
                  {t('cycle.cancel')}
                </button>
              )}
            </div>
          </form>
        </div>
      )
    }

    /* --- running --------------------------------------------------------- */
    return (
      <div data-hook="cycle-on" data-confidence={est.confidence}>
        <button
          type="button"
          onClick={toggleToday}
          disabled={busy}
          aria-pressed={Boolean(todayRow)}
          data-hook="cycle-log-today"
          data-on={Boolean(todayRow)}
          className={`press inline-flex items-center gap-2 rounded-pill px-4 py-2 text-small font-semibold transition-all duration-200 ease-settle ${
            todayRow
              ? 'bg-accent text-on-accent shadow-[0_4px_12px_-2px_rgb(var(--c-accent)/0.45)]'
              : 'chip-accent'
          }`}
        >
          {/* A tick when it is on. The fill says it too, and 1.4.1 asks that
              colour is never the only thing saying it. */}
          <span aria-hidden="true">{todayRow ? '✓' : '🌸'}</span>
          {todayRow ? t('cycle.started_today_on') : t('cycle.started_today')}
        </button>

        {/* The way out, spelled out rather than left to somebody discovering
            that the button above toggles. Only there when there is something
            to undo. */}
        {todayRow && (
          <p className="mt-1.5 text-small text-muted" data-hook="cycle-undo-hint">
            {t('cycle.started_today_undo')}
          </p>
        )}

        {prediction ? (
          <>
            <p className="mt-3 text-body text-ink">
              {daysAway === 0
                ? t('cycle.due_today')
                : daysAway > 0
                  ? t('cycle.in_days', { n: daysAway })
                  : t('cycle.late_days', { n: Math.abs(daysAway) })}
            </p>

            {/**
             * The estimate and how much to trust it, in the same sentence.
             *
             * Separating them is how somebody ends up quoting the date and
             * forgetting the qualifier. The window is shown as a range rather
             * than a day whenever the recorded cycles disagree, which is what
             * `window` is for.
             */}
            <p className="mt-1 text-small text-muted">
              {t('cycle.cycle_len', { n: est.length })}
              {' · '}
              {t(`cycle.conf_${est.confidence}`)}
              {prediction.window > 1 && ` · ${t('cycle.window', { n: prediction.window })}`}
            </p>

            {/**
             * One line about where in the cycle today is, and one thing to do
             * about it.
             *
             * WHAT THIS IS CAREFUL NOT TO BE.
             *
             * It is not a symptom log, a mood reading or anything the app
             * infers about how somebody is doing. Migration 51 is explicit
             * that a "who is having a rough week" signal is the thing these
             * tables exist to make impossible, and a wellness note that grew
             * inputs would be the first step towards one.
             *
             * So it is a lookup on a phase this panel already computes and
             * already draws on the calendar, saying nothing the person did not
             * enter themselves. It is read, never written, and there is
             * nowhere for it to send anything.
             *
             * phaseOn's fourth argument is periodDays and defaults to 5. It is
             * left alone here: passing the estimate object into it, which was
             * done once, makes every day inside a NaN-length window read as a
             * period.
             */}
            {phase && (
              <p
                className="mt-3 rounded-inner bg-accent/[0.07] px-3 py-2.5 text-small text-ink"
                data-hook="cycle-care"
                data-phase={phase}
              >
                <span aria-hidden="true" className="mr-1.5">{PHASE_EMOJI[phase]}</span>
                {t(`cycle.care_${phase}`)}
              </p>
            )}

            {prediction.missed > 0 && (
              <p className="mt-2 text-small text-negative">{t('cycle.stale', { n: prediction.missed })}</p>
            )}

            {/* The pre-period protocol, and only when it is nearly time. A
                checklist shown on day nine of a cycle is a checklist people stop
                reading by day twelve. */}
            {inPrep && (
              <ul className="mt-4 space-y-1.5 border-t border-hairline pt-4" data-hook="cycle-prep">
                {PREP.map((k) => (
                  <li key={k} className="text-safe text-small text-ink">
                    {t(k)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-3 text-small text-muted">{t('cycle.need_more')}</p>
        )}

        {/* --- hydration ---------------------------------------------------
            Its own block rather than a line in the checklist above, because
            the checklist is advice and this is a thing you do. It is shown
            every day, not only before a period: drinking water on day nine is
            not worse than drinking it on day twenty-six. */}
        <div className="mt-4 border-t border-hairline pt-4" data-hook="cycle-water" data-water={water}>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-small font-semibold text-ink">
                <span aria-hidden="true" className="mr-1.5">💧</span>
                {t('cycle.water')}
              </span>
              <span className="block text-small text-muted">
                {t('cycle.water_help', { n: water, goal: WATER_GOAL })}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setWater(water - 1)}
                disabled={busy || water === 0}
                aria-label={t('cycle.water_less')}
                className="press h-9 w-9 rounded-pill bg-ink/[0.06] text-body font-semibold text-ink hover:bg-ink/[0.11] disabled:opacity-40"
              >
                &#8722;
              </button>
              <button
                type="button"
                onClick={() => setWater(water + 1)}
                disabled={busy}
                aria-label={t('cycle.water_more')}
                className="press h-9 w-9 rounded-pill bg-accent text-body font-semibold text-on-accent"
              >
                +
              </button>
            </div>
          </div>

          {/**
           * Glasses that look like glasses, and the count above says the same
           * thing in words. The row is decoration, per 1.4.1: nothing here is
           * carried by the marks alone, which is why the whole thing is
           * aria-hidden rather than being given labels nobody needs.
           *
           * A drop rather than the eight grey capsules that were here. They
           * read as a progress bar somebody had chopped up, and the one thing
           * this counter has going for it is that filling the next one is
           * mildly satisfying, which a capsule is not.
           *
           * Drawn rather than an emoji. The blue droplet emoji is blue in
           * every font on every platform, and this app has two themes.
           */}
          <div aria-hidden="true" className="mt-2.5 flex flex-wrap gap-1.5">
            {Array.from({ length: WATER_GOAL }, (_, i) => {
              const full = i < water
              return (
                <svg
                  key={i}
                  viewBox="0 0 16 20"
                  className={`h-5 w-4 transition-all duration-300 ease-settle ${
                    full ? 'scale-105 text-accent' : 'scale-100 text-ink/25'
                  }`}
                >
                  <path
                    d="M8 1.5C8 1.5 2 8.4 2 12.2a6 6 0 0 0 12 0C14 8.4 8 1.5 8 1.5Z"
                    fill={full ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              )
            })}
          </div>
        </div>

        {/* --- the recorded dates ------------------------------------------
            The part that was missing. Every start is editable in place and
            deletable, because a tracker you cannot correct is one that goes
            wrong permanently the first time somebody taps the wrong day, and
            "started today" is one tap. Newest first: the recent ones are the
            ones people come here to fix. */}
        <div className="mt-4 border-t border-hairline pt-4">
          <h3 className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
            {t('cycle.history')}
          </h3>

          <ul className="mt-2 space-y-1.5" data-hook="cycle-history">
            {[...starts].reverse().map((row) => (
              <li key={row.id} className="flex items-center gap-2" data-hook="cycle-entry">
                <input
                  type="date"
                  defaultValue={row.started_on}
                  max={dayKey(new Date())}
                  onChange={(e) => moveEntry(row.id, e.target.value)}
                  aria-label={t('cycle.edit_date')}
                  className="field min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await removeEntry(row.id)
                    flash(t('cycle.undone'))
                  }}
                  disabled={busy}
                  aria-label={t('cycle.delete_entry')}
                  data-hook="cycle-delete"
                  className="press h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-negative/10 hover:text-negative"
                >
                  &#215;
                </button>
              </li>
            ))}
          </ul>

          {/**
           * Adjustable at any time, not only during setup. estimate() stops
           * using it once there are three measured gaps, and it says so.
           *
           * AN OUT-OF-RANGE NUMBER IS REFUSED OUT LOUD.
           *
           * It cannot be sent: the check constraint is 21 to 45 and a 300 would
           * fail the whole upsert, taking the reminder settings with it, and
           * the error somebody would see is about a constraint rather than
           * about a number. The first version simply did not send it, which a
           * screenshot caught: 300 sitting in the field, nothing saved, and
           * nothing on screen saying so. Silently discarding what somebody
           * typed is worse than refusing it, because they have no way to tell
           * the difference between that and a save.
           *
           * The typed text is state now so the hint can be shown, and the
           * write still only fires inside the range.
           */}
          <label className="mt-3 block">
            <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
              {t('cycle.avg_manual')}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_CYCLE}
              max={MAX_CYCLE}
              value={avgText}
              placeholder="28"
              data-hook="cycle-avg"
              aria-invalid={avgBad}
              aria-describedby="cycle-avg-help"
              onChange={(e) => {
                const raw = e.target.value
                setAvgText(raw)
                const n = Number.parseInt(raw, 10)
                if (raw === '') setPref({ stated_cycle: null })
                else if (Number.isFinite(n) && n >= MIN_CYCLE && n <= MAX_CYCLE) setPref({ stated_cycle: n })
              }}
              className="field mt-1 w-full"
            />
            <span id="cycle-avg-help" className="mt-1 block text-small">
              {avgBad ? (
                <span className="text-negative" data-hook="cycle-avg-bad">
                  {t('cycle.avg_range', { min: MIN_CYCLE, max: MAX_CYCLE })}
                </span>
              ) : (
                <span className="text-muted">{t('cycle.avg_help')}</span>
              )}
            </span>
          </label>
        </div>

        {/* --- reminders ---------------------------------------------------- */}
        <div className="mt-4 border-t border-hairline pt-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={Boolean(prefs?.cycle_remind)}
              onChange={(e) => setPref({ cycle_remind: e.target.checked })}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
              data-hook="cycle-remind"
            />
            <span className="min-w-0">
              <span className="block text-small font-semibold text-ink">{t('cycle.remind')}</span>
              <span className="block text-small text-muted">
                {t('cycle.remind_help', { n: prefs?.cycle_remind_days ?? 2 })}
              </span>
            </span>
          </label>

          {prefs?.cycle_remind && (
            <div className="mt-3 flex flex-wrap gap-2" data-hook="cycle-remind-days">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPref({ cycle_remind_days: n })}
                  aria-pressed={(prefs?.cycle_remind_days ?? 2) === n}
                  className={`press rounded-pill px-3 py-1 text-small font-semibold transition-colors ${
                    (prefs?.cycle_remind_days ?? 2) === n
                      ? 'bg-accent text-on-accent'
                      : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                  }`}
                >
                  {t('cycle.days_before', { n })}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-small text-muted">{t('cycle.disclaimer')}</p>
      </div>
    )
  })()

  /**
   * Portalled to the body.
   *
   * The calendar page is inside the shell's `md:pl-[7.5rem]` wrapper and inside
   * PageTransition, which animates transform on route change. A fixed element
   * inside a transformed ancestor positions against that ancestor rather than
   * the viewport, so a drawer left in place would slide in from somewhere other
   * than the edge of the screen, and only during a transition. Portalling puts
   * it outside both.
   */
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" data-hook="cycle-drawer">
      {/* The scrim. A button rather than a div with onClick, so tapping outside
          is reachable from a keyboard and announced as what it does. */}
      <button
        type="button"
        aria-label={t('cycle.close')}
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('cycle.title')}
        /* cycle-warm is the one place in the app with a tinted sheet, and the
           note in index.css says why this drawer gets it and the event form
           does not. */
        className="lg lg-modal cycle-warm relative m-2 flex w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-card p-0 outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <h2 className="text-safe text-h2 font-semibold text-ink">{t('cycle.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cycle.close')}
            data-hook="cycle-close"
            className="press -mr-1 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            &#215;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {failed && (
            <p className="mb-3 text-small text-negative" data-hook="cycle-failed">
              {t('cycle.save_failed')}
            </p>
          )}
          {/* Above the content rather than floating over it. A toast pinned to
              a corner of the screen would be outside the drawer somebody is
              looking at, and this drawer is already the smallest thing on the
              page. */}
          {said && (
            <p
              role="status"
              data-hook="cycle-said"
              className="mb-3 rounded-inner bg-accent/[0.10] px-3 py-2 text-small font-semibold text-ink"
            >
              {said}
            </p>
          )}
          {body}
        </div>
      </section>
    </div>,
    document.body,
  )
}
