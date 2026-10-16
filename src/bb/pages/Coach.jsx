import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { streamCoach } from '../api'
import { keepAsCard, loadCoachHistory, loadCourse } from '../data'
import { errorMessage } from '../errors'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { Anchor, Note, anchorMaps } from '../kit'
import { citeOf, citedIds, hasCites, shortMap, splitRich, stripCites } from '../../lib/bb/cite'
import { Spinner } from '../course/Processing'

/**
 * /bb/coach/:id, the coach of section 6, grounded in one course.
 *
 * The answer streams in as it is written. The model cites an excerpt by its
 * short id in square brackets ([3f9c1d2a], src/lib/bb/cite.js); here each id
 * that belongs to this course becomes a chip ("Cours 7 · diapo 6") that
 * opens the quoted words. An id that is not in the course is left as plain
 * text, never dressed up as a source.
 *
 * "Keep as a card" turns an answer into a flashcard, but only an answer
 * that cites the course: a card with no anchor would break the first rule.
 */
const MODES = ['explain', 'socratic', 'check', 'quiz']

/** Text with [id] citations turned into chips, **bold** kept, lines kept. */
function Rich({ text, byShort, files }) {
  const paras = String(text).split(/\n{2,}/)
  return paras.map((p, i) => {
    const lines = p.split('\n')
    const list = lines.every((l) => /^\s*[-*•]\s+/.test(l))
    const inline = (line, key) =>
      splitRich(line).map((part, j) => {
        const cite = citeOf(part)
        if (cite && byShort.has(cite)) {
          const a = byShort.get(cite)
          return (
            <span key={`${key}-${j}`} className="mx-0.5 inline-block align-baseline">
              <Anchor anchor={a} fileName={files.get(a.material_id)} />
            </span>
          )
        }
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${j}`}>{part.slice(2, -2)}</strong>
        return <Fragment key={`${key}-${j}`}>{part}</Fragment>
      })
    if (list) {
      return (
        <ul key={i} className="ml-5 list-disc space-y-1">
          {lines.map((l, k) => (
            <li key={k}>{inline(l.replace(/^\s*[-*•]\s+/, ''), `${i}-${k}`)}</li>
          ))}
        </ul>
      )
    }
    /* A div, not a p: a chip is a <details>, which a paragraph may not hold. */
    return (
      <div key={i}>
        {lines.map((l, k) => (
          <Fragment key={k}>
            {k > 0 && <br />}
            {inline(l, `${i}-${k}`)}
          </Fragment>
        ))}
      </div>
    )
  })
}

export default function Coach() {
  const { id } = useParams()
  const { t, locale } = useT()
  const navigate = useNavigate()
  const { courses, reloadStatus } = useBB()
  usePageMeta({ title: `${t('bb.coach.title')} · Beauty & Brain` })
  const [course, setCourse] = useState(null)
  const [messages, setMessages] = useState([])
  const [mode, setMode] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [kept, setKept] = useState(() => new Set())
  const end = useRef(null)

  /* No course in the address: the first one, so the coach opens ready. */
  useEffect(() => {
    if (!id && courses?.length) navigate(`/bb/coach/${courses[0].id}`, { replace: true })
  }, [id, courses, navigate])

  useEffect(() => {
    if (!id) return undefined
    let live = true
    setCourse(null)
    setMessages([])
    Promise.all([loadCourse(id), loadCoachHistory(id)])
      .then(([c, history]) => {
        if (!live) return
        setCourse(c)
        setMessages(history.map((m) => ({ role: m.role, content: m.content })))
      })
      .catch(() => live && setError(t('bb.err.generic')))
    return () => {
      live = false
    }
  }, [id])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length])

  const maps = useMemo(() => anchorMaps(course?.anchors, course?.materials), [course])
  const byShort = useMemo(() => shortMap(course?.anchors), [course])

  async function send(e) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || busy || !id) return
    setError(null)
    setDraft('')
    const history = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '', streaming: true }])
    setBusy(true)
    const r = await streamCoach({ course_id: id, messages: history.slice(-12).map(({ role, content }) => ({ role, content })), mode }, (sofar) =>
      setMessages((list) => {
        const next = [...list]
        next[next.length - 1] = { role: 'assistant', content: sofar, streaming: true }
        return next
      }),
    )
    setBusy(false)
    if (!r.ok && !r.text) {
      setMessages(history)
      setDraft(text)
      setError(r.error === 'busy' || r.error === 'model_failed' ? t(`bb.coach.err.${r.error}`) : errorMessage(t, locale, r.data ?? { error: r.error }))
      reloadStatus()
      return
    }
    setMessages((list) => {
      const next = [...list]
      next[next.length - 1] = { role: 'assistant', content: r.text }
      return next
    })
    if (r.error) setError(t(`bb.coach.err.${r.error === 'busy' ? 'busy' : 'model_failed'}`))
    reloadStatus()
  }

  async function keep(i) {
    const answer = messages[i]
    const question = [...messages.slice(0, i)].reverse().find((m) => m.role === 'user')
    const ids = citedIds(answer.content, byShort)
    if (!ids.length || !question) return
    const first = course.anchors.find((a) => a.id === ids[0])
    const concept = course.concepts.find((c) => (c.anchor_ids ?? []).includes(first?.id))
    try {
      await keepAsCard({
        courseId: id,
        chapterId: concept?.chapter_id ?? null,
        conceptId: concept?.id ?? null,
        stem: question.content,
        answer: stripCites(answer.content),
        anchorIds: ids,
      })
      setKept((s) => new Set(s).add(i))
    } catch {
      setError(t('bb.err.generic'))
    }
  }

  if (courses && !courses.length) {
    return (
      <Page>
        <PageHead title={t('bb.coach.title')} sub={t('bb.coach.lede')} />
        <Note className="mt-4">{t('bb.coach.no_courses')}</Note>
        <Link to="/bb/cours/nouveau" className="btn-ghost press mt-6 w-auto px-6">
          {t('bb.today.add_course')}
        </Link>
      </Page>
    )
  }

  return (
    <Page>
      <PageHead title={t('bb.coach.title')} sub={t('bb.coach.lede')} />
      {courses?.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('bb.coach.pick')}>
          {courses.map((c) => (
            <Link key={c.id} to={`/bb/coach/${c.id}`} aria-current={c.id === id ? 'page' : undefined} className={`press rounded-pill border px-3 py-1.5 text-small font-semibold text-ink ${c.id === id ? 'border-[#009DB9] bg-[#DDF3F7]' : 'border-ink/15 bg-surface'}`}>
              {c.id === id && '✓ '}
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('bb.coach.modes')} data-hook="bb-coach-modes">
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(mode === m ? null : m)} className={`press rounded-pill border px-3 py-1.5 text-small font-semibold text-ink ${mode === m ? 'border-[#FF007A] bg-[#FFE3F0]' : 'border-ink/15 bg-surface'}`}>
            {mode === m && '✓ '}
            {t(`bb.coach.mode.${m}`)}
          </button>
        ))}
      </div>

      <section className="mt-6 space-y-4" aria-live="polite" data-hook="bb-coach-thread">
        {!course ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !messages.length ? (
          <p className="lg p-5 text-body text-muted">{t('bb.coach.empty')}</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[85%] rounded-card px-4 py-3 ${m.role === 'user' ? 'bg-[#FFE3F0]' : 'lg'}`} data-role={m.role}>
                <p className="sr-only">{m.role === 'user' ? t('bb.coach.you') : t('bb.coach.them')}</p>
                <div className="space-y-2 text-body text-ink">
                  {m.content ? <Rich text={m.content} byShort={byShort} files={maps.files} /> : <span className="flex items-center gap-2 text-small text-muted"><Spinner /> {t('bb.coach.thinking')}</span>}
                </div>
                {m.role === 'assistant' && !m.streaming && hasCites(m.content) && (
                  <button type="button" className="press mt-3 text-small font-semibold text-ink underline underline-offset-4" onClick={() => keep(i)} disabled={kept.has(i)}>
                    {kept.has(i) ? `✓ ${t('bb.coach.kept')}` : t('bb.coach.keep')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={end} />
      </section>

      {error && <Note tone="error" className="mt-4">{error}</Note>}

      <form onSubmit={send} className="sticky bottom-28 z-20 mt-6 md:bottom-4" data-hook="bb-coach-form">
        <div className="lg lg-chrome flex items-end gap-2 p-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('bb.coach.ph')}</span>
            <textarea
              className="field max-h-40 min-h-[3rem] resize-none border-0 bg-transparent"
              rows={1}
              value={draft}
              placeholder={t('bb.coach.ph')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              maxLength={6000}
            />
          </label>
          <button type="submit" disabled={busy || !draft.trim() || !course} className="btn press w-auto shrink-0 bg-[#FF007A] px-5 text-[1.1875rem] font-bold text-white hover:opacity-90" data-hook="bb-coach-send">
            {busy ? <Spinner /> : t('bb.coach.send')}
          </button>
        </div>
      </form>
    </Page>
  )
}
