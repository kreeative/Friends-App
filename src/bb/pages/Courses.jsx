import { Link } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { canAddCourse } from '../../lib/bb/plans'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { ExamChip, Note } from '../kit'

/**
 * /bb/cours: every course, its exam, and the way to add one. On the free
 * plan the second course is where Plus is offered, in a sentence, before the
 * form rather than after it.
 */
export default function Courses() {
  const { t } = useT()
  const { courses, status } = useBB()
  usePageMeta({ title: `${t('bb.courses.title')} · Beauty & Brain` })
  const list = courses ?? []
  const sub = status ? { plan: status.plan, status: status.status, current_period_end: status.current_period_end } : null
  const room = status?.tier === 'owner' || status?.tier === 'plus' ? true : canAddCourse(sub, list.length)

  return (
    <Page>
      <PageHead
        title={t('bb.courses.title')}
        right={
          room ? (
            <Link to="/bb/cours/nouveau" className="btn-ghost press w-auto px-5" data-hook="bb-new-course">
              + {t('bb.courses.new')}
            </Link>
          ) : null
        }
      />
      {!room && (
        <Note className="mt-4">
          {t('bb.courses.limit')}{' '}
          <Link to="/bb/tarifs" className="font-semibold underline underline-offset-4">
            {t('bb.courses.upgrade')}
          </Link>
        </Note>
      )}
      {!list.length ? (
        <section className="lg mt-6 p-6">
          <h2 className="text-h2 text-ink">{t('bb.today.empty_title')}</h2>
          <p className="mt-2 text-body text-muted">{t('bb.today.empty_body')}</p>
          <Link to="/bb/cours/nouveau" className="btn press mt-6 w-auto bg-ink px-8 font-bold text-white hover:opacity-90">
            {t('bb.today.add_course')}
          </Link>
        </section>
      ) : (
        <ul className="card-grid mt-6" data-hook="bb-courses">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/bb/cours/${c.id}`} className="lg press flex h-full flex-col p-5" data-card="bb-course">
                <span className="text-body font-bold text-ink">{c.name}</span>
                <span className="text-small text-muted">{[c.code, c.professor].filter(Boolean).join(' · ') || ' '}</span>
                <ExamChip examAt={c.exam_at} className="mt-4 self-start" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
