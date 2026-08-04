import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { completionRate, consecutiveMisses } from '../lib/stats'
import { Screen, Section, Sheet, Stat, TopBar } from '../components/ui'
import HistoryStrip from '../components/HistoryStrip'
import GoalForm from '../components/GoalForm'

export default function Me() {
  const { user, profile, signOut } = useAuth()
  const { statusesFor, myGoals, reloadGroup } = useGroup()
  const [resetOpen, setResetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows = statusesFor(user?.id)
  const rate = completionRate(rows, 14)
  const quiet = consecutiveMisses(rows)

  /**
   * Frictionless re-entry.
   *
   * Someone coming back after a gap should not have to face a wall of overdue
   * items — that backlog is precisely what makes people close the app and not
   * return. So coming back parks everything old (paused, not failed) and asks
   * for exactly one new thing.
   */
  async function restart() {
    setBusy(true)
    await supabase
      .from('goals')
      .update({ status: 'paused' })
      .eq('owner_id', user.id)
      .eq('status', 'active')
    await reloadGroup()
    setBusy(false)
    setResetOpen(true)
  }

  return (
    <Screen>
      <TopBar title={profile?.display_name ?? 'You'} sub="Your consistency" />

      {quiet >= 2 && (
        <div className="px-4 pt-4">
          <div className="border border-white/40 p-4">
            <p className="label">Been a couple of cycles</p>
            <h3 className="mt-1.5 font-display text-[17px] leading-tight">Still in?</h3>
            <p className="mt-2 text-[13px] leading-snug text-white/55">
              Park what's there and pick one thing. No catching up, no backlog.
            </p>
            <button onClick={restart} disabled={busy} className="btn mt-3">
              {busy ? '…' : "I'm still in — reset me"}
            </button>
          </div>
        </div>
      )}

      <Section title="Last 14 cycles">
        <div className="flex gap-2">
          <Stat
            value={rate.total ? `${rate.done}/${rate.total}` : '—'}
            label="Checked in"
            hint={rate.pct !== null ? `${rate.pct}%` : 'No cycles yet'}
          />
          <Stat value={myGoals.filter((g) => g.status === 'active').length} label="Live goals" />
          <Stat value={rate.away} label="Away" hint="Not counted" />
        </div>
        <p className="mt-3 text-[12px] leading-snug text-white/30">
          A rate, not a streak. A bad cycle moves this a few points — it never resets anything to
          zero.
        </p>
      </Section>

      <Section title="Last 12 cycles">
        <HistoryStrip rows={rows} count={12} />
        <div className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
          <span>█ In</span>
          <span>▨ Away</span>
          <span>□ Missed</span>
        </div>
      </Section>

      <Section>
        <button onClick={signOut} className="btn">
          Sign out
        </button>
      </Section>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="One thing">
        <GoalForm onDone={() => setResetOpen(false)} />
      </Sheet>
    </Screen>
  )
}
