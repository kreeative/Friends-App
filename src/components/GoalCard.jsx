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

  return (
    <article className={`hair p-4 ${paused ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[16px] leading-tight">{goal.commitment}</h3>
        <span className="label shrink-0 pt-1">
          {goal.cadence === 'recurring' ? `${goal.target_per_cycle}×` : shortDate(goal.due_on)}
        </span>
      </div>

      {(goal.trigger_when || goal.trigger_where) && (
        <p className="mt-2 text-[13px] leading-snug text-white/45">
          {[goal.trigger_when, goal.trigger_where].filter(Boolean).join(' · ')}
        </p>
      )}

      {goal.evidence_def && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
          Proof: {goal.evidence_def}
        </p>
      )}

      {progress && (
        <div className="mt-3">
          <div className="hair h-2 w-full">
            <div className="h-full bg-white" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-white/40">
            {progress.actual} / {progress.target} this cycle
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="label">
          {owner ? owner.display_name : 'Everyone'}
          {paused && ' · paused'}
          {goal.stake_text && ` · ${goal.stake_text}`}
        </span>

        {showControls && (
          <div className="flex gap-2">
            <button
              onClick={() => setStatus(paused ? 'active' : 'paused')}
              className="label px-2 py-1 hover:text-white"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => setStatus('completed')}
              className="label px-2 py-1 hover:text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
