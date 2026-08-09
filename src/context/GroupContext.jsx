import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { cyclePhase, lastClosed, soonestUpcoming } from '../lib/time'

/* Exported so a test or a preview can supply a value without standing up a
   Supabase client. Application code should use the hook. */
export const GroupCtx = createContext(null)
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
 * than useParams, which only resolves inside a matched Route.
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
  const [soloGoals, setSoloGoals] = useState([])
  const [statuses, setStatuses] = useState([])
  const [nudges, setNudges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Goals with no group at all.
   *
   * Loaded here rather than inside loadGroup, because they belong to the
   * person and not to whichever group happens to be open, they have to be
   * available on /goals, where there is no group, and they must survive
   * switching between groups without a refetch.
   *
   * Failure is soft. These are additive, and someone who has not run the
   * migration yet should still get their groups rather than an error screen.
   */
  const loadSolo = useCallback(async () => {
    if (!user) return setSoloGoals([])
    const { data } = await supabase
      .from('goals')
      .select('*')
      .is('group_id', null)
      .eq('owner_id', user.id)
      .order('created_at')
    setSoloGoals(data ?? [])
  }, [user?.id])

  useEffect(() => {
    loadSolo()
  }, [loadSolo])

  const loadMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setLoading(false)
      return
    }
    // A rejected query here used to escape as an unhandled rejection, leaving
    // `loading` true forever, an eternal splash with no way out of it.
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
      /* offline or not yet migrated, the reads below still work */
    }

    try {
      const [g, m, c, gl, st, nd] = await Promise.all([
      supabase.from('groups').select('*').eq('id', activeId).maybeSingle(),
      supabase
        .from('group_members')
        /* birthday comes down with the roster because the banner needs a
           week's notice and the roster is already loaded. It is a month and a
           day to the app; the year is never rendered. */
        .select('user_id, role, nudge_order, profiles(id, display_name, avatar_url, birthday)')
        .eq('group_id', activeId)
        .order('nudge_order'),
      supabase
        .from('cycles')
        .select('*')
        .eq('group_id', activeId)
        .order('seq', { ascending: false })
        .limit(24),
      /* Every status, not just active and paused. "Past goals" is a screen
         now, and a finished goal that vanishes from the app the moment you
         finish it is the one piece of evidence you most wanted to keep. */
      supabase.from('goals').select('*').eq('group_id', activeId).order('created_at'),
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

  /* Every phase question in the app goes through the same two arguments, so
     that a period ends when the next one starts rather than thirty hours in.
     Bound once here and passed down, because a component that asks with only
     the row gets the old answer and there is no way to see that it did. */
  const cadence = group?.cadence_days ?? null

  // The period you are in if there is one, otherwise the one that just ended.
  // The board should always have something to show, never an empty screen.
  const currentCycle = useMemo(() => {
    const open = cycles.find((c) => cyclePhase(c, cycles, cadence) === 'open')
    if (open) return open
    return lastClosed(cycles, cadence) ?? cycles[cycles.length - 1] ?? null
  }, [cycles, cadence])

  /* The period that just ended, which is the one the board reveals. It is
     separate from currentCycle now: with the window running the whole week,
     the moment last week's results unseal is the same moment this week opens,
     so the board has to be able to hold both at once. Otherwise the reveal
     you waited seven days for is replaced by an empty week the second it
     arrives. */
  const lastCycle = useMemo(() => lastClosed(cycles, cadence), [cycles, cadence])

  const nextCycle = useMemo(() => soonestUpcoming(cycles, cadence), [cycles, cadence])

  /* Live only. Everything downstream, the board, the check-in, the count on
     the dashboard. Means "things I am currently on the hook for", and that
     stopped being the same set as `goals` once the finished ones stayed. */
  const live = useMemo(() => goals.filter((g) => g.status === 'active' || g.status === 'paused'), [goals])

  const myGoals = useMemo(
    () => live.filter((g) => g.kind === 'personal' && g.owner_id === user?.id),
    [live, user?.id],
  )
  const groupGoals = useMemo(() => live.filter((g) => g.kind === 'group'), [live])

  /** Whether you can delete the group you are looking at. */
  const myRole = useMemo(
    () => memberships.find((m) => m.group_id === activeId)?.role ?? null,
    [memberships, activeId],
  )

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
    cadence,
    currentCycle,
    lastCycle,
    nextCycle,
    goals,
    myGoals,
    groupGoals,
    soloGoals,
    myRole,
    statuses,
    statusesFor,
    nudges,
    reload: async () => {
      await Promise.all([loadMemberships(), loadGroup(), loadSolo()])
    },
    /* Anything that writes a goal may have written a solo one, and the form
       is shared between both screens, so this refreshes both rather than
       making every caller work out which list it just changed. */
    reloadGroup: async () => {
      await Promise.all([loadGroup(), loadSolo()])
    },
    reloadSolo: loadSolo,
  }

  return <GroupCtx.Provider value={value}>{children}</GroupCtx.Provider>
}
