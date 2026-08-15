import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { isMissingTable, readLocal, today, writeLocal } from '../lib/moodStore'
import { isMissingColumn } from '../lib/dberr'
import { cleanMoods, primaryMood } from '../lib/moods'
import MoodBoard, { MoodBadges } from './MoodBoard'

/**
 * How you are today, on the dashboard.
 *
 * It used to live inside the check-in, which meant it only existed during the
 * hours a group's window happened to be open, and only if you were in a group
 * at all. That is backwards twice: how you are is a fact about your Tuesday
 * rather than about a schedule, and the person most worth asking is the one
 * who has not opened a check-in in three weeks.
 *
 * One line at rest, and the faces open **inside the card**.
 *
 * The previous version put them in a bottom sheet, which threw a dimmed,
 * blurred overlay across the whole page for what is a small optional
 * question. That is the weight of a decision you cannot undo, not of picking
 * a face, and it hid the dashboard behind a scrim to ask something you are
 * free to ignore. Expanding in place keeps the rest of the page visible and
 * keeps the question the size it actually is.
 *
 * The animation is CSS grid, not a motion library. A `grid-template-rows`
 * transition from 0fr to 1fr animates to the content's real height without
 * anybody measuring it, degrades to an instant open where it is unsupported,
 * and costs nothing to ship. Pulling in an animation dependency to move one
 * card would be a poor trade.
 *
 * Works with or without the database. Without it, the mood is kept on this
 * device and the sharing choice explains why it is unavailable rather than
 * appearing and reaching nobody.
 */
export default function MoodToday({ groupCount = 0 }) {
  const { user } = useAuth()
  const { t } = useT()

  /**
   * Rendered from this device first, then corrected by the database.
   *
   * Nothing here waits on the network to paint. An earlier version held the
   * whole block back until a query returned, and when that query hung (an
   * unreachable host does not reject, it simply never answers) the mood
   * picker did not appear at all.
   *
   * `local` starts true and is only cleared once a real row comes back, so the
   * sharing choice can never appear before there is somewhere to share to.
   */
  /* An array now. readLocal predates multi-select and returns a single id, so
     cleanMoods reads it as a list of one rather than needing its own branch. */
  const saved = useState(() => readLocal())[0]
  const [moods, setMoods] = useState(() => cleanMoods(saved?.mood ?? null))
  const [shared, setShared] = useState(false)
  const [local, setLocal] = useState(true) // until the database says otherwise

  /* `draft` is what has been tapped but not saved, so closing the panel
     leaves today's mood exactly as it was. */
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState([])
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
          .select('mood, moods, shared')
          .eq('user_id', user.id)
          .eq('day', today())
          .maybeSingle()

        if (cancelled || error) return

        setLocal(false)
        setShared(data?.shared ?? false)
        /* `moods` first, falling back to `mood`. A row written before migration
           36, or by a client that has not been reloaded since, has an empty
           array and a single value, and reading the array alone would show
           somebody nothing where they had answered. */
        const back = cleanMoods(data?.moods?.length ? data.moods : data?.mood)
        // Only adopt the server's answer if there is one. A row that does not
        // exist yet must not wipe a face tapped a moment ago offline.
        if (back.length) setMoods(back)
      } catch {
        /* Device copy stands. */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const persist = useCallback(
    async (nextMoods, nextShared) => {
      const primary = primaryMood(nextMoods)
      /* The device copy is written first and unconditionally. Whatever the
         network does next, the tap is not lost. It stores the primary, because
         that is the shape readLocal has always had and the only thing the
         offline path ever showed. */
      writeLocal(primary)
      if (local || !user) return

      try {
        if (primary === null) {
          await supabase.from('daily_mood').delete().eq('user_id', user.id).eq('day', today())
          return
        }

        /**
         * Both columns, every time.
         *
         * `mood` is not null and is what the week strip and the group board
         * read, so it keeps being written: the first of the set in catalogue
         * order, which is what primaryMood returns. `moods` carries all of
         * them. Writing one without the other would leave the two disagreeing
         * about the same day.
         */
        const row = {
          user_id: user.id,
          day: today(),
          mood: primary,
          moods: cleanMoods(nextMoods),
          shared: nextShared,
          updated_at: new Date().toISOString(),
        }

        let { error } = await supabase.from('daily_mood').upsert(row, { onConflict: 'user_id,day' })

        /* Migration 36 not run yet. Dropping the array and sending the primary
           alone keeps the tap, loses only the extra faces, and is the right way
           round: a mood recorded as one of the four is better than a mood not
           recorded at all. */
        if (isMissingColumn(error, 'moods')) {
          const { moods: _drop, ...legacy } = row
          ;({ error } = await supabase.from('daily_mood').upsert(legacy, { onConflict: 'user_id,day' }))
        }

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

  function toggle() {
    if (open) return setOpen(false)
    setDraft(moods)
    setDraftShared(shared)
    setOpen(true)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setMoods(draft)
    setShared(draftShared)
    await persist(draft, draftShared)
    setSaving(false)
    setOpen(false)
  }

  /* Every name, joined. Four faces with one word under them would be a caption
     for the first of them. */
  const chosen = moods.length ? moods.map((id) => t(`mood.${id}`)).join(' · ') : null

  return (
    <div className="lg overflow-hidden p-6">
      {/* The resting row. Same shape whether or not a mood is set, so opening
          and closing never makes the heading jump. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {chosen ? (
            <>
              <p className="text-small text-muted">{t('mood.today_is')}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-h2 text-ink">
                <MoodBadges ids={moods} size={30} />
                {chosen}
              </p>
            </>
          ) : (
            /* The question, and nothing under it. There was a second line
               here ("Un geste, et ça reste dans ton historique") explaining
               what tapping a face would do, which is a sentence about a
               feature rather than about the person, on a card whose whole job
               is one small question. The faces below say the rest. */
            <p className="text-h2 text-ink">{t('mood.question_day')}</p>
          )}
        </div>

        <button
          onClick={toggle}
          aria-expanded={open}
          className={`press w-auto shrink-0 rounded-pill px-6 py-2.5 text-small font-semibold transition-colors ${
            chosen || open
              ? 'border border-ink/15 text-ink hover:bg-ink/[0.05]'
              : 'bg-accent text-on-accent'
          }`}
        >
          {open ? t('ui.close') : chosen ? t('mood.change') : t('mood.choose')}
        </button>
      </div>

      {/**
       * The expanding half.
       *
       * The outer grid is what animates: 0fr to 1fr resolves to the content's
       * natural height, so nothing has to be measured and no height is
       * hard-coded. The inner element carries the overflow clip, which is what
       * makes the collapsed state actually zero-height rather than just
       * squashed. Opacity trails slightly behind so the faces fade in as the
       * space opens rather than being visible while cropped.
       */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-settle motion-reduce:transition-none ${
          open ? 'mt-6 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          {/* inert while collapsed, so a closed panel is not a tab stop */}
          <fieldset disabled={!open} className="border-0 p-0">
            {/**
             * Scrolls inside itself rather than pushing the page.
             *
             * Twelve faces at three across is four rows, and with the sharing
             * checkbox and the two buttons under them the open panel is taller
             * than a phone in landscape or a short browser window. The floating
             * nav bar sits over the bottom of the viewport, so the last thing
             * to be clipped is the Save button, which is the one control the
             * panel exists to reach.
             */}
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain border-t border-hairline pt-6">
              <MoodBoard value={draft} onChange={setDraft} />

              {/**
               * Appears the moment a face is tapped, not before. Asking
               * whether to share a mood that has not been picked is asking
               * about a decision that has not come up yet.
               */}
              {draft.length > 0 &&
                groupCount > 0 &&
                (local ? (
                  /* Not a disabled checkbox. A control you can see and cannot
                     use invites you to keep trying it; a sentence explains. */
                  <p className="mt-6 rounded-inner bg-ink/[0.035] p-4 text-small text-muted">
                    {t('mood.share_unavailable')}
                  </p>
                ) : (
                  /* No inner card. A tinted, padded box around one checkbox
                     made a single optional choice look like a section of the
                     form, on a panel that is already a panel. The checkbox
                     sits inline with its label and the state is one short line
                     under it, which is all it ever needed to be. */
                  <label className="press mt-6 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={draftShared}
                      onChange={(e) => setDraftShared(e.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
                    />
                    <span className="min-w-0">
                      <span className="block text-body text-ink">{t('mood.share')}</span>
                      <span className="mt-0.5 block text-small text-muted">
                        {draftShared ? t('mood.share_on') : t('mood.share_off')}
                      </span>
                    </span>
                  </label>
                ))}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse">
                <button
                  onClick={save}
                  disabled={saving}
                  className="btn-primary press sm:w-auto sm:px-9"
                >
                  {saving ? '…' : t('ui.save')}
                </button>
                {/* Clearing is its own button. Tapping the chosen face again
                    also clears it, but that is a gesture you have to know
                    about, and "none of these" is a real answer here. */}
                {draft.length > 0 && (
                  <button onClick={() => setDraft([])} className="btn-ghost press sm:w-auto sm:px-7">
                    {t('mood.clear')}
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Said once, quietly, and only when it is true. */}
      {local && moods.length > 0 && !open && (
        <p className="mt-4 text-small text-muted/80">{t('mood.local_note')}</p>
      )}
    </div>
  )
}
