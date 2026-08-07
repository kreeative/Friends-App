import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'

/**
 * The way out of a group.
 *
 * Both actions run as database functions rather than as deletes from here,
 * because neither is one row's worth of work — leaving has to decide what
 * happens to your goals, whether an admin needs promoting, and whether the
 * group still exists afterwards. Doing that from the client means three
 * round trips that can half-fail.
 *
 * Neither is behind a modal. A dialog you can dismiss by tapping the backdrop
 * is not a safeguard, it is a speed bump — so the confirmation is inline and
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
      setError(err.message)
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
          {myRole === 'admin' && (
            <button
              onClick={() => setConfirm('delete')}
              className="btn press text-negative hover:bg-negative/[0.07] sm:w-auto sm:px-7"
            >
              {t('settings.delete')}
            </button>
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
