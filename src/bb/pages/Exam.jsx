import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT, localeTag } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { MARKED, MIN_EXAM, clock, examShape, pickExam, scoreExam, secondsLeft } from '../../lib/bb/exam'
import { answerRows } from '../../lib/bb/answer'
import { retentionFor } from '../../lib/bb/fsrs'
import { daysUntil } from '../../lib/bb/days'
import { endExam, loadCourse, loadExams, loadStudy, saveAnswer, saveExamAnswers, startExam } from '../data'
import { Anchors, Bar, BigButton, Note, Outside, anchorMaps } from '../kit'
import { Spinner } from '../course/Processing'

/**
 * /bb/examen/:id, the timed mock exam (section 6, phase 2).
 *
 *   Follows the blueprint: counts, time limit, chapter weights. Results by
 *   chapter and by Bloom level, and a review of every miss. Feeds the
 *   Mistake log and the plan.
 *
 * EXAM CONDITIONS. The questions, a clock and nothing else: no confidence
 * picker, no feedback until the paper is handed in, the chapters not
 * announced. Built from verified questions the app marks itself, so a mock
 * exam costs no AI call (src/lib/bb/exam.js).
 *
 * NOTHING IS LOST. The exam row is written when it starts and every answer
 * is saved to it as it is picked, so a reload, a dead battery or a closed
 * tab resumes on the same questions with the clock still running. When time
 * is up the paper is handed in as it stands, here or on the next visit.
 *
 * AFTERWARDS each answer goes through answerRows like any other: the FSRS
 * schedule moves and every wrong answer enters the Mistake log with the trap
 * behind the option picked. A question left blank is counted wrong and
 * shown in the review, but not written as an answer: there was none.
 *
 * LAYOUT: one column on a phone, the clock and the hand-in in a bar at the
 * bottom; from lg the question on the left, the grid of numbers on the
 * right (.pane-grid in spirit, like the session).
 */
const BLOOM = { 1: 'remember', 2: 'understand', 3: 'apply', 4: 'analyse', 5: 'evaluate', 6: 'create' }

export default function Exam() {
  const { id } = useParams()
  const { t, locale } = useT()
  const { user } = useAuth()
  usePageMeta({ title: `${t('bb.mock.title')} · Beauty & Brain` })

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [size, setSize] = useState('full')
  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState(() => new Set())
  const [at, setAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const handedIn = useRef(false)
  const pending = useRef(null)
  const questionRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [course, study, exams] = await Promise.all([loadCourse(id), loadStudy(id), loadExams(id)])
      if (!course.course) return setError('missing')
      const byId = new Map(study.items.map((i) => [i.id, i]))
      const lastSeen = new Map()
      for (const r of study.reviews) lastSeen.set(r.item_id, r.created_at)
      setData({ ...course, ...study, byId, lastSeen, exams, maps: anchorMaps(course.anchors, course.materials) })
      const open = exams.find((e) => !e.ended_at && (e.item_ids ?? []).every((x) => byId.has(x)))
      if (open) {
        setExam(open)
        setAnswers(open.answers ?? {})
      }
    } catch {
      setError('load')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const format = useMemo(() => ({ ...(data?.course?.exam_format ?? {}), ...(data?.blueprint?.data ?? {}) }), [data])
  const available = useMemo(() => (data ? data.items.filter((i) => MARKED.has(i.type) && !i.variant_of).length : 0), [data])
  const shapes = useMemo(() => {
    const full = examShape(format, available)
    const n = Math.min(10, full.count)
    return { full, short: { count: n, minutes: Math.max(5, Math.round((full.minutes * n) / full.count)) } }
  }, [format, available])

  const items = useMemo(() => (exam && data ? (exam.item_ids ?? []).map((x) => data.byId.get(x)).filter(Boolean) : []), [exam, data])
  const running = Boolean(exam && !exam.ended_at && !result)
  const left = running ? secondsLeft(exam.started_at, exam.minutes, now) : 0

  useEffect(() => {
    if (!running) return undefined
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [running])

  /* Every pick saved to the exam row, a moment after the last one. */
  useEffect(() => {
    if (!running) return undefined
    clearTimeout(pending.current)
    pending.current = setTimeout(() => saveExamAnswers(exam.id, answers).catch(() => {}), 700)
    return () => clearTimeout(pending.current)
  }, [answers, running, exam?.id])

  const handIn = useCallback(async () => {
    if (!exam || handedIn.current) return
    handedIn.current = true
    clearTimeout(pending.current)
    setConfirm(false)
    const scored = scoreExam({ items, answers, chapters: data.chapters })
    setResult(scored)
    const given = items.filter((i) => answers[i.id] != null)
    setSaving({ done: 0, of: given.length })
    const schedule = new Map(data.schedule.map((s) => [s.item_id, s]))
    const mistakes = new Map(data.mistakes.map((m) => [m.item_id, m]))
    const weight = new Map(data.concepts.map((c) => [c.id, c.weight]))
    const daysLeft = daysUntil(data.course.exam_at)
    let done = 0
    for (const item of given) {
      const rows = answerRows({
        item,
        card: schedule.get(item.id) ?? null,
        choice: answers[item.id],
        mistake: mistakes.get(item.id) ?? null,
        mode: 'mock',
        retention: retentionFor({ weight: weight.get(item.concept_id), daysLeft }),
      })
      try {
        await saveAnswer(user.id, { schedule: rows.schedule, answer: rows.answer, mistake: rows.mistake })
      } catch {
        /* kept in the offline queue by saveAnswer when it can be */
      }
      done += 1
      setSaving({ done, of: given.length })
    }
    try {
      const row = await endExam(exam.id, {
        answers,
        score: scored.score,
        total: scored.total,
        by_chapter: scored.byChapter.map(({ chapter_id, title, right, total, pct }) => ({ chapter_id, title, right, total, pct })),
        by_bloom: scored.byBloom,
      })
      setExam(row)
    } catch {
      /* the result is on screen; the row is closed on the next visit */
    }
    setSaving(null)
  }, [exam, items, answers, data, user?.id])

  /* Time is up: the paper goes in as it stands. */
  useEffect(() => {
    if (running && left === 0 && items.length) handIn()
  }, [running, left, items.length, handIn])

  async function begin() {
    const shape = shapes[size]
    const picked = pickExam({ items: data.items, concepts: data.concepts, chapters: data.chapters, count: shape.count, seed: Date.now(), lastSeen: data.lastSeen })
    if (!picked.length) return
    try {
      const row = await startExam({ courseId: id, minutes: shape.minutes, itemIds: picked.map((i) => i.id) })
      handedIn.current = false
      setAnswers({})
      setFlags(new Set())
      setAt(0)
      setResult(null)
      setNow(Date.now())
      setExam(row)
    } catch {
      setError('start')
    }
  }

  /* A new question takes the focus, so a screen reader reads it and the
     focus ring does not sit on an option of the next one as if picked. */
  const moved = useRef(false)
  useEffect(() => {
    if (!running) return
    if (moved.current) questionRef.current?.focus({ preventScroll: true })
    moved.current = true
  }, [at, running])

  /* Keyboard: A to D answer, arrows move, F flags. */
  const item = items[at] ?? null
  useEffect(() => {
    if (!running || !item) return undefined
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const pick = ['a', 'b', 'c', 'd', 'e', 'f'].indexOf(k)
      if (pick >= 0 && pick < (item.options ?? []).length && k !== 'f') {
        e.preventDefault()
        setAnswers((a) => ({ ...a, [item.id]: pick }))
      } else if (k === 'arrowright') setAt((n) => Math.min(items.length - 1, n + 1))
      else if (k === 'arrowleft') setAt((n) => Math.max(0, n - 1))
      else if (k === 'f') {
        e.preventDefault()
        setFlags((f) => {
          const next = new Set(f)
          if (next.has(item.id)) next.delete(item.id)
          else next.add(item.id)
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, item, items.length])

  /* --- screens --------------------------------------------------------------- */

  const answeredCount = items.filter((i) => answers[i.id] != null).length
  const top = (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="lg lg-chrome mx-auto flex w-full max-w-[72rem] items-center gap-3 px-3 py-2.5">
        <Link to={`/bb/cours/${id}/examen`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink" aria-label={t('bb.mock.leave')} data-hook="bb-exam-leave">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <p className="min-w-0 flex-1 truncate text-small font-semibold text-ink">{data?.course?.name ?? t('bb.mock.title')}</p>
        {running && (
          <p className={`shrink-0 rounded-pill px-3 py-1 text-small font-bold tabular-nums text-ink ${left <= 300 ? 'bg-[#FFE3F0]' : 'bg-[#F4F4F5]'}`} data-hook="bb-exam-clock" aria-live={left <= 60 ? 'polite' : 'off'}>
            ⏱ {clock(left)}
            {left <= 300 && <span className="sr-only"> {t('bb.mock.hurry')}</span>}
          </p>
        )}
      </div>
    </header>
  )

  if (error) {
    return (
      <Shell top={top}>
        <Note tone="error">{error === 'missing' ? t('bb.course.not_found') : t('bb.err.generic')}</Note>
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell top={top}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
      </Shell>
    )
  }

  /* Results ------------------------------------------------------------------ */
  if (result) {
    const wrongGiven = result.misses.filter((m) => m.given != null).length
    return (
      <Shell top={top}>
        <section className="lg p-6" data-hook="bb-exam-result" aria-live="polite">
          <p className="eyebrow">{t('bb.mock.result')}</p>
          <p className="mt-2 text-[2.5rem] font-bold leading-none tabular-nums text-ink">
            {result.score}
            <span className="text-[1.5rem] text-muted"> / {result.total}</span>
          </p>
          <p className="mt-2 text-body font-semibold text-ink">{t('bb.mock.pct', { n: result.pct })}</p>
          {saving && (
            <p className="mt-3 flex items-center gap-2 text-small text-ink">
              <Spinner />
              {t('bb.mock.saving', { done: saving.done, of: saving.of })}
            </p>
          )}
          {!saving && wrongGiven > 0 && <p className="mt-3 text-small text-ink">✓ {t('bb.mock.logged', { n: wrongGiven })}</p>}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
          <section className="lg p-5" data-hook="bb-exam-chapters">
            <h2 className="eyebrow">{t('bb.mock.by_chapter')}</h2>
            <ul className="mt-3 space-y-4">
              {result.byChapter.map((c) => (
                <li key={c.chapter_id ?? c.title}>
                  <Bar pct={c.pct} label={c.title} hint={t('bb.mock.right_of', { right: c.right, total: c.total })} />
                </li>
              ))}
            </ul>
          </section>
          <section className="lg p-5" data-hook="bb-exam-bloom">
            <h2 className="eyebrow">{t('bb.mock.by_bloom')}</h2>
            <ul className="mt-3 space-y-4">
              {result.byBloom.map((b) => (
                <li key={b.bloom}>
                  <Bar pct={b.pct} label={t(`bb.bloom.${BLOOM[b.bloom]}`)} hint={t('bb.mock.right_of', { right: b.right, total: b.total })} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {result.misses.length > 0 && (
          <section className="mt-6" data-hook="bb-exam-misses">
            <h2 className="eyebrow">{t('bb.mock.review', { n: result.misses.length })}</h2>
            <ol className="mt-3 space-y-4">
              {result.misses.map(({ item: miss, given }) => {
                const key = miss.answer?.index
                return (
                  <li key={miss.id} className="lg p-5" data-hook="bb-exam-miss">
                    <p className="whitespace-pre-line text-body text-ink">{miss.stem}</p>
                    <p className="mt-3 text-small font-bold text-ink">{given == null ? `○ ${t('bb.mock.blank')}` : `✗ ${t('bb.mock.yours')}: ${String.fromCharCode(65 + Number(given))}. ${miss.options?.[given]?.text ?? ''}`}</p>
                    {given != null && miss.options?.[given]?.why && <p className="mt-1 text-small text-ink">{miss.options[given].why}</p>}
                    <p className="mt-3 text-small font-bold text-ink">
                      ✓ {t('bb.ses.right')}: {String.fromCharCode(65 + Number(key))}. {miss.options?.[key]?.text ?? ''}
                    </p>
                    {miss.options?.[key]?.why && <p className="mt-1 text-small text-ink">{miss.options[key].why}</p>}
                    {miss.options?.[key]?.outside && (
                      <div className="mt-2">
                        <Outside />
                      </div>
                    )}
                    {miss.explanation && <p className="mt-3 text-small text-ink">{miss.explanation}</p>}
                    <Anchors className="mt-3" ids={miss.anchor_ids} anchors={data.maps.anchors} files={data.maps.files} />
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to={`/bb/session/${id}?m=15`} className="btn press bg-ink text-[1.1875rem] font-bold text-white hover:opacity-90 sm:w-auto sm:px-8" data-hook="bb-exam-practise">
            {t('bb.mock.practise')}
          </Link>
          <Link to={`/bb/cours/${id}/examen`} className="btn-ghost press sm:w-auto sm:px-8">
            {t('bb.mock.back')}
          </Link>
        </div>
      </Shell>
    )
  }

  /* Setup ------------------------------------------------------------------- */
  if (!running) {
    const past = data.exams.filter((e) => e.ended_at && e.total)
    return (
      <Shell top={top}>
        <section className="lg mx-auto max-w-[40rem] p-6" data-hook="bb-exam-setup">
          <h1 className="text-h1 text-ink">{t('bb.mock.title')}</h1>
          <p className="mt-2 text-body text-ink">{t('bb.mock.lede')}</p>
          {available < MIN_EXAM ? (
            <Note className="mt-5">{t('bb.mock.too_few')}</Note>
          ) : (
            <>
              {/* A choice only when there is one: with ten questions or fewer
                  in the bank the short version is the full one, and two cards
                  saying "7 questions · 14 min" ask the student to pick
                  between the same thing. */}
              {shapes.short.count >= shapes.full.count ? (
                <p className="mt-5 text-body font-bold text-ink" data-hook="bb-exam-shape">
                  {t('bb.mock.shape', { n: shapes.full.count, m: shapes.full.minutes })}
                </p>
              ) : (
                <fieldset className="mt-5">
                  <legend className="text-small font-semibold text-ink">{t('bb.mock.size')}</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {['full', 'short'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={size === k}
                        onClick={() => setSize(k)}
                        className={`press rounded-inner border-2 px-4 py-3 text-left ${size === k ? 'border-ink bg-[#FFF4C2]' : 'border-ink/15 bg-surface'}`}
                        data-hook={`bb-exam-size-${k}`}
                      >
                        <span className="block text-body font-bold text-ink">
                          {size === k && '✓ '}
                          {t(`bb.mock.size_${k}`)}
                        </span>
                        <span className="block text-small text-ink">{t('bb.mock.shape', { n: shapes[k].count, m: shapes[k].minutes })}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <ul className="mt-5 space-y-1.5 text-small text-ink">
                <li>• {t('bb.mock.rule_clock')}</li>
                <li>• {t('bb.mock.rule_no_feedback')}</li>
                <li>• {t('bb.mock.rule_saved')}</li>
              </ul>
              <BigButton className="mt-6" onClick={begin} data-hook="bb-exam-start">
                {t('bb.mock.start')}
              </BigButton>
            </>
          )}
        </section>
        {past.length > 0 && (
          <section className="mx-auto mt-6 max-w-[40rem]" data-hook="bb-exam-history">
            <h2 className="eyebrow">{t('bb.mock.history')}</h2>
            <ul className="mt-3 space-y-2">
              {past.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-4 rounded-inner bg-surface px-4 py-3 text-small text-ink">
                  <span>{new Date(e.started_at).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'long' })}</span>
                  <span className="font-bold tabular-nums">
                    {e.score} / {e.total} · {Math.round((e.score / Math.max(1, e.total)) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Shell>
    )
  }

  /* Running ----------------------------------------------------------------- */
  if (!item) return null
  const picked = answers[item.id]
  const grid = (
    <nav aria-label={t('bb.mock.grid')} data-hook="bb-exam-grid">
      <p className="text-small font-semibold text-ink">{t('bb.mock.answered', { n: answeredCount, total: items.length })}</p>
      <ol className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
        {items.map((it, n) => {
          const done = answers[it.id] != null
          const flagged = flags.has(it.id)
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => setAt(n)}
                aria-current={n === at ? 'step' : undefined}
                aria-label={`${n + 1}${done ? `, ${t('bb.mock.done')}` : ''}${flagged ? `, ${t('bb.mock.flagged')}` : ''}`}
                className={`press relative flex h-10 w-full items-center justify-center rounded-inner border-2 text-small font-bold tabular-nums text-ink ${n === at ? 'border-ink' : done ? 'border-[#6B4EFF] bg-[#EFEBFF]' : 'border-ink/15 bg-surface'}`}
              >
                {n + 1}
                {done && <span aria-hidden="true" className="absolute right-0.5 top-0 text-[0.625rem]">●</span>}
                {flagged && <span aria-hidden="true" className="absolute bottom-0 right-0.5 text-[0.625rem]">⚑</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-[0.8125rem] text-muted">{t('bb.mock.legend')}</p>
    </nav>
  )

  return (
    <Shell top={top}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section ref={questionRef} tabIndex={-1} className="lg p-5 outline-none sm:p-6" data-hook="bb-exam-question" aria-live="polite">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.02em] text-muted">{t('bb.mock.question', { n: at + 1, total: items.length })}</p>
          <p className="mt-4 whitespace-pre-line text-[1.0625rem] leading-[1.6] text-ink">{item.stem}</p>
          <div role="radiogroup" aria-label={t('bb.mock.question', { n: at + 1, total: items.length })} className="mt-5 space-y-2">
            {(item.options ?? []).map((o, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={picked === i}
                onClick={() => setAnswers((a) => ({ ...a, [item.id]: i }))}
                className={`press flex w-full items-start gap-3 rounded-inner border-2 px-3 py-3 text-left transition-colors ${picked === i ? 'border-[#6B4EFF] bg-[#EFEBFF]' : 'border-ink/15 bg-surface hover:border-ink/30'}`}
                data-hook="bb-exam-option"
              >
                <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-small font-bold ${picked === i ? 'bg-ink text-white' : 'bg-ink/[0.07] text-ink'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 text-body text-ink">
                  {o.text}
                  {picked === i && <span className="sr-only"> ({t('bb.mock.chosen')})</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* Not there rather than greyed out: a faded label is the one
                sentence on the screen nobody can read. */}
            {at > 0 && (
              <button type="button" className="btn-ghost press w-auto px-5" onClick={() => setAt((n) => Math.max(0, n - 1))}>
                ← {t('bb.mock.prev')}
              </button>
            )}
            {at < items.length - 1 && (
              <button type="button" className="btn-ghost press w-auto px-5" onClick={() => setAt((n) => Math.min(items.length - 1, n + 1))} data-hook="bb-exam-next">
                {t('bb.mock.next')} →
              </button>
            )}
            <button
              type="button"
              aria-pressed={flags.has(item.id)}
              className="press ml-auto rounded-pill px-3 py-2 text-small font-semibold text-ink underline underline-offset-4"
              onClick={() =>
                setFlags((f) => {
                  const next = new Set(f)
                  if (next.has(item.id)) next.delete(item.id)
                  else next.add(item.id)
                  return next
                })
              }
              data-hook="bb-exam-flag"
            >
              ⚑ {flags.has(item.id) ? t('bb.mock.unflag') : t('bb.mock.flag')}
            </button>
          </div>
        </section>
        <aside className="lg p-5">{grid}</aside>
      </div>
      {confirm && (
        <Note className="mt-4">
          {t('bb.mock.confirm', { n: items.length - answeredCount })}{' '}
          <button type="button" className="font-bold underline underline-offset-4" onClick={handIn} data-hook="bb-exam-confirm">
            {t('bb.mock.confirm_yes')}
          </button>
        </Note>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 lg:static lg:mt-6 lg:px-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-[40rem] rounded-card bg-white p-2 shadow-[var(--e-float)] lg:max-w-[72rem] lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex justify-center lg:max-w-[26rem] lg:justify-start [&>*]:w-full">
            <BigButton tone="violet" onClick={() => (answeredCount < items.length && !confirm ? setConfirm(true) : handIn())} data-hook="bb-exam-handin">
              {t('bb.mock.hand_in')}
            </BigButton>
          </div>
        </div>
      </div>
      <p className="mt-6 hidden text-center text-small text-muted lg:block">{t('bb.mock.keys')}</p>
    </Shell>
  )
}

function Shell({ top, children }) {
  return (
    <div className="ground relative min-h-dvh" data-hook="app-shell" data-page="bb-exam">
      {top}
      <main className="relative z-10 mx-auto w-full max-w-[40rem] px-4 pb-40 pt-6 lg:max-w-[72rem] lg:px-8 lg:pb-16">{children}</main>
    </div>
  )
}
