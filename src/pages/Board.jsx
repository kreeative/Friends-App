import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { cyclePhase, untilLabel } from '../lib/time'
import { groupGoalProgress } from '../lib/stats'
import { Avatar, Empty, Screen, Section, TopBar } from '../components/ui'
import NudgeBanner from '../components/NudgeBanner'
import GoalCard from '../components/GoalCard'

export default function Board() {
  const { user } = useAuth()
  const { group, members, currentCycle, nextCycle, groupGoals, statuses } = useGroup()
  const [checkins, setCheckins] = useState([])
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!currentCycle) return
    let cancelled = false
    ;(async () => {
      const { data: cks } = await supabase
        .from('checkins')
        .select('*')
        .eq('cycle_id', currentCycle.id)
      if (cancelled) return
      setCheckins(cks ?? [])

      const ids = (cks ?? []).map((c) => c.id)
      if (ids.length === 0) return setItems([])
      const { data: its } = await supabase.from('checkin_items').select('*').in('checkin_id', ids)
      if (!cancelled) setItems(its ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [currentCycle?.id])

  const phase = cyclePhase(currentCycle)
  const submittedIds = new Set(checkins.map((c) => c.user_id))
  const awayIds = new Set(
    statuses.filter((s) => s.cycle_id === currentCycle?.id && s.status === 'away').map((s) => s.user_id),
  )
  const expected = members.filter((m) => !awayIds.has(m.user_id))
  const allIn = expected.length > 0 && expected.every((m) => submittedIds.has(m.user_id))

  /**
   * Results stay sealed until the window closes, or until everyone is in.
   * Before that the board shows only who has checked in. Holding the reveal is
   * what turns a form into an event — there is a reason to come back at a
   * particular time, rather than a page that is identical whenever you look.
   */
  const revealed = phase === 'closed' || allIn

  const iHaveChecked = submittedIds.has(user?.id)
  const meAway = awayIds.has(user?.id)

  const status = useMemo(() => {
    if (!currentCycle) return 'Setting up'
    if (phase === 'open') return `Closes ${untilLabel(currentCycle.closes_at, { prefix: 'in ' })}`
    if (phase === 'upcoming') return `Opens ${untilLabel(currentCycle.opens_at, { prefix: 'in ' })}`
    if (nextCycle) return `Next opens ${untilLabel(nextCycle.opens_at, { prefix: 'in ' })}`
    return 'Closed'
  }, [currentCycle?.id, phase, nextCycle?.id])

  if (!group) return null

  return (
    <Screen>
      <TopBar title={group.name} sub={status} />

      <NudgeBanner />

      {phase === 'open' && !iHaveChecked && !meAway && (
        <div className="px-4 pt-4">
          <Link to="/checkin" className="btn-solid block text-center">
            Check in — 60 seconds
          </Link>
        </div>
      )}

      <Section title={revealed ? 'This cycle' : `In so far — ${submittedIds.size} of ${expected.length}`}>
        <div className="divide-y divide-white/[0.14] hair">
          {members.map((m) => {
            const ck = checkins.find((c) => c.user_id === m.user_id)
            const isAway = awayIds.has(m.user_id)
            const mine = m.user_id === user?.id

            return (
              <div key={m.user_id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar profile={m.profile} />
                  <span className="flex-1 font-display text-[15px]">
                    {m.profile?.display_name}
                    {mine && <span className="text-white/30"> · you</span>}
                  </span>
                  <span className="label">
                    {isAway ? 'Away' : ck ? 'In' : phase === 'closed' ? 'Quiet' : 'Waiting'}
                  </span>
                </div>

                {revealed && ck && (
                  <div className="mt-3 space-y-1.5 pl-10">
                    {items
                      .filter((i) => i.checkin_id === ck.id)
                      .map((i) => (
                        <ItemLine key={i.id} item={i} />
                      ))}
                    {ck.next_commitment && (
                      <p className="pt-1 text-[13px] leading-snug text-white/55">
                        Next: {ck.next_commitment}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {groupGoals.length > 0 && (
        <Section title="Together">
          <div className="space-y-2">
            {groupGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                progress={groupGoalProgress(
                  g,
                  items.filter((i) => i.goal_id === g.id),
                  members.length,
                )}
              />
            ))}
          </div>
        </Section>
      )}

      {members.length === 1 && (
        <Section title="Invite">
          <Empty>
            Share the code <span className="font-mono text-white">{group.invite_code}</span> — this
            works with two to six people.
          </Empty>
        </Section>
      )}
    </Screen>
  )
}

function ItemLine({ item }) {
  const mark = item.outcome === 'done' ? '●' : item.outcome === 'partial' ? '◐' : '○'
  return (
    <p className="flex items-baseline gap-2 text-[13px] text-white/60">
      <span className="font-mono text-white/40">{mark}</span>
      <span className="flex-1">{item.evidence || item.outcome}</span>
      {item.count_done > 0 && <span className="font-mono text-[11px] text-white/35">{item.count_done}</span>}
    </p>
  )
}
