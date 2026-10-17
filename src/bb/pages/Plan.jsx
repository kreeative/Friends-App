import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT, localeTag } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { fromHm, toHm } from '../../lib/reminders'
import { dayKey, daysUntil } from '../../lib/bb/days'
import { chapterMastery } from '../../lib/bb/mastery'
import { examsOf, scopeOf } from '../../lib/bb/exams'
import { HORIZON, eventRows, missed, placeDays, planDays } from '../../lib/bb/planner'
import { supabase } from '../../lib/supabase'
import { saveProfile } from '../data'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { Bar, BigButton, ExamChip, Note, examName } from '../kit'
import Squads from '../plan/Squads'

/**
 * /hakkilo/plan, the study plan (section 6, phase 2).
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
  usePageMeta({ title: `${t('bb.plan.title')} · Hakkilo` })
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
      const [{ data: concepts }, { data: reviews }, { data: chapters }] = await Promise.all([
        supabase.from('bb_concepts').select('id, course_id, chapter_id, weight'),
        supabase.from('bb_reviews').select('concept_id, correct, bloom, confidence, created_at').gte('created_at', new Date(Date.now() - 120 * 86400000).toISOString()),
        supabase.from('bb_chapters').select('id, course_id, title, position'),
      ])
      if (!live) return
      const byConcept = {}
      for (const r of reviews ?? []) if (r.concept_id) (byConcept[r.concept_id] ??= []).push(r)
      /* Ready for each exam: over the chapters it covers, so "ready for the
         midterm" does not count the chapters only the final asks. */
      const out = {}
      for (const c of courses ?? []) {
        const own = (concepts ?? []).filter((x) => x.course_id === c.id)
        const mine = (chapters ?? []).filter((x) => x.course_id === c.id)
        for (const e of examsOf(c)) {
          const scope = scopeOf(e, c, mine)
          out[`${c.id}:${e.id}`] = chapterMastery(scope ? own.filter((x) => scope.has(x.chapter_id)) : own, byConcept).pct
        }
      }
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
  /* Every exam to come, midterms and finals of every course, soonest first. */
  const exams = (courses ?? [])
    .flatMap((c) => examsOf(c).filter((e) => e.at && daysUntil(e.at) >= 0).map((e) => ({ course: c, exam: e })))
    .sort((a, b) => daysUntil(a.exam.at) - daysUntil(b.exam.at))
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
  const titleOf = (p) => [kindText(p.kind), p.exam ? examName(t, p.exam) : null, name.get(p.course_id) ?? 'Hakkilo'].filter(Boolean).join(' · ')

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
        <Link to="/hakkilo/profil" className="font-semibold text-ink underline underline-offset-4">
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
          {exams.map(({ course: c, exam: e }) => (
            <li key={`${c.id}:${e.id}`} className="lg p-5" data-hook="bb-plan-exam">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <Link to={`/hakkilo/cours/${c.id}`} className="text-body font-bold text-ink underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                <ExamChip exam={e} course={c} link />
              </div>
              <Bar className="mt-4" pct={ready[`${c.id}:${e.id}`] ?? 0} label={t('bb.plan.ready', { n: ready[`${c.id}:${e.id}`] ?? 0 })} />
              {daysUntil(e.at) <= 10 && <p className="mt-3 text-small text-ink">{t('bb.plan.final')}</p>}
              <Link to={`/hakkilo/examen/${c.id}?e=${e.id}`} className="mt-3 inline-block text-small font-semibold text-ink underline underline-offset-4">
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
                /* On a phone the day sits above its line and the line has the
                   whole width: beside a 7rem date column it had 182px at
                   390, and every study day ran to three lines next to an
                   empty column. Two columns from sm, where there is room. */
                <li key={d.date} className={`grid gap-y-0.5 rounded-inner px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 ${i === 0 ? 'bg-[#F4F4F5]' : 'bg-surface'}`} data-hook="bb-plan-day">
                  <span className="text-small font-bold capitalize text-ink">{i === 0 ? t('bb.plan.today') : date.toLocaleDateString(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="min-w-0 space-y-0.5 text-small text-ink">
                    {(d.exams ?? []).map((ex) => (
                      <span key={`${ex.course_id}:${ex.kind}:${ex.n}`} className="block font-bold">
                        {t('bb.plan.exam_day', { exam: examName(t, ex), name: name.get(ex.course_id) ?? '' })}
                      </span>
                    ))}
                    {d.rest ? (
                      <span className="block">{t('bb.plan.rest')}</span>
                    ) : (
                      d.items.map((it, k) => {
                        const slot = at.find((p) => p.course_id === it.course_id && p.kind === it.kind && p.exam?.kind === it.exam?.kind && p.exam?.n === it.exam?.n)
                        return (
                          <span key={k} className="block">
                            {it.kind === 'mock' ? '⏱ ' : ''}
                            {/* Each dot keeps to the word before it (a no-break
                                space), so a line ends on "80 min ·" instead of
                                the next one starting with "·"; and "35 min"
                                stays whole. */}
                            {[
                              kindText(it.kind),
                              it.exam ? examName(t, it.exam) : null,
                              name.get(it.course_id),
                              t('bb.plan.minutes', { n: it.minutes }).replace(/ /g, ' '),
                              slot ? t('bb.plan.span', { a: timeOf(slot.start_min), b: timeOf(slot.end_min) }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
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
          {/* One sentence, "I study from 6:00 PM to 10:00 PM". On a phone it
              does not fit on a line, and wrapping it put "to" and its field
              under the first one, out of line: a stair. So below sm the two
              fields stand one under the other, each word against its own. */}
          <div className="mt-4 grid w-max grid-cols-[auto_auto] items-center gap-x-3 gap-y-2 sm:flex sm:w-auto sm:flex-wrap">
            <label htmlFor="bb-plan-from" className="text-right text-small font-semibold text-ink">
              {t('bb.plan.from')}
            </label>
            <input id="bb-plan-from" type="time" className="field w-auto" value={from ?? ''} step={900} onChange={(e) => setFrom(e.target.value)} data-hook="bb-plan-from" />
            <label htmlFor="bb-plan-to" className="text-right text-small font-semibold text-ink">
              {t('bb.plan.to')}
            </label>
            <input id="bb-plan-to" type="time" className="field w-auto" value={to ?? ''} step={900} onChange={(e) => setTo(e.target.value)} data-hook="bb-plan-to" />
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
