import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'

/**
 * The response to silence.
 *
 * Two rules shape this component. It never addresses the quiet person — it
 * addresses everyone else, because the one thing that reliably reaches someone
 * who has stopped opening an app is a message from a friend, not another
 * notification. And it is claimed rather than assigned: volunteering is a real
 * commitment, whereas an assigned chore in a friend group produces either
 * silence or a stilted message. The rotation in tick() exists only as a
 * fallback once nobody has stepped up for a day.
 */
export default function NudgeBanner() {
  const { user } = useAuth()
  const { nudges, members, reloadGroup } = useGroup()
  const [busy, setBusy] = useState(null)

  const visible = nudges.filter((n) => n.subject_id !== user?.id)
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

  return (
    <div className="space-y-4 pt-8">
      {visible.map((n) => {
        const claimedByMe = n.claimed_by === user?.id
        const assignedToMe = n.assigned_to === user?.id && n.state === 'pending'

        return (
          // A raised surface rather than a pink wash: this is not something
          // you tap, and pink here would spend the accent on decoration.
          <div key={n.id} className="animate-rise rounded-card bg-surface p-6 shadow-raised">
            <h3 className="text-h2 text-ink">
              {nameOf(n.subject_id)} has been quiet for a couple of weeks.
            </h3>
            <p className="lede mt-3">
              {n.state === 'claimed'
                ? claimedByMe
                  ? "You've got this one. Send them a message — about them, not about the app."
                  : `${nameOf(n.claimed_by)} is checking in on them.`
                : assignedToMe
                  ? 'Nobody picked this one up, so it came to you. A text is plenty.'
                  : 'Someone should say hello — wherever you actually talk, not in here.'}
            </p>

            {n.state === 'pending' && (
              <button onClick={() => claim(n.id)} disabled={busy === n.id} className="btn-primary mt-6">
                {busy === n.id ? 'One moment' : "I'll check on them"}
              </button>
            )}
            {claimedByMe && (
              <button onClick={() => close(n.id)} disabled={busy === n.id} className="btn-ghost mt-6">
                {busy === n.id ? 'One moment' : 'Done — we spoke'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
