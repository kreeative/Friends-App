import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { PREP, dayKey, daysBetween, estimate, fromKey, predict } from '../lib/cycle'

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
export default function CyclePanel({ onChange }) {
  const { user } = useAuth()
  const { t } = useT()

  const [starts, setStarts] = useState([])
  const [prefs, setPrefs] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [setup, setSetup] = useState(false)
  const [busy, setBusy] = useState(false)

  /* The three dates and the stated average, as typed. Kept as strings so a
     half-entered date is not repeatedly parsed and rejected while somebody is
     still typing it. */
  const [form, setForm] = useState({ d1: '', d2: '', d3: '', avg: '' })

  const load = async () => {
    if (!user) return
    const [{ data: logs }, { data: pref }] = await Promise.all([
      supabase.from('cycle_log').select('id, started_on').order('started_on', { ascending: true }),
      supabase.from('notification_preference').select('*').maybeSingle(),
    ])
    setStarts(logs ?? [])
    setPrefs(pref ?? null)
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

  if (!loaded) return null

  const saveSetup = async (e) => {
    e.preventDefault()
    setBusy(true)
    /* Whichever of the three were filled in. Somebody who remembers one date
       is better served by a low-confidence prediction than by a form that
       refuses them for not remembering three. */
    const rows = [form.d1, form.d2, form.d3]
      .map((d) => fromKey(d))
      .filter(Boolean)
      .map((d) => ({ user_id: user.id, started_on: dayKey(d) }))

    if (rows.length) {
      await supabase.from('cycle_log').upsert(rows, { onConflict: 'user_id,started_on' })
    }

    /* The stated average is only sent when it is inside the range the check
       constraint allows. Sending 300 because somebody mistyped would fail the
       whole upsert, taking the reminder setting with it, and the error a
       person would see is about a constraint rather than about a number. */
    const avg = Number.parseInt(form.avg, 10)
    const stated = Number.isFinite(avg) && avg >= 21 && avg <= 45 ? avg : null

    await supabase.from('notification_preference').upsert(
      { user_id: user.id, cycle_remind: true, cycle_remind_days: 2, stated_cycle: stated },
      { onConflict: 'user_id' },
    )
    setBusy(false)
    setSetup(false)
    setForm({ d1: '', d2: '', d3: '', avg: '' })
    await load()
  }

  const logToday = async () => {
    setBusy(true)
    await supabase
      .from('cycle_log')
      .upsert({ user_id: user.id, started_on: dayKey(new Date()) }, { onConflict: 'user_id,started_on' })
    setBusy(false)
    await load()
  }

  const setRemind = async (patch) => {
    const next = { user_id: user.id, ...(prefs ?? {}), ...patch }
    setPrefs(next)
    await supabase.from('notification_preference').upsert(next, { onConflict: 'user_id' })
  }

  /* --- not set up yet --------------------------------------------------- */

  if (!starts.length && !setup) {
    return (
      <section className="lg w-full overflow-hidden p-5" data-hook="cycle-off">
        <h2 className="text-safe text-h2 font-semibold text-ink">{t('cycle.title')}</h2>
        <p className="lede mt-1.5">{t('cycle.pitch')}</p>
        <button
          type="button"
          onClick={() => setSetup(true)}
          className="goal-action press mt-4"
          data-hook="cycle-setup-open"
        >
          {t('cycle.setup')}
        </button>
        <p className="mt-3 text-small text-muted">{t('cycle.private')}</p>
      </section>
    )
  }

  /* --- the three-date form ---------------------------------------------- */

  if (setup) {
    return (
      <section className="lg w-full overflow-hidden p-5" data-hook="cycle-setup">
        <h2 className="text-safe text-h2 font-semibold text-ink">{t('cycle.setup_title')}</h2>
        <p className="lede mt-1.5">{t('cycle.setup_help')}</p>

        <form onSubmit={saveSetup} className="mt-4 space-y-3">
          {['d1', 'd2', 'd3'].map((k, i) => (
            <label key={k} className="block">
              <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
                {t('cycle.date_n', { n: i + 1 })}
              </span>
              <input
                type="date"
                value={form[k]}
                max={dayKey(new Date())}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
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
            <button type="button" onClick={() => setSetup(false)} className="goal-action-soft press">
              {t('cycle.cancel')}
            </button>
          </div>
        </form>
      </section>
    )
  }

  /* --- running ----------------------------------------------------------- */

  const daysAway = prediction ? daysBetween(new Date(), prediction.nextStart) : null
  const inPrep = daysAway != null && daysAway >= 0 && daysAway <= 3

  return (
    <section className="lg w-full overflow-hidden p-5" data-hook="cycle-on" data-confidence={est.confidence}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-safe text-h2 font-semibold text-ink">{t('cycle.title')}</h2>
        <button
          type="button"
          onClick={logToday}
          disabled={busy}
          className="chip-accent press shrink-0"
          data-hook="cycle-log-today"
        >
          {t('cycle.started_today')}
        </button>
      </div>

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

      <div className="mt-4 border-t border-hairline pt-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(prefs?.cycle_remind)}
            onChange={(e) => setRemind({ cycle_remind: e.target.checked })}
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
                onClick={() => setRemind({ cycle_remind_days: n })}
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
    </section>
  )
}
