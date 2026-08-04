import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { shortDate } from '../lib/time'

export default function GoalCard({ goal, owner, showControls = false, progress = null }) {
  const { reloadGroup } = useGroup()
  const paused = goal.status === 'paused'

  async function setStatus(status) {
    await supabase.from('goals').update({ status }).eq('id', goal.id)
    await reloadGroup()
  }

  const cadence =
    goal.cadence === 'recurring'
      ? `${goal.target_per_cycle} ${goal.target_per_cycle === 1 ? 'time' : 'times'} a week`
      : `by ${shortDate(goal.due_on)}`

  return (
    <article
      className={`card transition-opacity duration-200 ease-settle ${paused ? 'opacity-55' : ''}`}
    >
      <h3 className="text-h2 text-ink">{goal.commitment}</h3>

      <p className="mt-1.5 text-small text-muted">
        {cadence}
        {paused && ' · paused'}
      </p>

      {(goal.trigger_when || goal.trigger_where) && (
        <p className="mt-4 text-small text-muted">
          {[goal.trigger_when, goal.trigger_where].filter(Boolean).join(', ')}
        </p>
      )}

      {goal.evidence_def && (
        <p className="mt-1 text-small text-muted/75">Proof: {goal.evidence_def}</p>
      )}

      {progress && (
        <div className="mt-6">
          {/* Gold, not pink: this is progress, not something you tap. */}
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
            <div
              className="h-full rounded-pill bg-gold transition-[width] duration-300 ease-settle"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="mt-2.5 text-small text-muted">
            {progress.actual} of {progress.target} so far this week
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="text-small text-muted">
          {owner ? owner.display_name : 'Everyone'}
          {goal.stake_text && ` · ${goal.stake_text}`}
        </span>

        {showControls && (
          <div className="-mr-2 flex gap-1">
            <button
              onClick={() => setStatus(paused ? 'active' : 'paused')}
              className="rounded-pill px-3 py-1.5 text-small text-muted transition-colors duration-200 ease-settle hover:bg-ink/[0.05] hover:text-ink"
            >
              {paused ? 'Pick it back up' : 'Pause'}
            </button>
            <button
              onClick={() => setStatus('completed')}
              className="rounded-pill px-3 py-1.5 text-small text-muted transition-colors duration-200 ease-settle hover:bg-ink/[0.05] hover:text-ink"
            >
              Mark done
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
