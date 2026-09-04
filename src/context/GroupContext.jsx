import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { cyclePhase, lastClosed, soonestUpcoming } from '../lib/time'
import { dayKey, indexDays, since } from '../lib/streak'
import { openHides } from '../lib/nudgeHidden'

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
  const [goalDays, setGoalDays] = useState([])
  const [statuses, setStatuses] = useState([])
  const [nudges, setNudges] = useState([])
  const [hiddenNudges, setHiddenNudges] = useState([])
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
    if (!user) {
      setSoloGoals([])
      setGoalDays([])
      return
    }
    const { data } = await supabase
      .from('goals')
      .select('*')
      .is('group_id', null)
      .eq('owner_id', user.id)
      .order('created_at')
    setSoloGoals(data ?? [])

    /**
     * The ticks, bounded by the same number the streak walk uses.
     *
     * Not `select('*')` over all of history: this table gets one row per goal
     * per day forever, and the only thing that reads it looks back at most
     * LOOKBACK_DAYS. Asking for exactly that is the difference between a few
     * hundred rows and an unbounded fetch that grows every day the app is used.
     *
     * Soft failure, like the goals above. Migration 32 may not have been run
     * yet, and somebody who has not run it should still get their goals, just
     * without the ticks, rather than an error screen.
     */
    const { data: days } = await supabase
      .from('goal_days')
      .select('goal_id, on_date, count_done')
      .eq('user_id', user.id)
      .gte('on_date', since())
    setGoalDays(days ?? [])
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
      const [g, m, c, gl, st, nd, hid] = await Promise.all([
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
      /**
       * The ones this reader has put away, and when.
       *
       * Its own request rather than a join, for the reason the envelopes and
       * the savings ledger each have one: migration 40 may not have been run,
       * and a missing table must not take the whole group down with it. RLS
       * already limits this to the reader's own rows, so no filter is needed
       * and none would add anything.
       *
       * hidden_at comes down because a cross expires. See HIDE_DAYS.
       */
      supabase.from('nudge_hidden').select('nudge_id, hidden_at'),
      ])

      setGroup(g.data ?? null)
      setMembers((m.data ?? []).map((r) => ({ ...r, profile: r.profiles })))
      setCycles(c.data ?? [])
      setGoals(gl.data ?? [])
      setStatuses(st.data ?? [])
      /* Hidden is a per-reader veto, applied here so every consumer of
         `nudges` sees the same list. hid.data is null when the table is not
         installed, which reads as "nothing hidden" and is the right way for
         this to fail. */
      const hidden = new Set(openHides(hid?.data))
      const open = nd.data ?? []
      setNudges(open.filter((n) => !hidden.has(n.id)))
      /**
       * The ones this reader crossed off, kept rather than dropped.
       *
       * They were thrown away here, and that left no way back. Cross off every
       * card and the rail returns null, so the group board has nothing on it
       * about nudges at all: no count, no button, no mention that anything was
       * put away. The only route back was somebody running SQL, which is not a
       * route.
       *
       * Keeping the rows costs nothing, they were already fetched, and it lets
       * the rail offer to bring them back.
       */
      setHiddenNudges(open.filter((n) => hidden.has(n.id)))
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

  /* Built once here rather than per card. Five goals against a year of ticks
     is five scans of a couple of thousand rows on every render if each card
     filters for itself; this is one pass and a Map lookup. */
  const dayIndex = useMemo(() => indexDays(goalDays), [goalDays])

  /**
   * Tick a goal for a day, or take the tick back.
   *
   * Optimistic, and the local state is written first on purpose: this is a
   * checkbox, and a checkbox that waits for a network round trip before
   * changing feels broken on a phone with two bars. `count` of 0 means the row
   * goes, because a row saying zero and no row are the same statement, and
   * migration 32 refuses the former.
   *
   * On failure the true rows are refetched rather than the previous value being
   * restored from a variable. Reverting from a snapshot is what puts a stale
   * count on screen when two taps are in flight and the first one fails.
   */
  const setGoalDay = useCallback(
    async (goal, count, date = new Date()) => {
      if (!user || !goal?.id) return { error: { message: 'not signed in' } }
      const on_date = dayKey(date)
      const n = Math.max(0, Math.floor(Number(count) || 0))

      setGoalDays((rows) => {
        const without = rows.filter((r) => !(r.goal_id === goal.id && String(r.on_date).slice(0, 10) === on_date))
        return n > 0 ? [...without, { goal_id: goal.id, on_date, count_done: n }] : without
      })

      const { error } = n > 0
        ? await supabase
            .from('goal_days')
            .upsert({ goal_id: goal.id, user_id: user.id, on_date, count_done: n },
                    { onConflict: 'goal_id,user_id,on_date' })
        : await supabase
            .from('goal_days')
            .delete()
            .eq('goal_id', goal.id)
            .eq('user_id', user.id)
            .eq('on_date', on_date)

      if (error) {
        await loadSolo()
        return { error }
      }
      return { error: null }
    },
    [user?.id, loadSolo],
  )

  /**
   * Delete a goal, for good.
   *
   * THE `.select()` IS THE LOAD-BEARING PART. Postgres row-level security does
   * not raise on a delete it refuses: it deletes nothing and reports success.
   * Proved in supabase, where an ordinary member deleting the group's goal
   * returns zero rows and no error at all. Without asking for the deleted rows
   * back, that silence is indistinguishable from success, the card vanishes,
   * and it reappears on the next load with nothing said about why.
   *
   * WHY THIS DOES NOT REMOVE THE ROW FROM STATE FIRST.
   *
   * It did, and that was a bug: stripping the goal from the list unmounted the
   * card, and the card is what owns the confirmation dialog, so a refused
   * delete had nowhere left to print its reason. The person saw the card
   * blink out and come back with no explanation.
   *
   * The optimism lives in GoalCard instead, which hides itself the instant you
   * confirm and un-hides if this comes back with an error. Same feel, and the
   * thing that has to report the failure is still on screen to do it.
   */
  const removeGoal = useCallback(async (goal) => {
    if (!goal?.id) return { error: { message: 'no goal' } }

    const { data, error } = await supabase.from('goals').delete().eq('id', goal.id).select('id')

    if (error || !data || data.length === 0) {
      return { error: error ?? { code: '42501', message: 'not allowed' } }
    }

    setGoals((rows) => rows.filter((g) => g.id !== goal.id))
    setSoloGoals((rows) => rows.filter((g) => g.id !== goal.id))
    return { error: null }
  }, [])

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
    goalDays,
    dayIndex,
    setGoalDay,
    removeGoal,
    myRole,
    statuses,
    statusesFor,
    nudges,
    hiddenNudges,
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
