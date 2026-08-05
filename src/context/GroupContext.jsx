import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { cyclePhase } from '../lib/time'

const GroupCtx = createContext(null)
export const useGroup = () => useContext(GroupCtx)

const ACTIVE_KEY = 'friends.activeGroup'

// Storage can be disabled or throw (Safari private mode). Reading it at mount
// unguarded would crash the provider before anything rendered.
const readActive = () => {
  try {
    return localStorage.getItem(ACTIVE_KEY) || null
  } catch {
    return null
  }
}

export function GroupProvider({ children }) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [activeId, setActiveId] = useState(readActive)
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [cycles, setCycles] = useState([])
  const [goals, setGoals] = useState([])
  const [statuses, setStatuses] = useState([])
  const [nudges, setNudges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setLoading(false)
      return
    }
    // A rejected query here used to escape as an unhandled rejection, leaving
    // `loading` true forever — an eternal splash with no way out of it.
    try {
      const { data, error: err } = await supabase
        .from('group_members')
        .select('group_id, role, groups(*)')
        .eq('user_id', user.id)

      if (err) throw err
      setError(null)

      const rows = (data ?? []).filter((r) => r.groups)
      setMemberships(rows)

      setActiveId((current) => {
        if (current && rows.some((r) => r.group_id === current)) return current
        return rows[0]?.group_id ?? null
      })
    } catch (e) {
      setError({ code: e?.code ?? 'network', description: e?.message ?? String(e) })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

  useEffect(() => {
    if (!activeId) return
    try {
      localStorage.setItem(ACTIVE_KEY, activeId)
    } catch {
      /* not fatal — the group choice just won't survive a reload */
    }
  }, [activeId])

  const loadGroup = useCallback(async () => {
    if (!activeId || !user) {
      setGroup(null)
      return
    }

    // Idempotent: keeps periods flowing even before pg_cron is configured.
    // Never let a failure here block the rest of the load.
    try {
      await supabase.rpc('tick')
    } catch {
      /* offline or not yet migrated — the reads below still work */
    }

    try {
      const [g, m, c, gl, st, nd] = await Promise.all([
      supabase.from('groups').select('*').eq('id', activeId).maybeSingle(),
      supabase
        .from('group_members')
        .select('user_id, role, nudge_order, profiles(id, display_name, avatar_url)')
        .eq('group_id', activeId)
        .order('nudge_order'),
      supabase
        .from('cycles')
        .select('*')
        .eq('group_id', activeId)
        .order('seq', { ascending: false })
        .limit(24),
      supabase
        .from('goals')
        .select('*')
        .eq('group_id', activeId)
        .in('status', ['active', 'paused'])
        .order('created_at'),
      supabase.from('member_cycle_status').select('*').eq('group_id', activeId),
      supabase.from('nudges').select('*').eq('group_id', activeId).in('state', ['pending', 'claimed']),
      ])

      setGroup(g.data ?? null)
      setMembers((m.data ?? []).map((r) => ({ ...r, profile: r.profiles })))
      setCycles(c.data ?? [])
      setGoals(gl.data ?? [])
      setStatuses(st.data ?? [])
      setNudges(nd.data ?? [])
      setError(null)
    } catch (e) {
      // One rejected request used to abort the whole Promise.all and leave
      // every list at its previous value with nothing said about it.
      setError({ code: e?.code ?? 'network', description: e?.message ?? String(e) })
    }
  }, [activeId, user?.id])

  useEffect(() => {
    loadGroup()
  }, [loadGroup])

  // The open cycle if there is one, otherwise the most recent — the board
  // should always have something to show, never an empty screen.
  const currentCycle = useMemo(() => {
    const open = cycles.find((c) => cyclePhase(c) === 'open')
    if (open) return open
    const past = cycles.filter((c) => cyclePhase(c) === 'closed')
    return past[0] ?? cycles[cycles.length - 1] ?? null
  }, [cycles])

  const nextCycle = useMemo(
    () => [...cycles].reverse().find((c) => cyclePhase(c) === 'upcoming') ?? null,
    [cycles],
  )

  const myGoals = useMemo(
    () => goals.filter((g) => g.kind === 'personal' && g.owner_id === user?.id),
    [goals, user?.id],
  )
  const groupGoals = useMemo(() => goals.filter((g) => g.kind === 'group'), [goals])

  const statusesFor = useCallback(
    (uid) => statuses.filter((s) => s.user_id === uid),
    [statuses],
  )

  const value = {
    loading,
    error,
    memberships,
    groups: memberships.map((m) => m.groups),
    group,
    activeId,
    setActiveGroup: setActiveId,
    members,
    cycles,
    currentCycle,
    nextCycle,
    goals,
    myGoals,
    groupGoals,
    statuses,
    statusesFor,
    nudges,
    reload: async () => {
      await loadMemberships()
      await loadGroup()
    },
    reloadGroup: loadGroup,
  }

  return <GroupCtx.Provider value={value}>{children}</GroupCtx.Provider>
}
