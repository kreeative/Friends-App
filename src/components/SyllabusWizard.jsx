import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { clockOf, weekdayName } from '../lib/agenda'
import { dayKey, fromKey } from '../lib/cycle'
import {
  DEFAULT_AVAILABILITY,
  SESSION_LENGTHS,
  analyseSyllabus,
  dedupPlan,
  examRows,
  findGoal,
  goalPayload,
  pdfProblem,
  planStudy,
  sessionRows,
  stepRows,
  studyRows,
} from '../lib/syllabus'

/**
 * Un plan de cours en PDF, et ce qu'il devient sur le calendrier.
 *
 *   "est-ce que tu peux ajouter une option intelligente ou tu peux ajouter
 *    ton PDF de ton syllabus et ca va analyser pour te donner des events,
 *    des rappels de goals et des to-dos a propos de ton calendrier, et te
 *    demander une question de quand tu es disponible, comme ca ca peut
 *    planifier intelligemment comment tu vas etudier"
 *
 *   "comme certaines personnes auront deja ajoute des events, faire
 *    attention de ne pas les repeter"
 *
 * QUATRE ECRANS, DANS LA MEME FEUILLE QUE L'ASSISTANT D'HORAIRE.
 *
 *   pick    le fichier, et une ligne sur ce qu'on en fait
 *   review  ce que le modele a lu, en cases a cocher; ce qui est deja sur
 *           le calendrier arrive decoche et le dit
 *   when    la question: quels jours, quelle plage, combien de temps,
 *           combien par semaine
 *   plan    le compte de ce qui va s'ecrire, les seances d'etude jour par
 *           jour, et le bouton
 *
 * Rien ne s'ecrit avant le dernier bouton. Le modele propose, la personne
 * dispose, et la base recoit une seule fois.
 *
 * TOUT LE CALCUL EST DANS src/lib/syllabus.js, en pur et teste: ce
 * composant ne fait que tenir l'etat des cases et appeler.
 */

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

/* Les mots-codes que l'ecran sait traduire. Tout autre code devient
   "la lecture a echoue", plutot qu'une cle de traduction a l'ecran. */
const KNOWN_ERRORS = new Set([
  'not_pdf', 'too_big', 'no_key', 'setup', 'unauthorized', 'network', 'timeout',
  'refused', 'busy', 'model_failed', 'empty', 'term', 'nothing', 'db',
])

export default function SyllabusWizard({ open, onClose, onSaved, events = [], extras = [], steps = [] }) {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [stage, setStage] = useState('pick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [file, setFile] = useState(null)
  /* La cle de l'<input type=file>: sa valeur n'est pas controlable, donc
     le vider au reset passe par le remonter. */
  const [fileKey, setFileKey] = useState(0)
  const [plan, setPlan] = useState(null)
  const [course, setCourse] = useState('')
  const [term, setTerm] = useState({ from: '', until: '' })
  const [take, setTake] = useState(() => new Set())
  const [av, setAv] = useState(DEFAULT_AVAILABILITY)
  const [study, setStudy] = useState(null)
  const [note, setNote] = useState(null)
  /* Les objectifs actifs, pour retrouver la liste d'un cours deja importe
     et y ajouter plutot que d'en ouvrir une deuxieme. */
  const [goals, setGoals] = useState([])

  useEffect(() => {
    if (!open || !user) return undefined
    let alive = true
    supabase
      .from('goals')
      .select('id, commitment, due_on, status')
      .eq('status', 'active')
      .then(({ data }) => {
        if (alive) setGoals(data ?? [])
      })
    return () => {
      alive = false
    }
  }, [open, user])

  if (!open) return null

  const today = dayKey(new Date())
  const tag = localeTag(locale)
  const fmtDay = (iso) => {
    const d = fromKey(iso)
    return d ? new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short' }).format(d) : iso
  }
  const dayLetters = (days) => DAY_ORDER.filter((d) => days.includes(d)).map((d) => t(`cal.dow_${d}`)).join(' ')
  const fail = (code) => setError(t(`syl.err_${KNOWN_ERRORS.has(code) ? code : 'model_failed'}`))

  const reset = () => {
    setStage('pick')
    setBusy(false)
    setError(null)
    setFile(null)
    setFileKey((k) => k + 1)
    setPlan(null)
    setCourse('')
    setTerm({ from: '', until: '' })
    setTake(new Set())
    setAv(DEFAULT_AVAILABILITY)
    setStudy(null)
    setNote(null)
  }
  const close = () => {
    reset()
    onClose()
  }

  const chosenSessions = plan ? plan.sessions.filter((s) => take.has(s.id)) : []
  const chosenDeadlines = plan ? plan.deadlines.filter((d) => take.has(d.id)) : []
  const exams = examRows(chosenDeadlines, { userId: user?.id })
  const courseName = course.trim() || t('syl.course_fallback')
  const goalTitle = t('syl.goal_title', { course: courseName })
  const termNow = () => ({ from: term.from || null, until: term.until || null })

  const analyse = async () => {
    const problem = pdfProblem(file)
    if (problem) return fail(problem)
    setBusy(true)
    setError(null)
    const got = await analyseSyllabus(supabase, file, { locale, today })
    setBusy(false)
    if (got.error) return fail(got.error)
    if (!got.plan.sessions.length && !got.plan.deadlines.length) return fail('empty')

    /* Compare a ce que la page a deja charge: les regles du calendrier, les
       objectifs actifs et les etapes datees. C'est ici que "deja sur ton
       calendrier" se decide, avant d'afficher quoi que ce soit. */
    const deduped = dedupPlan(got.plan, { events, goals, steps })
    setPlan(deduped)
    setCourse(deduped.course ?? String(file.name ?? '').replace(/\.pdf$/i, ''))
    setTerm({ from: deduped.term.from ?? '', until: deduped.term.until ?? '' })
    setTake(
      new Set(
        [...deduped.sessions.filter((s) => !s.dup), ...deduped.deadlines.filter((d) => !d.dup && !d.past)].map((x) => x.id),
      ),
    )
    setNote(got.fallback ? t('syl.fallback_note') : null)
    setStage('review')
  }

  const toggle = (id) =>
    setTake((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toWhen = () => {
    setError(null)
    if (!chosenSessions.length && !chosenDeadlines.length) return fail('nothing')
    if (chosenSessions.length && !term.from) return fail('term')
    if (chosenDeadlines.some((d) => !d.past)) return setStage('when')
    setStudy({ blocks: [], unplaced: [] })
    setStage('plan')
  }

  const makePlan = (withStudy) => {
    setError(null)
    if (!withStudy) {
      setStudy({ blocks: [], unplaced: [] })
      return setStage('plan')
    }
    /* Occupe: tout ce qui a une heure sur le calendrier, plus les cours
       qu'on est en train d'ajouter. Un bloc d'etude ne se pose sur rien. */
    const taken = [...events, ...extras, ...sessionRows(chosenSessions, { userId: user.id, term: termNow(), today })]
    setStudy(planStudy(chosenDeadlines.filter((d) => !d.past), av, { today, busy: taken }))
    setStage('plan')
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const rows = [
      ...sessionRows(chosenSessions, { userId: user.id, term: termNow(), today }),
      ...exams,
      ...studyRows(study?.blocks ?? [], { userId: user.id, label: (what) => t('syl.study_title', { what }) }),
    ]
    let written = 0
    if (rows.length) {
      /* Un seul insert: tout arrive ou rien n'arrive. */
      const { error: err } = await supabase.from('calendar_event').insert(rows)
      if (err) {
        setBusy(false)
        return setError(err.message)
      }
      written = rows.length
    }

    let stepsWritten = 0
    if (chosenDeadlines.length) {
      let goal = findGoal(goals, goalTitle) ?? findGoal(goals, courseName)
      let offset = 0
      if (goal) {
        const { count } = await supabase.from('goal_step').select('id', { count: 'exact', head: true }).eq('goal_id', goal.id)
        offset = count ?? 0
      } else {
        const { data, error: err } = await supabase
          .from('goals')
          .insert(goalPayload({ userId: user.id, title: goalTitle, deadlines: chosenDeadlines, today }))
          .select('id')
          .single()
        if (err || !data?.id) {
          setBusy(false)
          return setError(err?.message ?? t('syl.err_db'))
        }
        goal = data
      }
      const srows = stepRows(chosenDeadlines, { goalId: goal.id, offset })
      const { error: err } = await supabase.from('goal_step').insert(srows)
      if (err) {
        setBusy(false)
        return setError(err.message)
      }
      stepsWritten = srows.length
    }

    setBusy(false)
    reset()
    await onSaved({ events: written, steps: stepsWritten })
  }

  const Label = ({ children }) => (
    <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{children}</span>
  )

  const Pill = ({ hook, children }) => (
    <span data-hook={hook} className="mt-1 inline-block rounded-pill bg-ink/[0.06] px-2 py-0.5 text-label font-semibold text-ink">
      {children}
    </span>
  )

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-hook="syl">
      <button type="button" aria-label={t('wiz.close')} onClick={close} className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('syl.title')}
        data-stage={stage}
        className="lg lg-modal relative m-2 flex max-h-[92dvh] w-[min(52rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-safe text-h2 font-semibold text-ink">{t('syl.title')}</h2>
            <p className="text-safe mt-0.5 text-small text-muted">{t(`syl.help_${stage}`)}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('wiz.close')}
            data-hook="syl-close"
            className="press -mr-1 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            &#215;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {stage === 'pick' && (
            <>
              <label className="block">
                <Label>{t('syl.file')}</Label>
                <input
                  key={fileKey}
                  type="file"
                  accept="application/pdf,.pdf"
                  data-hook="syl-file"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null)
                    setError(null)
                  }}
                  className="field mt-1 w-full"
                />
              </label>
              <p className="text-safe mt-2 text-small text-muted">{t('syl.privacy')}</p>
              {busy && (
                <p role="status" data-hook="syl-reading" className="text-safe mt-3 text-small font-semibold text-ink">
                  {t('syl.reading')}
                </p>
              )}
            </>
          )}

          {stage === 'review' && plan && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <Label>{t('syl.course')}</Label>
                  <input
                    value={course}
                    maxLength={120}
                    data-hook="syl-course"
                    onChange={(e) => setCourse(e.target.value)}
                    className="field mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <Label>{t('wiz.term_from')}</Label>
                  <input
                    type="date"
                    value={term.from}
                    data-hook="syl-from"
                    onChange={(e) => setTerm((s) => ({ ...s, from: e.target.value }))}
                    className="field mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <Label>{t('wiz.term_until')}</Label>
                  <input
                    type="date"
                    value={term.until}
                    data-hook="syl-until"
                    onChange={(e) => setTerm((s) => ({ ...s, until: e.target.value }))}
                    className="field mt-1 w-full"
                  />
                </label>
              </div>
              {note && (
                <p className="text-safe mt-2 text-small text-muted" data-hook="syl-note">
                  {note}
                </p>
              )}

              <h3 className="mt-4 text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('syl.sessions')}</h3>
              {plan.sessions.length === 0 ? (
                <p className="text-safe mt-1 text-small text-muted">{t('syl.none_sessions')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {plan.sessions.map((s) => (
                    <li
                      key={s.id}
                      data-hook="syl-session"
                      data-id={s.id}
                      data-dup={s.dup ? '1' : '0'}
                      data-on={take.has(s.id) ? '1' : '0'}
                      className="rounded-card border border-hairline bg-[rgb(var(--glass-tint))] p-3 shadow-raised"
                    >
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={take.has(s.id)}
                          onChange={() => toggle(s.id)}
                          data-hook="syl-take"
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-safe block font-semibold text-ink">{s.title}</span>
                          <span className="text-safe block text-small text-muted">
                            {dayLetters(s.weekdays)}
                            {s.start ? ` · ${s.start} - ${s.end}` : ''}
                            {s.location ? ` · ${s.location}` : ''}
                          </span>
                          {s.dup && <Pill hook="syl-dup">{t('syl.dup')}</Pill>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-4 text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('syl.deadlines')}</h3>
              {plan.deadlines.length === 0 ? (
                <p className="text-safe mt-1 text-small text-muted">{t('syl.none_deadlines')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {plan.deadlines.map((d) => (
                    <li
                      key={d.id}
                      data-hook="syl-deadline"
                      data-id={d.id}
                      data-dup={d.dup ? '1' : '0'}
                      data-on={take.has(d.id) ? '1' : '0'}
                      className="rounded-card border border-hairline bg-[rgb(var(--glass-tint))] p-3 shadow-raised"
                    >
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={take.has(d.id)}
                          onChange={() => toggle(d.id)}
                          data-hook="syl-take"
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-safe block font-semibold text-ink">{d.title}</span>
                          <span className="text-safe block text-small text-muted">
                            {t(`syl.kind_${d.kind}`)}
                            {` · ${fmtDay(d.due_on)}`}
                            {d.at ? ` ${d.at}` : ''}
                            {d.weight ? ` · ${t('syl.weight', { n: d.weight })}` : ''}
                          </span>
                          {d.dup && <Pill hook="syl-dup">{t('syl.dup')}</Pill>}
                          {!d.dup && d.past && <Pill hook="syl-past">{t('syl.past')}</Pill>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {stage === 'when' && (
            <>
              <Label>{t('syl.av_days')}</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DAY_ORDER.map((d) => {
                  const on = av.weekdays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={weekdayName(d, tag)}
                      data-hook="syl-day"
                      data-day={d}
                      onClick={() =>
                        setAv((a) => ({ ...a, weekdays: on ? a.weekdays.filter((x) => x !== d) : [...a.weekdays, d] }))
                      }
                      className={`press h-8 w-8 rounded-pill text-small font-semibold transition-colors ${
                        on ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                      }`}
                    >
                      {t(`cal.dow_${d}`)}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="block">
                  <Label>{t('syl.av_from')}</Label>
                  <input
                    type="time"
                    value={av.start}
                    data-hook="syl-av-start"
                    onChange={(e) => setAv((a) => ({ ...a, start: e.target.value }))}
                    className="field mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <Label>{t('syl.av_to')}</Label>
                  <input
                    type="time"
                    value={av.end}
                    data-hook="syl-av-end"
                    onChange={(e) => setAv((a) => ({ ...a, end: e.target.value }))}
                    className="field mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <Label>{t('syl.av_len')}</Label>
                  <select
                    value={av.minutes}
                    data-hook="syl-av-len"
                    onChange={(e) => setAv((a) => ({ ...a, minutes: Number(e.target.value) }))}
                    className="field mt-1 w-full"
                  >
                    {SESSION_LENGTHS.map((m) => (
                      <option key={m} value={m}>
                        {t('syl.min', { n: m })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <Label>{t('syl.av_week')}</Label>
                  <select
                    value={av.perWeek}
                    data-hook="syl-av-week"
                    onChange={(e) => setAv((a) => ({ ...a, perWeek: Number(e.target.value) }))}
                    className="field mt-1 w-full"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {stage === 'plan' && study && (
            <>
              <ul className="space-y-1 text-small text-ink" data-hook="syl-summary">
                {chosenSessions.length > 0 && (
                  <li data-hook="syl-sum-sessions">
                    {t(chosenSessions.length === 1 ? 'syl.sum_sessions_one' : 'syl.sum_sessions_other', { n: chosenSessions.length })}
                  </li>
                )}
                {exams.length > 0 && (
                  <li data-hook="syl-sum-exams">{t(exams.length === 1 ? 'syl.sum_exams_one' : 'syl.sum_exams_other', { n: exams.length })}</li>
                )}
                {chosenDeadlines.length > 0 && (
                  <li data-hook="syl-sum-steps">
                    {t(chosenDeadlines.length === 1 ? 'syl.sum_steps_one' : 'syl.sum_steps_other', {
                      n: chosenDeadlines.length,
                      what: goalTitle,
                    })}
                  </li>
                )}
                <li data-hook="syl-sum-study">
                  {t(study.blocks.length === 1 ? 'syl.sum_study_one' : 'syl.sum_study_other', { n: study.blocks.length })}
                </li>
              </ul>

              {study.blocks.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {study.blocks.map((b) => (
                    <li key={b.id} data-hook="syl-block" className="flex flex-wrap items-baseline gap-x-2 text-small">
                      <span className="font-semibold text-ink">{fmtDay(b.starts_on)}</span>
                      <span className="text-muted">
                        {clockOf(b.start_min)} - {clockOf(b.end_min)}
                      </span>
                      <span className="text-safe min-w-0 text-ink">{t('syl.study_title', { what: b.title })}</span>
                    </li>
                  ))}
                </ul>
              )}

              {study.unplaced.length > 0 && (
                <p data-hook="syl-unplaced" className="text-safe mt-3 text-small font-semibold text-ink">
                  {t('syl.unplaced', { what: study.unplaced.map((u) => u.title).join(', ') })}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4">
          {stage === 'pick' && (
            <button type="button" onClick={analyse} disabled={!file || busy} className="goal-action-done press" data-hook="syl-analyse">
              {busy ? t('syl.reading_short') : t('syl.analyse')}
            </button>
          )}
          {stage === 'review' && (
            <>
              <button type="button" onClick={toWhen} className="goal-action-done press" data-hook="syl-next">
                {t('syl.next')}
              </button>
              <button type="button" onClick={() => setStage('pick')} className="goal-action-soft press" data-hook="syl-back">
                {t('syl.back')}
              </button>
            </>
          )}
          {stage === 'when' && (
            <>
              <button type="button" onClick={() => makePlan(true)} className="goal-action-done press" data-hook="syl-plan">
                {t('syl.plan')}
              </button>
              <button type="button" onClick={() => makePlan(false)} className="goal-action-soft press" data-hook="syl-skip">
                {t('syl.skip_plan')}
              </button>
              <button type="button" onClick={() => setStage('review')} className="goal-action-soft press" data-hook="syl-back">
                {t('syl.back')}
              </button>
            </>
          )}
          {stage === 'plan' && (
            <>
              <button type="button" onClick={save} disabled={busy} className="goal-action-done press" data-hook="syl-save">
                {busy ? t('cal.saving') : t('syl.save')}
              </button>
              <button
                type="button"
                onClick={() => setStage(chosenDeadlines.some((d) => !d.past) ? 'when' : 'review')}
                className="goal-action-soft press"
                data-hook="syl-back"
              >
                {t('syl.back')}
              </button>
            </>
          )}
          <button type="button" onClick={close} className="goal-action-soft press">
            {t('cal.cancel')}
          </button>
          {error && (
            <p className="text-safe w-full text-small text-negative" role="alert" data-hook="syl-error">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
