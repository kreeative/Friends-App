import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { shortDate } from '../lib/time'
import { localeTag, useT } from '../lib/i18n'
import { Avatar } from './ui'

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

  const when = [goal.trigger_when, goal.trigger_where].filter(Boolean).join(', ')

  return (
    /**
     * Four levels, where there used to be one.
     *
     * Every line on this card was the same size and the same colour: the
     * title, the cadence, the trigger, the proof and the owner's name, five
     * stacked sentences in identical type. Nothing was findable, because
     * finding something in a list requires the list to have a shape.
     *
     * So: who it belongs to is a badge above, the commitment is the one big
     * thing, and everything that used to be a sentence underneath is a pill.
     * Pills work here because these facts are short, unordered and scanned
     * rather than read, which is exactly the case running text handles worst.
     */
    <article
      className={`${finished?.card ?? 'lg p-5'} transition-opacity duration-200 ease-settle ${
        paused ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Whose goal it is, first and quietly. It was the last line on the
            card, under the buttons, which is where you put something nobody
            needs; in a shared list it is the first thing you check. */}
        <span className="inline-flex min-w-0 items-center gap-2 rounded-pill bg-accent/[0.14] py-1 pl-1 pr-3">
          {owner ? (
            <Avatar profile={owner} size={20} />
          ) : (
            <span className="h-5 w-5 shrink-0 rounded-pill bg-accent/30" aria-hidden="true" />
          )}
          <span className="truncate text-label font-semibold uppercase tracking-[0.06em] text-ink">
            {owner ? owner.display_name : t('goal.everyone')}
          </span>
        </span>

        {finished && <span className={`${finished.chip} shrink-0`}>{t(finished.label)}</span>}
      </div>

      <h3 className="mt-3 text-h2 font-semibold text-ink">{goal.commitment}</h3>

      {/**
       * Two tones, not one. The cadence is the goal's own rule and carries the
       * accent; when, where, proof and stake are circumstances and sit on ink.
       * A row of five identical pills would be the same flatness the sentences
       * had, in a rounder shape.
       */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-pill bg-accent/[0.14] px-3 py-1 text-label font-semibold text-ink ring-1 ring-inset ring-accent/25">
          {cadence}
        </span>

        {when && (
          <span className="inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            {when}
          </span>
        )}

        {goal.evidence_def && (
          <span className="inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            {t('goal.proof', { text: goal.evidence_def })}
          </span>
        )}

        {goal.stake_text && (
          <span className="inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            {goal.stake_text}
          </span>
        )}

        {paused && (
          <span className="inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            {t('goal.paused')}
          </span>
        )}
      </div>

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
       * Three tiers, left to right in increasing weight: outline to edit, a
       * tint to pause, filled to finish. The owner's name has moved to the
       * badge at the top, so this row is only controls and can simply wrap.
       */}
      {showControls && !finished && (
        <div className="mt-5 flex flex-wrap gap-2">
          {editHref && (
            <Link to={editHref} className="goal-action press">
              {t('goal.edit')}
            </Link>
          )}
          <button
            onClick={() => setStatus(paused ? 'active' : 'paused')}
            className="goal-action-soft press"
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
        <button onClick={() => setStatus('active')} className="goal-action-soft press mt-5">
          {t('goal.reopen')}
        </button>
      )}
    </article>
  )
}
