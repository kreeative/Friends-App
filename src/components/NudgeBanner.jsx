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
    await supabase.from('nudges').update({ state: 'done', closed_at: new Date().toISOString() }).eq('id', id)
    await reloadGroup()
    setBusy(null)
  }

  return (
    <div className="space-y-2 px-4 pt-4">
      {visible.map((n) => {
        const claimedByMe = n.claimed_by === user?.id
        const assignedToMe = n.assigned_to === user?.id && n.state === 'pending'

        return (
          <div key={n.id} className="border border-white/40 p-4">
            <p className="label">Quiet for two cycles</p>
            <h3 className="mt-1.5 font-display text-[17px] leading-tight">
              {nameOf(n.subject_id)} hasn't checked in.
            </h3>
            <p className="mt-2 text-[13px] leading-snug text-white/55">
              {n.state === 'claimed'
                ? claimedByMe
                  ? "You're reaching out. Send a message — not about the app."
                  : `${nameOf(n.claimed_by)} is reaching out.`
                : assignedToMe
                  ? 'Nobody volunteered, so this one came to you. A text does it.'
                  : 'Someone should message them directly. Not here — wherever you actually talk.'}
            </p>

            {n.state === 'pending' && (
              <button onClick={() => claim(n.id)} disabled={busy === n.id} className="btn mt-3">
                {busy === n.id ? '…' : "I'll check on them"}
              </button>
            )}
            {claimedByMe && (
              <button onClick={() => close(n.id)} disabled={busy === n.id} className="btn mt-3">
                {busy === n.id ? '…' : 'Done — I spoke to them'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
