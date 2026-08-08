import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import MoodBoard from './MoodBoard'

/**
 * How you are today, on the dashboard.
 *
 * It used to live inside the check-in, which meant it only existed during the
 * hours a group's window happened to be open, and only if you were in a group
 * at all. That is backwards twice over: how you are is a fact about your
 * Tuesday rather than about a schedule, and the person most worth asking is
 * the one who has not opened a check-in in three weeks.
 *
 * Sharing is off until you turn it on, and the toggle only appears once a
 * mood is picked, because there is nothing to decide about before then.
 */
export default function MoodToday({ groupCount = 0 }) {
  const { user } = useAuth()
  const { t } = useT()

  const [mood, setMood] = useState(null)
  const [shared, setShared] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('daily_mood')
        .select('mood, shared')
        .eq('user_id', user.id)
        .eq('day', today)
        .maybeSingle()
      if (cancelled) return
      // A missing table means the migration has not run. Say so once rather
      // than rendering a picker that silently drops everything tapped into it.
      if (err) setError(err)
      else if (data) {
        setMood(data.mood)
        setShared(data.shared)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, today])

  /* Upsert on the composite key, so tapping four moods in a row leaves one
     row rather than four, and changing your mind late in the day is an edit. */
  const save = useCallback(
    async (nextMood, nextShared) => {
      if (!user) return
      const { error: err } = await supabase.from('daily_mood').upsert(
        {
          user_id: user.id,
          day: today,
          mood: nextMood,
          shared: nextShared,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,day' },
      )
      if (err) setError(err)
    },
    [user?.id, today],
  )

  async function pick(next) {
    // Tapping the same face again clears it, matching the check-in's rule.
    if (next === null || next === mood) {
      setMood(null)
      if (user) await supabase.from('daily_mood').delete().eq('user_id', user.id).eq('day', today)
      return
    }
    setMood(next)
    await save(next, shared)
  }

  async function toggleShare(next) {
    setShared(next)
    if (mood) await save(mood, next)
  }

  if (!ready) return null

  if (error) {
    return (
      <div className="lg p-6">
        <p className="text-body text-muted">{t('mood.not_installed')}</p>
      </div>
    )
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
      )}
    </div>
  )
}
