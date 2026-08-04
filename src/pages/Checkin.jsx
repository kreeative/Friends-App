import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cyclePhase, untilLabel } from '../lib/time'
import { Field, Screen, Section, TopBar } from '../components/ui'

export default function Checkin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentCycle, myGoals, groupGoals, reloadGroup } = useGroup()

  const goals = useMemo(
    () => [...myGoals, ...groupGoals].filter((g) => g.status === 'active'),
    [myGoals, groupGoals],
  )

  const [answers, setAnswers] = useState({})
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)

  const phase = cyclePhase(currentCycle)

  function set(goalId, patch) {
    setAnswers((a) => ({ ...a, [goalId]: { ...(a[goalId] ?? {}), ...patch } }))
  }

  function outcomeFor(goal, count) {
    if (goal.cadence === 'once') return count > 0 ? 'done' : 'missed'
    const target = goal.target_per_cycle || 1
    if (count >= target) return 'done'
    if (count > 0) return 'partial'
    return 'missed'
  }

  async function submit() {
    if (busy || !currentCycle) return
    setBusy(true)

    const items = goals.map((g) => {
      const a = answers[g.id] ?? {}
      const count = a.count ?? 0
      return {
        goal_id: g.id,
        outcome: a.outcome ?? outcomeFor(g, count),
        count_done: count,
        evidence: a.evidence || null,
      }
    })

    // Local first, network second — a bad connection must never lose this.
    enqueue({ cycle_id: currentCycle.id, next_commitment: next.trim() || null, note: null, items })
    await flush()
    await reloadGroup()
    setBusy(false)
    navigate('/')
  }

  async function markAway() {
    if (!currentCycle) return
    setBusy(true)
    await supabase.from('away_periods').upsert(
      { cycle_id: currentCycle.id, user_id: user.id, reason: null },
      { onConflict: 'cycle_id,user_id' },
    )
    await reloadGroup()
    setBusy(false)
    navigate('/')
  }

  if (!currentCycle) return null

  if (phase !== 'open') {
    return (
      <Screen>
        <TopBar title="Check-in" sub="Window closed" />
        <Section>
          <p className="hair p-5 text-[14px] leading-relaxed text-white/60">
            This cycle's window has closed. The next one opens{' '}
            {untilLabel(currentCycle.closes_at, { prefix: 'in ' })} — nothing to catch up on in the
            meantime.
          </p>
        </Section>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar
        title="Check-in"
        sub={`Closes ${untilLabel(currentCycle.closes_at, { prefix: 'in ' })}`}
      />

      {goals.length === 0 ? (
        <Section>
          <p className="hair p-5 text-[14px] leading-relaxed text-white/60">
            No active goals yet. Add one first — a check-in needs something to check.
          </p>
        </Section>
      ) : (
        <Section title="What actually happened">
          <div className="space-y-2">
            {goals.map((g) => {
              const a = answers[g.id] ?? {}
              const count = a.count ?? 0
              const target = g.target_per_cycle || 1

              return (
                <div key={g.id} className="hair p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-[16px] leading-tight">{g.commitment}</h3>
                    {g.kind === 'group' && <span className="label shrink-0 pt-1">Shared</span>}
                  </div>
                  <p className="label mt-1">
                    Committed: {g.cadence === 'recurring' ? `${target}×` : 'once'}
                    {g.trigger_when ? ` · ${g.trigger_when}` : ''}
                  </p>

                  {g.cadence === 'recurring' ? (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => set(g.id, { count: Math.max(0, count - 1) })}
                        className="hair h-12 w-12 text-[20px] leading-none"
                        aria-label="One fewer"
                      >
                        −
                      </button>
                      <div className="flex-1 text-center">
                        <div className="font-display text-[28px] leading-none">
                          {count}
                          <span className="text-white/30"> / {target}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => set(g.id, { count: Math.min(99, count + 1) })}
                        className="hair h-12 w-12 text-[20px] leading-none"
                        aria-label="One more"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {[
                        ['done', 'Did it'],
                        ['missed', 'Not yet'],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          onClick={() => set(g.id, { outcome: v, count: v === 'done' ? 1 : 0 })}
                          className={`hair py-3 font-mono text-[11px] uppercase tracking-[0.16em] ${
                            (a.outcome ?? '') === v ? 'bg-white text-black' : 'text-white/50'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}

                  {g.evidence_def && (
                    <input
                      className="field mt-3"
                      placeholder={g.evidence_def}
                      value={a.evidence ?? ''}
                      onChange={(e) => set(g.id, { evidence: e.target.value })}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title="One thing for next cycle">
        <Field label="">
          <input
            className="field"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="The single thing you'll do"
            maxLength={280}
          />
        </Field>
      </Section>

      <Section>
        <button onClick={submit} disabled={busy} className="btn-solid">
          {busy ? 'Sending' : 'Submit check-in'}
        </button>
        <button onClick={markAway} disabled={busy} className="btn mt-2">
          I'm away this cycle
        </button>
        <p className="mt-3 text-center text-[12px] leading-snug text-white/30">
          Away weeks don't count against you. They're not misses.
        </p>
      </Section>
    </Screen>
  )
}
