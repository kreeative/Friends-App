import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { pronounLabel } from '../lib/pronouns'
import { Avatar, Sheet } from './ui'

/**
 * What you can do about one person, once you have tapped them.
 *
 * The roster used to carry its controls inline: a "Make admin" button under
 * every row that could have one, on every row, all the time. On a group of
 * nine that is nine buttons for something that happens perhaps twice in the
 * life of a group, and it made a contact list read as an admin console.
 *
 * A tap on the row opens this instead. Same actions, none of them on screen
 * until somebody asks, which is what a list of people should look like.
 *
 * EVERY RULE HERE IS ALSO A RULE IN THE DATABASE.
 *
 * Promotion goes through set_member_role and removal through the
 * group_members delete policy, both of which check the caller's role
 * themselves. Hiding an action from somebody who cannot take it is courtesy;
 * a crafted call from a console gets the same refusal. That is why this file
 * can be read as a description of the interface rather than as the security.
 *
 * Removal asks twice. It is the one action here that cannot be undone from
 * the app, the person has to be re-invited and their history in this group
 * goes with them, and a confirm step is cheap against that.
 */
export default function MemberSheet({ member, myRole, meId, onClose }) {
  const { activeId, reload } = useGroup()
  const { t } = useT()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  if (!member) return null

  const isMe = member.user_id === meId
  const isCreator = member.role === 'creator'
  /* Only the creator moves people in and out of admin, and nobody demotes the
     creator. The group would be left with no owner and no way to appoint one. */
  const canPromote = myRole === 'creator' && !isMe && !isCreator
  const canRemove = (myRole === 'creator' || myRole === 'admin') && !isMe && !isCreator

  async function changeRole(role) {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('set_member_role', {
      p_group: activeId,
      p_user: member.user_id,
      p_role: role,
    })
    setBusy(false)

    if (err) {
      /* The likely failure is that 18_daily_roles_and_feed.sql has not been
         run, which PostgREST reports as a missing function: a message about a
         schema cache, which reads like an application bug rather than an
         unrun migration. */
      const raw = `${err.code ?? ''} ${err.message ?? ''}`.toLowerCase()
      const notInstalled = raw.includes('pgrst202') || raw.includes('could not find the function')
      setError(notInstalled ? t('settings.roles_not_installed') : err.message)
      return
    }
    await reload()
    onClose()
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', activeId)
      .eq('user_id', member.user_id)
    setBusy(false)

    if (err) return setError(err.message)
    await reload()
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={member.profile?.display_name ?? ''}>
      <div className="flex items-center gap-4">
        <Avatar profile={member.profile} size={56} />
        <div className="min-w-0">
          <p className="truncate text-body text-ink">{member.profile?.display_name}</p>
          {/* Role and pronouns on one line, in that order: the role is why
              you opened this sheet, the pronouns are how to talk about them.
              Nothing at all when they have not said, rather than the app
              asserting a set on somebody's behalf. */}
          <p className="mt-0.5 text-small text-muted">
            {[
              isCreator
                ? t('settings.role_creator')
                : member.role === 'admin'
                  ? t('settings.role_admin')
                  : t('settings.role_member'),
              pronounLabel(member.profile),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {error && <p className="mt-6 text-small text-negative">{error}</p>}

      <div className="mt-8 space-y-3">
        {canPromote && (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeRole(member.role === 'admin' ? 'member' : 'admin')}
            className="press w-full rounded-inner bg-ink/[0.05] px-5 py-4 text-left text-body text-ink transition-colors hover:bg-ink/[0.09] disabled:opacity-60"
          >
            {member.role === 'admin' ? t('settings.demote') : t('settings.promote')}
          </button>
        )}

        {canRemove &&
          (confirming ? (
            /* The question in place of the button, rather than a second sheet
               over this one. A dialog on top of a dialog to ask one yes-or-no
               is a stack nobody can see the bottom of. */
            <div className="rounded-inner bg-negative/[0.07] p-5">
              <p className="text-small text-ink">
                {t('settings.remove_confirm', { name: member.profile?.display_name ?? '' })}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={busy}
                  onClick={remove}
                  className="press rounded-pill bg-negative px-6 py-2.5 text-small font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  {busy ? '…' : t('settings.remove_yes')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="press rounded-pill px-6 py-2.5 text-small font-semibold text-muted transition-colors hover:text-ink sm:w-auto"
                >
                  {t('ui.close')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="press w-full rounded-inner bg-negative/[0.07] px-5 py-4 text-left text-body text-negative transition-colors hover:bg-negative/[0.12]"
            >
              {t('settings.remove')}
            </button>
          ))}

        {/* Not an empty sheet. Somebody who taps a row and can do nothing about
            that person should be told so, rather than shown a title over a gap
            and left wondering what failed to load. */}
        {!canPromote && !canRemove && (
          <p className="text-small text-muted">
            {isMe ? t('settings.thats_you') : t('settings.nothing_to_do')}
          </p>
        )}
      </div>
    </Sheet>
  )
}
