import { useState } from 'react'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { inviteErrorKey, respondToProjectInvite } from '../lib/projectData'
import { Avatar } from './ui'

/**
 * "Ann t'ajoute a Afro Nation." Yes or no.
 *
 * WHY IT SAYS A PERSON'S NAME FIRST.
 *
 * "You have been invited to Afro Nation" is a system speaking. The thing that
 * makes somebody tap accept is that a specific friend asked, so the sentence
 * leads with them and the project is the object. It is also the honest shape
 * of the decision: you are not evaluating a budget, you are answering a person.
 *
 * WHY IT SITS ABOVE THE LIST AND NOT IN A BELL.
 *
 * A notification centre is a place you have to remember to visit. This is one
 * card at the top of the exact screen where the thing it is about lives, and it
 * is gone the moment it is answered. Nothing to check, nothing to clear.
 *
 * WHY DECLINE IS AS PLAIN AS ACCEPT.
 *
 * Not a small grey link under a big button. Somebody who does not want to be in
 * a shared budget about money with four other people needs the no to be as easy
 * as the yes, or the card is a nag rather than a question.
 */
export default function ProjectInvites({ invites, profiles, onDone }) {
  const { t } = useT()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  /* Optimistic, and rolled back on failure. An answered card that lingers
     reads as a tap that did not register, and the next tap is the one that
     produces "that invitation has already been answered". */
  const [answered, setAnswered] = useState(() => new Set())

  const open = (invites ?? []).filter((i) => !answered.has(i.invite_id))
  if (open.length === 0) return null

  const name = (id) => profiles?.[id]?.display_name ?? t('proj.someone')

  async function answer(inviteId, accept) {
    setBusy(inviteId)
    setError('')
    setAnswered((s) => new Set(s).add(inviteId))
    const { error: err } = await respondToProjectInvite(inviteId, accept)
    setBusy(null)
    if (err) {
      setAnswered((s) => { const n = new Set(s); n.delete(inviteId); return n })
      const key = inviteErrorKey(err)
      return setError(key ? t(key) : errorText(err))
    }
    await onDone()
  }

  return (
    <ul className="space-y-3" data-hook="project-invites">
      {open.map((i) => (
        <li
          key={i.invite_id}
          data-invite={i.invite_id}
          className="animate-rise glass-card rounded-3xl p-5"
        >
          <div className="flex items-center gap-3">
            <Avatar profile={profiles?.[i.invited_by]} size={38} />
            <p className="min-w-0 flex-1 text-body text-ink">
              {t('proj.inv_line', { who: name(i.invited_by), project: i.project_name })}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary press flex-1"
              disabled={busy === i.invite_id}
              data-hook="invite-accept"
              onClick={() => answer(i.invite_id, true)}
            >
              {busy === i.invite_id ? t('common.saving') : t('proj.inv_accept')}
            </button>
            <button
              className="goal-action press shrink-0"
              disabled={busy === i.invite_id}
              data-hook="invite-decline"
              onClick={() => answer(i.invite_id, false)}
            >
              {t('proj.inv_decline')}
            </button>
          </div>
        </li>
      ))}

      {error && (
        <li className="break-words px-1 text-small text-negative" role="alert">
          {error}
        </li>
      )}
    </ul>
  )
}
