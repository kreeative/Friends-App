import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { celebrate } from '../lib/celebrations'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'

/**
 * The one part of the check-in that is not about you.
 *
 * Everything above this asks what you did. This asks what somebody else did,
 * and it is the only thing on the screen that cannot be answered by looking at
 * your own week. That is the whole reason it is here rather than in a menu:
 * the moment a person is already thinking about how the day went is the moment
 * they are most likely to remember that their friend passed a driving test.
 *
 * OPTIONAL, AND VISIBLY SO.
 *
 * It used to open itself behind a disclosure, back when it sat in the middle
 * of one long scrolling form and a step that had to be dismissed every day
 * made the check-in longer every day. It now lives behind its own tile in the
 * action bar, which is the same protection from a better direction: it costs
 * nothing until somebody asks for it, and asking for it is one tap.
 *
 * Nothing here blocks Submit, nothing is remembered as skipped, and there is
 * no counter of how often you did or did not use it. It refuses to be an
 * obligation in a quieter way too: no prompt, no suggested recipient, no "you
 * have not celebrated anybody this week". A nudge to say something nice
 * produces things nobody means.
 *
 * IT SENDS ITSELF NOW.
 *
 * It used to ride along with the check-in's own Submit, on the reasoning that
 * a second send button in a form with one Submit is two ways to finish. That
 * was wrong once this became a pane of its own: with the Progress pane's
 * Submit off screen, the only button in front of somebody who had just written
 * a compliment was "Skip", which reads as the app refusing to take it.
 *
 * It is also the wrong coupling. A compliment is not a fact about your day, it
 * does not belong in the same transaction as your counts, and there is no
 * reason somebody should have to file a check-in to tell a friend well done.
 * So this posts on its own, immediately, and says so.
 */
export default function CelebrateStep({ groupId, members = [], value, onChange, onSent }) {
  const { user } = useAuth()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [sent, setSent] = useState(null)

  /* Everybody but you. Celebrating yourself is refused by the database, and
     offering it here and then failing would be a poor way to say so. */
  const others = members.filter((m) => m.user_id !== user?.id)
  if (others.length === 0) {
    return <p className="lg p-5 text-small text-muted">{t('celebrate.alone')}</p>
  }

  const pick = (id) => onChange({ ...value, receiverId: value.receiverId === id ? null : id })
  const ready = Boolean(value.receiverId && value.message.trim())

  async function send() {
    if (!ready || busy) return
    setBusy(true)
    setError(false)

    const name = others.find((m) => m.user_id === value.receiverId)?.profile?.display_name ?? ''
    const { error: err } = await celebrate({
      groupId,
      senderId: user.id,
      receiverId: value.receiverId,
      message: value.message,
    })

    setBusy(false)
    if (err) return setError(true)

    onChange({ receiverId: null, message: '' })
    setSent(name)
    onSent?.()
  }

  return (
    <div className="lg p-5 sm:p-6">
      {/* Said once, where the thing happened, and it stays until something else
          is typed. A toast that vanishes in three seconds is the wrong shape
          for "your friend has been told". */}
      {sent && (
        <p className="mb-5 rounded-inner bg-green/10 p-4 text-small font-semibold text-green">
          {t('celebrate.sent', { name: sent })}
        </p>
      )}

      <p className="text-small text-muted">{t('celebrate.who')}</p>

      {/* A row of faces rather than a select. The list is two to six people you
          know by sight, which is the one case where avatars beat a dropdown
          outright, and it is one tap instead of three. */}
      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {others.map((m) => {
          const on = value.receiverId === m.user_id
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => {
                setSent(null)
                pick(m.user_id)
              }}
              aria-pressed={on}
              className={`press flex w-[4.5rem] shrink-0 flex-col items-center gap-2 rounded-inner py-2 transition-colors ${
                on ? 'bg-accent/15' : 'hover:bg-ink/[0.04]'
              }`}
            >
              <span
                className={`rounded-pill transition-shadow ${
                  on ? 'shadow-[0_0_0_2px_rgb(var(--c-accent))]' : ''
                }`}
              >
                <Avatar profile={m.profile} size={44} />
              </span>
              <span
                className={`w-full truncate px-1 text-center text-label font-semibold ${
                  on ? 'text-ink' : 'text-muted'
                }`}
              >
                {(m.profile?.display_name ?? '').split(/\s+/)[0]}
              </span>
            </button>
          )
        })}
      </div>

      {/**
       * A textarea, not an input.
       *
       * "Fatim a eu la première étape de son permis" is longer than a single
       * line on a phone, and a single-line input answers that by scrolling the
       * text sideways out of view: you cannot read back what you wrote while
       * you are writing it. Three rows fits the sentence people actually type,
       * and it grows no further, so the pane keeps its height.
       */}
      <textarea
        className="field mt-5 w-full resize-none leading-snug"
        rows={3}
        value={value.message}
        onChange={(e) => {
          setSent(null)
          onChange({ ...value, message: e.target.value })
        }}
        placeholder={t('celebrate.message_ph')}
        maxLength={280}
      />

      <p className="mt-2 text-small text-muted">{t('celebrate.visible')}</p>

      {error && <p className="mt-3 text-small text-negative">{t('celebrate.failed')}</p>}

      {/* Disabled until there is both a person and a sentence, because a
          celebration missing either is not a thing the database will take and
          finding that out from a red line is a poor way to learn it. */}
      <button
        type="button"
        onClick={send}
        disabled={!ready || busy}
        className="btn-primary press mt-5"
      >
        {busy ? t('celebrate.sending') : t('celebrate.send')}
      </button>

      {/* Underneath, and only once there is something to take back. A permanent
          Skip on a step that is already optional is a button that mostly does
          nothing. */}
      {(value.receiverId || value.message) && (
        <button
          type="button"
          onClick={() => {
            setSent(null)
            setError(false)
            onChange({ receiverId: null, message: '' })
          }}
          className="press mt-3 w-full py-2 text-center text-small font-semibold text-muted transition-colors hover:text-ink"
        >
          {t('celebrate.skip')}
        </button>
      )}
    </div>
  )
}
