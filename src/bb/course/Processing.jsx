import { useT } from '../../lib/i18n'
import { errorMessage, materialError } from '../errors'
import { Note } from '../kit'
import { isWaiting } from './useProcessing'

/**
 * The panel that says what is happening to the course, file by file, in
 * words: waiting, reading, read (with what was found), failed (why, and a
 * retry). Then the questions of the chapter being prepared, with how many
 * the quality check turned away, because that number is real and the
 * student can see questions are checked.
 */
export default function Processing({ proc, materials, chapters, statusReady }) {
  const { t, locale } = useT()
  const busy = proc.running || materials.some((m) => m.status === 'reading' && !isWaiting(m))
  const open = materials.filter((m) => m.status !== 'ready' || proc.current === m.id)
  const chapter = proc.generating ? chapters.find((c) => c.id === proc.generating) : null
  if (!open.length && !chapter && !proc.stopped && !proc.firstReady) return null

  return (
    <section className="lg mt-6 p-5" data-hook="bb-processing" aria-live="polite">
      <h2 className="text-body font-bold text-ink">{t('bb.proc.title')}</h2>
      {statusReady === false && <Note className="mt-3">{t('bb.proc.no_key')}</Note>}
      {open.length > 0 && (
        <ul className="mt-3 space-y-2">
          {open.map((m) => {
            const reading = proc.current === m.id || (m.status === 'reading' && !isWaiting(m))
            const failed = m.status === 'failed' || proc.errors[m.id]
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inner bg-surface px-3 py-2" data-hook="bb-proc-file">
                <span className="min-w-0 flex-1 truncate text-small font-semibold text-ink">{m.file_name}</span>
                <span className="flex items-center gap-1.5 text-small font-semibold text-ink">
                  {reading && <Spinner />}
                  {failed ? t('bb.proc.failed') : reading ? t('bb.proc.reading') : m.status === 'ready' ? t('bb.proc.ready') : t('bb.proc.uploaded')}
                </span>
                {failed && !reading && (
                  <>
                    <p className="w-full text-small text-ink">{proc.errors[m.id] ? errorMessage(t, locale, proc.errors[m.id]) : materialError(t, m.error)}</p>
                    <button type="button" className="press text-small font-semibold text-ink underline underline-offset-4" onClick={() => proc.retry(m)} disabled={proc.running}>
                      {t('bb.proc.retry')}
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {chapter && (
        <p className="mt-3 flex items-center gap-2 text-small font-semibold text-ink" data-hook="bb-proc-gen">
          <Spinner />
          {t('bb.proc.generating', { chapter: chapter.title, added: proc.added })}
          {proc.rejected > 0 && <span className="font-normal text-muted">· {t('bb.proc.rejected', { n: proc.rejected })}</span>}
        </p>
      )}
      {busy && <p className="mt-3 text-small text-muted">{t('bb.proc.keep_open')}</p>}
      {proc.firstReady && !busy && <Note tone="good" className="mt-3">{t('bb.proc.first_ready')}</Note>}
      {proc.stopped && <Note tone={proc.stopped.error === 'limit' || proc.stopped.error === 'plan_chapters' ? 'info' : 'error'} className="mt-3">{errorMessage(t, locale, proc.stopped)}</Note>}
    </section>
  )
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 animate-spin text-ink motion-reduce:animate-none" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
