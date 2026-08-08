import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { isMissingTable, readLocal, today, writeLocal } from '../lib/moodStore'
import { Sheet } from './ui'
import MoodBoard, { MoodBadge } from './MoodBoard'

/**
 * How you are today, on the dashboard.
 *
 * It used to live inside the check-in, which meant it only existed during the
 * hours a group's window happened to be open, and only if you were in a group
 * at all. That is backwards twice: how you are is a fact about your Tuesday
 * rather than about a schedule, and the person most worth asking is the one
 * who has not opened a check-in in three weeks.
 *
 * It is now one line at rest rather than twelve faces.
 *
 * Twelve coloured glyphs and their labels is a large, loud block, and it sat
 * at the top of the dashboard every day whether or not you had anything to say
 * with it. As a permanent fixture that is a lot of furniture for one optional
 * question. Asking the question in a sentence, and opening the faces only when
 * somebody says yes, gives the picker a whole sheet to breathe in and gives
 * the dashboard its top back.
 *
 * The sharing choice moved inside the same sheet, next to the face, because
 * that is the moment the question is live. Asking it afterwards, from a
 * checkbox further down a page somebody has already stopped reading, is how it
 * went unanswered.
 *
 * Works with or without the database. Without it, the mood is kept on this
 * device and the sharing choice explains why it is unavailable rather than
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
   * whole block back until a query returned, and when that query hung (an
   * unreachable host does not reject, it simply never answers) the mood picker
   * did not appear at all. A picker that vanishes on a slow connection is
   * worse than one showing a slightly stale face for half a second.
   *
   * `local` starts true and is only cleared once a real row comes back, so the
   * sharing choice can never appear before there is somewhere to share to.
   */
  const saved = useState(() => readLocal())[0]
  const [mood, setMood] = useState(saved?.mood ?? null)
  const [shared, setShared] = useState(false)
  const [local, setLocal] = useState(true) // until the database says otherwise

  /* Sheet state. `draft` is what has been tapped but not saved, so backing out
     of the sheet leaves today's mood exactly as it was. */
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [draftShared, setDraftShared] = useState(false)
  const [saving, setSaving] = useState(false)

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

  function openSheet() {
    setDraft(mood)
    setDraftShared(shared)
    setOpen(true)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setMood(draft)
    setShared(draftShared)
    await persist(draft, draftShared)
    setSaving(false)
    setOpen(false)
  }

  const chosen = mood ? t(`mood.${mood}`) : null

  return (
    <>
      {/**
       * The card at rest. One row: what is being asked, and the way in.
       *
       * Both states keep the same shape, so opening and closing the sheet does
       * not make the page jump. The only thing that changes is whether the
       * left half is a question or an answer.
       */}
      <div className="lg flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          {chosen ? (
            <>
              <p className="text-small text-muted">{t('mood.today_is')}</p>
              <p className="mt-1.5 flex items-center gap-2.5 text-h2 text-ink">
                <MoodBadge id={mood} size={30} />
                {chosen}
              </p>
            </>
          ) : (
            <>
              <p className="text-h2 text-ink">{t('mood.question_day')}</p>
              <p className="mt-1 text-small text-muted">{t('mood.optional')}</p>
            </>
          )}
        </div>

        <button
          onClick={openSheet}
          className={`press w-auto shrink-0 rounded-pill px-6 py-2.5 text-small font-bold ${
            chosen ? 'border border-ink/15 text-ink hover:bg-ink/[0.05]' : 'bg-accent text-on-accent'
          }`}
        >
          {chosen ? t('mood.change') : t('mood.choose')}
        </button>
      </div>

      {/* Said once, quietly, and only when it is true. */}
      {local && mood && <p className="mt-3 text-small text-muted/80">{t('mood.local_note')}</p>}

      <Sheet open={open} onClose={() => setOpen(false)} title={t('mood.question')}>
        <MoodBoard value={draft} onChange={(id) => setDraft(id)} />

        <p className="mt-6 text-small text-muted">{t('mood.hint')}</p>

        {/**
         * Appears the moment a face is tapped, not before. Asking whether to
         * share a mood that has not been picked is asking about a decision
         * that has not come up yet.
         */}
        {draft && groupCount > 0 && (
          local ? (
            /* Not a disabled checkbox. A control you can see and cannot use
               invites you to keep trying it; a sentence explains once. */
            <p className="mt-6 rounded-inner bg-ink/[0.035] p-4 text-small text-muted">
              {t('mood.share_unavailable')}
            </p>
          ) : (
            <label className="press mt-6 flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
              <input
                type="checkbox"
                checked={draftShared}
                onChange={(e) => setDraftShared(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
              />
              <span>
                <span className="block text-body text-ink">{t('mood.share')}</span>
                <span className="mt-1 block text-small text-muted">
                  {draftShared ? t('mood.share_on') : t('mood.share_off')}
                </span>
              </span>
            </label>
          )
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary press sm:w-auto sm:px-9"
          >
            {saving ? '…' : t('ui.save')}
          </button>
          {/* Clearing is its own button now. Tapping the chosen face again
              also clears it, but that is a gesture you have to know about,
              and "none of these" is a real answer to this question. */}
          {draft && (
            <button
              onClick={() => setDraft(null)}
              className="btn-ghost press sm:w-auto sm:px-7"
            >
              {t('mood.clear')}
            </button>
          )}
        </div>
      </Sheet>
    </>
  )
}
