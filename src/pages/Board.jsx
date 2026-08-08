import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { cycleEnd, cyclePhase, shortDate, untilLabel } from '../lib/time'
import { groupGoalProgress } from '../lib/stats'
import { useT } from '../lib/i18n'
import { Avatar, Empty, Screen, Section, TopBar } from '../components/ui'
import NudgeBanner from '../components/NudgeBanner'
import GroupMoods from '../components/GroupMoods'
import GoalCard from '../components/GoalCard'
import { MoodBadge } from '../components/MoodBoard'

export default function Board() {
  const { user } = useAuth()
  const { t, locale } = useT()
  const {
    group,
    activeId,
    members,
    cycles,
    cadence,
    currentCycle,
    lastCycle,
    nextCycle,
    groupGoals,
    myGoals,
    statuses,
  } = useGroup()
  const [checkins, setCheckins] = useState([])
  const [items, setItems] = useState([])

  const phase = cyclePhase(currentCycle, cycles, cadence)

  /**
   * The period that just ended, shown underneath the one you are in.
   *
   * It is only a separate thing when a period is open. Once a week runs from
   * one meeting to the next, last week's results unseal at the same instant
   * this week begins, so a board that could only hold one period would throw
   * away the reveal at the moment it arrived. When nothing is open the two
   * are the same row and the section below is skipped.
   */
  const past = phase === 'open' && lastCycle?.id !== currentCycle?.id ? lastCycle: null

  /* One read for both periods rather than one per section. */
  const wanted = useMemo(
    () => [currentCycle?.id, past?.id].filter(Boolean),
    [currentCycle?.id, past?.id],
  )

  useEffect(() => {
    if (wanted.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data: cks } = await supabase.from('checkins').select('*').in('cycle_id', wanted)
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
  }, [wanted.join(',')])

  const now = checkins.filter((c) => c.cycle_id === currentCycle?.id)
  const submittedIds = new Set(now.map((c) => c.user_id))
  const awayIds = new Set(
    statuses.filter((s) => s.cycle_id === currentCycle?.id && s.status === 'away').map((s) => s.user_id),
  )
  const expected = members.filter((m) => !awayIds.has(m.user_id))
  const allIn = expected.length > 0 && expected.every((m) => submittedIds.has(m.user_id))

  /**
   * Results stay sealed until the period ends, or until everyone is in.
   * Before that the board shows only who has checked in. Holding the reveal is
   * what turns a form into an event. There is a reason to come back at a
   * particular time, rather than a page that is identical whenever you look.
   *
   * What changed is what is being held. It used to be the writing as well:
   * the form itself was shut for five days out of seven, so most of the time
   * the group was a countdown you could not act on. Now only the reading
   * waits. You write whenever the week gives you a minute.
   */
  const revealed = phase === 'closed' || allIn

  const nowItemIds = new Set(now.map((c) => c.id))
  const iHaveChecked = submittedIds.has(user?.id)
  const meAway = awayIds.has(user?.id)
  const openCount = [...myGoals, ...groupGoals].filter((g) => g.status === 'active').length

  const status = useMemo(() => {
    if (!currentCycle) return t('board.getting_ready')
    if (phase === 'open')
      return t('board.reveals_in', { t: untilLabel(cycleEnd(currentCycle, cycles, cadence)) })
    if (phase === 'upcoming') return t('board.opens_in', { t: untilLabel(currentCycle.opens_at) })
    if (nextCycle) return t('board.next_opens_in', { t: untilLabel(nextCycle.opens_at) })
    return t('board.closed')
  }, [currentCycle?.id, phase, nextCycle?.id, cycles, cadence, t])

  if (!group) return null

  return (
    <Screen>
      <TopBar title={group.name} sub={status} />

      <NudgeBanner />

      {/**
       * The one hero surface on this screen, and the only glass in the page
       * body. Everything below it stays solid, a second floating card here
       * would flatten the hierarchy this is buying.
       */}
      {phase === 'open' && !iHaveChecked && !meAway && (
        <div className="glass mt-8 rounded-card p-6">
          <h2 className="text-h2 text-ink">{t('board.ready')}</h2>
          <p className="mt-2 text-body text-ink/70">
            {openCount === 0
              ? t('board.nothing_listed')
              : t('board.things_to_look_at', { n: openCount })}
          </p>
          <Link to={`/g/${activeId}/checkin`} className="btn-primary press mt-6">
            {t('board.check_in')}
          </Link>
        </div>
      )}

      <Section
        title={
          revealed
            ? t('board.this_week')
            : t('board.checked_in_count', { n: submittedIds.size, total: expected.length })
        }
      >
        <Roster
          members={members}
          checkins={now}
          items={items}
          awayIds={awayIds}
          revealed={revealed}
          settled={phase === 'closed'}
          me={user?.id}
          t={t}
        />
        {/* Said once, on the screen where the waiting happens, rather than
            left for someone to work out from a chip that never changes. */}
        {!revealed && <p className="mt-5 text-small text-muted">{t('board.sealed_note')}</p>}
      </Section>

      {/**
       * Last week, revealed, underneath this week.
       *
       * This is the payoff for the seal above, and it used to be reachable
       * only in the day and a half between a window closing and its
       * replacement. Everything anyone wrote is worth more read together a
       * week later than it is read alone the night it was written.
       */}
      {past && (
        <Section title={t('board.last_week', { d: shortDate(past.opens_at, locale) })}>
          <Roster
            members={members}
            checkins={checkins.filter((c) => c.cycle_id === past.id)}
            items={items}
            awayIds={
              new Set(
                statuses
                  .filter((s) => s.cycle_id === past.id && s.status === 'away')
                  .map((s) => s.user_id),
              )
            }
            revealed
            settled
            me={user?.id}
            t={t}
          />
        </Section>
      )}

      {/**
       * How everyone is today, above the goals.
       *
       * Deliberately not sealed with the rest of the board. A mood is shared
       * on purpose, by somebody who pressed a switch to share it, and the
       * point of that switch is that a group-mate sees it now rather than at
       * the end of the week. It is also the one thing here that is about the
       * person and not about their performance, which is why it sits above
       * the goals rather than under them.
       *
       * Renders nothing at all when nobody has shared. See GroupMoods.
       */}
      <GroupMoods groupId={activeId} members={members} />

      {groupGoals.length > 0 && (
        <Section title={t('board.together')}>
          <div className="space-y-4">
            {groupGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                /* Scoped to this period's check-ins. `items` covers both
                   periods on screen now, and counting last week's rows into
                   this week's progress would show a shared goal already part
                   done before anybody had touched it. */
                progress={groupGoalProgress(
                  g,
                  items.filter((i) => i.goal_id === g.id && nowItemIds.has(i.checkin_id)),
                  members.length,
                )}
              />
            ))}
          </div>
        </Section>
      )}

      {members.length === 1 && (
        <Section title={t('board.invite')}>
          <Empty
            action={
              <p className="font-display text-h1 tracking-[0.12em] text-ink">{group.invite_code}</p>
            }
          >
            {t('board.invite_body')}
          </Empty>
        </Section>
      )}
    </Screen>
  )
}

/**
 * Who is in, and what they said once it is safe to say it.
 *
 * Pulled out of the page because the board renders it twice: sealed for the
 * period you are in, open for the one that just ended. It was written inline
 * when there was only ever one of them.
 *
 * `settled` is separate from `revealed` on purpose. Revealed decides whether
 * you can read someone's answers; settled decides whether an empty row means
 * "has not yet" or "did not". Once everyone is in, a period is revealed while
 * still running, and calling a missing row a miss at that point would be
 * wrong: the period has not ended.
 */
function Roster({ members, checkins, items, awayIds, revealed, settled, me, t }) {
  return (
    <div className="list">
      {members.map((m) => {
        const ck = checkins.find((c) => c.user_id === m.user_id)
        const isAway = awayIds.has(m.user_id)
        const mine = m.user_id === me

        return (
          <div key={m.user_id} className="py-5">
            <div className="flex items-center gap-4">
              <Avatar profile={m.profile} />
              <span className="flex-1 text-body text-ink">
                {m.profile?.display_name}
                {mine && <span className="text-muted"> · {t('board.you')}</span>}
              </span>
              {/* Sealed along with everything else. How someone felt is part
                  of their check-in, so it waits with the rest of it. */}
              {revealed && ck?.mood && <MoodBadge id={ck.mood} size={24} />}
              {/* A filled chip, not coloured text: green at full saturation
                  cannot pass contrast as type, and the block reads louder. */}
              <span className={ck ? 'chip-green': 'chip-quiet'}>
                {isAway
                  ? t('board.state_away')
: ck
                    ? t('board.state_in')
: settled
                      ? t('board.state_quiet')
: t('board.state_waiting')}
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
                  <p className="pt-1 text-small text-muted">
                    {t('board.next', { text: ck.next_commitment })}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ItemLine({ item }) {
  const { t } = useT()
  // A dot is not text, so it can carry the saturated hue directly.
  const tone =
    item.outcome === 'done'
      ? 'bg-green'
      : item.outcome === 'partial'
        ? 'bg-accent'
        : 'bg-muted/40'

  const label =
    item.outcome === 'done'
      ? t('board.did_it')
      : item.outcome === 'partial'
        ? t('board.partly')
        : t('board.not_this_week')

  return (
    <p className="flex items-center gap-3 text-small">
      <span className={`h-2 w-2 shrink-0 rounded-pill ${tone}`} />
      <span className="flex-1 text-muted">{item.evidence || label}</span>
      {item.count_done > 0 && <span className="text-muted/70">{item.count_done}</span>}
    </p>
  )
}
