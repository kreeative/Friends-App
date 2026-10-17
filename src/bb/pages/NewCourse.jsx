import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Field } from '../../components/ui'
import { ACCEPT, kindFor, refuse } from '../../lib/bb/formats'
import { canAddCourse } from '../../lib/bb/plans'
import { examColumns, newExam } from '../../lib/bb/exams'
import { addPasted, createCourse, uploadMaterial } from '../data'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { BigButton, Note, PILL, PILL_ROUND } from '../kit'
import { Choice } from './Onboarding'

/**
 * /hakkilo/cours/nouveau: one course, in the order of section 9.
 *
 *   1. which course: name, code, professor, language;
 *   2. when the exams are: the midterm and the final, each with its date or
 *      "I don't know yet", either one taken off when the course has none,
 *      a second midterm added when it has one, and whether the final
 *      covers the whole course or only what came after the midterm ("ya le
 *      final exam mais ya aussi le mid term", src/lib/bb/exams.js);
 *   3. what they look like: the types for the course, the number of
 *      questions and the length for each exam. A past exam among the files
 *      will propose its own format later, for confirmation;
 *   4. the material: several files, a kind for each, or pasted text.
 *
 * Which chapters the midterm covers is asked on the course page, once the
 * files are read and there are chapters to pick (Exams.jsx).
 *
 * Creating it writes the course, then sends each file to the private bucket
 * with its own status line, then opens the course, where the reading starts
 * and is shown step by step (Course.jsx, Processing).
 *
 * A file that cannot be read is refused HERE, with the fix ("export the photo
 * as JPG"), rather than after an upload and a model call.
 */
export const KINDS = ['slides', 'guide', 'exam', 'transcript', 'notes', 'photo']
const TYPES = ['mcq', 'tf', 'short', 'calc', 'case']
const draft = (kind) => ({ ...newExam(kind), date: '', time: '09:00', unknown: false, count: '', minutes: '' })

export default function NewCourse() {
  const { t, locale } = useT()
  const { user } = useAuth()
  const { courses, setCourses, status } = useBB()
  const navigate = useNavigate()
  const picker = useRef(null)
  usePageMeta({ title: `${t('bb.new.title')} · Hakkilo` })

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: '', code: '', professor: '', language: locale === 'en' ? 'en' : 'fr', types: [], count: '', minutes: '' })
  const [exams, setExams] = useState(() => [draft('midterm'), { ...draft('final'), scope: 'all' }])
  const [files, setFiles] = useState([])
  const [paste, setPaste] = useState(null)
  const [refused, setRefused] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setExam = (id, patch) => setExams((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  const midterms = exams.filter((e) => e.kind === 'midterm')
  const hasFinal = exams.some((e) => e.kind === 'final')
  const nameOf = (e) => (e.kind === 'final' ? t('bb.ex.final') : midterms.length > 1 ? t('bb.ex.midterm_n', { n: midterms.indexOf(e) + 1 }) : t('bb.ex.midterm'))
  function addMidterm() {
    setExams((list) => {
      const at = list.findIndex((e) => e.kind === 'final')
      const next = draft('midterm')
      return at < 0 ? [...list, next] : [...list.slice(0, at), next, ...list.slice(at)]
    })
  }

  const sub = status ? { plan: status.plan, status: status.status, current_period_end: status.current_period_end } : null
  const room = status?.tier === 'owner' || status?.tier === 'plus' ? true : canAddCourse(sub, (courses ?? []).length)

  function addFiles(list) {
    const ok = []
    const no = []
    for (const file of list) {
      const why = refuse(file)
      if (why) no.push(t(`bb.new.${why}`, { name: file.name }))
      else ok.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, kind: kindFor(file.name, file.type), state: 'waiting' })
    }
    setRefused(no)
    setFiles((f) => [...f, ...ok.filter((x) => !f.some((y) => y.key === x.key))])
  }

  async function create() {
    setBusy(true)
    setError(null)
    let course
    try {
      const list = exams.map((e) => ({
        id: e.id,
        kind: e.kind,
        at: !e.unknown && e.date ? new Date(`${e.date}T${e.time || '09:00'}`).toISOString() : null,
        scope: e.kind === 'final' ? (midterms.length && e.scope === 'since' ? 'since' : 'all') : null,
        format: { count: e.count, minutes: e.minutes },
      }))
      const cols = examColumns(list)
      /* The course's own length, for what reads one exam: the one shown first. */
      const lead = cols.exams.find((e) => e.at && e.at === cols.exam_at) ?? cols.exams.at(-1)
      course = await createCourse({
        name: form.name.trim().slice(0, 120),
        code: form.code.trim().slice(0, 40) || null,
        professor: form.professor.trim().slice(0, 120) || null,
        language: form.language,
        ...cols,
        exam_format: {
          types: form.types,
          count: lead?.format.count ?? (Number(form.count) || null),
          minutes: lead?.format.minutes ?? (Number(form.minutes) || null),
          has_case: form.types.includes('case'),
          source: 'student',
        },
      })
    } catch {
      setBusy(false)
      setError(t('bb.new.error'))
      return
    }
    setCourses((list) => [...(list ?? []), course])
    for (let i = 0; i < files.length; i += 1) {
      setFiles((f) => f.map((x, j) => (j === i ? { ...x, state: 'sending' } : x)))
      try {
        await uploadMaterial({ userId: user.id, courseId: course.id, file: files[i].file, kind: files[i].kind })
        setFiles((f) => f.map((x, j) => (j === i ? { ...x, state: 'sent' } : x)))
      } catch {
        setFiles((f) => f.map((x, j) => (j === i ? { ...x, state: 'error' } : x)))
      }
    }
    if (paste?.text?.trim()) {
      try {
        await addPasted({ courseId: course.id, text: paste.text.trim(), name: t('bb.new.paste_name'), kind: 'notes' })
      } catch {
        /* the course exists; the text can be pasted again from the course */
      }
    }
    navigate(`/hakkilo/cours/${course.id}`, { replace: true })
  }

  const steps = ['course', 'exam', 'format', 'files']
  const canGo = step === 0 ? form.name.trim().length > 0 : true

  if (!room) {
    return (
      <Page>
        <PageHead title={t('bb.new.title')} />
        <Note className="mt-4">
          {t('bb.courses.limit')}
          <span className="mt-3 block">
            <Link to="/hakkilo/tarifs" className={PILL}>
              {t('bb.courses.upgrade')}
            </Link>
          </span>
        </Note>
      </Page>
    )
  }

  return (
    <Page>
      <PageHead eyebrow={t('bb.onb.step', { n: step + 1, total: steps.length })} title={t('bb.new.title')} />
      <div className="mt-2 flex max-w-[38rem] gap-1.5" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className={`h-1.5 flex-1 rounded-pill ${i <= step ? 'bg-ink' : 'bg-ink/15'}`} />
        ))}
      </div>

      <form
        className="measure-form mt-8"
        data-hook={`new-${steps[step]}`}
        onSubmit={(e) => {
          e.preventDefault()
          if (!canGo || busy) return
          if (step < steps.length - 1) setStep(step + 1)
          else create()
        }}
      >
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-h2 text-ink">{t('bb.new.step_course')}</h2>
            <Field label={t('bb.new.name')}>
              <input className="field" autoFocus required value={form.name} onChange={(e) => set('name')(e.target.value)} maxLength={120} placeholder={t('bb.new.name_ph')} data-hook="new-name" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('bb.new.code')}>
                <input className="field" value={form.code} onChange={(e) => set('code')(e.target.value)} maxLength={40} placeholder={t('bb.new.code_ph')} />
              </Field>
              <Field label={t('bb.new.prof')}>
                <input className="field" value={form.professor} onChange={(e) => set('professor')(e.target.value)} maxLength={120} />
              </Field>
            </div>
            <fieldset>
              <legend className="text-small font-semibold text-ink">{t('bb.new.lang')}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {['fr', 'en'].map((l) => (
                  <Choice key={l} on={form.language === l} onClick={() => set('language')(l)}>
                    {t(`bb.onb.lang.${l}`)}
                  </Choice>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-h2 text-ink">{t('bb.new.step_exam')}</h2>
              <p className="mt-2 text-body text-muted">{t('bb.new.exams_hint')}</p>
            </div>
            {exams.map((e) => (
              <fieldset key={e.id} className="rounded-card border border-ink/15 p-4 sm:p-5" data-hook={`new-exam-${e.kind}`}>
                <legend className="px-1 text-body font-bold text-ink">{e.kind === 'midterm' && midterms.length === 1 ? t('bb.new.midterm_title') : nameOf(e)}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('bb.new.exam_date')}>
                    <input type="date" className="field" value={e.date} disabled={e.unknown} onChange={(ev) => setExam(e.id, { date: ev.target.value })} data-hook={`new-date-${e.kind}`} />
                  </Field>
                  <Field label={t('bb.new.exam_time')}>
                    <input type="time" className="field" value={e.time} disabled={e.unknown} onChange={(ev) => setExam(e.id, { time: ev.target.value })} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Choice on={e.unknown} onClick={() => setExam(e.id, { unknown: !e.unknown })}>
                    {t('bb.new.exam_unknown')}
                  </Choice>
                </div>
                {e.kind === 'final' && midterms.length > 0 && (
                  <fieldset className="mt-5">
                    <legend className="text-small font-semibold text-ink">{t('bb.ex.scope')}</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {['all', 'since'].map((k) => (
                        <Choice key={k} on={(e.scope ?? 'all') === k} onClick={() => setExam(e.id, { scope: k })} hook={`new-final-${k}`}>
                          {t(`bb.ex.scope.${k}`)}
                        </Choice>
                      ))}
                    </div>
                  </fieldset>
                )}
                <button type="button" className={`${PILL} mt-4`} onClick={() => setExams((list) => list.filter((x) => x.id !== e.id))} data-hook={`new-drop-${e.kind}`}>
                  {e.kind === 'final' ? t('bb.new.no_final') : t('bb.new.no_midterm')}
                </button>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-3">
              {midterms.length < 3 && (
                <button type="button" className="btn-ghost press w-auto px-6" onClick={addMidterm} data-hook="new-add-midterm">
                  + {t('bb.ex.add_midterm')}
                </button>
              )}
              {!hasFinal && (
                <button type="button" className="btn-ghost press w-auto px-6" onClick={() => setExams((list) => [...list, { ...draft('final'), scope: 'all' }])} data-hook="new-add-final">
                  + {t('bb.ex.add_final')}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-h2 text-ink">{t('bb.new.step_format')}</h2>
            <p className="text-body text-muted">{t('bb.new.format_hint')}</p>
            <fieldset>
              <legend className="text-small font-semibold text-ink">{t('bb.new.types')}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TYPES.map((ty) => (
                  <Choice key={ty} on={form.types.includes(ty)} onClick={() => set('types')(form.types.includes(ty) ? form.types.filter((x) => x !== ty) : [...form.types, ty])}>
                    {t(`bb.new.type.${ty}`)}
                  </Choice>
                ))}
              </div>
            </fieldset>
            {/* The length for each exam: a final is often longer than the
                midterm. With no exam named, one length for the course. */}
            {exams.length ? (
              exams.map((e) => (
                <fieldset key={e.id} data-hook={`new-length-${e.kind}`}>
                  <legend className="text-small font-semibold text-ink">{nameOf(e)}</legend>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    <Field label={t('bb.new.count')}>
                      <input type="number" inputMode="numeric" min={1} max={300} className="field" value={e.count} onChange={(ev) => setExam(e.id, { count: ev.target.value })} />
                    </Field>
                    <Field label={t('bb.new.minutes')}>
                      <input type="number" inputMode="numeric" min={5} max={600} className="field" value={e.minutes} onChange={(ev) => setExam(e.id, { minutes: ev.target.value })} />
                    </Field>
                  </div>
                </fieldset>
              ))
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('bb.new.count')}>
                  <input type="number" inputMode="numeric" min={1} max={300} className="field" value={form.count} onChange={(e) => set('count')(e.target.value)} />
                </Field>
                <Field label={t('bb.new.minutes')}>
                  <input type="number" inputMode="numeric" min={5} max={600} className="field" value={form.minutes} onChange={(e) => set('minutes')(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-h2 text-ink">{t('bb.new.step_files')}</h2>
            <p className="text-body text-muted">{t('bb.new.files_hint')}</p>
            <p className="text-small text-muted">{t('bb.new.limits')}</p>
            <input ref={picker} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => addFiles([...(e.target.files ?? [])])} data-hook="new-files-input" />
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-ghost press w-auto px-6" onClick={() => picker.current?.click()} data-hook="new-pick">
                {t('bb.new.pick_files')}
              </button>
              <button type="button" className="btn-outline press w-auto px-6" onClick={() => setPaste(paste ? null : { text: '' })} aria-expanded={Boolean(paste)}>
                {t('bb.new.paste')}
              </button>
            </div>
            {refused.map((r) => (
              <Note key={r} tone="error">
                {r}
              </Note>
            ))}
            {paste && (
              <Field label={t('bb.new.paste_label')}>
                <textarea className="field min-h-[10rem]" value={paste.text} onChange={(e) => setPaste({ text: e.target.value })} maxLength={400000} />
              </Field>
            )}
            {files.length > 0 && (
              <ul className="space-y-2" data-hook="new-file-list">
                {files.map((f, i) => (
                  <li key={f.key} className="lg flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-small font-semibold text-ink">{f.file.name}</span>
                    <label className="flex items-center gap-2 text-small text-muted">
                      <span className="sr-only">{t('bb.new.kind')}</span>
                      <select
                        className="rounded-inner border border-ink/15 bg-surface px-2 py-1.5 text-small text-ink"
                        value={f.kind}
                        disabled={busy}
                        onChange={(e) => setFiles((list) => list.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {t(`bb.new.kind.${k}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {f.state === 'waiting' ? (
                      <button type="button" className={PILL_ROUND} onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} aria-label={t('bb.new.remove_file', { name: f.file.name })}>
                        ×
                      </button>
                    ) : (
                      <span className="text-small font-semibold text-ink" role="status">
                        {f.state === 'sending' ? t('bb.new.sending') : f.state === 'sent' ? `✓ ${t('bb.new.sent')}` : t('bb.proc.failed')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!files.length && !paste && <p className="text-small text-muted">{t('bb.new.no_files')}</p>}
          </div>
        )}

        {error && <Note tone="error" className="mt-5">{error}</Note>}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-end">
          <BigButton type="submit" disabled={!canGo || busy} data-hook="new-next" className="sm:w-auto sm:px-10">
            {busy ? t('bb.new.creating') : step < steps.length - 1 ? t('bb.onb.next') : t('bb.new.create')}
          </BigButton>
          {step > 0 && !busy && (
            <button type="button" className="btn-ghost press sm:w-auto sm:px-8" onClick={() => setStep(step - 1)}>
              {t('bb.onb.back')}
            </button>
          )}
        </div>
      </form>
    </Page>
  )
}
