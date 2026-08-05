import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
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
  /\b\d[\d,.]*\s*(k|m)?\s*(followers?|subs?|subscribers?|users?|customers?|clients?|downloads?|sales?|revenue|mrr|views?|likes?|abonn[ée]s?|vues?)\b/i,
  /\b(reach|hit|get to|grow to|earn|make|atteindre|gagner)\b.*\b\d/i,
  /\blose\b.*\b\d+\s*(kg|lbs?|pounds?)\b/i,
  /\bperdre\b.*\b\d+\s*kg\b/i,
  /\b(get|be|become|devenir|être)\s+(fit|rich|healthy|famous|better|riche|mince|c[ée]l[èe]bre)\b/i,
]

function looksLikeOutcome(text) {
  return OUTCOME_HINTS.some((re) => re.test(text))
}

export default function GoalForm({ onDone, initial = null }) {
  const { user } = useAuth()
  const { group, reloadGroup } = useGroup()
  const { t } = useT()

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

  const Toggle = ({ options, value, onChange }) => (
    <div className="flex gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={value === v ? 'chip-accent press' : 'chip-quiet press'}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <form onSubmit={save} className="space-y-8">
      <Toggle
        value={kind}
        onChange={setKind}
        options={[
          ['personal', t('form.mine')],
          ['group', t('form.whole_group')],
        ]}
      />

      <Field label={t('form.commitment')} hint={t('form.commitment_hint')}>
        <input
          className="field"
          value={commitment}
          onChange={(e) => setCommitment(e.target.value)}
          placeholder={t('form.commitment_ph')}
          maxLength={200}
        />
      </Field>

      {showOutcomeHint && (
        <div className="card space-y-4">
          <p className="text-body text-muted">{t('form.outcome_1')}</p>
          <p className="text-body text-muted">{t('form.outcome_2')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="chip-quiet press"
              onClick={() => {
                setDismissedHint(true)
                setGoalType('outcome')
              }}
            >
              {t('form.keep_as_is')}
            </button>
            <button
              type="button"
              className="chip-accent press"
              onClick={() => setDismissedHint(true)}
            >
              {t('form.rewrite')}
            </button>
          </div>
        </div>
      )}

      <div>
        <span className="field-label">{t('form.cadence')}</span>
        <Toggle
          value={cadence}
          onChange={setCadence}
          options={[
            ['recurring', t('form.every_cycle')],
            ['once', t('form.one_off')],
          ]}
        />
      </div>

      {cadence === 'recurring' ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('form.times_per_cycle')}>
            <input
              type="number"
              min={1}
              max={50}
              className="field"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label={t('form.until')}>
            <input
              type="date"
              className="field"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <Field label={t('form.due_by')}>
          <input
            type="date"
            className="field"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
        </Field>
      )}

      <Field label={t('form.when')} hint={t('form.when_hint')}>
        <input
          className="field"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          placeholder={t('form.when_ph')}
        />
      </Field>

      <Field label={t('form.where')}>
        <input
          className="field"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder={t('form.where_ph')}
        />
      </Field>

      <Field label={t('form.evidence')} hint={t('form.evidence_hint')}>
        <input
          className="field"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder={t('form.evidence_ph')}
        />
      </Field>

      <Field label={t('form.stake')} hint={t('form.stake_hint')}>
        <input
          className="field"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          placeholder={t('form.stake_ph')}
        />
      </Field>

      {error && <p className="card text-small text-negative">{error}</p>}

      <button className="btn-primary press" disabled={!canSave || saving}>
        {saving ? t('form.saving') : initial ? t('form.save_changes') : t('form.add_goal')}
      </button>
      {!canSave && <p className="text-center text-small text-muted">{t('form.required')}</p>}
    </form>
  )
}
