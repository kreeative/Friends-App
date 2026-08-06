import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cyclePhase, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { Field, Screen, Section, TopBar } from '../components/ui'
import MoodBoard from '../components/MoodBoard'

export default function Checkin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useT()
  const { activeId, currentCycle, myGoals, groupGoals, reloadGroup } = useGroup()

  const goals = useMemo(
    () => [...myGoals, ...groupGoals].filter((g) => g.status === 'active'),
    [myGoals, groupGoals],
  )

  const [answers, setAnswers] = useState({})
  const [next, setNext] = useState('')
  const [mood, setMood] = useState(null)
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
    enqueue({
      cycle_id: currentCycle.id,
      next_commitment: next.trim() || null,
      note: null,
      mood,
      items,
    })
    await flush()
    await reloadGroup()
    setBusy(false)
    navigate(`/g/${activeId}`)
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
    navigate(`/g/${activeId}`)
  }

  if (!currentCycle) return null

  if (phase !== 'open') {
    return (
      <Screen>
        <TopBar title={t('checkin.title')} sub={t('checkin.window_closed')} />
        <Section>
          <p className="card text-body text-muted">
            {t('checkin.closed_body', { t: untilLabel(currentCycle.closes_at) })}
          </p>
        </Section>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar
        title={t('checkin.title')}
        sub={t('checkin.closes_in', { t: untilLabel(currentCycle.closes_at) })}
      />

      {/**
       * Before the goals, not after them. Opening a check-in with a counter
       * asks "did you perform"; opening it with this asks "how are you",
       * which is the question that keeps someone in a group through the
       * fortnight where the answer to the first one is no.
       */}
      <Section title={t('mood.question')}>
        <div className="lg lg-frost p-5">
          <MoodBoard value={mood} onChange={setMood} />
        </div>
        <p className="mt-4 text-small text-muted">{t('mood.hint')}</p>
      </Section>

      {goals.length === 0 ? (
        <Section>
          <p className="card text-body text-muted">{t('checkin.no_goals')}</p>
        </Section>
      ) : (
        <Section title={t('checkin.what_happened')}>
          <div className="space-y-4">
            {goals.map((g) => {
              const a = answers[g.id] ?? {}
              const count = a.count ?? 0
              const target = g.target_per_cycle || 1

              return (
                <div key={g.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-h2 text-ink">{g.commitment}</h3>
                    {g.kind === 'group' && (
                      <span className="chip-quiet shrink-0">{t('checkin.shared')}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-small text-muted">
                    {g.cadence === 'recurring'
                      ? t('checkin.committed', { n: target })
                      : t('checkin.committed_once')}
                    {g.trigger_when ? ` · ${g.trigger_when}` : ''}
                  </p>

                  {g.cadence === 'recurring' ? (
                    <div className="mt-6 flex items-center gap-4">
                      <button
                        onClick={() => set(g.id, { count: Math.max(0, count - 1) })}
                        className="press h-14 w-14 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink"
                        aria-label={t('checkin.fewer')}
                      >
                        −
                      </button>
                      <div className="flex-1 text-center">
                        <span className="font-display text-metric text-ink">{count}</span>
                        <span className="text-h2 text-muted"> / {target}</span>
                      </div>
                      <button
                        onClick={() => set(g.id, { count: Math.min(99, count + 1) })}
                        className="press h-14 w-14 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink"
                        aria-label={t('checkin.more')}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 flex gap-2">
                      {[
                        ['done', t('checkin.did_it')],
                        ['missed', t('checkin.not_yet')],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => set(g.id, { outcome: v, count: v === 'done' ? 1 : 0 })}
                          className={
                            (a.outcome ?? '') === v
                              ? v === 'done'
                                ? 'chip-green press'
                                : 'chip-accent press'
                              : 'chip-quiet press'
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {g.evidence_def && (
                    <input
                      className="field mt-6"
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

      <Section title={t('checkin.one_thing')}>
        <Field>
          <input
            className="field"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t('checkin.one_thing_ph')}
            maxLength={280}
          />
        </Field>
      </Section>

      <Section>
        <button onClick={submit} disabled={busy} className="btn-primary press">
          {busy ? t('checkin.sending') : t('checkin.submit')}
        </button>
        <button onClick={markAway} disabled={busy} className="btn-ghost press mt-2">
          {t('checkin.away')}
        </button>
        <p className="mt-4 text-center text-small text-muted">{t('checkin.away_note')}</p>
      </Section>
    </Screen>
  )
}
