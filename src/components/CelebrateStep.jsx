import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { Avatar, Section } from './ui'

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
 * It starts collapsed behind one line and a button. A step that has to be
 * dismissed every day is a step that makes the check-in longer every day, and
 * the check-in being sixty seconds is the product. Nothing here blocks Submit,
 * nothing here is remembered as skipped, and there is no counter anywhere of
 * how often you did or did not use it.
 *
 * It also refuses to be a daily obligation in a quieter way: there is no
 * prompt, no suggestion of who to pick, and no "you have not celebrated
 * anybody this week". A nudge to say something nice produces things nobody
 * means.
 */
export default function CelebrateStep({ members = [], value, onChange }) {
  const { user } = useAuth()
  const { t } = useT()
  const [open, setOpen] = useState(false)

  /* Everybody but you. Celebrating yourself is refused by the database, and
     offering it here and then failing would be a poor way to say so. */
  const others = members.filter((m) => m.user_id !== user?.id)
  if (others.length === 0) return null

  const pick = (id) => onChange({ ...value, receiverId: value.receiverId === id ? null : id })

  const close = () => {
    setOpen(false)
    onChange({ receiverId: null, message: '' })
  }

  return (
    <Section title={t('celebrate.title')}>
      {!open ? (
        <div className="lg flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-[38ch] text-small text-muted">{t('celebrate.prompt')}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="goal-action press shrink-0"
          >
            {t('celebrate.open')}
          </button>
        </div>
      ) : (
        <div className="lg p-5 sm:p-6">
          <p className="text-small text-muted">{t('celebrate.who')}</p>

          {/* A row of faces rather than a select. The list is two to six people
              you know by sight, which is the one case where avatars beat a
              dropdown outright, and it is one tap instead of three. */}
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {others.map((m) => {
              const on = value.receiverId === m.user_id
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => pick(m.user_id)}
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

          <input
            className="field mt-5"
            value={value.message}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
            placeholder={t('celebrate.message_ph')}
            maxLength={280}
          />

          <p className="mt-2 text-small text-muted">{t('celebrate.visible')}</p>

          {/* Skip, not Cancel. It is the same button either way, and "skip" is
              the honest word for a step nobody has to do. */}
          <button type="button" onClick={close} className="btn-ghost press mt-5 sm:w-auto sm:px-8">
            {t('celebrate.skip')}
          </button>
        </div>
      )}
    </Section>
  )
}
