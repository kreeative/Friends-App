import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'

/**
 * The way out of a group.
 *
 * Both actions run as database functions rather than as deletes from here,
 * because neither is one row's worth of work. Leaving has to decide what
 * happens to your goals, whether an admin needs promoting, and whether the
 * group still exists afterwards. Doing that from the client means three
 * round trips that can half-fail.
 *
 * Neither is behind a modal. A dialog you can dismiss by tapping the backdrop
 * is not a safeguard, it is a speed bump, so the confirmation is inline and
 * it makes you press the thing twice, with the second press saying exactly
 * what is about to happen.
 */
export default function DangerZone() {
  const { activeId, group, myRole, reload } = useGroup()
  const { t } = useT()
  const navigate = useNavigate()

  const [confirm, setConfirm] = useState(null) // 'leave' | 'delete' | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(fn) {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc(fn, { p_group: activeId })
    if (err) {
      /**
       * The failure that actually happens here is that the function does not
       * exist yet, because 09_solo_goals_and_leaving.sql has not been run.
       * PostgREST reports that as PGRST202, with a message about not finding
       * the function in the schema cache, which reads like an application bug
       * rather than an unrun migration. Naming the file is the difference
       * between a dead button and a to-do.
       */
      const raw = `${err.code ?? ''} ${err.message ?? ''}`.toLowerCase()
      const notInstalled =
        raw.includes('pgrst202') ||
        raw.includes('could not find the function') ||
        (raw.includes('function') && raw.includes('does not exist'))

      setError(notInstalled ? t('settings.leave_not_installed') : err.message)
      setBusy(false)
      setConfirm(null)
      return
    }
    // Reload before navigating: the dashboard reads memberships, and leaving
    // it stale shows the group you just left until the next fetch.
    await reload()
    navigate('/', { replace: true })
  }

  if (!group) return null

  return (
    <div className="space-y-3">
      {confirm === null && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setConfirm('leave')}
            className="btn-outline press sm:w-auto sm:px-7"
          >
            {t('settings.leave')}
          </button>
          {/* Only an admin can delete, and a button that is simply absent
              looks like a missing feature rather than a permission. */}
          {/* Creator or admin. Whether an admin's press actually goes
              through is decided by delete_group against the group's
              admins_can_delete toggle, so this decides who sees a button,
              not who may act. */}
          {myRole === 'admin' || myRole === 'creator' ? (
            <button
              onClick={() => setConfirm('delete')}
              className="btn press text-negative hover:bg-negative/[0.07] sm:w-auto sm:px-7"
            >
              {t('settings.delete')}
            </button>
          ) : (
            <p className="self-center text-small text-muted">{t('settings.delete_admin_only')}</p>
          )}
        </div>
      )}

      {confirm && (
        <div className="card space-y-5">
          <div>
            <p className="text-body text-ink">
              {confirm === 'leave'
                ? t('settings.leave_confirm', { group: group.name })
                : t('settings.delete_confirm', { group: group.name })}
            </p>
            <p className="mt-2 text-small text-muted">
              {confirm === 'leave' ? t('settings.leave_note') : t('settings.delete_note')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              onClick={() => run(confirm === 'leave' ? 'leave_group' : 'delete_group')}
              disabled={busy}
              className={`btn press sm:w-auto sm:px-7 ${
                confirm === 'leave'
                  ? 'bg-accent text-on-accent'
                  : 'bg-negative text-white hover:opacity-90'
              }`}
            >
              {busy
                ? '…'
                : confirm === 'leave'
                  ? t('settings.leave_yes')
                  : t('settings.delete_yes')}
            </button>
            <button
              onClick={() => setConfirm(null)}
              disabled={busy}
              className="btn-ghost press sm:w-auto sm:px-7"
            >
              {t('settings.keep')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-small text-negative">{error}</p>}
    </div>
  )
}
