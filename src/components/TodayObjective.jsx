import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { enqueue } from '../lib/queue'
import { cheer } from '../lib/burst'
import { errorText } from '../lib/dberr'

/**
 * Today's goal, and one tap to say it happened.
 *
 * The check-in form asks about every goal, wants a count and an optional note,
 * and is the right shape for a weekly review. It is the wrong shape for a
 * daily one: on a cadence of a day the honest answer is usually just "yes",
 * and making somebody open a form to say it is how a daily habit becomes a
 * chore about the app rather than about the thing.
 *
 * So the common case gets a button. Everything else is still the form, which
 * is linked underneath and unchanged.
 *
 * One goal is shown, not a list. If you have three active goals this picks the
 * first unfinished one, because a prompt that lists everything is the list you
 * already have further down the page, and the whole point of this card is to
 * be the single thing you can act on without deciding anything first.
 */
export default function TodayObjective({ cycle, goals, doneGoalIds, groupId, onMarked, onDone }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  if (!cycle || goals.length === 0) return null

  const next = goals.find((g) => !doneGoalIds.has(g.id))
  const allDone = !next

  /**
   * WHY THIS BUTTON LOOPED.
   *
   * It went through the offline queue: enqueue, flush, refetch. flush() has a
   * `flushing` guard so two of them cannot run at once, and AppShell starts an
   * auto-flush that runs on an interval and on every reconnect. When the two
   * overlapped, this flush returned immediately having sent nothing, the
   * refetch that followed asked the server, the server correctly said the goal
   * was not done, and the optimistic tick was rolled back.
   *
   * From the outside that is exactly what was reported: "…" for a moment, then
   * the card comes back untouched. Nothing was lost, the auto-flush sent it a
   * minute later, but the tap looked like it had failed and the obvious
   * response is to press it again.
   *
   * So the tap no longer asks the queue to do it. It calls submit_checkin
   * directly, which cannot be blocked by another flush and answers with the
   * truth, and the queue becomes the fallback for when that call fails: the
   * entry is written locally, the auto-flush picks it up, and the card says so
   * rather than pretending.
   *
   * submit_checkin upserts on (cycle_id, user_id) and checkin_items on
   * (checkin_id, goal_id), so sending only this goal adds it without
   * disturbing anything already recorded for the others today, and pressing
   * twice is harmless.
   */
  async function markDone() {
    if (busy || !next) return
    setBusy(true)
    setFailed(null)

    const item = { goal_id: next.id, outcome: 'done', count_done: 1 }

    try {
      const { error } = await supabase.rpc('submit_checkin', {
        p_cycle_id: cycle.id,
        p_next_commitment: null,
        p_note: null,
        p_items: [item],
        p_mood: null,
      })
      if (error) throw error

      /* Only now, because now it is true. The parent moves its roster and its
         counter on this call, and the refetch underneath confirms it. */
      onMarked?.(next.id)
      /* Same event, same celebration. A goal marked from the board is a goal
         done, and having it be quiet here and loud in the check-in would make
         the two feel like different things. */
      cheer()
      await onDone?.()
    } catch (e) {
      /* Kept, not dropped. The queue retries on its own schedule and on the
         next reconnect, so the tap is not lost; it is just not done yet, and
         the card says which of those it is. */
      enqueue({ cycle_id: cycle.id, items: [item] })
      setFailed(errorText(e) || String(e))
    }

    setBusy(false)
  }

  return (
    /**
     * Compact. This was p-6 on a phone growing to p-7, with a 32px top margin,
     * a heading at text-h1 and a button on another 24px of space: about a
     * third of the first screen for one sentence and one button. The card is
     * the most important thing on the board and it does not need to be the
     * tallest.
     */
    <div className="mt-6 rounded-card bg-field p-4 text-on-field sm:p-5">
      <span className="block text-label font-semibold uppercase tracking-[0.14em] text-on-field/70">
        {t('board.today_objective')}
      </span>

      {allDone ? (
        <p className="mt-1.5 text-h2 font-semibold leading-[1.15] tracking-[-0.02em]">
          {t('board.done_today')}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-h2 font-semibold leading-[1.15] tracking-[-0.02em]">
            {next.commitment}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={markDone}
              disabled={busy}
              className="press inline-flex items-center gap-2 rounded-pill bg-on-field px-5 py-2.5 text-small font-semibold text-field transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? '…' : t('board.one_tap_done')}
            </button>

            {/* The way to a photograph, without hijacking the tap. Marking it
                done is one action and adding proof is another; sending
                somebody to a different tab the moment they press the first
                would take the "one tap" out of the one-tap card. */}
            {groupId && (
              <Link
                to={`/g/${groupId}/checkin`}
                className="text-small font-semibold text-on-field/70 underline-offset-4 hover:underline"
              >
                {t('board.add_proof')}
              </Link>
            )}
          </div>

          {failed && (
            <div className="mt-3">
              <p className="text-small text-on-field/80">{t('board.mark_queued')}</p>
              {/* The reason, verbatim. This component already had the error in
                  hand and printed a reassurance instead, so "it will send when
                  you are back online" was shown to somebody whose connection
                  was fine and whose write the server had refused. There is
                  nothing to try again when the app will not say what went
                  wrong. */}
              <p className="mt-1 break-words text-label text-on-field/70">{failed}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
