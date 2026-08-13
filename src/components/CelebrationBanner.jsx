import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { loadUnseen, markSeen } from '../lib/celebrations'
import { Avatar } from './ui'
import Confetti from './Confetti'

/**
 * Somebody said something about you.
 *
 * The one notification in this app that is unambiguously good news, which is
 * why it is the one thing allowed to interrupt. Everything else the app has to
 * tell you (a missed day, a quiet friend, a budget running short) is delivered
 * quietly and on the screen it belongs to; this arrives at the top of whatever
 * you opened.
 *
 * NOT A MODAL.
 *
 * A modal would be the obvious reading of "display a banner/modal", and it is
 * the wrong one here. A dialog over the whole page with a scrim is the weight
 * of a decision you cannot undo. This is a sentence somebody wrote about you,
 * it needs no answer, and putting it behind a scrim would mean the first thing
 * a compliment does is block the app.
 *
 * Marked seen when it is dismissed rather than when it is rendered. Something
 * that vanished because it happened to paint while the phone was in a pocket
 * is a message that was never delivered.
 */
export default function CelebrationBanner() {
  const { user } = useAuth()
  const { t } = useT()
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!user) return
    let dead = false

    const run = async () => {
      const { rows: found } = await loadUnseen(user.id).catch(() => ({ rows: [] }))
      if (!dead) setRows(found)
    }

    run()
    /* Coming back to the tab, because the thing this reports happened in
       somebody else's browser and nothing in this one will hear about it. */
    const onWake = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onWake)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [user?.id])

  if (rows.length === 0) return null

  const dismiss = async () => {
    const ids = rows.map((r) => r.id)
    setRows([])
    await markSeen(ids).catch(() => {
      /* Offline. It comes back next time, which is the right failure: better
         to be told twice than never. */
    })
  }

  return (
    <div className="lg relative mb-6 overflow-hidden p-5 sm:p-6">
      <Confetti />

      <div className="relative">
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3.5 py-1.5">
            <Avatar
              profile={{ display_name: r.sender_name, avatar_url: r.sender_avatar }}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold text-ink">
                {t('celebrate.banner', { name: r.sender_name ?? '', group: r.group_name ?? '' })}
              </p>
              {/* The message itself in full ink and a size up. The line above
                  is the envelope; this is the thing somebody actually wrote. */}
              <p className="mt-1 text-body text-ink">{r.message}</p>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={dismiss}
          className="goal-action press mt-4"
        >
          {t('celebrate.thanks')}
        </button>
      </div>
    </div>
  )
}
