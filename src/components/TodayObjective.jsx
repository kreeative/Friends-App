import { useState } from 'react'
import { useT } from '../lib/i18n'
import { enqueue, flush } from '../lib/queue'

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
export default function TodayObjective({ cycle, goals, doneGoalIds, onMarked, onDone }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)

  if (!cycle || goals.length === 0) return null

  const next = goals.find((g) => !doneGoalIds.has(g.id))
  const allDone = !next

  async function markDone() {
    if (busy || !next) return
    setBusy(true)

    /**
     * Through the same queue the full form uses.
     *
     * submit_checkin upserts on (cycle_id, user_id) and checkin_items upserts
     * on (checkin_id, goal_id), so sending only this goal adds it without
     * disturbing anything already recorded for the others today. Writing it
     * locally first means a tap on a bad connection is not lost.
     */
    enqueue({
      cycle_id: cycle.id,
      items: [{ goal_id: next.id, outcome: 'done', count_done: 1 }],
    })

    /**
     * Said done before it has been sent.
     *
     * The queue has already accepted it, so it is going to happen whether or
     * not the network is having a good day: waiting for a round trip to admit
     * that is a button that feels broken on the underground. The parent moves
     * its roster and its counter on the same call, and the refetch afterwards
     * either confirms all of it or puts it back.
     */
    onMarked?.(next.id)

    await flush()
    await onDone?.()
    setBusy(false)
  }

  return (
    <div className="mt-8 rounded-card bg-field p-6 text-on-field sm:p-7">
      <span className="block text-label font-semibold uppercase tracking-[0.14em] text-on-field/70">
        {t('board.today_objective')}
      </span>

      {allDone ? (
        <p className="mt-3 text-h1 font-bold leading-[1.1] tracking-[-0.024em]">
          {t('board.done_today')}
        </p>
      ) : (
        <>
          <p className="mt-3 text-h1 font-bold leading-[1.1] tracking-[-0.024em]">
            {next.commitment}
          </p>
          <button
            onClick={markDone}
            disabled={busy}
            className="press mt-6 inline-flex items-center gap-2 rounded-pill bg-on-field px-6 py-3 text-small font-semibold text-field transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? '…' : t('board.one_tap_done')}
          </button>
        </>
      )}
    </div>
  )
}
