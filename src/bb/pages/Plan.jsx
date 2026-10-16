import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT, localeTag } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { daysUntil, weekPlan } from '../../lib/bb/days'
import { chapterMastery } from '../../lib/bb/mastery'
import { supabase } from '../../lib/supabase'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { Bar, ExamChip, Note } from '../kit'

/**
 * /bb/plan: the next seven days and every exam ahead (section 6, the light
 * version of the study plan): the student's weekly hours spread over six
 * days with one rest day, the closer exam getting more of each day, a light
 * review and sleep the night before, and the last ten days marked.
 *
 * Readiness is the course mastery, with its number (section 3).
 */
export default function Plan() {
  const { t, locale } = useT()
  const { bb, courses } = useBB()
  usePageMeta({ title: `${t('bb.plan.title')} · Beauty & Brain` })
  const [ready, setReady] = useState({})

  useEffect(() => {
    let live = true
    ;(async () => {
      const [{ data: concepts }, { data: reviews }] = await Promise.all([
        supabase.from('bb_concepts').select('id, course_id, weight'),
        supabase.from('bb_reviews').select('concept_id, correct, bloom, confidence, created_at').gte('created_at', new Date(Date.now() - 120 * 86400000).toISOString()),
      ])
      if (!live) return
      const byConcept = {}
      for (const r of reviews ?? []) if (r.concept_id) (byConcept[r.concept_id] ??= []).push(r)
      const out = {}
      for (const c of courses ?? []) out[c.id] = chapterMastery((concepts ?? []).filter((x) => x.course_id === c.id), byConcept).pct
      setReady(out)
    })().catch(() => {})
    return () => {
      live = false
    }
  }, [courses])

  const hours = bb?.weekly_hours ?? 5
  const days = useMemo(() => weekPlan({ courses: courses ?? [], weeklyHours: hours }), [courses, hours])
  const name = new Map((courses ?? []).map((c) => [c.id, c.name]))
  const exams = (courses ?? []).filter((c) => (daysUntil(c.exam_at) ?? -1) >= 0).sort((a, b) => daysUntil(a.exam_at) - daysUntil(b.exam_at))
  const perDay = Math.round((Math.min(80, Math.max(1, hours)) * 60) / 6)

  return (
    <Page>
      <PageHead title={t('bb.plan.title')} sub={t('bb.plan.lede')} />
      <p className="mt-2 text-small text-muted">
        {t('bb.plan.weekly', { n: hours, m: perDay })}{' '}
        <Link to="/bb/profil" className="font-semibold text-ink underline underline-offset-4">
          {t('bb.plan.set_hours')}
        </Link>
      </p>

      {!exams.length && <Note className="mt-6">{t('bb.plan.no_exams')}</Note>}

      {exams.length > 0 && (
        <ul className="card-grid mt-6" data-hook="bb-plan-exams">
          {exams.map((c) => (
            <li key={c.id} className="lg p-5">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/bb/cours/${c.id}`} className="text-body font-bold text-ink underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                <ExamChip examAt={c.exam_at} />
              </div>
              <Bar className="mt-4" pct={ready[c.id] ?? 0} label={t('bb.plan.ready', { n: ready[c.id] ?? 0 })} />
              {daysUntil(c.exam_at) <= 10 && <p className="mt-3 text-small text-ink">{t('bb.plan.final')}</p>}
            </li>
          ))}
        </ul>
      )}

      {(courses ?? []).length > 0 && (
        <section className="mt-8" data-hook="bb-plan-week">
          <h2 className="eyebrow">{t('bb.plan.today')}</h2>
          <ol className="mt-3 space-y-2">
            {days.map((d, i) => {
              const date = new Date(`${d.date}T12:00:00`)
              return (
                <li key={d.date} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-inner px-4 py-3 ${i === 0 ? 'bg-[#FFE3F0]' : 'bg-surface'}`}>
                  <span className="w-28 shrink-0 text-small font-bold capitalize text-ink">{i === 0 ? t('bb.plan.today') : date.toLocaleDateString(localeTag(locale), { weekday: 'long', day: 'numeric' })}</span>
                  <span className="min-w-0 flex-1 text-small text-ink">
                    {d.rest ? t('bb.plan.rest') : d.eve ? `${name.get(d.items[0].course_id)} · ${t('bb.plan.minutes', { n: d.items[0].minutes })} · ${t('bb.plan.eve')}` : d.items.map((it) => `${name.get(it.course_id)} · ${t('bb.plan.minutes', { n: it.minutes })}`).join('   ')}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </Page>
  )
}
