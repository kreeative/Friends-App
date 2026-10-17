import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { supabase } from '../../lib/supabase'
import { buildSession } from '../../lib/bb/sampler'
import { answerRows } from '../../lib/bb/answer'
import { typedMatch } from '../../lib/bb/quality'
import { dayKey } from '../../lib/bb/days'
import { retentionFor } from '../../lib/bb/fsrs'
import { capFromFormat, targetsByConcept } from '../../lib/bb/difficulty'
import { daysToExamOf, examFormat, nextExam, scopeOf } from '../../lib/bb/exams'
import { sessionCounts, tickRow } from '../../lib/bb/checkin'
import { call } from '../api'
import { useBB } from '../BBApp'
import { endSession, loadCourse, loadStudy, saveAnswer, startSession } from '../data'
import { errorMessage } from '../errors'
import { Anchors, BigButton, Note, Outside, PILL, anchorMaps } from '../kit'
import { Spinner } from '../course/Processing'

/**
 * Today's session (sections 3 and 6): due reviews, the mistake log, a pretest
 * of the next chapter and a few new items, interleaved (buildSession in
 * src/lib/bb/sampler.js), for 10, 15 or 25 minutes.
 *
 * THE ORDER OF ONE QUESTION, AND WHY.
 *   1. Recall first: the question, nothing else on screen.
 *   2. The answer, then the confidence: Sure, Unsure or Guessing, BEFORE
 *      the reveal (calibration, technique 9).
 *   3. The reveal: right or not in words and an icon, never colour alone;
 *      every option with why it is right or wrong and where it is written;
 *      "Not in your slides" where it applies.
 *   4. One "why is this true?" line, checked against the excerpt
 *      (elaborative interrogation, technique 4). Optional, and it is the
 *      only step here that costs an AI call.
 *   5. Next. Saved at the reveal, so leaving mid-question loses nothing.
 *
 * A flashcard is the professor's definition: recall it (or type it, checked
 * by the app with no AI), reveal, rate Again, Hard, Good or Easy.
 *
 * Again puts the item back later in the same session, once.
 *
 * DIFFICULTY AND RETENTION. New questions come nearest the Bloom level each
 * concept has reached (src/lib/bb/difficulty.js), capped by the exam's own
 * format; in the last ten days before the exam, what the professor flagged
 * is scheduled for 95% recall instead of 90% (retentionFor in fsrs.js).
 *
 * THE NEXT EXAM LEADS (src/lib/bb/exams.js). Before the midterm its
 * chapters come first, and each answer is scheduled against the exam that
 * covers its chapter: the midterm for the first chapters, the final for the
 * others.
 *
 * THE END. A finished session ticks the student's Rich & Friends study goal
 * when she switched it on (src/lib/bb/checkin.js), and the questions she
 * missed are sent for variations, another scenario on the same skill, ready
 * for the next session (api/_bb/vary.js): one on the free plan, three on Plus.
 *
 * KEYBOARD (section 11): A to D answer, S U G confidence, Space or Enter
 * checks and moves on, Space reveals a card, 1 to 4 rate it.
 *
 * LAYOUT: one column on a phone with the buttons at the bottom, within
 * thumb reach; two panes from lg, the question on the left and the
 * explanation with its sources on the right.
 */
const MINUTES = [10, 15, 25]
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

export default function Session() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const minutes = MINUTES.includes(Number(params.get('m'))) ? Number(params.get('m')) : 15
  const { t, locale } = useT()
  const { user } = useAuth()
  const { bb, status } = useBB()
  usePageMeta({ title: 'Hakkilo' })

  const [data, setData] = useState(null)
  const [queue, setQueue] = useState(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('ask')
  const [choice, setChoice] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [typed, setTyped] = useState('')
  const [outcome, setOutcome] = useState(null)
  const [answered, setAnswered] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [offline, setOffline] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [why, setWhy] = useState({ text: '', busy: false, result: null, error: null })
  const [report, setReport] = useState({ open: false, reason: '', busy: false, result: null })
  const [ticked, setTicked] = useState(null)
  const [variants, setVariants] = useState(null)
  const startedAt = useRef(Date.now())
  const shownAt = useRef(Date.now())
  const requeued = useRef(new Set())
  const schedule = useRef(new Map())
  const mistakes = useRef(new Map())
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [course, study] = await Promise.all([loadCourse(id), loadStudy(id)])
        if (!live) return
        if (!course.course) return setError('missing')
        schedule.current = new Map(study.schedule.map((s) => [s.item_id, s]))
        mistakes.current = new Map(study.mistakes.map((m) => [m.item_id, m]))
        /* The next exam leads: its format caps the level, its chapters come
           first (the midterm's before the midterm, src/lib/bb/exams.js). */
        const next = nextExam(course.course)
        const format = examFormat(course.course, course.blueprint, next)
        const focus = next ? scopeOf(next, course.course, course.chapters) : null
        const targets = targetsByConcept(study.reviews, { cap: capFromFormat(format) })
        const plan = buildSession({ minutes, items: study.items, schedule: study.schedule, mistakes: study.mistakes, concepts: course.concepts, chapters: course.chapters, targets, focus })
        setData({ ...course, ...study, byId: new Map(study.items.map((i) => [i.id, i])), maps: anchorMaps(course.anchors, course.materials) })
        setQueue(plan.items)
        if (plan.items.length) setSessionId(await startSession(id, minutes))
      } catch {
        if (live) setError('load')
      }
    })()
    return () => {
      live = false
    }
  }, [id, minutes])

  const entry = queue?.[index] ?? null
  const item = entry ? data?.byId.get(entry.id) : null
  const marked = item && item.type !== 'flash' && item.type !== 'cloze'
  const concept = item ? data.concepts.find((c) => c.id === item.concept_id) : null
  const twinName = useMemo(() => {
    if (!item || !data) return null
    const tw = data.twins.find((x) => x.a_concept === item.concept_id || x.b_concept === item.concept_id)
    if (!tw) return null
    const other = tw.a_concept === item.concept_id ? tw.b_concept : tw.a_concept
    return data.concepts.find((c) => c.id === other)?.name ?? null
  }, [item, data])

  const resetCard = () => {
    setPhase('ask')
    setChoice(null)
    setConfidence(null)
    setTyped('')
    setOutcome(null)
    setWhy({ text: '', busy: false, result: null, error: null })
    setReport({ open: false, reason: '', busy: false, result: null })
    shownAt.current = Date.now()
  }

  /* The missed questions, sure-and-wrong first, sent for variations one at a
     time; the server answers at once, for free, when a question has its two. */
  const vary = useCallback(
    async (list) => {
      const max = status?.tier === 'free' || !status?.tier ? 1 : 3
      const seen = new Set()
      const missed = [...list.filter((a) => a.sureWrong), ...list.filter((a) => !a.correct)]
        .filter((a) => a.mode !== 'pretest' && a.marked)
        .map((a) => a.origin)
        .filter((o) => (seen.has(o) ? false : seen.add(o)))
        .slice(0, max)
      if (!missed.length) return
      setVariants({ busy: true, added: 0, of: missed.length })
      let added = 0
      for (const itemId of missed) {
        const r = await call('vary', { item_id: itemId })
        if (r.ok) added += r.data.added ?? 0
        if (!r.ok && (r.status === 429 || r.status === 503)) break
      }
      setVariants({ busy: false, added, of: missed.length })
    },
    [status?.tier],
  )

  const finish = useCallback(
    async (list = answered) => {
      setDone(true)
      await endSession(sessionId, { answered: list.length, correct: list.filter((a) => a.correct && a.mode !== 'pretest').length })
      if (bb?.rf_goal_id && user?.id && sessionCounts(list)) {
        const { error: tickError } = await supabase.from('goal_days').upsert(tickRow({ goalId: bb.rf_goal_id, userId: user.id }), { onConflict: 'goal_id,user_id,on_date', ignoreDuplicates: true })
        setTicked(tickError ? 'failed' : 'ok')
      }
      vary(list)
    },
    [answered, sessionId, bb?.rf_goal_id, user?.id, vary],
  )

  const record = useCallback(
    async ({ rating = null, correct = null }) => {
      /* A variation answers for the original's mistake: one log row, keyed
         on the original (answerRows writes it there too). */
      const origin = item.variant_of ?? item.id
      const rows = answerRows({
        item,
        card: schedule.current.get(item.id) ?? null,
        choice,
        rating,
        correct,
        confidence,
        mistake: mistakes.current.get(origin) ?? null,
        ms: Date.now() - shownAt.current,
        mode: entry.reason,
        sessionId,
        retention: retentionFor({ weight: concept?.weight, daysLeft: daysToExamOf(data?.course, item.chapter_id, data?.chapters) }),
      })
      schedule.current.set(item.id, { ...rows.schedule })
      if (rows.mistake) mistakes.current.set(origin, { ...(mistakes.current.get(origin) ?? {}), ...rows.mistake })
      setAnswered((a) => [...a, { id: item.id, origin, marked, correct: rows.correct, sureWrong: rows.sureWrong, mode: entry.reason }])
      /* Again: back in the queue a few cards later, once. */
      if (rows.rating === 1 && !requeued.current.has(item.id)) {
        requeued.current.add(item.id)
        setQueue((q) => {
          const next = [...q]
          next.splice(Math.min(next.length, index + 4), 0, { ...entry, reason: entry.reason === 'pretest' ? 'due' : entry.reason })
          return next
        })
      }
      try {
        const how = await saveAnswer(user.id, { schedule: rows.schedule, answer: rows.answer, mistake: rows.mistake })
        if (how === 'queued') setOffline(true)
      } catch {
        setOffline(true)
      }
      return rows
    },
    [item, choice, confidence, entry, sessionId, index, user?.id, concept, marked, data?.course, data?.chapters],
  )

  const next = useCallback(() => {
    if (!queue) return
    if (index + 1 >= queue.length) {
      finish()
      return
    }
    setIndex(index + 1)
    resetCard()
  }, [queue, index, finish])

  /* On a phone the explanation is under the question: bring it up. */
  const feedbackRef = useRef(null)
  const showFeedback = () =>
    requestAnimationFrame(() => {
      if (window.innerWidth >= 1024) return
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      feedbackRef.current?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    })

  const check = useCallback(async () => {
    if (!marked || phase !== 'ask' || choice == null || !confidence) return
    setPhase('shown')
    const rows = await record({})
    setOutcome({ correct: rows.correct })
    showFeedback()
  }, [marked, phase, choice, confidence, record])

  const reveal = useCallback(() => {
    if (marked || phase !== 'ask') return
    setPhase('shown')
    setOutcome({ typed: typed.trim() ? typedMatch(typed, item.answer?.text ?? '') : null })
    showFeedback()
  }, [marked, phase, typed, item])

  const rate = useCallback(
    async (g) => {
      if (marked || phase !== 'shown') return
      await record({ rating: g })
      next()
    },
    [marked, phase, record, next],
  )

  /* The keyboard of section 11. Typing in a field is left alone. */
  useEffect(() => {
    if (!item || done) return undefined
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'radio') || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (marked && phase === 'ask') {
        const at = LETTERS.indexOf(k)
        if (at >= 0 && at < (item.options ?? []).length) {
          e.preventDefault()
          setChoice(at)
        } else if (k === 's' || k === 'u' || k === 'g') {
          e.preventDefault()
          setConfidence(k === 's' ? 'sure' : k === 'u' ? 'unsure' : 'guess')
        } else if (k === ' ' || k === 'enter') {
          e.preventDefault()
          check()
        }
      } else if (marked && phase === 'shown') {
        if (k === ' ' || k === 'enter') {
          e.preventDefault()
          next()
        }
      } else if (!marked && phase === 'ask') {
        if (k === ' ' || k === 'enter') {
          e.preventDefault()
          reveal()
        }
      } else if (!marked && phase === 'shown') {
        if (['1', '2', '3', '4'].includes(k)) {
          e.preventDefault()
          rate(Number(k))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, done, marked, phase, check, next, reveal, rate])

  async function sendWhy() {
    if (!why.text.trim()) return
    setWhy((w) => ({ ...w, busy: true, error: null }))
    const r = await call('elaborate', { item_id: item.id, text: why.text.trim() })
    setWhy((w) => ({ ...w, busy: false, result: r.ok ? r.data : null, error: r.ok ? null : errorMessage(t, locale, r.data) }))
  }

  async function sendReport() {
    setReport((r) => ({ ...r, busy: true }))
    const r = await call('report', { item_id: item.id, reason: report.reason.trim() })
    const result = r.ok ? r.data : { outcome: null, error: errorMessage(t, locale, r.data) }
    setReport((x) => ({ ...x, busy: false, result }))
    if (r.ok && r.data.outcome !== 'kept') {
      /* Gone or changed: not asked again in this session. */
      setQueue((q) => q.filter((e, i) => i <= index || e.id !== item.id))
    }
  }

  /* --- screens --------------------------------------------------------------- */

  const left = Math.max(0, minutes - Math.floor((now - startedAt.current) / 60000))
  const top = (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="lg lg-chrome mx-auto flex w-full max-w-[72rem] items-center gap-3 px-3 py-2.5">
        <Link to={`/hakkilo/cours/${id}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink" aria-label={t('bb.ses.quit')} data-hook="bb-quit">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-pill bg-ink/10" aria-hidden="true">
            <div className="h-full rounded-pill bg-ink transition-[width] duration-300" style={{ width: `${queue?.length ? Math.round((Math.min(index + (phase === 'shown' ? 1 : 0), queue.length) / queue.length) * 100) : 0}%` }} />
          </div>
        </div>
        <p className="shrink-0 text-small font-semibold tabular-nums text-ink" data-hook="bb-progress">
          {queue?.length ? t('bb.ses.progress', { n: Math.min(index + 1, queue.length), total: queue.length }) : ''} · {t('bb.ses.time_left', { n: left })}
        </p>
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
  if (!data || !queue) {
    return (
      <Shell top={top}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
      </Shell>
    )
  }

  if (!queue.length) {
    return (
      <Shell top={top}>
        <section className="lg mx-auto max-w-[40rem] p-6 text-center" data-hook="bb-session-empty">
          <h1 className="text-h1 text-ink">{t('bb.ses.empty_title')}</h1>
          <p className="mt-3 text-body text-muted">{t('bb.ses.empty_body')}</p>
          <Link to={`/hakkilo/cours/${id}`} className="btn-ghost press mt-6 w-auto px-8">
            {t('bb.ses.back')}
          </Link>
        </section>
      </Shell>
    )
  }

  if (done) {
    const counted = answered.filter((a) => a.mode !== 'pretest')
    const right = counted.filter((a) => a.correct).length
    const sureWrong = answered.filter((a) => a.sureWrong).length
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tKey = dayKey(tomorrow)
    const end = new Date(tomorrow)
    end.setHours(23, 59, 59, 999)
    const dueTomorrow = [...schedule.current.values()].filter((s) => Date.parse(s.due) <= end.getTime() && (Date.parse(s.due) > Date.now() || dayKey(s.due) === tKey)).length
    const spent = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
    return (
      <Shell top={top}>
        <section className="lg mx-auto max-w-[40rem] p-6" data-hook="bb-session-done" aria-live="polite">
          <h1 className="text-h1 text-ink">{t('bb.ses.done_title')}</h1>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              [answered.length, t('bb.ses.lbl_answered')],
              [right, t('bb.ses.lbl_right')],
              [spent, t('bb.ses.lbl_minutes')],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-[1.75rem] font-bold tabular-nums text-ink">{value}</p>
                <p className="text-small text-muted">{label}</p>
              </div>
            ))}
          </div>
          {sureWrong > 0 && <p className="mt-4 text-body text-ink">⚑ {t('bb.ses.done_sure_wrong', { n: sureWrong })}</p>}
          <p className="mt-4 text-body font-semibold text-ink">{dueTomorrow ? t('bb.ses.tomorrow', { n: dueTomorrow }) : t('bb.ses.tomorrow_none')}</p>
          {ticked === 'ok' && (
            <p className="mt-3 text-body text-ink" data-hook="bb-done-ticked">
              ✓ {t('bb.ses.ticked')}
            </p>
          )}
          {ticked === 'failed' && <Note tone="error" className="mt-3">{t('bb.ses.tick_failed')}</Note>}
          {variants && (
            <p className="mt-3 flex items-center gap-2 text-small text-ink" data-hook="bb-done-variants" aria-live="polite">
              {variants.busy ? (
                <>
                  <Spinner />
                  {t('bb.ses.varying', { n: variants.of })}
                </>
              ) : variants.added ? (
                `✓ ${t('bb.ses.varied', { n: variants.added })}`
              ) : (
                t('bb.ses.varied_none')
              )}
            </p>
          )}
          {offline && <Note className="mt-4">{t('bb.ses.offline')}</Note>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to={`/hakkilo/cours/${id}`} className="btn press bg-ink font-bold text-white hover:opacity-90 sm:w-auto sm:px-8" data-hook="bb-done-back">
              {t('bb.ses.back')}
            </Link>
            <button type="button" className="btn-ghost press sm:w-auto sm:px-8" onClick={() => navigate(`/hakkilo/session/${id}?m=10&r=${Date.now()}`, { replace: true })}>
              {t('bb.ses.again')}
            </button>
          </div>
        </section>
      </Shell>
    )
  }

  if (!item) return null
  const key = item.answer?.index
  const anchorsOf = (ids) => <Anchors ids={ids} anchors={data.maps.anchors} files={data.maps.files} />

  const question = (
    <section className="lg p-5 sm:p-6" data-hook="bb-question" data-type={item.type}>
      <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.02em] text-muted">
        {t(`bb.ses.reason.${entry.reason}`)}
        {concept ? ` · ${concept.name}` : ''}
      </p>
      {entry.reason === 'pretest' && <Note className="mt-3">{t('bb.ses.pretest')}</Note>}
      {item.variant_of && <p className="mt-2 text-small font-semibold text-ink" data-hook="bb-variant">↻ {t('bb.ses.variant')}</p>}

      {marked ? (
        <>
          <p className="mt-4 whitespace-pre-line text-[1.0625rem] leading-[1.6] text-ink" data-hook="bb-stem">
            {item.stem}
          </p>
          <div role="radiogroup" aria-label={item.stem.slice(0, 80)} className="mt-5 space-y-2">
            {(item.options ?? []).map((o, i) => {
              const picked = choice === i
              const shown = phase === 'shown'
              const isKey = i === key
              const tone = shown ? (isKey ? 'border-[#1E7B34] bg-[#E4F5D9]' : picked ? 'border-negative/60 bg-[#FDECEE]' : 'border-ink/10 bg-surface') : picked ? 'border-ink bg-[#E6DFFF]' : 'border-ink/15 bg-surface hover:border-ink/30'
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={shown}
                  onClick={() => setChoice(i)}
                  className={`press flex w-full items-start gap-3 rounded-inner border-2 px-3 py-3 text-left transition-colors ${tone}`}
                  data-hook="bb-option"
                >
                  <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-small font-bold ${picked ? 'bg-ink text-white' : 'bg-ink/[0.07] text-ink'}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1 text-body text-ink">
                    {o.text}
                    {shown && isKey && <span className="ml-2 font-bold">✓ {t('bb.ses.right')}</span>}
                    {shown && picked && !isKey && <span className="ml-2 font-bold">✗</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {phase === 'ask' && (
            <fieldset className="mt-6">
              <legend className="text-small font-semibold text-ink">{t('bb.ses.confidence')}</legend>
              {/* Equal thirds while the words fit, and never a word on two
                  lines: a third of the row is 77px at 320 and 100px at 390,
                  and "✓ Au hasard" needs 84. A button takes the width its
                  words need, and the row wraps before a word would. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {['sure', 'unsure', 'guess'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={confidence === c}
                    onClick={() => setConfidence(c)}
                    className={`press min-w-max flex-1 whitespace-nowrap rounded-inner border-2 px-1 py-2.5 text-small font-semibold text-ink ${confidence === c ? 'border-ink bg-[#E6DFFF]' : 'border-ink/15 bg-surface'}`}
                    data-hook={`bb-conf-${c}`}
                  >
                    {confidence === c && '✓ '}
                    {t(`bb.ses.conf.${c}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 text-small font-semibold text-muted">{t('bb.ses.define')}</p>
          <p className="mt-1 text-[1.5rem] font-bold leading-snug text-ink" data-hook="bb-stem">
            {item.stem}
          </p>
          {phase === 'ask' && (
            <label className="mt-5 block">
              <span className="text-small font-semibold text-ink">{t('bb.ses.type_answer')}</span>
              <textarea className="field mt-2 min-h-[5rem]" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </label>
          )}
        </>
      )}
    </section>
  )

  const feedback =
    phase === 'shown' ? (
      <section ref={feedbackRef} className="lg scroll-mt-28 p-5 sm:p-6" data-hook="bb-feedback" aria-live="polite">
        {marked ? (
          <>
            <p className="text-[1.25rem] font-bold text-ink" data-hook="bb-verdict">
              {outcome?.correct ? `✓ ${t('bb.ses.right')}` : `✗ ${t('bb.ses.wrong')}`}
            </p>
            {!outcome?.correct && key != null && <p className="mt-1 text-body text-ink">{t('bb.ses.right_is', { answer: `${String.fromCharCode(65 + key)}. ${item.options?.[key]?.text ?? ''}` })}</p>}
            <ol className="mt-4 space-y-3">
              {(item.options ?? []).map((o, i) => (
                <li key={i} className="border-t border-hairline pt-3 first:border-0 first:pt-0">
                  <p className="text-small font-bold text-ink">
                    {String.fromCharCode(65 + i)}. {i === key ? `✓ ${t('bb.ses.right')}` : '✗'}
                  </p>
                  {o.why && <p className="mt-1 text-small text-ink">{o.why}</p>}
                  {o.outside && <div className="mt-2"><Outside /></div>}
                  {o.anchor && <div className="mt-2">{anchorsOf([o.anchor])}</div>}
                </li>
              ))}
            </ol>
            {item.explanation && <p className="mt-4 text-small text-ink">{item.explanation}</p>}
            <div className="mt-3">{anchorsOf(item.anchor_ids)}</div>
            {item.quality === 'revised' && item.revision_note && <p className="mt-3 text-small text-muted">{t('bb.bank.revised')}: {item.revision_note}</p>}

            <div className="mt-6 border-t border-hairline pt-4">
              <label className="block">
                <span className="text-small font-bold text-ink">{twinName ? t('bb.ses.why_twin', { twin: twinName }) : t('bb.ses.why_title')}</span>
                <textarea className="field mt-2 min-h-[4rem]" value={why.text} placeholder={t('bb.ses.why_ph')} maxLength={1200} onChange={(e) => setWhy((w) => ({ ...w, text: e.target.value }))} disabled={why.busy || Boolean(why.result)} />
              </label>
              {!why.result && (
                <button type="button" className="btn-ghost press mt-2 w-auto px-5" onClick={sendWhy} disabled={why.busy || !why.text.trim()}>
                  {why.busy ? t('bb.ses.why_checking') : t('bb.ses.why_send')}
                </button>
              )}
              {why.result && (
                <p className="mt-3 text-small text-ink" data-hook="bb-why-result">
                  <strong>{t(`bb.ses.why_${why.result.verdict}`)}. </strong>
                  {why.result.feedback}
                </p>
              )}
              {why.error && <Note tone="error" className="mt-2">{why.error}</Note>}
            </div>
          </>
        ) : (
          <>
            <p className="text-small font-semibold text-muted">{t('bb.bank.from_prof')}</p>
            <p className="mt-1 text-[1.0625rem] leading-[1.6] text-ink" data-hook="bb-definition">
              «&#8239;{item.answer?.text}&#8239;»
            </p>
            <div className="mt-3">{anchorsOf(item.anchor_ids)}</div>
            {outcome?.typed && <p className="mt-3 text-small font-semibold text-ink">{outcome.typed === 'right' ? `✓ ${t('bb.ses.typed_ok')}` : t('bb.ses.typed_close')}</p>}
          </>
        )}
        {item.source === 'ai' && (
          <div className="mt-5 border-t border-hairline pt-3">
            {!report.open && !report.result && (
              <button type="button" className={PILL} onClick={() => setReport((r) => ({ ...r, open: true }))} data-hook="bb-report">
                ⚐ {t('bb.ses.report')}
              </button>
            )}
            {report.open && !report.result && (
              <div>
                <label className="block text-small font-semibold text-ink">
                  {t('bb.ses.report_reason')}
                  <textarea className="field mt-2 min-h-[3.5rem]" value={report.reason} maxLength={600} onChange={(e) => setReport((r) => ({ ...r, reason: e.target.value }))} />
                </label>
                <button type="button" className="btn-ghost press mt-2 w-auto px-5" onClick={sendReport} disabled={report.busy}>
                  {report.busy ? t('bb.ses.report_checking') : t('bb.ses.report_send')}
                </button>
              </div>
            )}
            {report.result && (
              <Note className="mt-1">
                {report.result.error ?? t(`bb.ses.report.${report.result.outcome}`, { reasons: report.result.reasons ?? '' })}
              </Note>
            )}
          </div>
        )}
      </section>
    ) : null

  const actions = marked ? (
    phase === 'ask' ? (
      <div>
        {/* What is missing, in ink: an instruction on a faded button would
            be the one sentence on the screen nobody can read. */}
        {(choice == null || !confidence) && (
          <p className="mb-2 text-center text-small font-semibold text-ink" data-hook="bb-check-hint">
            {choice == null ? t('bb.ses.pick_first') : t('bb.ses.pick_conf')}
          </p>
        )}
        <BigButton onClick={check} disabled={choice == null || !confidence} data-hook="bb-check">
          {t('bb.ses.check')}
        </BigButton>
      </div>
    ) : (
      <BigButton onClick={next} data-hook="bb-next">
        {index + 1 >= queue.length ? t('bb.ses.finish') : t('bb.ses.next')}
      </BigButton>
    )
  ) : phase === 'ask' ? (
    <BigButton onClick={reveal} data-hook="bb-reveal">
      {t('bb.ses.reveal')}
    </BigButton>
  ) : (
    <div>
      <p className="mb-2 text-center text-small font-semibold text-ink">{t('bb.ses.rate')}</p>
      <div className="grid grid-cols-4 gap-2" data-hook="bb-rate">
        {[1, 2, 3, 4].map((g) => (
          <button key={g} type="button" onClick={() => rate(g)} className={`press flex min-h-[3.25rem] flex-col items-center justify-center rounded-inner border-2 px-1 py-1.5 text-small font-bold text-ink ${g === 3 ? 'border-ink bg-surface' : 'border-ink/15 bg-surface'}`} data-hook={`bb-rate-${g}`}>
            <span aria-hidden="true" className="text-[0.75rem] font-semibold text-muted">
              {g}
            </span>
            {t(`bb.ses.rate.${g}`)}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Shell top={top}>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">{question}</div>
        <div className="space-y-4">{feedback}</div>
      </div>
      {/* Within thumb reach on a phone: a glass bar fixed at the bottom. From
          lg it is an ordinary row under the two panes. Plain utilities rather
          than .lg, whose pseudo-elements cannot be switched off by breakpoint. */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 lg:static lg:mt-6 lg:px-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-[40rem] rounded-card bg-white p-2 shadow-[var(--e-float)] lg:max-w-[72rem] lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex justify-center lg:max-w-[26rem] lg:justify-start [&>*]:w-full">{actions}</div>
        </div>
      </div>
      <p className="mt-6 hidden text-center text-small text-muted lg:block">{t('bb.ses.keys')}</p>
      {offline && <Note className="mt-4">{t('bb.ses.offline')}</Note>}
    </Shell>
  )
}

function Shell({ top, children }) {
  return (
    <div className="ground relative min-h-dvh" data-hook="app-shell" data-page="bb-session">
      {top}
      <main className="relative z-10 mx-auto w-full max-w-[40rem] px-4 pb-40 pt-6 lg:max-w-[72rem] lg:px-8 lg:pb-16">{children}</main>
    </div>
  )
}
