import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { cyclePhase } from '../lib/time'

const GroupCtx = createContext(null)
export const useGroup = () => useContext(GroupCtx)

/**
 * Which group is open is a fact about the URL, not about this provider.
 *
 * It used to be a piece of state seeded from localStorage and defaulted to
 * the first membership, which is what made signing in drop you straight into
 * a group with no way back and no address for the thing you were looking at.
 * Now /g/:id names it: the dashboard is the group-less state, back and
 * forward work, and a link to a group is a link to that group.
 *
 * The provider sits above the route tree, so it reads the path itself rather
 * than useParams — which only resolves inside a matched Route.
 */
const GROUP_PATH = /^\/g\/([0-9a-f-]{36})/i
const groupIdFrom = (pathname) => pathname.match(GROUP_PATH)?.[1] ?? null

export function GroupProvider({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const activeId = groupIdFrom(pathname)

  const [memberships, setMemberships] = useState([])
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

      setMemberships((data ?? []).filter((r) => r.groups))
    } catch (e) {
      setError({ code: e?.code ?? 'network', description: e?.message ?? String(e) })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

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
