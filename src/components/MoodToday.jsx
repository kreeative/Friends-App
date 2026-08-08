import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { isMissingTable, readLocal, today, writeLocal } from '../lib/moodStore'
import MoodBoard from './MoodBoard'

/**
 * How you are today, on the dashboard.
 *
 * It used to live inside the check-in, which meant it only existed during the
 * hours a group's window happened to be open, and only if you were in a group
 * at all. That is backwards twice: how you are is a fact about your Tuesday
 * rather than about a schedule, and the person most worth asking is the one
 * who has not opened a check-in in three weeks.
 *
 * Works with or without the database. Without it, the mood is kept on this
 * device and the sharing toggle explains why it is unavailable rather than
 * appearing and reaching nobody. With it, the row wins: it is the only copy
 * other people can see and the only one that follows you between devices.
 */
export default function MoodToday({ groupCount = 0 }) {
  const { user } = useAuth()
  const { t } = useT()

  /**
   * Rendered from this device first, then corrected by the database.
   *
   * Nothing here waits on the network to paint. An earlier version held the
   * whole block back until a query returned, and when that query hung -- an
   * unreachable host does not reject, it simply never answers -- the mood
   * picker did not appear at all. A picker that vanishes on a slow connection
   * is worse than one showing a slightly stale face for half a second.
   *
   * `local` starts true and is only cleared once a real row comes back, so
   * the sharing toggle can never appear before there is somewhere to share
   * to.
   */
  const saved = useState(() => readLocal())[0]
  const [mood, setMood] = useState(saved?.mood ?? null)
  const [shared, setShared] = useState(false)
  const [local, setLocal] = useState(true) // until the database says otherwise

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      /* Both failure shapes, because they are different: a missing table
         resolves with an error, an unreachable host rejects or hangs. Either
         way the device copy already on screen stands. */
      try {
        const { data, error } = await supabase
          .from('daily_mood')
          .select('mood, shared')
          .eq('user_id', user.id)
          .eq('day', today())
          .maybeSingle()

        if (cancelled || error) return

        setLocal(false)
        setShared(data?.shared ?? false)
        // Only adopt the server's mood if there is one. A row that does not
        // exist yet must not wipe a face tapped a moment ago offline.
        if (data?.mood) setMood(data.mood)
      } catch {
        /* Device copy stands. */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const persist = useCallback(
    async (nextMood, nextShared) => {
      /* The device copy is written first and unconditionally. Whatever the
         network does next, the tap is not lost. */
      writeLocal(nextMood)
      if (local || !user) return

      try {
        if (nextMood === null) {
          await supabase.from('daily_mood').delete().eq('user_id', user.id).eq('day', today())
          return
        }

        const { error } = await supabase.from('daily_mood').upsert(
          {
            user_id: user.id,
            day: today(),
            mood: nextMood,
            shared: nextShared,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day' },
        )
        // The table was never there, or went away mid-session. Keep what was
        // tapped and stop claiming it is shared.
        if (error && isMissingTable(error)) {
          setLocal(true)
          setShared(false)
        }
      } catch {
        setLocal(true)
        setShared(false)
      }
    },
    [local, user?.id],
  )

  async function pick(next) {
    // Tapping the same face again clears it, matching the check-in's rule.
    const value = next === null || next === mood ? null : next
    setMood(value)
    await persist(value, shared)
  }

  async function toggleShare(next) {
    setShared(next)
    if (mood) await persist(mood, next)
  }

  return (
    <div className="lg p-6">
      <MoodBoard value={mood} onChange={pick} />

      <p className="mt-5 text-small text-muted">{t('mood.hint')}</p>

      {/**
       * Only once something has been picked, and only if there is anyone to
       * share it with. Offering to broadcast a mood to nobody is noise, and
       * offering it before a mood exists is asking about a decision that has
       * not come up yet.
       */}
      {mood && groupCount > 0 && (
        local ? (
          /* Not a disabled checkbox. A control you can see and cannot use
             invites you to keep trying it; a sentence explains once. */
          <p className="mt-5 rounded-inner bg-ink/[0.035] p-4 text-small text-muted">
            {t('mood.share_unavailable')}
          </p>
        ) : (
          <label className="press mt-5 flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => toggleShare(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
            />
            <span>
              <span className="block text-body text-ink">{t('mood.share')}</span>
              <span className="mt-1 block text-small text-muted">
                {shared ? t('mood.share_on') : t('mood.share_off')}
              </span>
            </span>
          </label>
        )
      )}

      {/* Said once, quietly, and only when it is true. */}
      {local && mood && (
        <p className="mt-3 text-small text-muted/80">{t('mood.local_note')}</p>
      )}
    </div>
  )
}
