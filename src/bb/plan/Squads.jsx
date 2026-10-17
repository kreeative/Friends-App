import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { Note } from '../kit'

/**
 * Study squads (section 6, phase 3): a Rich & Friends group that studies
 * together.
 *
 *   Members see effort (minutes, streak, sessions), never scores or
 *   mistakes. Ranked on effort, never on grades, following the group
 *   sharing rules.
 *
 * Per group, the student switches her study effort on or off
 * (bb_squad_share, migration 81). The board comes from one database
 * function, bb_squad_effort(), which reads sessions only (never a course,
 * an answer, a mark or a mistake) and lists only members who switched it on
 * in that group. Both ways or not at all: someone who shares nothing sees
 * nothing, so the board is shown once her own switch is on. The name is the
 * one the group already shows (its alias, else the display name), as the
 * sharing rules of migration 75 say: the name is always shown.
 */
export default function Squads() {
  const { t } = useT()
  const { user } = useAuth()
  const [groups, setGroups] = useState(null)
  const [shared, setShared] = useState({})
  const [boards, setBoards] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const loadBoard = useCallback(async (groupId) => {
    const { data, error: err } = await supabase.rpc('bb_squad_effort', { p_group: groupId })
    setBoards((b) => ({ ...b, [groupId]: err ? { error: true } : data ?? [] }))
  }, [])

  useEffect(() => {
    if (!user?.id) return undefined
    let live = true
    ;(async () => {
      const [{ data: rows }, { data: shares }] = await Promise.all([
        supabase.from('group_members').select('group_id, groups(id, name)').eq('user_id', user.id),
        supabase.from('bb_squad_share').select('group_id, shared').eq('user_id', user.id),
      ])
      if (!live) return
      const list = (rows ?? []).map((r) => r.groups).filter(Boolean)
      const on = Object.fromEntries((shares ?? []).map((s) => [s.group_id, s.shared]))
      setGroups(list)
      setShared(on)
      for (const g of list) if (on[g.id]) loadBoard(g.id)
    })().catch(() => live && setGroups([]))
    return () => {
      live = false
    }
  }, [user?.id, loadBoard])

  async function toggle(groupId, value) {
    setBusy(groupId)
    setError(null)
    const { error: err } = await supabase.from('bb_squad_share').upsert({ group_id: groupId, user_id: user.id, shared: value, updated_at: new Date().toISOString() }, { onConflict: 'group_id,user_id' })
    setBusy(null)
    if (err) return setError(t('bb.squad.failed'))
    setShared((s) => ({ ...s, [groupId]: value }))
    if (value) loadBoard(groupId)
    else setBoards((b) => ({ ...b, [groupId]: undefined }))
  }

  if (!groups) return null

  return (
    <section className="mt-10" data-hook="bb-squads">
      <h2 className="text-h2 text-ink">{t('bb.squad.title')}</h2>
      <p className="mt-2 text-body text-ink">{t('bb.squad.lede')}</p>
      {!groups.length ? (
        <Note className="mt-4">{t('bb.squad.no_groups')}</Note>
      ) : (
        <ul className="card-grid mt-4">
          {groups.map((g) => {
            const on = Boolean(shared[g.id])
            const board = boards[g.id]
            return (
              <li key={g.id} className="lg p-5" data-hook="bb-squad">
                <p className="text-body font-bold text-ink">{g.name}</p>
                <label className="press mt-3 flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-3">
                  <input type="checkbox" checked={on} disabled={busy === g.id} onChange={(e) => toggle(g.id, e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#111111]" data-hook="bb-squad-share" />
                  <span className="min-w-0">
                    <span className="block text-small font-semibold text-ink">{t('bb.squad.share')}</span>
                    <span className="mt-0.5 block text-small text-muted">{t('bb.squad.share_sub')}</span>
                  </span>
                </label>
                {on && board && !board.error && (
                  <ol className="mt-4 space-y-2" data-hook="bb-squad-board" aria-label={t('bb.squad.board', { name: g.name })}>
                    {board.map((m, i) => (
                      <li key={m.user_id} className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-inner px-3 py-2 text-small text-ink ${m.me ? 'bg-[#FFF4C2]' : 'bg-[#F4F4F5]'}`}>
                        <span className="font-semibold">
                          {i + 1}. {m.name}
                          {m.me ? ` (${t('bb.squad.you')})` : ''}
                        </span>
                        <span className="tabular-nums">
                          {t('bb.squad.line', { min: m.minutes_week, n: m.sessions_week })}
                          {m.streak > 0 ? ` · ${t('bb.squad.streak', { n: m.streak })}` : ''}
                        </span>
                      </li>
                    ))}
                    {board.length === 1 && <li className="text-small text-muted">{t('bb.squad.alone')}</li>}
                  </ol>
                )}
                {on && board?.error && <p className="mt-3 text-small text-ink">{t('bb.squad.failed')}</p>}
              </li>
            )
          })}
        </ul>
      )}
      {error && <Note tone="error" className="mt-3">{error}</Note>}
      <p className="mt-4 text-small text-muted">{t('bb.squad.never')}</p>
    </section>
  )
}
