import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { today } from '../lib/moodStore'
import { Avatar, Section } from './ui'
import { MoodBadge } from './MoodBoard'

/**
 * How the group is feeling today.
 *
 * The mood question moved to the dashboard, and sharing it became a choice, so
 * for a while there was a switch labelled "let my groups see this" that
 * nothing in the app ever acted on. Turning it on changed nothing anybody
 * could observe, which makes it worse than not offering it: it is a promise of
 * an audience that does not exist.
 *
 * This is the audience. Only people who turned it on, only today, and only
 * inside a group you share, all of which is enforced by the policy in
 * 12_daily_mood.sql rather than here. Nothing in this file filters anything.
 * If a row comes back, its owner chose to show it to you.
 *
 * The section is absent rather than empty when nobody has shared. A heading
 * over a blank space reads as something being broken, and "nobody has said how
 * they are today" is not news worth a box.
 */
export default function GroupMoods({ groupId, members = [] }) {
  const { t } = useT()
  const [moods, setMoods] = useState([])

  const load = useCallback(async () => {
    if (!groupId || members.length === 0) return
    const ids = members.map((m) => m.user_id)
    try {
      /**
       * Bounded to today explicitly, even though the policy already bounds
       * everybody else's rows to today.
       *
       * It does not bound yours: you can always read your own mood, on any
       * day. Without this filter your row from last Tuesday comes back with
       * everyone else's row from this morning, and you appear on the board
       * wearing a face you have not picked today.
       *
       * today() is the same helper MoodToday writes with, so the two agree
       * about where the day boundary falls on this device.
       */
      const { data, error } = await supabase
        .from('daily_mood')
        .select('user_id, mood, shared, updated_at')
        .eq('day', today())
        .in('user_id', ids)

      if (error) return
      setMoods(data ?? [])
    } catch {
      /* Offline, or the migration has not been run. Show nothing. */
    }
  }, [groupId, members.map((m) => m.user_id).join(',')])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Keeping it live, two ways, because neither is reliable on its own.
   *
   * Realtime is the good path: a change to daily_mood arrives as a push and
   * the row updates without anybody reloading. It needs the table added to the
   * publication, which 16_realtime_moods.sql does, and it needs a websocket
   * that stays up.
   *
   * Refetching when the tab comes back to the front is the path that always
   * works. Phones suspend sockets in the background, so the common case, the
   * one where you look at this after your friend has picked a face, is exactly
   * the case realtime is worst at. Two cheap mechanisms beat one clever one.
   */
  useEffect(() => {
    if (!groupId) return

    const channel = supabase
      .channel(`moods:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_mood' }, load)
      .subscribe()

    const onWake = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [groupId, load])

  const byUser = new Map(moods.map((m) => [m.user_id, m]))
  const shown = members.filter((m) => byUser.get(m.user_id)?.mood)

  /* The heading goes with the list. Rendering a Section around this from the
     board would leave "How friends are feeling today" standing over a blank
     space on every day nobody had shared, which reads as something broken. */
  if (shown.length === 0) return null

  /**
   * One card per person, rather than one card of rows.
   *
   * This was a single panel with hairlines between the names, which is the
   * right shape for a list of the same kind of thing: a roster, a ledger, a
   * set of categories. A mood is not that. It is one person saying something
   * about their own day, and stacking four of them inside one container reads
   * as a table of results, which is exactly the register this part of the app
   * is trying not to be in.
   *
   * Separate cards also mean the mood glyph sits on its own ground with its
   * own edge, so four saturated colours in a column stop competing across the
   * hairlines between them.
   */
  return (
    <Section title={t('board.moods_today')}>
      <div className="space-y-3">
        {shown.map((m) => {
          const mood = byUser.get(m.user_id)
          return (
            <div key={m.user_id} className="lg flex items-center gap-4 p-4">
              <Avatar profile={m.profile} size={40} />

              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-semibold text-ink">
                  {m.profile?.display_name}
                </div>
                {/* The word under the name rather than beside the glyph. Beside
                    it, a long label like "Reconnaissant" pushed the name into
                    an ellipsis on a phone, so the row lost the one thing it
                    has to say first. */}
                <div className="mt-0.5 truncate text-small text-muted">
                  {t(`mood.${mood.mood}`)}
                </div>
              </div>

              {/* Its own soft well, so the glyph reads as a badge on the card
                  rather than as an image floating at the end of a line. */}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-ink/[0.04]">
                <MoodBadge id={mood.mood} size={26} />
              </span>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
