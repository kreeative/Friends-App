import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT, localeTag } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { SegTabs } from '../../components/ui'
import { daysUntil, sessionsToday, studyStreak } from '../../lib/bb/days'
import { weeklyLine } from '../../lib/bb/calib'
import { loadDue, loadWeek } from '../data'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { ExamChip, weekText } from '../kit'
import { AskBar } from '../Composer'

/**
 * /bb/app: today. "Due today" is the main button (section 3.2): one per
 * course, nearest exam first, with the session length picked once above.
 *
 * The Beauty line comes first and is about the person, not the score: the
 * streak counted in study days, a break after a lot of sessions, and sleep
 * the night before an exam.
 *
 * Then the week's calibration line (section 3, technique 9): where the
 * "sure and wrong" answers of the last seven days gather, and the twin pair
 * they fall on when they do, with a flag and words, never a colour alone.
 *
 * Above both, the ask bar: a question about a course, the way you would ask
 * Claude, sent straight to the coach. The Beauty line is grey until a
 * session is done today, and turns yellow then: colour is kept for events.
 */
export const PRESETS = [10, 15, 25]

export default function Today() {
  const { t, locale } = useT()
  const { bb, courses, status } = useBB()
  const [minutes, setMinutes] = useState(15)
  const [due, setDue] = useState(null)
  const [week, setWeek] = useState(null)
  usePageMeta({ title: `${t('bb.today.title')} · Beauty & Brain` })

  useEffect(() => {
    let live = true
    loadDue()
      .then((d) => live && setDue(d))
      .catch(() => live && setDue({ due: new Map(), items: new Map(), sessions: [] }))
    loadWeek()
      .then((w) => live && setWeek(weeklyLine(w)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const ordered = useMemo(
    () =>
      [...(courses ?? [])].sort((a, b) => {
        const da = daysUntil(a.exam_at)
        const db = daysUntil(b.exam_at)
        const ka = da == null || da < 0 ? 9999 : da
        const kb = db == null || db < 0 ? 9999 : db
        return ka - kb
      }),
    [courses],
  )

  const sessions = due?.sessions ?? []
  const streak = studyStreak(sessions)
  const doneToday = sessionsToday(sessions)
  const eve = ordered.find((c) => daysUntil(c.exam_at) === 1)
  const date = new Date().toLocaleDateString(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'long' })
  const coachLeft = status?.limits?.coach == null ? null : Math.max(0, status.limits.coach - (status.used?.coach ?? 0))

  return (
    <Page>
      <PageHead eyebrow={date} title={bb?.first_name ? t('bb.today.hi', { name: bb.first_name }) : t('bb.today.hi_anon')} />

      <AskBar courses={ordered} className="mt-5" />

      <section className={`mt-4 rounded-card px-5 py-4 ${doneToday > 0 ? 'bg-[#FFF4C2]' : 'bg-[#F4F4F5]'}`} data-hook="bb-beauty-line" aria-live="polite">
        <p className="text-body font-semibold text-ink">
          {eve
            ? t('bb.today.sleep')
            : doneToday >= 3
              ? t('bb.today.break', { n: doneToday })
              : doneToday > 0
                ? t('bb.today.done_today')
                : streak > 0
                  ? t('bb.today.streak', { n: streak })
                  : t('bb.today.streak_zero')}
        </p>
        {doneToday > 0 && streak > 0 && !eve && <p className="mt-1 text-small text-ink">{t('bb.today.streak', { n: streak })}</p>}
      </section>

      {week && (
        <section className="mt-3 rounded-card bg-[#F4F4F5] px-5 py-4" data-hook="bb-week-line">
          <p className="text-small font-bold uppercase tracking-[0.02em] text-ink">⚑ {t('bb.calib.week_title')}</p>
          <p className="mt-1 text-body text-ink">
            {weekText(t, week)}
            {week.course_id && (
              <>
                {' '}
                <Link to={`/bb/cours/${week.course_id}/erreurs`} className="font-semibold underline underline-offset-4">
                  {t('bb.calib.week_go')}
                </Link>
              </>
            )}
          </p>
        </section>
      )}

      {!ordered.length ? (
        <section className="lg mt-6 p-6" data-hook="bb-empty">
          <h2 className="text-h2 text-ink">{t('bb.today.empty_title')}</h2>
          <p className="mt-2 text-body text-muted">{t('bb.today.empty_body')}</p>
          <Link to="/bb/cours/nouveau" className="btn press mt-6 w-auto bg-ink px-8 font-bold text-white hover:opacity-90" data-hook="bb-add-first">
            {t('bb.today.add_course')}
          </Link>
        </section>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="eyebrow">{t('bb.today.title')}</h2>
            <SegTabs value={minutes} options={PRESETS} onChange={setMinutes} label={t('bb.course.minutes', { n: minutes })} hook="bb-minutes" labelOf={(n) => t('bb.course.minutes', { n })} />
          </div>
          <ul className="card-grid mt-4" data-hook="bb-today-courses">
            {ordered.map((c, i) => {
              const n = due?.due.get(c.id) ?? 0
              const items = due?.items.get(c.id) ?? 0
              return (
                <li key={c.id} className="lg flex flex-col p-5" data-card="bb-course">
                  <Link to={`/bb/cours/${c.id}`} className="break-words text-body font-bold text-ink underline-offset-4 hover:underline">
                    {c.name}
                  </Link>
                  {c.code && <p className="text-small text-muted">{c.code}</p>}
                  <ExamChip examAt={c.exam_at} className="mt-3 self-start" />
                  <p className="mt-3 text-small font-semibold text-ink">
                    {items === 0 ? t('bb.today.preparing') : n > 0 ? t('bb.today.due', { n }) : t('bb.today.due_none')}
                  </p>
                  {items > 0 ? (
                    <Link
                      to={`/bb/session/${c.id}?m=${minutes}`}
                      data-hook="bb-start"
                      className={`btn press mt-4 text-center font-bold ${i === 0 ? 'bg-ink text-white hover:opacity-90' : 'btn-ghost'}`}
                    >
                      {t('bb.today.start', { n: minutes })}
                    </Link>
                  ) : (
                    <Link to={`/bb/cours/${c.id}`} className="btn-ghost press mt-4">
                      {t('bb.proc.title')}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="mt-8 text-small text-muted" data-hook="bb-allowance">
        {coachLeft == null ? null : t('bb.today.left_coach', { n: coachLeft })}
      </p>
    </Page>
  )
}
