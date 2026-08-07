import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { shortDate } from '../lib/time'
import { localeTag, useT } from '../lib/i18n'

/* Finished states, which get a label instead of controls. A completed goal is
   a record; offering to pause it is offering to edit history. */
const DONE = { completed: 'goal.done', abandoned: 'goal.dropped' }

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
      ? t('goal.times_a_week', { n: goal.target_per_cycle })
      : t('goal.by_date', { date: shortDate(goal.due_on, localeTag(locale)) })

  return (
    <article
      className={`card transition-opacity duration-200 ease-settle ${paused ? 'opacity-55' : ''}`}
    >
      <h3 className="text-h2 text-ink">{goal.commitment}</h3>

      <p className="mt-1.5 text-small text-muted">
        {cadence}
        {paused && ` · ${t('goal.paused')}`}
        {finished && ` · ${t(finished)}`}
      </p>

      {(goal.trigger_when || goal.trigger_where) && (
        <p className="mt-4 text-small text-muted">
          {[goal.trigger_when, goal.trigger_where].filter(Boolean).join(', ')}
        </p>
      )}

      {goal.evidence_def && (
        <p className="mt-1 text-small text-muted/75">
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
       * wrapped underneath each other while the name stayed put — so they
       * overlapped, which is what it looked like: a pile.
       */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-small text-muted">
          {owner ? owner.display_name : t('goal.everyone')}
          {goal.stake_text && ` · ${goal.stake_text}`}
        </span>

        {showControls && !finished && (
          <div className="-mx-2 flex flex-wrap gap-1 sm:mx-0 sm:-mr-2 sm:justify-end">
            {editHref && (
              <Link to={editHref} className="goal-action press">
                {t('goal.edit')}
              </Link>
            )}
            <button
              onClick={() => setStatus(paused ? 'active' : 'paused')}
              className="goal-action press"
            >
              {paused ? t('goal.resume') : t('goal.pause')}
            </button>
            <button onClick={() => setStatus('completed')} className="goal-action press">
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
            className="goal-action press -mx-2 self-start sm:mx-0 sm:-mr-2"
          >
            {t('goal.reopen')}
          </button>
        )}
      </div>
    </article>
  )
}
