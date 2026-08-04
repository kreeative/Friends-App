import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { Field } from './ui'

/**
 * Rough signals that someone has written an outcome ("hit 10k followers")
 * rather than a process ("post 3 videos a week"). Outcomes are not within the
 * person's control, so holding them accountable for one is unfair and — more
 * practically — unfixable in a bad week, which is when people quit.
 *
 * This only prompts. Hard-blocking would just teach people to phrase around
 * the filter, and some outcome goals are genuinely what someone wants to track.
 */
const OUTCOME_HINTS = [
  /\b\d[\d,.]*\s*(k|m)?\s*(followers?|subs?|subscribers?|users?|customers?|clients?|downloads?|sales?|revenue|mrr|views?|likes?)\b/i,
  /\b(reach|hit|get to|grow to|earn|make)\b.*\b\d/i,
  /\blose\b.*\b\d+\s*(kg|lbs?|pounds?)\b/i,
  /\b(get|be|become)\s+(fit|rich|healthy|famous|better)\b/i,
]

function looksLikeOutcome(text) {
  return OUTCOME_HINTS.some((re) => re.test(text))
}

export default function GoalForm({ onDone, initial = null }) {
  const { user } = useAuth()
  const { group, reloadGroup } = useGroup()

  const [kind, setKind] = useState(initial?.kind ?? 'personal')
  const [commitment, setCommitment] = useState(initial?.commitment ?? '')
  const [cadence, setCadence] = useState(initial?.cadence ?? 'recurring')
  const [target, setTarget] = useState(initial?.target_per_cycle ?? 3)
  const [dueOn, setDueOn] = useState(initial?.due_on ?? '')
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? '')
  const [when, setWhen] = useState(initial?.trigger_when ?? '')
  const [where, setWhere] = useState(initial?.trigger_where ?? '')
  const [evidence, setEvidence] = useState(initial?.evidence_def ?? '')
  const [stake, setStake] = useState(initial?.stake_text ?? '')
  const [goalType, setGoalType] = useState(initial?.goal_type ?? 'process')
  const [dismissedHint, setDismissedHint] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const showOutcomeHint = useMemo(
    () => !dismissedHint && goalType === 'process' && looksLikeOutcome(commitment),
    [commitment, dismissedHint, goalType],
  )

  const canSave =
    commitment.trim().length > 2 &&
    when.trim().length > 0 &&
    evidence.trim().length > 0 &&
    (cadence === 'recurring' || dueOn)

  async function save(e) {
    e.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    const payload = {
      group_id: group.id,
      kind,
      owner_id: kind === 'personal' ? user.id : null,
      commitment: commitment.trim(),
      goal_type: goalType,
      trigger_when: when.trim() || null,
      trigger_where: where.trim() || null,
      evidence_def: evidence.trim() || null,
      cadence,
      target_per_cycle: cadence === 'recurring' ? Number(target) || 1 : 1,
      due_on: cadence === 'once' ? dueOn || null : null,
      ends_on: cadence === 'recurring' ? endsOn || null : null,
      stake_text: stake.trim() || null,
    }

    const q = initial
      ? supabase.from('goals').update(payload).eq('id', initial.id)
      : supabase.from('goals').insert(payload)

    const { error: err } = await q
    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }
    await reloadGroup()
    onDone?.()
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        {['personal', 'group'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`hair py-3 font-mono text-[11px] uppercase tracking-[0.18em] ${
              kind === k ? 'bg-white text-black' : 'text-white/50'
            }`}
          >
            {k === 'personal' ? 'Mine' : 'Whole group'}
          </button>
        ))}
      </div>

      <Field
        label="The commitment"
        hint="What specifically gets done. Not the result you want — the thing you do."
      >
        <input
          className="field"
          value={commitment}
          onChange={(e) => setCommitment(e.target.value)}
          placeholder="Post 3 videos"
          maxLength={200}
        />
      </Field>

      {showOutcomeHint && (
        <div className="hair space-y-3 p-3">
          <p className="text-[13px] leading-snug text-white/70">
            That reads like a result rather than an action. Results depend on things you don't
            control, so a bad week looks like failure even when you did the work.
          </p>
          <p className="text-[13px] leading-snug text-white/70">
            What would you <em>do</em> each week to get there? Track that instead.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDismissedHint(true)
                setGoalType('outcome')
              }}
              disabled={saving}
            >
              Keep as is
            </button>
            <button type="button" className="btn" onClick={() => setDismissedHint(true)}>
              Let me rewrite
            </button>
          </div>
        </div>
      )}

      <div>
        <span className="label mb-1.5 block">Cadence</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['recurring', 'Every cycle'],
            ['once', 'One-off'],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setCadence(v)}
              className={`hair py-3 font-mono text-[11px] uppercase tracking-[0.18em] ${
                cadence === v ? 'bg-white text-black' : 'text-white/50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {cadence === 'recurring' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Times per cycle">
            <input
              type="number"
              min={1}
              max={50}
              className="field"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Until (optional)">
            <input
              type="date"
              className="field"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <Field label="Due by">
          <input
            type="date"
            className="field"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
        </Field>
      )}

      <Field
        label="The trigger — when"
        hint="Naming when and where roughly doubles follow-through versus stating the intention alone."
      >
        <input
          className="field"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          placeholder="After my Tuesday lecture"
        />
      </Field>

      <Field label="The trigger — where">
        <input
          className="field"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="At the library, third floor"
        />
      </Field>

      <Field label="The evidence" hint="What you'll show at check-in that proves it happened.">
        <input
          className="field"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Links to the posted videos"
        />
      </Field>

      <Field label="Stake (optional)" hint="Settled between you — the app only remembers it.">
        <input
          className="field"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          placeholder="Coffee for whoever asks"
        />
      </Field>

      {error && <p className="hair p-3 text-[13px] text-white/70">{error}</p>}

      <button className="btn-solid" disabled={!canSave || saving}>
        {saving ? 'Saving' : initial ? 'Save changes' : 'Add goal'}
      </button>
      {!canSave && (
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
          Commitment, trigger and evidence required
        </p>
      )}
    </form>
  )
}
