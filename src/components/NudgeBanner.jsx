import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'

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
  const { t } = useT()
  const [busy, setBusy] = useState(null)
  /* Optimistic. The row goes to the database and the card goes now: the
     question has been answered and waiting on a round trip to acknowledge it
     is what makes an app feel slow on a phone with two bars. */
  const [hidden, setHidden] = useState(() => new Set())
  const rail = useRef(null)

  const visible = nudges.filter((n) => n.subject_id !== user?.id && !hidden.has(n.id))
  if (visible.length === 0) return null

  const nameOf = (id) =>
    members.find((m) => m.user_id === id)?.profile?.display_name ?? 'Someone'

  async function claim(id) {
    setBusy(id)
    await supabase.rpc('claim_nudge', { p_nudge_id: id })
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

  async function hide(id) {
    setHidden((s) => new Set(s).add(id))
    const { error } = await supabase
      .from('nudge_hidden')
      .upsert({ nudge_id: id, user_id: user.id }, { onConflict: 'nudge_id,user_id' })
    /* Back on screen if the write did not land. A card that vanishes and
       returns on the next load is worse than one that never went: the reader
       has already decided, and the app quietly disagreeing is the shape of
       "I dismissed this and it keeps coming back". */
    if (error) setHidden((s) => { const n = new Set(s); n.delete(id); return n })
  }

  return (
    <div className="pt-8" data-hook="nudges">
      <div
        ref={rail}
        /* Bleeds to both screen edges: the shell pads by 6, so the negative
           margin lets the rail run to the glass and the padding puts the first
           and last card back on the text column. A rail that stops short of
           the edge reads as a rail that has ended. */
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-6 pb-2
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
                  would squeeze the name further. */}
              <button
                type="button"
                onClick={() => hide(n.id)}
                data-hook="nudge-hide"
                aria-label={t('nudge.hide', { name: nameOf(n.subject_id) })}
                className="press absolute right-3 top-3 flex h-9 w-9 items-center justify-center
                           rounded-pill text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {/* pr-10 so a long name never runs under the cross. */}
              <h3 className="pr-10 text-h2 text-ink">
                {t('nudge.quiet', { name: nameOf(n.subject_id) })}
              </h3>
              <p className="lede mt-3">
                {n.state === 'claimed'
                  ? claimedByMe
                    ? t('nudge.claimed_by_me')
                    : t('nudge.claimed_by_other', { name: nameOf(n.claimed_by) })
                  : assignedToMe
                    ? t('nudge.assigned')
                    : t('nudge.open')}
              </p>

              {n.state === 'pending' && (
                <button
                  onClick={() => claim(n.id)}
                  disabled={busy === n.id}
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
