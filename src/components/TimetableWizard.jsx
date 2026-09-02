import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { CATEGORIES, timetableRows, weekdayName } from '../lib/agenda'
import { dayKey } from '../lib/cycle'

/**
 * A term's classes, in one go.
 *
 * WHY THIS EXISTS ALONGSIDE THE ORDINARY EVENT FORM.
 *
 * They look like the same form and they are not. Adding one event is a
 * decision: what is it, when is it, does it repeat. Entering a timetable is
 * transcription from a printout, six or eight rows that share a term start, a
 * term end and a category, and doing it through a modal that opens, saves and
 * closes eight times means retyping those three things eight times and
 * counting how many are left.
 *
 * So the shared parts are stated once at the top and the rows are a table. The
 * unit of work is the term, which is how the person on the other side of this
 * is thinking about it.
 *
 * ONE INSERT, NOT EIGHT.
 *
 * Postgres takes an array and the whole batch lands or none of it does. Eight
 * separate inserts can half-fail, and the recovery from that is somebody
 * comparing their printout against the grid to work out which two are missing.
 * timetableRows validates the whole set before anything is sent for the same
 * reason.
 *
 * WHY THE DAYS ARE CHIPS AND NOT A MULTI-SELECT.
 *
 * A native multiple-select needs a modifier key to pick a second option, which
 * does not exist on the tablet this layout is for, and it hides the current
 * answer behind a scroll. Seven toggles are the whole answer, visible.
 */

const BLANK = { title: '', category: 'cours', location: '', start: '', end: '', weekdays: [] }

/* Monday first, which is what a European timetable looks like, while the
   values stay getDay()'s numbering so nothing downstream has to shift. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function TimetableWizard({ open, onClose, onSaved, startsOn }) {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [term, setTerm] = useState({ from: startsOn ?? dayKey(new Date()), until: '' })
  const [rows, setRows] = useState([{ ...BLANK }, { ...BLANK }, { ...BLANK }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const patch = (i, next) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...next } : row)))

  const toggleDay = (i, d) =>
    patch(i, {
      weekdays: rows[i].weekdays.includes(d)
        ? rows[i].weekdays.filter((x) => x !== d)
        : [...rows[i].weekdays, d],
    })

  const save = async (e) => {
    e.preventDefault()
    setError(null)

    const built = timetableRows(rows, { userId: user.id, startsOn: term.from, untilOn: term.until })
    if (built.error) {
      /* The message names the row it is about. "Give both a start and an end"
         is useless advice when six rows are on screen. */
      return setError(
        built.at ? t(`wiz.err_${built.error}`, { what: built.at }) : t(`wiz.err_${built.error}`),
      )
    }

    setBusy(true)
    const { error: err } = await supabase.from('calendar_event').insert(built.rows)
    setBusy(false)
    if (err) return setError(err.message)
    await onSaved(built.rows.length)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-hook="wiz">
      <button
        type="button"
        aria-label={t('wiz.close')}
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('wiz.title')}
        className="lg lg-chrome relative m-2 flex max-h-[92dvh] w-[min(52rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-safe text-h2 font-semibold text-ink">{t('wiz.title')}</h2>
            <p className="text-safe mt-0.5 text-small text-muted">{t('wiz.help')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('wiz.close')}
            data-hook="wiz-close"
            className="press -mr-1 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            &#215;
          </button>
        </div>

        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* Said once, because every row shares them. This is the whole
                reason the wizard is not eight passes through the event form. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
                  {t('wiz.term_from')}
                </span>
                <input
                  type="date"
                  value={term.from}
                  data-hook="wiz-from"
                  onChange={(e) => setTerm((s) => ({ ...s, from: e.target.value }))}
                  className="field mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
                  {t('wiz.term_until')}
                </span>
                <input
                  type="date"
                  value={term.until}
                  data-hook="wiz-until"
                  onChange={(e) => setTerm((s) => ({ ...s, until: e.target.value }))}
                  className="field mt-1 w-full"
                />
              </label>
            </div>

            <ul className="mt-4 space-y-3">
              {rows.map((row, i) => (
                <li
                  key={i}
                  data-hook="wiz-row"
                  className="rounded-card border border-hairline/70 p-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
                    <input
                      value={row.title}
                      placeholder={t('wiz.f_title')}
                      aria-label={t('wiz.f_title')}
                      maxLength={120}
                      data-hook="wiz-title"
                      onChange={(e) => patch(i, { title: e.target.value })}
                      className="field w-full min-w-0"
                    />
                    <input
                      value={row.location}
                      placeholder={t('wiz.f_where')}
                      aria-label={t('wiz.f_where')}
                      maxLength={160}
                      onChange={(e) => patch(i, { location: e.target.value })}
                      className="field w-full min-w-0"
                    />
                    <input
                      type="time"
                      value={row.start}
                      aria-label={t('cal.f_start')}
                      data-hook="wiz-start"
                      onChange={(e) => patch(i, { start: e.target.value })}
                      className="field w-full min-w-0"
                    />
                    <input
                      type="time"
                      value={row.end}
                      aria-label={t('cal.f_end')}
                      data-hook="wiz-end"
                      onChange={(e) => patch(i, { end: e.target.value })}
                      className="field w-full min-w-0"
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {DAY_ORDER.map((d) => {
                      const on = row.weekdays.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          /* mardi and mercredi share an initial, so the visible
                             letter cannot be the accessible name and a 32px
                             chip has no room for a second one. */
                          aria-label={weekdayName(d, localeTag(locale))}
                          data-hook="wiz-day"
                          data-day={d}
                          onClick={() => toggleDay(i, d)}
                          className={`press h-8 w-8 rounded-pill text-small font-semibold transition-colors ${
                            on ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                          }`}
                        >
                          {t(`cal.dow_${d}`)}
                        </button>
                      )
                    })}

                    <span className="ml-auto flex items-center gap-1.5">
                      {/* The category, so an exam in the middle of a term
                          timetable does not have to be entered separately. */}
                      <select
                        value={row.category}
                        aria-label={t('wiz.f_kind')}
                        onChange={(e) => patch(i, { category: e.target.value })}
                        className="field py-1.5 text-small"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {t(`cal.cat_${c}`)}
                          </option>
                        ))}
                      </select>

                      {/* Removing a row is only offered when there is more than
                          one, so the form cannot be emptied into a state with
                          nothing to type into. */}
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                          aria-label={t('wiz.remove_row')}
                          data-hook="wiz-remove"
                          className="press h-8 w-8 shrink-0 rounded-pill text-muted hover:bg-negative/10 hover:text-negative"
                        >
                          &#215;
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setRows((r) => [...r, { ...BLANK }])}
              data-hook="wiz-add-row"
              className="goal-action-soft press mt-3"
            >
              {t('wiz.add_row')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4">
            <button type="submit" disabled={busy} className="goal-action-done press" data-hook="wiz-save">
              {busy ? t('cycle.saving') : t('wiz.save')}
            </button>
            <button type="button" onClick={onClose} className="goal-action-soft press">
              {t('cal.cancel')}
            </button>
            {error && (
              <p className="text-safe w-full text-small text-negative" data-hook="wiz-error">
                {error}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}
