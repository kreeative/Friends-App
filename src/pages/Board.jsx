import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { cycleEnd, cyclePhase, untilLabel } from '../lib/time'
import { groupGoalProgress } from '../lib/stats'
import { dueOn } from '../lib/schedule'
import { useT } from '../lib/i18n'
import { Avatar, Empty, Screen, Section, TopBar } from '../components/ui'
import BirthdayBanner from '../components/BirthdayBanner'
import NudgeBanner from '../components/NudgeBanner'
import GroupMoods from '../components/GroupMoods'
import GroupAnalytics from '../components/GroupAnalytics'
import TodayObjective from '../components/TodayObjective'
import GroupFeed from '../components/GroupFeed'
import GoalCard from '../components/GoalCard'

export default function Board() {
  const { user } = useAuth()
  const { t } = useT()
  const {
    group,
    activeId,
    members,
    cycles,
    cadence,
    currentCycle,
    nextCycle,
    goals,
    groupGoals,
    myGoals,
    statuses,
    reloadGroup,
  } = useGroup()
  const [checkins, setCheckins] = useState([])
  const [items, setItems] = useState([])

  const phase = cyclePhase(currentCycle, cycles, cadence)

  /**
   * Every period the board holds, in one read.
   *
   * This used to fetch exactly the two periods on screen, and then the
   * analytics section wanted the history as well, which would have been a
   * third and fourth request for rows the same two queries could return. The
   * page already loads every member's status for every cycle; the outcomes
   * behind those statuses are the same order of magnitude.
   *
   * Everything downstream already filters by cycle, so widening the window
   * changes nothing about what the rosters show.
   */
  const wanted = useMemo(() => cycles.map((c) => c.id), [cycles])

  /**
   * WHY "MARQUER FAIT" APPEARED TO DO NOTHING.
   *
   * The tap wrote to the database correctly every time. What did not happen
   * was this page noticing. reloadGroup refreshes what GroupContext owns, and
   * the roster, the "X sur Y" counter and the button all read `checkins` and
   * `items`, which are local to this component. They were loaded by an effect
   * keyed on the list of cycle ids, and a check-in does not create a cycle, so
   * the key never changed and the effect never ran again.
   *
   * Everything on screen was therefore drawn from state captured before the
   * tap: still nobody checked in, still "Pas encore", still 0 of 7. Reload the
   * page and it was all correct, which is the signature of a stale read rather
   * than a failed write.
   *
   * So the fetch is a function that can be called again, and the sequence
   * counter drops a response that arrives after a newer one was asked for.
   */
  const seq = useRef(0)

  const loadCheckins = useCallback(async () => {
    if (wanted.length === 0) return
    const mine = ++seq.current

    const { data: cks } = await supabase.from('checkins').select('*').in('cycle_id', wanted)
    if (mine !== seq.current) return
    setCheckins(cks ?? [])

    const ids = (cks ?? []).map((c) => c.id)
    if (ids.length === 0) return setItems([])
    const { data: its } = await supabase.from('checkin_items').select('*').in('checkin_id', ids)
    if (mine === seq.current) setItems(its ?? [])
  }, [wanted.join(',')])

  useEffect(() => {
    loadCheckins()
  }, [loadCheckins])

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

  /* Goals I have already recorded an outcome for today, so the one-tap card
     knows what is left rather than offering the same goal again after it has
     been marked. Only mine: a shared goal another member ticked is still
     outstanding for me. */
  const myCheckinIds = new Set(now.filter((c) => c.user_id === user?.id).map((c) => c.id))
  const doneToday = new Set(
    items
      .filter(
        (i) =>
          myCheckinIds.has(i.checkin_id) &&
          (i.outcome === 'done' || i.outcome === 'partial'),
      )
      .map((i) => i.goal_id),
  )
  const iHaveChecked = submittedIds.has(user?.id)
  const meAway = awayIds.has(user?.id)
  const openCount = [...myGoals, ...groupGoals].filter((g) => g.status === 'active').length

  /**
   * The tap, before the network has answered.
   *
   * Written into the same local state the roster and the counter read, so the
   * button, your own row and "X sur Y" all move on the tap rather than after a
   * round trip. The refetch that follows replaces these with the real rows; if
   * the write failed, they go back to what the server says, which is the
   * correct thing for an optimistic update to do.
   *
   * The synthetic ids are prefixed so nothing downstream mistakes them for
   * rows it could update or delete.
   */
  const markOptimistically = useCallback(
    (goalId) => {
      if (!currentCycle || !user) return
      const existing = checkins.find(
        (c) => c.cycle_id === currentCycle.id && c.user_id === user.id,
      )
      const checkinId = existing?.id ?? `local-${currentCycle.id}`

      if (!existing) {
        setCheckins((prev) => [
          ...prev,
          {
            id: checkinId,
            cycle_id: currentCycle.id,
            user_id: user.id,
            submitted_at: new Date().toISOString(),
          },
        ])
      }

      setItems((prev) =>
        prev.some((i) => i.checkin_id === checkinId && i.goal_id === goalId)
          ? prev
          : [
              ...prev,
              {
                id: `local-${goalId}`,
                checkin_id: checkinId,
                goal_id: goalId,
                outcome: 'done',
                count_done: 1,
              },
            ],
      )
    },
    [checkins, currentCycle?.id, user?.id],
  )

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

      {/* Above the nudge, because a nudge waits for whoever gets to it and a
          birthday does not wait at all. */}
      <BirthdayBanner people={members.map((m) => m.profile)} />

      <NudgeBanner />

      {/**
       * The one hero surface on this screen, and the only glass in the page
       * body. Everything below it stays solid, a second floating card here
       * would flatten the hierarchy this is buying.
       */}
      {/**
       * The day's one actionable thing, and a tap to finish it.
       *
       * This replaces "ready when you are" as the lead. On a weekly cadence,
       * pointing at the full form was right: a week's review has several
       * goals and a note worth writing. On a daily one the honest answer is
       * usually just yes, and making somebody open a form to say it turns a
       * daily habit into a chore about the app.
       *
       * The form is still here, underneath, for the days that need it.
       */}
      {phase === 'open' && !meAway && (
        <>
          <TodayObjective
            cycle={currentCycle}
            goals={dueOn([...myGoals, ...groupGoals].filter((g) => g.status === 'active'))}
            doneGoalIds={doneToday}
            onMarked={markOptimistically}
            onDone={async () => {
              /* Both: the local rows this page draws from, and the context
                 that owns statuses and the analytics underneath. */
              await Promise.all([loadCheckins(), reloadGroup()])
            }}
          />
          {!iHaveChecked && openCount > 0 && (
            <div className="mt-4">
              <Link
                to={`/g/${activeId}/checkin`}
                className="text-small text-ink underline-offset-4 hover:underline"
              >
                {t('board.things_to_look_at', { n: openCount })}
              </Link>
            </div>
          )}
        </>
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
       * How everyone is, first, ahead of how everyone is doing.
       *
       * This used to sit below the feed, which put two screens of who-missed-
       * what between the roster and the one thing on the page that is about
       * the people rather than their output. The order is the argument: a
       * group where the first thing you read is a percentage is a group that
       * has quietly become a scoreboard.
       *
       * Deliberately not sealed with the rest of the board either. A mood is
       * shared on purpose, by somebody who pressed a switch to share it, and
       * the point of that switch is that a group-mate sees it now rather than
       * at the end of the week.
       *
       * Renders nothing at all when nobody has shared. See GroupMoods.
       */}
      <GroupMoods groupId={activeId} members={members} />

      {/**
       * One table where there were three cards.
       *
       * This was the dark consistency panel, its fourteen status dots, the
       * twelve-point curve beside it and a streak leaderboard underneath. All
       * four counted the same thing, whether people opened the app, and none
       * of them counted whether the goals happened. On a group with no history
       * they also reported "0%" and "0/14", which is a measured failure where
       * the truth was an empty week, and the curve card's "7 Groupes" was the
       * member count wearing the dashboard's label.
       *
       * GroupAnalytics now answers the one question the screen is for, over a
       * window the reader picks. See the file for why the rows are neither
       * ranked nor sorted.
       */}
      <Section title={t('board.how_we_are')}>
        <GroupAnalytics
          members={members}
          goals={goals}
          cycles={cycles}
          checkins={checkins}
          items={items}
        />
      </Section>

      {/**
       * Yesterday's roster used to sit here, revealed, under today's.
       *
       * It was written when a period was a week, and read as the payoff for
       * the seal: everything the group wrote, together, once a week. At a
       * daily cadence it is a second copy of the same five names one day
       * older, on a page that already has today's roster above it and the
       * feed below it saying who missed what. Three passes over the same
       * question, and the middle one is the least useful.
       *
       * The history has not gone anywhere: the feed reports the misses and
       * the table above carries every day the group has had.
       */}
      <GroupFeed groupId={activeId} />

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
