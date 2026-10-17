import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { localeTag, useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { SegTabs } from '../../components/ui'
import { calibration, chapterMastery } from '../../lib/bb/mastery'
import { calibrationByChapter, weeklyLine } from '../../lib/bb/calib'
import { MARKED, MIN_EXAM } from '../../lib/bb/exam'
import { loadCourse, loadExams, loadStudy, reloadMaterials, updateCourse } from '../data'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { Bar, ExamChip, Note, anchorMaps, weekText } from '../kit'
import { errorMessage } from '../errors'
import { useProcessing } from '../course/useProcessing'
import Processing, { Spinner } from '../course/Processing'
import Sheet from '../course/Sheet'
import Blueprint from '../course/Blueprint'
import { Bank, Files, Mistakes, Twins } from '../course/Views'
import Cases from '../course/Cases'
import Visuals from '../course/Visuals'
import { PRESETS } from './Today'
import { AskBar } from '../Composer'

/**
 * /bb/cours/:id, the course home (section 6): the exam countdown, what is
 * due today, mastery per chapter with its number beside the bar, the "sure
 * and wrong" count, and one main button, "Start today's 15 minutes".
 *
 * Under it, the course's own tabs: chapters (with the calibration of each),
 * the cheat sheet, the visuals, the twin table, the question bank, the
 * mistake log, the mock exam, the case lab, the files. The address carries
 * the tab (/bb/cours/:id/fiches), so back works and a tab can be linked.
 */
const TABS = [
  ['chapitres', 'chapters'],
  ['fiches', 'sheet'],
  ['schemas', 'visuals'],
  ['jumeaux', 'twins'],
  ['banque', 'bank'],
  ['erreurs', 'mistakes'],
  ['examen', 'mock'],
  ['cas', 'cases'],
  ['fichiers', 'files'],
]

export default function Course() {
  const { id, tab = 'chapitres' } = useParams()
  const { t, locale } = useT()
  const navigate = useNavigate()
  const { status, setCourses } = useBB()
  const [data, setData] = useState(null)
  const [study, setStudy] = useState(null)
  const [missing, setMissing] = useState(false)
  const [minutes, setMinutes] = useState(15)
  const [editExam, setEditExam] = useState(false)

  const reload = useCallback(async () => {
    try {
      const d = await loadCourse(id)
      if (!d.course) return setMissing(true)
      setData(d)
      setStudy(await loadStudy(id))
    } catch {
      setMissing(true)
    }
  }, [id])

  useEffect(() => {
    setData(null)
    setStudy(null)
    setMissing(false)
    reload()
  }, [reload])

  /* While a file is being read in another tab, look again now and then. */
  useEffect(() => {
    if (!data?.materials?.some((m) => m.status === 'reading')) return undefined
    const timer = setInterval(async () => {
      const materials = await reloadMaterials(id).catch(() => null)
      if (materials && materials.some((m, i) => m.status !== data.materials[i]?.status)) reload()
    }, 15000)
    return () => clearInterval(timer)
  }, [data, id, reload])

  const proc = useProcessing({ courseId: id, materials: data?.materials ?? null, chapters: data?.chapters ?? null, onChange: reload })
  usePageMeta({ title: data?.course ? `${data.course.name} · Beauty & Brain` : 'Beauty & Brain' })

  const maps = useMemo(() => anchorMaps(data?.anchors, data?.materials), [data])
  const view = useMemo(() => {
    if (!data || !study) return null
    const byConcept = {}
    for (const r of study.reviews) {
      if (!r.concept_id) continue
      ;(byConcept[r.concept_id] ??= []).push(r)
    }
    const now = Date.now()
    const due = study.schedule.filter((s) => Date.parse(s.due) <= now).length
    const all = chapterMastery(data.concepts, byConcept)
    const chapters = data.chapters.map((ch) => {
      const concepts = data.concepts.filter((c) => c.chapter_id === ch.id)
      return {
        ...ch,
        mastery: chapterMastery(concepts, byConcept),
        items: study.items.filter((i) => i.chapter_id === ch.id && i.source === 'ai').length,
        cards: study.items.filter((i) => i.chapter_id === ch.id && i.source !== 'ai').length,
        signals: data.signals.filter((s) => concepts.some((c) => c.id === s.concept_id)).length,
      }
    })
    const sureWrong = study.mistakes.filter((m) => m.confident && !m.resolved_at).length
    const calibrated = calibrationByChapter(study.reviews, data.concepts)
    for (const ch of chapters) ch.calib = calibrated.get(ch.id) ?? null
    const week = weeklyLine({ reviews: study.reviews, concepts: data.concepts, chapters: data.chapters, twins: data.twins })
    return { due, all, chapters, sureWrong, calib: calibration(study.reviews), week }
  }, [data, study])

  if (missing) {
    return (
      <Page>
        <PageHead title={t('bb.course.not_found')} />
        <Link to="/bb/cours" className="btn-ghost press mt-6 w-auto px-6">
          {t('bb.course.back')}
        </Link>
      </Page>
    )
  }
  if (!data || !view) {
    return (
      <Page>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
      </Page>
    )
  }

  const { course } = data
  const hasItems = study.items.length > 0
  const key = TABS.find(([slug]) => slug === tab)?.[1] ?? 'chapters'

  async function saveExam(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const date = f.get('date')
    const time = f.get('time') || '09:00'
    const exam_at = date ? new Date(`${date}T${time}`).toISOString() : null
    const row = await updateCourse(course.id, { exam_at }).catch(() => null)
    if (row) {
      setData((d) => ({ ...d, course: row }))
      setCourses((list) => (list ?? []).map((c) => (c.id === row.id ? { ...c, exam_at: row.exam_at } : c)))
    }
    setEditExam(false)
  }

  const examDate = course.exam_at ? new Date(course.exam_at) : null
  const pad = (n) => String(n).padStart(2, '0')

  return (
    <Page>
      <PageHead eyebrow={[course.code, course.professor].filter(Boolean).join(' · ') || t('bb.nav.courses')} title={course.name} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ExamChip examAt={course.exam_at} />
        <button type="button" className="press text-small font-semibold text-ink underline underline-offset-4" onClick={() => setEditExam(!editExam)} aria-expanded={editExam}>
          {t('bb.course.exam_set')}
        </button>
      </div>
      {editExam && (
        <form onSubmit={saveExam} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-small font-semibold text-ink">
            {t('bb.new.exam_date')}
            <input type="date" name="date" className="field mt-1 w-auto" defaultValue={examDate ? `${examDate.getFullYear()}-${pad(examDate.getMonth() + 1)}-${pad(examDate.getDate())}` : ''} />
          </label>
          <label className="text-small font-semibold text-ink">
            {t('bb.new.exam_time')}
            <input type="time" name="time" className="field mt-1 w-auto" defaultValue={examDate ? `${pad(examDate.getHours())}:${pad(examDate.getMinutes())}` : '09:00'} />
          </label>
          <button className="btn-ghost press w-auto px-6">{t('bb.course.save')}</button>
        </form>
      )}

      <Processing proc={proc} materials={data.materials} chapters={data.chapters} statusReady={status?.ready?.model} />

      <section className="lg mt-6 p-5" data-hook="bb-course-main">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-small text-muted">{t('bb.course.due')}</dt>
            <dd className="text-[1.75rem] font-bold tabular-nums text-ink">{view.due}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">{t('bb.course.mastery')}</dt>
            <dd className="text-[1.75rem] font-bold tabular-nums text-ink">{view.all.pct}%</dd>
          </div>
          <div>
            <dt className="text-small text-muted">⚑ {t('bb.course.sure_wrong')}</dt>
            <dd className="text-[1.75rem] font-bold tabular-nums text-ink">{view.sureWrong}</dd>
          </div>
        </dl>
        {view.week && (
          <p className="mt-4 text-small text-ink" data-hook="bb-week-line">
            ⚑ {weekText(t, view.week)}
          </p>
        )}
        {hasItems && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to={`/bb/session/${course.id}?m=${minutes}`} className="btn press bg-ink font-bold text-white hover:opacity-90 sm:w-auto sm:px-8" data-hook="bb-course-start">
              {t('bb.course.start', { n: minutes })}
            </Link>
            <SegTabs value={minutes} options={PRESETS} onChange={setMinutes} label={t('bb.course.minutes', { n: minutes })} hook="bb-course-minutes" labelOf={(n) => t('bb.course.minutes', { n })} />
          </div>
        )}
      </section>

      <AskBar courses={[course]} label={t('bb.ask.ph_course')} className="mt-4" />

      <Blueprint course={course} blueprint={data.blueprint} onSaved={reload} />

      {/* Nine tabs wrap onto two or three rows rather than scroll sideways:
          on a phone a strip that scrolls hides "Cas" off the edge, and a tab
          sliding past the edge passes under the margin stickers. */}
      <nav className="mt-8 flex flex-wrap gap-1.5" aria-label={t('bb.course.tabs')} data-hook="bb-course-tabs">
        {TABS.map(([slug, k]) => (
          <Link
            key={slug}
            to={slug === 'chapitres' ? `/bb/cours/${course.id}` : `/bb/cours/${course.id}/${slug}`}
            aria-current={tab === slug ? 'page' : undefined}
            className={`press shrink-0 rounded-pill px-4 py-2 text-small font-semibold ${tab === slug ? 'bg-[#CFC2FF] text-ink' : 'bg-ink/[0.06] text-ink'}`}
          >
            {t(`bb.course.tab.${k}`)}
          </Link>
        ))}
      </nav>

      {key === 'chapters' && (
        <div className="mt-6" data-hook="bb-chapters">
          {!view.chapters.length ? (
            <p className="text-body text-muted">{t('bb.course.no_chapters')}</p>
          ) : (
            <ul className="space-y-3">
              {view.chapters.map((ch) => {
                const error = proc.errors[ch.id]
                return (
                  <li key={ch.id} className="lg p-5" data-hook="bb-chapter">
                    <h3 className="text-body font-bold text-ink">{ch.title}</h3>
                    {ch.summary && <p className="mt-1 text-small text-muted">{ch.summary}</p>}
                    <Bar className="mt-4" pct={ch.mastery.pct} label={t('bb.course.mastery')} hint={t('bb.course.concepts_mastered', { done: ch.mastery.mastered, total: ch.mastery.total })} />
                    <p className="mt-3 text-small text-ink">
                      {t('bb.courses.items', { n: ch.items + ch.cards })}
                      {ch.signals > 0 && ` · ${t('bb.course.signals', { n: ch.signals })}`}
                    </p>
                    {ch.calib?.pct != null && (
                      <p className="mt-1 text-small text-ink" data-hook="bb-chapter-calib">
                        {ch.calib.pct < 70 ? '⚑ ' : ''}
                        {t('bb.calib.chapter', { pct: ch.calib.pct, right: ch.calib.right, sure: ch.calib.sure })}
                        {ch.calib.pct < 70 ? ` ${t('bb.calib.low')}` : ''}
                      </p>
                    )}
                    {!ch.items_ready && (
                      <div className="mt-3">
                        {proc.generating === ch.id ? (
                          <p className="flex items-center gap-2 text-small font-semibold text-ink">
                            <Spinner />
                            {t('bb.course.preparing')}
                          </p>
                        ) : (
                          <>
                            <button type="button" className="btn-ghost press w-auto px-5" onClick={() => proc.prepareChapter(ch)} disabled={proc.running} data-hook="bb-prepare">
                              {t('bb.course.prepare')}
                            </button>
                            <p className="mt-2 text-small text-muted">{t('bb.course.prepare_hint')}</p>
                          </>
                        )}
                        {error && <Note tone="error" className="mt-2">{errorMessage(t, locale, error)}</Note>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {key === 'visuals' && <Visuals chapters={data.chapters} maps={maps} />}
      {key === 'mock' && <MockTab courseId={course.id} available={study.items.filter((i) => MARKED.has(i.type) && !i.variant_of).length >= MIN_EXAM} />}
      {key === 'cases' && <Cases course={course} chapters={data.chapters.filter((ch) => data.concepts.some((c) => c.chapter_id === ch.id))} anchors={data.anchors} maps={maps} />}
      {key === 'sheet' && <Sheet chapters={data.chapters} concepts={data.concepts} signals={data.signals} twins={data.twins} maps={maps} />}
      {key === 'twins' && <Twins twins={data.twins} concepts={data.concepts} maps={maps} />}
      {key === 'bank' && <Bank items={study.items} chapters={data.chapters} concepts={data.concepts} signals={data.signals} mistakes={study.mistakes} maps={maps} />}
      {key === 'mistakes' && <Mistakes mistakes={study.mistakes} items={study.items} maps={maps} />}
      {key === 'files' && (
        <Files
          course={course}
          materials={data.materials}
          proc={proc}
          onChange={reload}
          onDeleted={() => {
            setCourses((list) => (list ?? []).filter((c) => c.id !== course.id))
            navigate('/bb/cours', { replace: true })
          }}
        />
      )}
    </Page>
  )
}

/** The mock exams of the course: the last scores, and the way in. */
function MockTab({ courseId, available }) {
  const { t, locale } = useT()
  const [exams, setExams] = useState(null)
  useEffect(() => {
    let live = true
    loadExams(courseId)
      .then((rows) => live && setExams(rows))
      .catch(() => live && setExams([]))
    return () => {
      live = false
    }
  }, [courseId])
  const done = (exams ?? []).filter((e) => e.ended_at && e.total)
  return (
    <div className="mt-6 space-y-6" data-hook="bb-mock-tab">
      <section className="lg p-5 sm:p-6">
        <h2 className="text-h2 text-ink">{t('bb.mock.title')}</h2>
        <p className="mt-2 text-body text-ink">{t('bb.mock.lede')}</p>
        {available ? (
          <Link to={`/bb/examen/${courseId}`} className="btn press mt-5 bg-ink font-bold text-white hover:opacity-90 sm:w-auto sm:px-8" data-hook="bb-mock-open">
            {t('bb.mock.open')}
          </Link>
        ) : (
          <Note className="mt-5">{t('bb.mock.too_few')}</Note>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h2 className="eyebrow">{t('bb.mock.history')}</h2>
          <ul className="mt-3 space-y-2">
            {done.map((e) => {
              const pct = Math.round((e.score / Math.max(1, e.total)) * 100)
              const weakest = [...(e.by_chapter ?? [])].sort((a, b) => a.pct - b.pct)[0]
              return (
                <li key={e.id} className="rounded-inner bg-surface px-4 py-3 text-small text-ink">
                  <div className="flex items-baseline justify-between gap-4">
                    <span>{new Date(e.started_at).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'long' })}</span>
                    <span className="font-bold tabular-nums">
                      {e.score} / {e.total} · {pct}%
                    </span>
                  </div>
                  {weakest && weakest.pct < 100 && <p className="mt-1 text-muted">{t('bb.mock.weakest', { chapter: weakest.title, n: weakest.pct })}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
