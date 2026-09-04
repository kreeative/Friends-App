import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushNudge } from '../lib/notifications'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { DismissButton } from './ui'

/**
 * The response to silence.
 *
 * Two rules shape this component. It never addresses the quiet person, it
 * addresses everyone else, because the one thing that reliably reaches someone
 * who has stopped opening an app is a message from a friend, not another
 * notification. And it is claimed rather than assigned: volunteering is a real
 * commitment, whereas an assigned chore in a friend group produces either
 * silence or a stilted message. The rotation in tick() exists only as a
 * fallback once nobody has stepped up for a day.
 *
 * SIDEWAYS, NOT DOWN.
 *
 * These were a vertical stack, and a stack of these is a wall: each card is a
 * heading, a sentence and a button, so three quiet friends pushed everything
 * else on the board below the fold. Worse, a wall of them reads as a backlog
 * of chores rather than as three people, which is the opposite of the point.
 *
 * A rail costs one card's height whatever the count. Scroll-snap rather than a
 * transform and a drag handler, exactly as the welcome deck does: the browser
 * owns the physics, the momentum matches every other scroller on the device,
 * and it stays keyboard and screen-reader reachable for nothing.
 *
 * THE CROSS IS PRIVATE, AND THAT IS THE WHOLE DESIGN OF IT.
 *
 * "Peut-etre que tu veux pas notifier ton ami parce que tu sais qu'il peut
 * pas." That is a fact one person holds. Closing the nudge for everybody would
 * spend private knowledge on a decision belonging to four other people, and it
 * would strand the quiet friend precisely when the person who knew why is also
 * the one who made the card disappear for whoever might otherwise have
 * written. So the cross writes a row to nudge_hidden and hides the card for
 * the reader alone. The nudge stays open. See supabase/40.
 */
export default function NudgeBanner() {
  const { user } = useAuth()
  const { nudges, members, reloadGroup } = useGroup()
  /* Nudges whose push the server confirmed, this session. */
  const [notified, setNotified] = useState(() => new Set())
  const { t } = useT()
  const [busy, setBusy] = useState(null)
  /* Optimistic. The row goes to the database and the card goes now: the
     question has been answered and waiting on a round trip to acknowledge it
     is what makes an app feel slow on a phone with two bars. */
  const [hidden, setHidden] = useState(() => new Set())
  /* Cards whose cross the database refused, this session. */
  const [hideFailed, setHideFailed] = useState(() => new Set())
  const rail = useRef(null)

  const visible = nudges.filter((n) => n.subject_id !== user?.id && !hidden.has(n.id))
  if (visible.length === 0) return null

  const nameOf = (id) =>
    members.find((m) => m.user_id === id)?.profile?.display_name ?? 'Someone'

  /**
   * Claiming is a person saying "I will reach out to them", so the person it
   * is about hears about it in the same minute rather than in the next digest.
   *
   * After the claim, never before: the endpoint checks that the caller is the
   * one who claimed the nudge, so asking first would simply be refused. And
   * the result is deliberately not shown. The claim is what the group needed
   * and it has already happened; whether the other phone was reachable is not
   * something the claimer did wrong or can fix, and the inbox row is written
   * server-side either way.
   */
  async function claim(id) {
    setBusy(id)
    const { error } = await supabase.rpc('claim_nudge', { p_nudge_id: id })
    if (!error) {
      /**
       * ONLY SAY THEY WERE TOLD WHEN THE SERVER SAYS SO.
       *
       * The button says "notify them", so the obvious next line is "they have
       * been told" and the obvious place to put it is the standing text under
       * a claimed card. Both would be wrong.
       *
       * The push is sent by the Supabase function, and until the updated one
       * is deployed the POST reaches the old handler, which ignores the body
       * and runs its scheduled job. Nothing is written, nobody is told, and a
       * line printed from the claim alone would say otherwise. The same holds
       * for a network that dropped the call.
       *
       * So this is shown from the RESULT, and only when the server reports it
       * actually sent. It is transient rather than part of the card, because
       * on the next load nothing in the nudge row records whether a push went
       * out, and a standing sentence would have to be guessed at.
       */
      const res = await pushNudge(id)
      /* === true, not merely truthy. The OLD function answers a POST by
         running its scheduled job and returning { ok, sent: tally }, where
         tally is an object and therefore truthy. `res?.sent` passed against
         it, so the line claiming delivery appeared while nothing had been
         sent, which is precisely the case this check exists to catch. Found
         by driving that exact response in Chromium. */
      if (res?.ok === true && res?.sent === true) setNotified((s2) => new Set(s2).add(id))
    }
    await reloadGroup()
    setBusy(null)
  }

  async function close(id) {
    setBusy(id)
    await supabase
      .from('nudges')
      .update({ state: 'done', closed_at: new Date().toISOString() })
      .eq('id', id)
    await reloadGroup()
    setBusy(null)
  }

  /**
   * DELETE then INSERT, and never an upsert. This is the bug that made the
   * cross do nothing.
   *
   * It was `.upsert(..., { onConflict: 'nudge_id,user_id' })`, which PostgREST
   * sends as INSERT ... ON CONFLICT DO UPDATE. Migration 40 gave nudge_hidden
   * a select, an insert and a delete policy, and granted select, insert and
   * delete. No update, in either. Both halves of that are fatal, and which one
   * bites depends on the database:
   *
   *   - With the grant exactly as migration 40 writes it, EVERY cross fails
   *     with "permission denied for table nudge_hidden". ON CONFLICT DO UPDATE
   *     requires the update privilege up front, whether or not a row conflicts.
   *   - With the update privilege present anyway, which is what Supabase's
   *     default privileges on a new public table hand out, the first cross on
   *     a card succeeds through the insert path and every cross after it fails
   *     with "new row violates row-level security policy (USING expression)",
   *     because there is no update policy for the conflict path to satisfy.
   *
   * Both were reproduced against a real Postgres 16 with migration 40's
   * policies and grants loaded. The second is the one that matches a card that
   * will not go away however many times it is tapped.
   *
   * Delete then insert touches only the two verbs migration 40 actually
   * granted, so it works under either configuration and needs no migration.
   * It also refreshes hidden_at for free, which the seven day expiry depends
   * on: crossing off a card whose earlier cross has expired has to restart the
   * week, and an insert that swallowed the duplicate would have left the old
   * timestamp and hidden nothing.
   *
   * The delete affecting zero rows is the normal case and not an error. It is
   * the insert that reports whether the cross landed.
   */
  async function hide(id) {
    setHidden((s) => new Set(s).add(id))
    setHideFailed((s) => { const n = new Set(s); n.delete(id); return n })

    await supabase.from('nudge_hidden').delete().eq('nudge_id', id).eq('user_id', user.id)
    const { error } = await supabase
      .from('nudge_hidden')
      .insert({ nudge_id: id, user_id: user.id })

    /* Back on screen if the write did not land. A card that vanishes and
       returns on the next load is worse than one that never went: the reader
       has already decided, and the app quietly disagreeing is the shape of
       "I dismissed this and it keeps coming back".

       AND IT SAYS SO NOW. This restored the card in silence, so the only way
       to find out the cross was broken was to keep tapping it and eventually
       tell somebody. A failure the person can see is one they can report; one
       they cannot see is one they carry. */
    if (error) {
      setHidden((s) => { const n = new Set(s); n.delete(id); return n })
      setHideFailed((s) => new Set(s).add(id))
    }
  }

  return (
    <div className="pt-8" data-hook="nudges">
      <div
        ref={rail}
        /* Runs to the edges of the screen rather than of its column, and slides
           under the side nav on the way out. The numbers live in .bleed-row
           because they are the shell's own padding plus the nav's offset, and
           inline they were wrong the moment either changed. */
        className="bleed-row flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((n) => {
          const claimedByMe = n.claimed_by === user?.id
          const assignedToMe = n.assigned_to === user?.id && n.state === 'pending'

          return (
            <div
              key={n.id}
              data-nudge={n.id}
              /**
               * 85% of the viewport, not 100%. The sliver of the next card is
               * the only thing that says there IS a next card: a rail whose
               * items fill the width is indistinguishable from a single card
               * until somebody happens to swipe. Capped so it does not become
               * one absurd card on a tablet.
               */
              className="animate-rise relative w-[85%] max-w-sm shrink-0 snap-start rounded-card bg-surface p-6 shadow-raised"
            >
              {/* Top right, out of the heading's way. The heading is a person's
                  name and it wraps to two lines at this width, so the cross
                  gets its own corner rather than a slot in a flex row that
                  would squeeze the name further.

                  Shared with the birthday rail and the celebration banner now.
                  This was the first of the three and the other two were drawn
                  from it, which is how a 36px target becomes a 32px one on the
                  copy nobody compared side by side. */}
              <DismissButton
                onClick={() => hide(n.id)}
                label={t('nudge.hide', { name: nameOf(n.subject_id) })}
              />

              {/**
               * THE HEADING IS THE GESTURE, NOT THE ABSENCE.
               *
               * It used to be "{name} has been quiet for a couple of weeks",
               * so six quiet friends stacked six reproaches at the top of the
               * board and the rail read as a backlog of chores. That is the
               * thing the sideways layout above was already fighting, and the
               * words were undoing it.
               *
               * Leading with what you can do makes it an idea instead. How
               * long they have been quiet is still there, one line down and in
               * grey, where it is context rather than an accusation.
               *
               * pr-10 so a long name never runs under the cross.
               */}
              <h3 className="pr-10 text-h2 text-ink">
                {t('nudge.reach_out', { name: nameOf(n.subject_id) })}
              </h3>
              <p className="mt-1.5 text-label text-muted" data-hook="nudge-since">
                {t('nudge.quiet')}
              </p>
              <p className="lede mt-3">
                {n.state === 'claimed'
                  ? claimedByMe
                    ? t('nudge.claimed_by_me')
                    : t('nudge.claimed_by_other', { name: nameOf(n.claimed_by) })
                  : assignedToMe
                    ? t('nudge.assigned')
                    : t('nudge.open')}
              </p>

              {hideFailed.has(n.id) && (
                <p
                  className="mt-2 text-small text-muted"
                  data-hook="nudge-hide-failed"
                  role="status"
                >
                  {t('nudge.hide_failed')}
                </p>
              )}

              {notified.has(n.id) && (
                <p className="mt-2 text-small text-muted" data-hook="nudge-notified" role="status">
                  {t('nudge.notified')}
                </p>
              )}

              {n.state === 'pending' && (
                <button
                  onClick={() => claim(n.id)}
                  disabled={busy === n.id}
                  data-hook="nudge-claim"
                  className="btn-primary press mt-6 w-full"
                >
                  {busy === n.id ? t('nudge.busy') : t('nudge.claim')}
                </button>
              )}
              {claimedByMe && (
                <button
                  onClick={() => close(n.id)}
                  disabled={busy === n.id}
                  className="btn-ghost press mt-6 w-full"
                >
                  {busy === n.id ? t('nudge.busy') : t('nudge.close')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* How many there are, and where you are in them. Only past one: a
          counter under a single card is chrome describing nothing. */}
      {visible.length > 1 && (
        <p className="mt-1 px-1 text-label text-muted" data-hook="nudge-count">
          {t('nudge.count', { n: visible.length })}
        </p>
      )}
    </div>
  )
}
