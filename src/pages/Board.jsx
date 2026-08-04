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
  const { group, members, currentCycle, nextCycle, groupGoals, myGoals, statuses } = useGroup()
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
  const openCount = [...myGoals, ...groupGoals].filter((g) => g.status === 'active').length

  const status = useMemo(() => {
    if (!currentCycle) return 'Getting things ready'
    if (phase === 'open') return `Open for another ${untilLabel(currentCycle.closes_at)}`
    if (phase === 'upcoming') return `Opens in ${untilLabel(currentCycle.opens_at)}`
    if (nextCycle) return `Next one opens in ${untilLabel(nextCycle.opens_at)}`
    return 'Closed for now'
  }, [currentCycle?.id, phase, nextCycle?.id])

  if (!group) return null

  return (
    <Screen>
      <TopBar title={group.name} sub={status} />

      <NudgeBanner />

      {/**
       * The one hero surface on this screen, and the only glass in the page
       * body. Everything below it stays solid — a second floating card here
       * would flatten the hierarchy this is buying.
       */}
      {phase === 'open' && !iHaveChecked && !meAway && (
        <div className="glass mt-8 rounded-card p-6">
          <h2 className="text-h2 text-ink">Ready when you are</h2>
          <p className="mt-2 text-body text-ink/70">
            {openCount === 0
              ? 'Nothing on your list yet — add something first.'
              : `${openCount} ${openCount === 1 ? 'thing' : 'things'} to look at. Takes about a minute.`}
          </p>
          <Link to="/checkin" className="btn-primary press mt-6">
            Check in
          </Link>
        </div>
      )}

      <Section
        title={
          revealed
            ? 'This week'
            : `${submittedIds.size} of ${expected.length} ${submittedIds.size === 1 ? 'has' : 'have'} checked in`
        }
      >
        <div className="list">
          {members.map((m) => {
            const ck = checkins.find((c) => c.user_id === m.user_id)
            const isAway = awayIds.has(m.user_id)
            const mine = m.user_id === user?.id

            return (
              <div key={m.user_id} className="py-5">
                <div className="flex items-center gap-4">
                  <Avatar profile={m.profile} />
                  <span className="flex-1 text-body text-ink">
                    {m.profile?.display_name}
                    {mine && <span className="text-muted"> · you</span>}
                  </span>
                  <span
                    className={`text-small ${
                      ck ? 'text-positive' : isAway ? 'text-muted' : 'text-muted/70'
                    }`}
                  >
                    {isAway
                      ? 'Away this week'
                      : ck
                        ? 'Checked in'
                        : phase === 'closed'
                          ? "Didn't check in"
                          : 'Not yet'}
                  </span>
                </div>

                {revealed && ck && (
                  <div className="mt-4 space-y-2 pl-[3.5rem]">
                    {items
                      .filter((i) => i.checkin_id === ck.id)
                      .map((i) => (
                        <ItemLine key={i.id} item={i} />
                      ))}
                    {ck.next_commitment && (
                      <p className="pt-1 text-small text-muted">Next: {ck.next_commitment}</p>
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
          <div className="space-y-4">
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
        <Section title="Invite someone">
          <Empty
            action={
              <p className="font-display text-h1 tracking-[0.12em] text-ink">{group.invite_code}</p>
            }
          >
            It's just you so far. Send this code to a friend — two to six people works best.
          </Empty>
        </Section>
      )}
    </Screen>
  )
}

function ItemLine({ item }) {
  const tone =
    item.outcome === 'done' ? 'text-positive' : item.outcome === 'partial' ? 'text-caution' : 'text-muted/70'

  return (
    <p className="flex items-baseline gap-3 text-small">
      <span className={`text-[0.6rem] leading-[1.8] ${tone}`}>●</span>
      <span className="flex-1 text-muted">{item.evidence || labelFor(item.outcome)}</span>
      {item.count_done > 0 && <span className="text-muted/70">{item.count_done}</span>}
    </p>
  )
}

function labelFor(outcome) {
  if (outcome === 'done') return 'Did it'
  if (outcome === 'partial') return 'Got part of the way'
  return 'Not this week'
}
