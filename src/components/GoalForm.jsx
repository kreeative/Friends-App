import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Field } from './ui'
import { Slider, useSlider } from './Segmented'

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

/**
 * One numbered step of the form.
 *
 * The form used to be nine fields in an undifferentiated column inside a
 * bottom sheet, which is why it read as a wall you had to get through rather
 * than a set of decisions. It is the same nine fields; grouping them into
 * four named steps is the whole change, and it is enough — you can now tell
 * at a glance where you are and how much is left.
 */
function Step({ n, title, hint, children }) {
  return (
    <section className="border-t border-hairline pt-7 first:border-0 first:pt-0">
      <div className="flex items-baseline gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-ink text-[0.6875rem] font-bold text-white">
          {n}
        </span>
        <div>
          <h3 className="text-h2 text-ink">{title}</h3>
          {hint && <p className="mt-1.5 max-w-[46ch] text-small text-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-6 space-y-6 sm:pl-9">{children}</div>
    </section>
  )
}

/**
 * A two-or-three-way choice where the selection travels rather than swapping.
 *
 * Worth the machinery here specifically because these toggles change what the
 * rest of the form asks for — picking "One-off" replaces two fields with one.
 * When the highlight simply appeared on the other option there was nothing
 * connecting the tap to the fields rearranging underneath it, and it read as
 * the form glitching rather than as an answer being registered.
 */
function Toggle({ options, value, onChange }) {
  const { ref, box } = useSlider(value)

  return (
    <div ref={ref} className="relative inline-flex gap-1 rounded-pill bg-ink/[0.05] p-1">
      <Slider box={box} className="rounded-pill bg-accent" />
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          data-active={value === v}
          onClick={() => onChange(v)}
          className={`relative z-10 rounded-pill px-4 py-1.5 text-small font-bold transition-colors duration-200 ease-settle ${
            value === v ? 'text-on-accent' : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * @param groupId  the group this goal belongs to, or null for a solo goal.
 *                 Null is a real value here, not a missing one — a goal with
 *                 no group is private to you and is the whole point of being
 *                 able to use this without joining anybody.
 */
export default function GoalForm({ onDone, onCancel, initial = null, groupId = null }) {
  const { user } = useAuth()
  const { reloadGroup } = useGroup()
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
  const [remind, setRemind] = useState(initial?.remind ?? true)
  const [goalType, setGoalType] = useState(initial?.goal_type ?? 'process')
  const [dismissedHint, setDismissedHint] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const showOutcomeHint = useMemo(
    () => !dismissedHint && goalType === 'process' && looksLikeOutcome(commitment),
    [commitment, dismissedHint, goalType],
  )

  /* Evidence is no longer required. It is the right thing to write when other
     people are going to see it; on a goal only you can read, insisting on it
     was a gate with nothing behind it. */
  const canSave =
    commitment.trim().length > 2 &&
    when.trim().length > 0 &&
    (cadence === 'recurring' || dueOn)

  async function save(e) {
    e.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    // A goal with no group cannot belong to a group, whatever the toggle says
    // — and the toggle is not shown in that case. Belt and braces, because the
    // database constraint rejects the combination and the error it gives is
    // not one anybody should have to read.
    const effectiveKind = groupId ? kind : 'personal'

    const payload = {
      group_id: groupId,
      kind: effectiveKind,
      owner_id: effectiveKind === 'personal' ? user.id : null,
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
      remind,
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
    <form onSubmit={save} className="space-y-8">
      <Step n={1} title={t('form.step_what')} hint={t('form.commitment_hint')}>
        {/* Only meaningful inside a group. On a solo goal there is no "whole
            group" to pick, and offering the choice invited a save that the
            database would then refuse. */}
        {groupId && (
          <Toggle
            value={kind}
            onChange={setKind}
            options={[
              ['personal', t('form.mine')],
              ['group', t('form.whole_group')],
            ]}
          />
        )}

        <Field label={t('form.commitment')}>
          <input
            className="field"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder={t('form.commitment_ph')}
            maxLength={200}
            autoFocus
          />
        </Field>

        {showOutcomeHint && (
          <div className="card space-y-4">
            <p className="text-body text-muted">{t('form.outcome_1')}</p>
            <p className="text-body text-muted">{t('form.outcome_2')}</p>
            <div className="flex flex-wrap gap-2">
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
      </Step>

      <Step n={2} title={t('form.step_often')} hint={t('form.cadence_hint')}>
        <Toggle
          value={cadence}
          onChange={setCadence}
          options={[
            ['recurring', t('form.every_cycle')],
            ['once', t('form.one_off')],
          ]}
        />

        {cadence === 'recurring' ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('form.times_per_cycle')} hint={t('form.times_hint')}>
              <input
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                className="field"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
            <Field label={t('form.until')} hint={t('form.until_hint')}>
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
      </Step>

      <Step n={3} title={t('form.step_when')} hint={t('form.when_hint')}>
        <Field label={t('form.when')}>
          <input
            className="field"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder={t('form.when_ph')}
          />
        </Field>

        {/* Relabelled and re-explained. "The trigger — where" read as though
            the app were going to check, which it has no way of doing and no
            intention of doing. It is a sentence you write to yourself, and
            saying so removes the only genuinely alarming field in the form. */}
        <Field label={t('form.where')} hint={t('form.where_hint')}>
          <input
            className="field"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder={t('form.where_ph')}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
          />
          <span>
            <span className="block text-body text-ink">{t('form.remind')}</span>
            <span className="mt-1 block text-small text-muted">{t('form.remind_hint')}</span>
          </span>
        </label>
      </Step>

      <Step n={4} title={t('form.step_proof')} hint={t('form.optional_step')}>
        <Field label={t('form.evidence')} hint={t('form.evidence_hint')}>
          <input
            className="field"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={t('form.evidence_ph')}
          />
        </Field>

        {groupId && (
          <Field label={t('form.stake')} hint={t('form.stake_hint')}>
            <input
              className="field"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder={t('form.stake_ph')}
            />
          </Field>
        )}
      </Step>

      {error && <p className="card text-small text-negative">{error}</p>}

      <div className="flex flex-col gap-3 border-t border-hairline pt-7 sm:flex-row-reverse">
        <button className="btn-primary press sm:w-auto sm:px-10" disabled={!canSave || saving}>
          {saving ? t('form.saving') : initial ? t('form.save_changes') : t('form.add_goal')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost press sm:w-auto sm:px-8">
            {t('ui.close')}
          </button>
        )}
      </div>
      {!canSave && <p className="text-small text-muted">{t('form.required')}</p>}
    </form>
  )
}
