import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import WeekStrip from '../../components/WeekStrip'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { useExamsOnCalendar } from '../kit'

/**
 * /hakkilo/calendrier: the shared calendar as a place of its own ("well then
 * also add the calendar tab to hakkilo", Kee, once Today had it).
 *
 * The same strip as Today's: Rich & Friends' own, in its Hakkilo copy
 * (`study` in src/components/WeekStrip.jsx). So the same account, the same
 * calendar_event and the same reads: the timetable, the study sessions the
 * plan wrote, the deadlines, and the exams drawn from the courses, never the
 * check-ins, the moods, the money or the cycle. Here it opens on the month,
 * because a page that is only the calendar is where you look for the midterm;
 * the week is one tap away, on the toggle under the dates.
 *
 * One column, like every Hakkilo page, at every width.
 */
export default function Calendar() {
  const { t } = useT()
  const { courses } = useBB()
  const examsOnCalendar = useExamsOnCalendar(courses)
  usePageMeta({ title: `${t('bb.nav.calendar')} · Hakkilo` })

  return (
    <Page>
      <PageHead title={t('bb.today.calendar')} sub={t('bb.calendar.lede')} />
      <section className="mt-5" data-hook="bb-calendar-page">
        <WeekStrip study month extra={examsOnCalendar} />
      </section>
    </Page>
  )
}
