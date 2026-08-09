import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { shortDate } from '../lib/time'
import { localeTag, useT } from '../lib/i18n'

/**
 * Finished states. Each gets its own card colour and a chip, rather than the
 * word appended to the cadence line where it was previously. "3 times a day
 * · done" is the kind of sentence you read past.
 */
const DONE = {
  completed: { label: 'goal.done', card: 'card-done', chip: 'chip-green' },
  abandoned: { label: 'goal.dropped', card: 'card-dropped', chip: 'chip-quiet' },
}

export default function GoalCard({
  goal,
  owner,
  showControls = false,
  progress = null,
  editHref = null,
}) {
  const { reloadGroup } = useGroup()
  const { t, locale } = useT()
  const paused = goal.status === 'paused'
  const finished = DONE[goal.status] ?? null

  async function setStatus(status) {
    await supabase.from('goals').update({ status }).eq('id', goal.id)
    await reloadGroup()
  }

  const cadence =
    goal.cadence === 'recurring'
      ? t('goal.times_a_day', { n: goal.target_per_cycle })
      : t('goal.by_date', { date: shortDate(goal.due_on, localeTag(locale)) })

  return (
    <article
      className={`${finished?.card ?? 'card'} transition-opacity duration-200 ease-settle ${
        paused ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-h2 text-ink">{goal.commitment}</h3>
        {finished && <span className={`${finished.chip} shrink-0`}>{t(finished.label)}</span>}
      </div>

      <p className="mt-1.5 text-small text-muted">
        {cadence}
        {paused && ` · ${t('goal.paused')}`}
      </p>

      {(goal.trigger_when || goal.trigger_where) && (
        <p className="mt-4 text-small text-muted">
          {[goal.trigger_when, goal.trigger_where].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Not muted/75. --c-muted is already tuned to sit just above 4.5:1, so
          three quarters of it measured 3.0:1 on a plain white card, the
          quietest line on the card was the one that failed. The "Proof:"
          prefix distinguishes it from the trigger line above without needing
          a second, lighter grey to do it. */}
      {goal.evidence_def && (
        <p className="mt-1 text-small text-muted">
          {t('goal.proof', { text: goal.evidence_def })}
        </p>
      )}

      {progress && (
        <div className="mt-6">
          {/* Yellow, not pink: this is progress, not something you tap. */}
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-settle"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="mt-2.5 text-small text-muted">
            {t('goal.progress', { done: progress.actual, total: progress.target })}
          </p>
        </div>
      )}

      {/**
       * Wraps as a column below `sm`. Three controls and an owner name do not
       * fit on one phone-width line, and as a single flex row the buttons
       * wrapped underneath each other while the name stayed put, so they
       * overlapped, which is what it looked like: a pile.
       */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-small text-muted">
          {owner ? owner.display_name : t('goal.everyone')}
          {goal.stake_text && ` · ${goal.stake_text}`}
        </span>

        {showControls && !finished && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {editHref && (
              <Link to={editHref} className="goal-action press">
                {t('goal.edit')}
              </Link>
            )}
            <button
              onClick={() => setStatus(paused ? 'active' : 'paused')}
              className="goal-action-fill press"
            >
              {paused ? t('goal.resume') : t('goal.pause')}
            </button>
            <button onClick={() => setStatus('completed')} className="goal-action-done press">
              {t('goal.mark_done')}
            </button>
          </div>
        )}

        {/* An archived goal keeps one control: putting it back. Nothing else
            makes sense on a record, and a finished goal you want to restart is
            common enough to be worth one tap. */}
        {showControls && finished && (
          <button
            onClick={() => setStatus('active')}
            className="goal-action-fill press self-start"
          >
            {t('goal.reopen')}
          </button>
        )}
      </div>
    </article>
  )
}
