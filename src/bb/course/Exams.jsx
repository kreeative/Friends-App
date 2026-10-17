import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { localeTag, useT } from '../../lib/i18n'
import { Field } from '../../components/ui'
import { examColumns, examToAsk, examsOf, newExam, scopeOf } from '../../lib/bb/exams'
import { changed } from '../../lib/dirty'
import { updateCourse } from '../data'
import { ExamChip, Note, PILL, examName } from '../kit'
import { Choice } from '../pages/Onboarding'

/**
 * The exams of a course, on its page: the midterm and the final, each with
 * its countdown, its date and what it covers, and a form to change them
 * (src/lib/bb/exams.js).
 *
 * The chip is the way in: tapping "Intra dans 9 jours" opens that exam's
 * form, there is no "change the date" line beside it (Kee). The same chip
 * on Today and on the plan lands here with ?examen=<id>, the form already
 * open. The form's save stays grey until something in it differs from what
 * is saved (src/lib/dirty.js); an exam being added is itself the change.
 *
 * TWO QUESTIONS THE NEW-COURSE FLOW COULD NOT ASK, asked here once they can
 * be answered:
 *   - a course from before has one date: is it the midterm or the final?
 *   - which chapters the midterm covers: there were no chapters when the
 *     course was created. Once the files are read, the first midterm to
 *     come whose scope was never said is asked for, until it is.
 */
const pad = (n) => String(n).padStart(2, '0')
const localDate = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const localTime = (iso) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Porte sur : ...": what an exam covers, by chapter title, in the course's order. */
export function coversText(t, exam, course, chapters = []) {
  const scope = scopeOf(exam, course, chapters)
  if (scope) {
    const order = [...chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    return t('bb.ex.covers', { list: order.filter((c) => scope.has(c.id)).map((c) => c.title).join(' · ') })
  }
  if (exam?.scope === 'since') return t('bb.ex.covers_since')
  if (exam?.scope == null && exam?.kind === 'midterm') return t('bb.ex.covers_unsaid')
  return t('bb.ex.covers_all')
}

/* The form of one exam, as it opens. A course from before opens with its one
   date and no kind yet: the form asks whether it was the midterm or the final. */
function formOf(e) {
  return {
    id: e.legacy ? newExam('final').id : e.id,
    kind: e.legacy ? null : e.kind,
    legacy: Boolean(e.legacy),
    date: e.at ? localDate(e.at) : '',
    time: e.at ? localTime(e.at) : '09:00',
    unknown: false,
    scope: e.scope ?? (e.kind === 'final' ? 'all' : null),
    chapters: e.chapters ?? [],
    count: e.format?.count ?? '',
    minutes: e.format?.minutes ?? '',
  }
}

export default function Exams({ course, chapters = [], onSaved }) {
  const { t, locale } = useT()
  const list = examsOf(course)
  const real = list.filter((e) => !e.legacy)
  const legacy = list.find((e) => e.legacy) ?? null
  /* Sent here by a chip on Today or the plan: that exam's form, open. */
  const [params, setParams] = useSearchParams()
  const sent = params.get('examen')
  const [opening] = useState(() => (sent ? list.find((e) => e.id === sent) ?? null : null))
  const [draft, setDraft] = useState(() => (opening ? formOf(opening) : null))
  /* What the form opened with: Save waits for the draft to differ from it. */
  const [initial, setInitial] = useState(() => (opening ? draft : null))
  /* Read once: the address goes back to the course's own, so going back or
     reloading does not open the form a second time. */
  useEffect(() => {
    if (!sent) return
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('examen')
      return next
    }, { replace: true })
  }, [sent, setParams])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const ask = !draft && chapters.length >= 2 ? examToAsk(course) : null
  const hasMidterm = real.some((e) => e.kind === 'midterm')
  const order = [...chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  async function write(next) {
    setBusy(true)
    setError(false)
    try {
      onSaved(await updateCourse(course.id, examColumns(next)))
      setDraft(null)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function open(e, patch = {}) {
    setError(false)
    const base = formOf(e)
    setInitial(base)
    setDraft({ ...base, ...patch })
  }

  function save(ev) {
    ev.preventDefault()
    const at = !draft.unknown && draft.date ? new Date(`${draft.date}T${draft.time || '09:00'}`).toISOString() : null
    const row = { id: draft.id, kind: draft.kind, at, scope: draft.scope, chapters: draft.chapters, format: { count: draft.count, minutes: draft.minutes } }
    write([...real.filter((e) => e.id !== draft.id), row])
  }

  const when = (iso) => {
    const d = new Date(iso)
    return `${d.toLocaleDateString(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(localeTag(locale), { hour: '2-digit', minute: '2-digit' })}`
  }
  const covers = (e) => coversText(t, e, course, chapters)
  const scopes = draft ? (draft.kind === 'final' && hasMidterm ? ['all', 'since', 'chapters'] : ['all', 'chapters']) : []
  const valid = Boolean(draft?.kind) && !(draft?.scope === 'chapters' && !draft.chapters.length)
  /* An exam being added ("+ Ajouter le final") is the change, its form as
     it opened included: saving it adds the exam. */
  const adding = Boolean(draft) && !draft.legacy && !real.some((e) => e.id === draft.id)
  const dirty = Boolean(draft && initial) && (adding || changed(initial, draft))

  /* The form opens where the exam was: in its row for one already saved,
     under the list for one being added or a course from before. */
  const form = draft && (
    <form onSubmit={save} className="rounded-card border border-ink/15 bg-surface p-4 sm:p-5" data-hook="bb-exam-form">
      {draft.legacy ? (
        <fieldset>
          <legend className="text-body font-bold text-ink">{t('bb.ex.which')}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {['midterm', 'final'].map((k) => (
              <Choice key={k} on={draft.kind === k} onClick={() => setDraft((d) => ({ ...d, kind: k, scope: d.scope ?? (k === 'final' ? 'all' : null) }))} hook={`bb-exam-kind-${k}`}>
                {examName(t, { kind: k })}
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-body font-bold text-ink">{examName(t, list.find((e) => e.id === draft.id) ?? { kind: draft.kind })}</p>
      )}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label={t('bb.new.exam_date')}>
          <input type="date" className="field" value={draft.date} disabled={draft.unknown} onChange={(ev) => setDraft((d) => ({ ...d, date: ev.target.value }))} data-hook="bb-exam-date" />
        </Field>
        <Field label={t('bb.new.exam_time')}>
          <input type="time" className="field" value={draft.time} disabled={draft.unknown} onChange={(ev) => setDraft((d) => ({ ...d, time: ev.target.value }))} />
        </Field>
      </div>
      <div className="mt-3">
        <Choice on={draft.unknown} onClick={() => setDraft((d) => ({ ...d, unknown: !d.unknown }))}>
          {t('bb.new.exam_unknown')}
        </Choice>
      </div>

      <fieldset className="mt-5">
        <legend className="text-small font-semibold text-ink">{t('bb.ex.scope')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {scopes.map((k) => (
            <Choice key={k} on={draft.scope === k} onClick={() => setDraft((d) => ({ ...d, scope: k }))} hook={`bb-exam-scope-${k}`}>
              {t(`bb.ex.scope.${k}`)}
            </Choice>
          ))}
        </div>
        {draft.scope === 'chapters' &&
          (order.length ? (
            <ul className="mt-3 space-y-1" data-hook="bb-exam-chapters">
              {order.map((c) => {
                const on = draft.chapters.includes(c.id)
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-inner px-2 py-2 hover:bg-ink/[0.04]">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setDraft((d) => ({ ...d, chapters: on ? d.chapters.filter((x) => x !== c.id) : [...d.chapters, c.id] }))}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <span className="text-body text-ink">{c.title}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 text-small text-muted">{t('bb.ex.no_chapters')}</p>
          ))}
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={t('bb.new.count')}>
          <input type="number" inputMode="numeric" min={1} max={300} className="field" value={draft.count} onChange={(ev) => setDraft((d) => ({ ...d, count: ev.target.value }))} />
        </Field>
        <Field label={t('bb.new.minutes')}>
          <input type="number" inputMode="numeric" min={5} max={600} className="field" value={draft.minutes} onChange={(ev) => setDraft((d) => ({ ...d, minutes: ev.target.value }))} />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="btn press w-auto bg-ink px-8 font-bold text-white hover:opacity-90" disabled={busy || !dirty || !valid} data-hook="bb-exam-save">
          {t('bb.course.save')}
        </button>
        <button type="button" className="btn-ghost press w-auto px-6" onClick={() => setDraft(null)}>
          {t('bb.ex.cancel')}
        </button>
        {real.some((e) => e.id === draft.id) && (
          <button type="button" className={`${PILL} ml-auto`} disabled={busy} onClick={() => write(real.filter((e) => e.id !== draft.id))} data-hook="bb-exam-remove">
            {t('bb.ex.remove')}
          </button>
        )}
      </div>
    </form>
  )

  return (
    <section className="mt-3" data-hook="bb-exams" aria-label={t('bb.ex.title')}>
      {legacy && !draft && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-hook="bb-exams-legacy">
          <ExamChip exam={legacy} onEdit={() => open(legacy)} hook="bb-exam-chip" />
          <span className="text-small text-ink">{t('bb.ex.which')}</span>
          <span className="flex gap-2">
            {['midterm', 'final'].map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                className="press rounded-pill border border-ink/15 bg-surface px-3 py-1 text-small font-semibold text-ink hover:border-ink"
                onClick={() => write([{ ...newExam(k), at: legacy.at, scope: k === 'final' ? 'all' : null }])}
                data-hook={`bb-exams-legacy-${k}`}
              >
                {examName(t, { kind: k })}
              </button>
            ))}
          </span>
        </div>
      )}

      {ask && (
        <div className="mb-3" data-hook="bb-exams-ask">
        <Note>
          <strong>{t('bb.ex.ask', { name: examName(t, ask) })}</strong> {t('bb.ex.ask_body')}
          <span className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost press w-auto px-5" onClick={() => open(ask, { scope: 'chapters' })} data-hook="bb-exams-ask-pick">
              {t('bb.ex.pick')}
            </button>
            <button type="button" className={PILL} disabled={busy} onClick={() => write(real.map((e) => (e.id === ask.id ? { ...e, scope: 'all' } : e)))} data-hook="bb-exams-ask-all">
              {t('bb.ex.scope.all')}
            </button>
          </span>
        </Note>
        </div>
      )}

      {real.length > 0 && (
        <ul className="space-y-2">
          {real.map((e) =>
            draft?.id === e.id ? (
              <li key={e.id}>{form}</li>
            ) : (
              <li key={e.id} className="rounded-inner bg-[#F4F4F5] px-4 py-3" data-hook="bb-exam-row">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ExamChip exam={e} onEdit={() => open(e)} hook="bb-exam-chip" />
                  {e.at && <span className="text-small text-ink">{when(e.at)}</span>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-small text-muted">{covers(e)}</p>
              </li>
            ),
          )}
        </ul>
      )}

      {draft && !real.some((e) => e.id === draft.id) && <div className="mt-2">{form}</div>}

      {!legacy && !draft && (
        <div className="mt-3 flex flex-wrap gap-2">
          {real.filter((e) => e.kind === 'midterm').length < 3 && (
            <button type="button" className={PILL} onClick={() => open(newExam('midterm'))} data-hook="bb-exams-add-midterm">
              + {t('bb.ex.add_midterm')}
            </button>
          )}
          {!real.some((e) => e.kind === 'final') && (
            <button type="button" className={PILL} onClick={() => open(newExam('final'))} data-hook="bb-exams-add-final">
              + {t('bb.ex.add_final')}
            </button>
          )}
        </div>
      )}

      {error && (
        <Note tone="error" className="mt-3">
          {t('bb.err.generic')}
        </Note>
      )}
    </section>
  )
}
