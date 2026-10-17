import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT, localeTag } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { fromHm, toHm } from '../../lib/reminders'
import { dayKey, daysUntil } from '../../lib/bb/days'
import { chapterMastery } from '../../lib/bb/mastery'
import { HORIZON, eventRows, missed, placeDays, planDays } from '../../lib/bb/planner'
import { supabase } from '../../lib/supabase'
import { saveProfile } from '../data'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { Bar, BigButton, ExamChip, Note } from '../kit'
import Squads from '../plan/Squads'

/**
 * /bb/plan, the study plan (section 6, phase 2).
 *
 *   Built from the exam date, blueprint, mastery and the student's available
 *   hours. Every day mixes new material, due reviews and mock exams: at
 *   least two, the last 3 to 5 days before. One rest day a week. Re-plans
 *   when a day is missed. Written into the Rich & Friends calendar.
 *
 * WHAT and WHEN are two steps (src/lib/bb/planner.js): planDays() decides
 * what each of the next fourteen days holds, placeDays() finds a time for it
 * inside the student's study hours, around everything already on her
 * calendar (classes included, recurring ones too).
 *
 * WRITING IT. One button writes the blocks as "étude" entries of the Rich &
 * Friends calendar, the same rows the syllabus planner writes, and keeps
 * each day in bb_plan_days with the entry it made. Writing again replaces
 * the future part of the previous plan, never the past, and never anything
 * the student put in her calendar herself.
 *
 * MISSED DAYS. A planned day that went by with no session on that course (or
 * no finished mock exam on a mock day) is a missed day; the page says so and
 * offers to plan again from today. Nothing is rescheduled behind her back.
 *
 * Under it, the study squads (src/bb/plan/Squads.jsx).
 */
const DEFAULT_FROM = 18 * 60
const DEFAULT_TO = 22 * 60

export default function Plan() {
  const { t, locale } = useT()
  const { user } = useAuth()
  const { bb, setBB, courses } = useBB()
  usePageMeta({ title: `${t('bb.plan.title')} · Beauty & Brain` })
  const [ready, setReady] = useState({})
  const [cal, setCal] = useState(null)
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [written, setWritten] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (bb && from == null) {
      setFrom(toHm(bb.study_from ?? DEFAULT_FROM))
      setTo(toHm(bb.study_to ?? DEFAULT_TO))
    }
  }, [bb, from])

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

  /* The calendar as it stands, the plan rows, and what was studied. */
  const loadCal = useCallback(async () => {
    const since = new Date(Date.now() - 21 * 86400000)
    const [events, plan, sessions, exams] = await Promise.all([
      supabase.from('calendar_event').select('*'),
      supabase.from('bb_plan_days').select('*').gte('on_date', dayKey(since)).order('on_date'),
      supabase.from('bb_sessions').select('course_id, started_at, answered').gte('started_at', since.toISOString()),
      supabase.from('bb_exams').select('course_id, started_at, ended_at').gte('started_at', since.toISOString()),
    ])
    setCal({
      events: events.data ?? [],
      plan: plan.error ? [] : plan.data ?? [],
      sessions: sessions.data ?? [],
      exams: exams.error ? [] : exams.data ?? [],
      ok: !events.error && !plan.error,
    })
  }, [])

  useEffect(() => {
    loadCal().catch(() => setCal({ events: [], plan: [], sessions: [], exams: [], ok: false }))
  }, [loadCal])

  const hours = bb?.weekly_hours ?? 5
  const today = dayKey(new Date())
  const name = new Map((courses ?? []).map((c) => [c.id, c.name]))
  const exams = (courses ?? []).filter((c) => (daysUntil(c.exam_at) ?? -1) >= 0).sort((a, b) => daysUntil(a.exam_at) - daysUntil(b.exam_at))
  const perDay = Math.round((Math.min(80, Math.max(1, hours)) * 60) / 6)
  const startMin = fromHm(from ?? '', DEFAULT_FROM)
  const endMin = fromHm(to ?? '', DEFAULT_TO)
  const roomy = endMin - startMin >= 30

  const days = useMemo(() => planDays({ courses: courses ?? [], weeklyHours: hours }), [courses, hours])
  const placement = useMemo(() => {
    if (!cal || !roomy) return null
    /* The future entries of the plan already written are about to be
       replaced: they do not count as busy. */
    const own = new Set(cal.plan.filter((r) => r.event_id && r.on_date >= today).map((r) => r.event_id))
    return placeDays(days, { busy: cal.events.filter((e) => !own.has(e.id)), startMin, endMin })
  }, [cal, days, startMin, endMin, roomy, today])
  const late = useMemo(() => (cal ? missed(cal.plan, { sessions: cal.sessions, exams: cal.exams }) : []), [cal])
  const writtenBefore = cal?.plan.some((r) => r.on_date >= today) ?? false

  const kindText = (kind) => t(`bb.plan.kind.${kind}`)
  const titleOf = (p) => `${kindText(p.kind)} · ${name.get(p.course_id) ?? 'Beauty & Brain'}`

  async function write() {
    if (!placement || !user?.id) return
    setBusy(true)
    setError(null)
    try {
      const future = cal.plan.filter((r) => r.on_date >= today)
      const oldEvents = future.map((r) => r.event_id).filter(Boolean)
      if (oldEvents.length) {
        const { error: e1 } = await supabase.from('calendar_event').delete().in('id', oldEvents)
        if (e1) throw e1
      }
      /* The future of the old plan, and the days it missed: the new plan
         starts today and is the only one that counts. */
      const drop = [...future, ...late].map((r) => r.id)
      if (drop.length) {
        const { error: e2 } = await supabase.from('bb_plan_days').delete().in('id', drop)
        if (e2) throw e2
      }
      const { placed, unplaced } = placement
      let created = []
      const rows = eventRows(placed, { userId: user.id, title: titleOf })
      if (rows.length) {
        const { data, error: e3 } = await supabase.from('calendar_event').insert(rows).select('id, starts_on, start_min')
        if (e3) throw e3
        created = data ?? []
      }
      const idOf = new Map(created.map((e) => [`${String(e.starts_on).slice(0, 10)}:${e.start_min}`, e.id]))
      const dayRows = [
        ...placed.map((p) => ({ course_id: p.course_id, on_date: p.date, kind: p.kind, minutes: p.end_min - p.start_min, event_id: idOf.get(`${p.date}:${p.start_min}`) ?? null })),
        ...unplaced.map((p) => ({ course_id: p.course_id, on_date: p.date, kind: p.kind, minutes: Math.min(600, Math.max(5, p.minutes)), event_id: null })),
        ...days.filter((d) => d.rest).map((d) => ({ course_id: null, on_date: d.date, kind: 'rest', minutes: null, event_id: null })),
      ]
      if (dayRows.length) {
        const { error: e4 } = await supabase.from('bb_plan_days').insert(dayRows)
        if (e4) throw e4
      }
      const row = await saveProfile(user.id, { study_from: startMin, study_to: endMin }).catch(() => null)
      if (row) setBB(row)
      setWritten({ placed: placed.length, unplaced: unplaced.length })
      await loadCal()
    } catch {
      setError(t('bb.plan.write_failed'))
    }
    setBusy(false)
  }

  const timeOf = (m) => toHm(m)
  const slots = new Map()
  for (const p of placement?.placed ?? []) {
    if (!slots.has(p.date)) slots.set(p.date, [])
    slots.get(p.date).push(p)
  }
  const missing = new Map()
  for (const p of placement?.unplaced ?? []) missing.set(p.date, [...(missing.get(p.date) ?? []), p])

  return (
    <Page>
      <PageHead title={t('bb.plan.title')} sub={t('bb.plan.lede')} />
      <p className="mt-2 text-small text-muted">
        {t('bb.plan.weekly', { n: hours, m: perDay })}{' '}
        <Link to="/bb/profil" className="font-semibold text-ink underline underline-offset-4">
          {t('bb.plan.set_hours')}
        </Link>
      </p>

      {late.length > 0 && (
        <div data-hook="bb-plan-missed">
          <Note className="mt-5">
            <strong>{t('bb.plan.missed', { n: late.length })}</strong> {t('bb.plan.missed_body')}
          </Note>
        </div>
      )}

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
              <Link to={`/bb/examen/${c.id}`} className="mt-3 inline-block text-small font-semibold text-ink underline underline-offset-4">
                {t('bb.mock.open')}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(courses ?? []).length > 0 && (
        <section className="mt-8" data-hook="bb-plan-week">
          <h2 className="eyebrow">{t('bb.plan.next', { n: HORIZON })}</h2>
          <ol className="mt-3 space-y-2">
            {days.map((d, i) => {
              const date = new Date(`${d.date}T12:00:00`)
              const at = slots.get(d.date) ?? []
              const none = missing.get(d.date) ?? []
              return (
                <li key={d.date} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-inner px-4 py-3 ${i === 0 ? 'bg-[#F4F4F5]' : 'bg-surface'}`} data-hook="bb-plan-day">
                  <span className="w-28 shrink-0 text-small font-bold capitalize text-ink">{i === 0 ? t('bb.plan.today') : date.toLocaleDateString(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="min-w-0 flex-1 space-y-0.5 text-small text-ink">
                    {(d.exams ?? []).map((cid) => (
                      <span key={cid} className="block font-bold">
                        {t('bb.plan.exam_day', { name: name.get(cid) ?? '' })}
                      </span>
                    ))}
                    {d.rest ? (
                      <span className="block">{t('bb.plan.rest')}</span>
                    ) : (
                      d.items.map((it, k) => {
                        const slot = at.find((p) => p.course_id === it.course_id && p.kind === it.kind)
                        return (
                          <span key={k} className="block">
                            {it.kind === 'mock' ? '⏱ ' : ''}
                            {kindText(it.kind)} · {name.get(it.course_id)} · {t('bb.plan.minutes', { n: it.minutes })}
                            {slot ? ` · ${t('bb.plan.span', { a: timeOf(slot.start_min), b: timeOf(slot.end_min) })}` : ''}
                          </span>
                        )
                      })
                    )}
                    {none.length > 0 && <span className="block font-semibold">{t('bb.plan.no_room')}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {(courses ?? []).length > 0 && (
        <section className="lg mt-8 p-5 sm:p-6" data-hook="bb-plan-calendar">
          <h2 className="text-h2 text-ink">{t('bb.plan.cal_title')}</h2>
          <p className="mt-2 text-body text-ink">{t('bb.plan.cal_lede')}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-small font-semibold text-ink">
              {t('bb.plan.from')}
              <input type="time" className="field mt-1 w-auto" value={from ?? ''} step={900} onChange={(e) => setFrom(e.target.value)} data-hook="bb-plan-from" />
            </label>
            <label className="text-small font-semibold text-ink">
              {t('bb.plan.to')}
              <input type="time" className="field mt-1 w-auto" value={to ?? ''} step={900} onChange={(e) => setTo(e.target.value)} data-hook="bb-plan-to" />
            </label>
          </div>
          {!roomy && <Note tone="error" className="mt-3">{t('bb.plan.window_short')}</Note>}
          {placement && (
            <p className="mt-4 text-small text-ink" data-hook="bb-plan-preview">
              {t('bb.plan.preview', { n: placement.placed.length })}
              {placement.unplaced.length > 0 && ` ${t('bb.plan.preview_none', { n: placement.unplaced.length })}`}
            </p>
          )}
          <BigButton className="mt-4 sm:w-auto sm:px-8" onClick={write} disabled={busy || !placement || !cal?.ok || !placement.placed.length} data-hook="bb-plan-write">
            {busy ? t('bb.plan.writing') : late.length ? t('bb.plan.replan') : writtenBefore ? t('bb.plan.rewrite') : t('bb.plan.write')}
          </BigButton>
          {written && (
            <Note tone="good" className="mt-4">
              {t('bb.plan.written', { n: written.placed })}{' '}
              <Link to="/calendrier" className="font-bold underline underline-offset-4">
                {t('bb.plan.open_cal')}
              </Link>
            </Note>
          )}
          {error && <Note tone="error" className="mt-4">{error}</Note>}
          <p className="mt-4 text-small text-muted">{t('bb.plan.cal_note')}</p>
        </section>
      )}

      <Squads />
    </Page>
  )
}
