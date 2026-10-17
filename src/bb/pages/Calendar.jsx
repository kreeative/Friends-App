import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import FullCalendar from '../../pages/Calendar'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { useExamsOnCalendar } from '../kit'

/**
 * /hakkilo/calendrier: the shared calendar as a place of its own.
 *
 *   "Well then also add the calendar tab to hakkilo", then "le calendrier
 *   devrait etre comme sur Rich and Friend avec toutes les views" (Kee).
 *
 * So it is Rich & Friends' own calendar page, not a second one: the month,
 * the week and the day, adding and changing an entry, a whole timetable at
 * once, the layers. It runs in its Hakkilo copy (`study` in
 * src/pages/Calendar.jsx): Hakkilo's colours, its one column, the calendar's
 * own sources only (the timetable, the deadlines, the calendars linked from
 * Google or Outlook), never the cycle, the friends' birthdays or the
 * bookings. The exams come from the courses, as on Today, and open on their
 * course page with their form, where an exam is changed.
 *
 * Today keeps its strip, the glance at the week.
 */
export default function Calendar() {
  const { t } = useT()
  const { courses } = useBB()
  const navigate = useNavigate()
  const examsOnCalendar = useExamsOnCalendar(courses)
  usePageMeta({ title: `${t('bb.nav.calendar')} · Hakkilo` })

  /* An exam on the calendar is `bb-exam:<course>:<exam>` (examEvents). */
  const openExam = useCallback(
    (entry) => {
      const [, course, ...exam] = String(entry?.id ?? '').split(':')
      if (course) navigate(`/hakkilo/cours/${course}${exam.length ? `?examen=${encodeURIComponent(exam.join(':'))}` : ''}`)
    },
    [navigate],
  )

  return (
    <Page>
      <PageHead title={t('bb.today.calendar')} sub={t('bb.calendar.lede')} />
      <section data-hook="bb-calendar-page">
        <FullCalendar study extra={examsOnCalendar} onOpenExtra={openExam} />
      </section>
    </Page>
  )
}
