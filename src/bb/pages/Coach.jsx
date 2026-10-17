import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { streamCoach } from '../api'
import { keepAsCard, loadCoachHistory, loadCourse } from '../data'
import { errorMessage } from '../errors'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { Note, Rich, anchorMaps } from '../kit'
import { citedIds, hasCites, shortMap, stripCites } from '../../lib/bb/cite'
import { Spinner } from '../course/Processing'
import { Composer } from '../Composer'

/**
 * /hakkilo/coach/:id, the coach of section 6, grounded in one course.
 *
 * The answer streams in as it is written. The model cites an excerpt by its
 * short id in square brackets ([3f9c1d2a], src/lib/bb/cite.js); here each id
 * that belongs to this course becomes a chip ("Cours 7 · diapo 6") that
 * opens the quoted words. An id that is not in the course is left as plain
 * text, never dressed up as a source.
 *
 * "Keep as a card" turns an answer into a flashcard, but only an answer
 * that cites the course: a card with no anchor would break the first rule.
 *
 * The box is the Claude-style Composer: a "+" holds the course and the four
 * ways to answer, then the mic and the send arrow. A question typed in
 * Today's ask bar arrives as ?q= and is sent once the course and its
 * history are loaded.
 */

export default function Coach() {
  const { id } = useParams()
  const { t, locale } = useT()
  const navigate = useNavigate()
  const { courses, reloadStatus } = useBB()
  usePageMeta({ title: `${t('bb.coach.title')} · Hakkilo` })
  const [course, setCourse] = useState(null)
  const [messages, setMessages] = useState([])
  const [mode, setMode] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [kept, setKept] = useState(() => new Set())
  const [params, setParams] = useSearchParams()
  const asked = useRef(false)
  const end = useRef(null)

  /* No course in the address: the first one, so the coach opens ready. */
  useEffect(() => {
    if (!id && courses?.length) navigate(`/hakkilo/coach/${courses[0].id}`, { replace: true })
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

  /* Follow the answer as it is written, not only when a message is added:
     a long answer used to grow below the box with the page left where it
     was. Every 160 characters is enough to keep up without a scroll call
     per streamed word. */
  const tail = Math.floor((messages.at(-1)?.content?.length ?? 0) / 160)
  const writing = Boolean(messages.at(-1)?.streaming)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, tail, writing])

  const maps = useMemo(() => anchorMaps(course?.anchors, course?.materials), [course])
  const byShort = useMemo(() => shortMap(course?.anchors), [course])

  /* The question from Today's ask bar, sent once (a ref, so the second run
     of a development effect does not send it twice). */
  useEffect(() => {
    const q = params.get('q')
    if (!q || course?.course?.id !== id || asked.current) return
    asked.current = true
    setParams({}, { replace: true })
    send(q)
  }, [params, course, id])

  async function send(question) {
    const text = (question ?? draft).trim()
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

  /* The course is named in the header and in the empty box ("Pose ta
     question sur BIO 1101"), not as a chip: the header scrolls away once
     the thread opens on its last message, the box does not. */
  const current = courses?.find((c) => c.id === id)

  if (courses && !courses.length) {
    return (
      <Page>
        <PageHead title={t('bb.coach.title')} sub={t('bb.coach.lede')} />
        <Note className="mt-4">{t('bb.coach.no_courses')}</Note>
        <Link to="/hakkilo/cours/nouveau" className="btn-ghost press mt-6 w-auto px-6">
          {t('bb.today.add_course')}
        </Link>
      </Page>
    )
  }

  return (
    <Page footer={false}>
      <PageHead eyebrow={current ? [current.code, current.name].filter(Boolean).join(' · ') : null} title={t('bb.coach.title')} sub={t('bb.coach.lede')} />

      <section className="mt-6 space-y-5" aria-live="polite" data-hook="bb-coach-thread">
        {!course ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !messages.length ? (
          <p className="text-body text-muted">{t('bb.coach.empty')}</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              {/* Claude's way: your words in a grey bubble, the answer as
                  plain text on the page, no card round it. */}
              <div className={m.role === 'user' ? 'max-w-[85%] rounded-[1.25rem] bg-[#F4F4F5] px-4 py-2.5' : 'max-w-[44rem]'} data-role={m.role}>
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
        {/* The margin is the box and the tab bar below it, so the last line
            stops above them rather than under them. */}
        <div ref={end} className="scroll-mb-[16.5rem] md:scroll-mb-[10rem]" />
      </section>

      {error && <Note tone="error" className="mt-4">{error}</Note>}

      <div className="sticky bottom-28 z-20 mt-6 md:bottom-4">
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => send()}
          busy={busy}
          disabled={!course}
          courses={courses?.length > 1 ? courses : null}
          courseId={id}
          onCourse={(next) => next !== id && navigate(`/hakkilo/coach/${next}`)}
          mode={mode}
          onMode={setMode}
          showCourse={false}
          label={current ? t('bb.coach.ph_course', { course: current.code || current.name }) : undefined}
          hook="bb-coach-form"
        />
      </div>
    </Page>
  )
}
