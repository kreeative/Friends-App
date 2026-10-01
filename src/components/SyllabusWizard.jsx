import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { clockOf, weekdayName } from '../lib/agenda'
import { addDays, dayKey, fromKey } from '../lib/cycle'
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
  studyGoalPayload,
  studyRows,
  studyStepRows,
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
 * QUATRE ECRANS, DANS LA MEME FEUILLE QUE L'ASSISTANT D'HORAIRE, ET UN
 * FIL D'ETAPES SOUS LE TITRE POUR SAVOIR OU L'ON EST.
 *
 *   pick    le fichier, dans une zone de depot, et une ligne sur ce qu'on
 *           en fait; pendant la lecture, une barre qui avance
 *   review  ce que le modele a lu, en cases a cocher; ce qui est deja sur
 *           le calendrier arrive decoche et le dit
 *   when    la question: quels jours, quelle plage, combien de temps,
 *           combien par semaine
 *   plan    le compte de ce qui va s'ecrire, les seances d'etude semaine
 *           par semaine, et le bouton
 *
 * Rien ne s'ecrit avant le dernier bouton. Le modele propose, la personne
 * dispose, et la base recoit une seule fois.
 *
 * TOUT LE CALCUL EST DANS src/lib/syllabus.js, en pur et teste: ce
 * composant ne fait que tenir l'etat des cases et appeler.
 */

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const STAGES = ['pick', 'review', 'when', 'plan']
/* Ce qui va sur la grille comme un examen porte sa couleur d'examen. */
const ON_GRID = new Set(['exam', 'quiz'])

/* Les mots-codes que l'ecran sait traduire. Tout autre code devient
   "la lecture a echoue", plutot qu'une cle de traduction a l'ecran. */
const KNOWN_ERRORS = new Set([
  'not_pdf', 'too_big', 'no_key', 'no_workspace', 'key_format', 'setup', 'unauthorized', 'network', 'timeout',
  'refused', 'busy', 'model_failed', 'empty', 'term', 'nothing', 'db',
])

/* Hors du composant: un composant defini dans le rendu est remonte a
   chaque rendu, et un champ dedans perdrait son focus. */
function Label({ children }) {
  return <span className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{children}</span>
}

function Pill({ hook, tone = 'plain', children }) {
  const fill = tone === 'exam' ? 'bg-ev-examen text-ink' : 'bg-ink/[0.06] text-ink'
  return (
    <span data-hook={hook} className={`inline-block rounded-pill px-2 py-0.5 text-label font-semibold ${fill}`}>
      {children}
    </span>
  )
}

/**
 * Le fil des quatre etapes. Le numero et le libelle disent ou l'on est;
 * la couleur le repete sans etre le seul signal (aria-current, graisse).
 */
function Stepper({ stage, t }) {
  const at = STAGES.indexOf(stage)
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-y-1" data-hook="syl-steps" data-step={at + 1} aria-label={t('syl.steps_aria')}>
      {STAGES.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'next'
        return (
          <li key={s} className="flex items-center" aria-current={state === 'now' ? 'step' : undefined}>
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-pill text-label font-semibold ${
                state === 'now' ? 'bg-accent text-on-accent' : state === 'done' ? 'bg-ink text-on-accent' : 'bg-ink/[0.08] text-ink'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            {/* Sur un telephone, seul le libelle de l'etape courante est
                ecrit: quatre libelles et trois traits passaient a la ligne
                a 390, et une etape sur deux lignes se lit comme cinq. */}
            <span className={`ml-1.5 text-label font-semibold ${state === 'now' ? 'text-ink' : 'hidden text-muted sm:inline'}`}>
              {t(`syl.step_${s}`)}
            </span>
            {i < STAGES.length - 1 && <span aria-hidden="true" className="mx-2 h-px w-4 bg-ink/20" />}
          </li>
        )
      })}
    </ol>
  )
}

export default function SyllabusWizard({ open, onClose, onSaved, events = [], extras = [], steps = [] }) {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [stage, setStage] = useState('pick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [file, setFile] = useState(null)
  const [over, setOver] = useState(false)
  /* La cle de l'<input type=file>: sa valeur n'est pas controlable, donc
     le vider passe par le remonter. */
  const [fileKey, setFileKey] = useState(0)
  const inputRef = useRef(null)
  const inputId = useId()
  const [plan, setPlan] = useState(null)
  const [course, setCourse] = useState('')
  const [term, setTerm] = useState({ from: '', until: '' })
  const [take, setTake] = useState(() => new Set())
  const [av, setAv] = useState(DEFAULT_AVAILABILITY)
  const [study, setStudy] = useState(null)
  /* Ce que le plan d'etude devient en plus des blocs: un objectif recurrent
     (oui par defaut, c'est ce qui fait qu'on y va), et les seances en
     etapes de la liste a cocher (sur demande). */
  const [optGoal, setOptGoal] = useState(true)
  const [optSteps, setOptSteps] = useState(false)
  const [note, setNote] = useState(null)
  /* Les objectifs actifs, pour retrouver la liste d'un cours deja importe
     et y ajouter plutot que d'en ouvrir une deuxieme. */
  const [goals, setGoals] = useState([])

  useEffect(() => {
    if (!open || !user) return undefined
    let alive = true
    supabase
      .from('goals')
      .select('id, commitment, due_on, status, cadence')
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
  const fmtShort = (iso) => {
    const d = fromKey(iso)
    return d ? new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric' }).format(d) : iso
  }
  /* "Tue, Thu" et pas "T T": deux jours sur la meme lettre ne se lisent pas. */
  const dayNames = (days) =>
    DAY_ORDER.filter((d) => days.includes(d))
      .map((d) => new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(1970, 0, 4 + d))))
      .join(', ')
  const mondayOf = (iso) => {
    const d = fromKey(iso)
    return d ? dayKey(addDays(d, -((d.getDay() + 6) % 7))) : iso
  }
  /* La phrase traduite, et dessous, quand le serveur en a une, la phrase
     brute de l'API: c'est elle qu'on colle dans un message pour se faire
     aider, et sans elle huit essais ont dit la meme chose. */
  const fail = (code, detail = null) => {
    setError(t(`syl.err_${KNOWN_ERRORS.has(code) ? code : 'model_failed'}`))
    setDetail(detail || null)
  }

  const pick = (f) => {
    setFile(f ?? null)
    setError(null)
    setDetail(null)
    if (!f) setFileKey((k) => k + 1)
  }

  const reset = () => {
    setStage('pick')
    setBusy(false)
    setError(null)
    setDetail(null)
    setFile(null)
    setOver(false)
    setFileKey((k) => k + 1)
    setPlan(null)
    setCourse('')
    setTerm({ from: '', until: '' })
    setTake(new Set())
    setAv(DEFAULT_AVAILABILITY)
    setStudy(null)
    setOptGoal(true)
    setOptSteps(false)
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
    if (got.error) return fail(got.error, got.detail)
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
    setNote(got.strict === false ? t('syl.loose_note') : null)
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
    const blocks = study?.blocks ?? []
    const studyLabel = (what) => t('syl.study_title', { what })
    const rows = [
      ...sessionRows(chosenSessions, { userId: user.id, term: termNow(), today }),
      ...exams,
      /* Les seances vont sur la grille comme blocs, OU dans la liste comme
         etapes datees (qui passent sur la grille par la liste): jamais les
         deux, rien n'est ajoute deux fois. */
      ...(optSteps ? [] : studyRows(blocks, { userId: user.id, label: studyLabel })),
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
    let goalsWritten = 0
    if (chosenDeadlines.length || (optSteps && blocks.length)) {
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
        goalsWritten += 1
      }
      const dated = stepRows(chosenDeadlines, { goalId: goal.id, offset })
      const sessions = optSteps ? studyStepRows(blocks, { goalId: goal.id, offset: offset + dated.length, label: studyLabel }) : []
      const srows = [...dated, ...sessions]
      if (srows.length) {
        const { error: err } = await supabase.from('goal_step').insert(srows)
        if (err) {
          setBusy(false)
          return setError(err.message)
        }
        stepsWritten = srows.length
      }
    }

    /* L'objectif d'etude: recurrent, aux jours et a la cadence dits, avec le
       rappel a l'heure de la fenetre. Pas deux fois pour le meme cours: le
       titre exact et la cadence le retrouvent, sans la tolerance de
       sameTitle, qui prendrait la liste a cocher du cours pour lui. */
    if (optGoal && blocks.length) {
      const title = t('syl.study_goal', { course: courseName })
      const already = goals.some((g) => g?.cadence === 'recurring' && g.commitment === title)
      if (!already) {
        const { error: err } = await supabase
          .from('goals')
          .insert(studyGoalPayload({ userId: user.id, title, availability: av, blocks, deadlines: chosenDeadlines, today }))
        if (err) {
          setBusy(false)
          return setError(err.message)
        }
        goalsWritten += 1
      }
    }

    setBusy(false)
    reset()
    await onSaved({ events: written, steps: stepsWritten, goals: goalsWritten })
  }

  /* Les seances d'etude, par semaine, pour se lire comme un agenda. */
  const weeks = []
  for (const b of study?.blocks ?? []) {
    const wk = mondayOf(b.starts_on)
    const last = weeks.at(-1)
    if (last && last[0] === wk) last[1].push(b)
    else weeks.push([wk, [b]])
  }

  const rowClass = 'rounded-card border border-hairline bg-[rgb(var(--glass-tint))] p-3 shadow-raised'
  const boxClass = 'mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]'

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
        <div className="border-b border-hairline px-5 py-4">
          <div className="flex items-start justify-between gap-3">
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
          <Stepper stage={stage} t={t} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {stage === 'pick' && (
            <>
              {/* Une zone de depot plutot qu'un <input type=file> nu: le
                  bouton natif est le seul element de l'application qui a
                  l'air du navigateur et pas de l'application. Le champ
                  reste, invisible, pour le clavier et les lecteurs. */}
              <div
                data-hook="syl-drop"
                data-over={over ? '1' : '0'}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(false)
                  if (!busy) pick(e.dataTransfer?.files?.[0] ?? null)
                }}
                className={`rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  over ? 'border-accent bg-accent/10' : 'border-ink/20 bg-[rgb(var(--glass-tint))]'
                }`}
              >
                <input
                  ref={inputRef}
                  id={inputId}
                  key={fileKey}
                  type="file"
                  accept="application/pdf,.pdf"
                  data-hook="syl-file"
                  disabled={busy}
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2" data-hook="syl-file-name">
                    <span className="text-safe min-w-0 truncate font-semibold text-ink">{file.name}</span>
                    <span className="shrink-0 text-small text-muted">{t('syl.kb', { n: Math.max(1, Math.round(file.size / 1024)) })}</span>
                    {!busy && (
                      <button
                        type="button"
                        onClick={() => pick(null)}
                        aria-label={t('syl.clear_file')}
                        data-hook="syl-file-clear"
                        className="press h-8 w-8 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
                      >
                        &#215;
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => inputRef.current?.click()} className="goal-action-soft press" data-hook="syl-choose">
                      {t('syl.choose')}
                    </button>
                    <p className="mt-2 text-small text-muted">{t('syl.drop')}</p>
                  </>
                )}
              </div>
              <p className="text-safe mt-2 text-small text-muted">{t('syl.privacy')}</p>
              {busy && (
                <div className="mt-4" role="status" data-hook="syl-reading">
                  <div className="bar-busy" aria-hidden="true" />
                  <p className="text-safe mt-2 text-small font-semibold text-ink">{t('syl.reading')}</p>
                </div>
              )}
            </>
          )}

          {stage === 'review' && plan && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="col-span-2 block sm:col-span-1">
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
                  <Label>{t('syl.term_from')}</Label>
                  <input
                    type="date"
                    value={term.from}
                    data-hook="syl-from"
                    onChange={(e) => setTerm((s) => ({ ...s, from: e.target.value }))}
                    className="field mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <Label>{t('syl.term_until')}</Label>
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

              <h3 className="mt-5 text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('syl.sessions')}</h3>
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
                      className={rowClass}
                    >
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={take.has(s.id)} onChange={() => toggle(s.id)} data-hook="syl-take" className={boxClass} />
                        <span className="min-w-0 flex-1">
                          <span className="text-safe block font-semibold text-ink">{s.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
                            <span>{dayNames(s.weekdays)}</span>
                            {s.start && <span className="tabular-nums">{s.start} - {s.end}</span>}
                            {s.location && <span>{s.location}</span>}
                            {s.dup && <Pill hook="syl-dup">{t('syl.dup')}</Pill>}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('syl.deadlines')}</h3>
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
                      className={rowClass}
                    >
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={take.has(d.id)} onChange={() => toggle(d.id)} data-hook="syl-take" className={boxClass} />
                        <span className="min-w-0 flex-1">
                          <span className="text-safe block font-semibold text-ink">{d.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
                            <Pill hook="syl-kind" tone={ON_GRID.has(d.kind) ? 'exam' : 'plain'}>{t(`syl.kind_${d.kind}`)}</Pill>
                            <span className="tabular-nums">
                              {fmtDay(d.due_on)}
                              {d.at ? `, ${d.at}` : ''}
                            </span>
                            {d.weight ? <span>{t('syl.weight', { n: d.weight })}</span> : null}
                            {d.dup && <Pill hook="syl-dup">{t('syl.dup')}</Pill>}
                            {!d.dup && d.past && <Pill hook="syl-past">{t('syl.past')}</Pill>}
                          </span>
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
              <h3 className="text-safe text-h2 font-semibold text-ink">{t('syl.av_days')}</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
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
                      className={`press h-9 w-9 rounded-pill text-small font-semibold transition-colors ${
                        on ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                      }`}
                    >
                      {t(`cal.dow_${d}`)}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <ul className={`${rowClass} space-y-1 text-small text-ink`} data-hook="syl-summary">
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
                  {optSteps
                    ? t(study.blocks.length === 1 ? 'syl.sum_study_todo_one' : 'syl.sum_study_todo_other', { n: study.blocks.length })
                    : t(study.blocks.length === 1 ? 'syl.sum_study_one' : 'syl.sum_study_other', { n: study.blocks.length })}
                </li>
                {optGoal && study.blocks.length > 0 && (
                  <li data-hook="syl-sum-goal">{t('syl.sum_goal', { n: av.perWeek, days: dayNames(av.weekdays) })}</li>
                )}
              </ul>

              {/* Ce que le plan devient en plus des blocs. Un plan que personne
                  ne voit est un plan qui glisse: l'objectif est coche par
                  defaut, les seances dans la liste sont a la demande. */}
              {study.blocks.length > 0 && (
                <div className={`${rowClass} mt-3 grid gap-3`} data-hook="syl-options">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={optGoal} onChange={(e) => setOptGoal(e.target.checked)} data-hook="syl-opt-goal" className={boxClass} />
                    <span className="text-safe min-w-0 flex-1 text-small text-ink">
                      {t('syl.opt_goal', { n: av.perWeek, days: dayNames(av.weekdays), at: av.start })}
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={optSteps} onChange={(e) => setOptSteps(e.target.checked)} data-hook="syl-opt-steps" className={boxClass} />
                    <span className="text-safe min-w-0 flex-1 text-small text-ink">{t('syl.opt_steps')}</span>
                  </label>
                </div>
              )}

              {weeks.map(([wk, list]) => (
                <section key={wk} className="mt-4" data-hook="syl-week">
                  <h3 className="text-label font-semibold uppercase tracking-[0.06em] text-muted">{t('syl.week_of', { date: fmtDay(wk) })}</h3>
                  <ul className="mt-1.5 space-y-1.5">
                    {list.map((b) => (
                      <li key={b.id} data-hook="syl-block" className="flex flex-wrap items-baseline gap-x-2 text-small">
                        <span className="w-16 shrink-0 font-semibold text-ink">{fmtShort(b.starts_on)}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {clockOf(b.start_min)} - {clockOf(b.end_min)}
                        </span>
                        <span className="text-safe min-w-0 text-ink">{t('syl.study_title', { what: b.title })}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {study.unplaced.length > 0 && (
                <p data-hook="syl-unplaced" className="text-safe mt-4 text-small font-semibold text-ink">
                  {t('syl.unplaced', { what: study.unplaced.map((u) => u.title).join(', ') })}
                </p>
              )}
            </>
          )}
        </div>

        {/* Le pied: l'action, puis Retour. Le x du haut ferme; un Annuler
            de plus a chaque etape faisait quatre boutons sur deux lignes. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4">
          {stage === 'pick' && (
            <>
              <button type="button" onClick={analyse} disabled={!file || busy} className="goal-action-done press" data-hook="syl-analyse">
                {busy ? t('syl.reading_short') : t('syl.analyse')}
              </button>
              <button type="button" onClick={close} className="goal-action-soft press">
                {t('cal.cancel')}
              </button>
            </>
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
          {error && (
            <p className="text-safe w-full text-small text-negative" role="alert" data-hook="syl-error">
              {error}
              {detail && (
                <span className="mt-1 block break-words font-mono text-label text-muted" data-hook="syl-detail">
                  {detail}
                </span>
              )}
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
