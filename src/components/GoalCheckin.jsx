import { useT } from '../lib/i18n'
import { outcomeFor, targetFor } from '../lib/schedule'
import { proofFilled, proofTypeOf } from '../lib/proofKinds'
import ProofField from './ProofField'

/**
 * "Did you do it today?", on the card the goal is on.
 *
 * WHY THIS MOVED OUT OF THE CHECK-IN SCREEN.
 *
 * The check-in was a second copy of the goals list on a page of its own, with
 * one Submit at the bottom that sent all of them at once. Two things were
 * wrong with that and only the second is obvious.
 *
 * The first is that it asked the question in the wrong place. Somebody opening
 * Goals is already looking at the thing they committed to; being told to go
 * somewhere else to say whether they did it is a detour through a screen that
 * lists the same goals again. Answering where the goal is, is the shorter
 * sentence.
 *
 * The second is the button. One Submit for six cards means the act of
 * answering and the act of recording are separated by a scroll, so a person
 * who taps "Did it" on the one goal they care about and closes the app has
 * recorded nothing. The button belongs to the answer, so it is on the card.
 *
 * THE CONTROL DEPENDS ON THE GOAL, WHICH IS THE POINT.
 *
 * A one-off is a yes or a no and gets two chips. Something with a target is a
 * number and gets a counter. Asking "did you do it" about a goal that is three
 * times a week has no true answer on a Tuesday, and asking for a count on a
 * goal that happens once is a question with one possible number in it.
 *
 * SAVING SENDS EVERY ANSWER, NOT JUST THIS ONE, AND THAT IS NOT A BUG.
 *
 * submit_checkin upserts on (cycle_id, user_id) and carries the whole item
 * list, so one row per person per cycle is the shape the database has. A card
 * that sent only its own answer would replace the check-in with a
 * single-goal one and delete the rest. The page owns the answers and hands
 * this component a save that posts all of them, which is also why the page has
 * to READ the existing check-in before it can write: without that, the first
 * card saved would wipe answers recorded on an earlier visit.
 */
export default function GoalCheckin({ goal, answer = {}, onChange, onSave, busy = false, saved = false }) {
  const { t } = useT()

  const target = targetFor(goal)
  const count = answer.count ?? 0
  const proof = proofTypeOf(goal)

  /* Whether this card holds anything worth sending. A card nobody has touched
     is not "0 of 3", it is unanswered, and offering Save on it invites a
     person to record a nought they did not mean. */
  const answered = goal.cadence === 'once' ? Boolean(answer.outcome) : count > 0 || answer.touched

  return (
    <div className="mt-5 border-t border-hairline pt-5" data-hook="goal-checkin" data-goal={goal.id}>
      <p className="field-label">{t('checkin.today_q')}</p>

      {goal.cadence === 'recurring' ? (
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChange({ count: Math.max(0, count - 1), touched: true })}
            className="press h-12 w-12 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink"
            aria-label={t('checkin.fewer')}
          >
            &#8722;
          </button>
          <div className="flex-1 text-center">
            {/* Green once it is met, so the number itself says so rather than
                leaving it to be worked out from two digits that match. */}
            <span className={`font-display text-h1 ${count >= target ? 'text-green' : 'text-ink'}`}>
              {count}
            </span>
            <span className="text-h2 text-muted"> / {target}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange({ count: Math.min(target, count + 1), touched: true })}
            disabled={count >= target}
            className="press h-12 w-12 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink disabled:opacity-40"
            aria-label={t('checkin.more')}
          >
            +
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['done', t('checkin.did_it')],
            ['missed', t('checkin.not_yet')],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={(answer.outcome ?? '') === v}
              onClick={() => onChange({ outcome: v, count: v === 'done' ? 1 : 0, touched: true })}
              className={
                (answer.outcome ?? '') === v
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

      {/**
       * The proof, on the card it is proof of.
       *
       * evidence_def is the sentence somebody wrote to their future self about
       * what would count, so it is the hint above the control rather than a
       * text box of its own. proof_type decides which control gets drawn.
       */}
      {proof !== 'none' && (
        <div className="mt-4">
          <p className="field-label">{goal.evidence_def || t(`proof.want_${proof}`)}</p>
          <ProofField
            type={proof}
            value={answer}
            goalTitle={goal.commitment}
            onChange={(patch) => onChange({ ...patch, touched: true })}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !answered}
          data-hook="goal-save"
          className="goal-action-done press disabled:opacity-40"
        >
          {busy ? t('checkin.sending') : t('checkin.save_one')}
        </button>

        {/* Said out loud, because the whole reason the button is here is that
            a person should be able to answer one goal and leave. If they
            cannot tell it landed, the button has not solved anything. */}
        {saved && !busy && (
          <span className="text-small font-semibold text-green" role="status" data-hook="goal-saved">
            {t('checkin.saved_one')}
          </span>
        )}
        {proof !== 'none' && !proofFilled(answer, proof) && answered && (
          <span className="text-small text-muted">{t('checkin.proof_optional')}</span>
        )}
      </div>
    </div>
  )
}
