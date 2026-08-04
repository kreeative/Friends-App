import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { cyclePhase, untilLabel } from '../lib/time'
import { groupGoalProgress } from '../lib/stats'
import { useT } from '../lib/i18n'
import { Avatar, Empty, Screen, Section, TopBar } from '../components/ui'
import NudgeBanner from '../components/NudgeBanner'
import GoalCard from '../components/GoalCard'

export default function Board() {
  const { user } = useAuth()
  const { t } = useT()
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
    if (!currentCycle) return t('board.getting_ready')
    if (phase === 'open') return t('board.open_for', { t: untilLabel(currentCycle.closes_at) })
    if (phase === 'upcoming') return t('board.opens_in', { t: untilLabel(currentCycle.opens_at) })
    if (nextCycle) return t('board.next_opens_in', { t: untilLabel(nextCycle.opens_at) })
    return t('board.closed')
  }, [currentCycle?.id, phase, nextCycle?.id, t])

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
          <h2 className="text-h2 text-ink">{t('board.ready')}</h2>
          <p className="mt-2 text-body text-ink/70">
            {openCount === 0
              ? t('board.nothing_listed')
              : t('board.things_to_look_at', { n: openCount })}
          </p>
          <Link to="/checkin" className="btn-primary press mt-6">
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
                    {mine && <span className="text-muted"> · {t('board.you')}</span>}
                  </span>
                  {/* A filled chip, not coloured text: green at full saturation
                      cannot pass contrast as type, and the block reads louder. */}
                  <span className={ck ? 'chip-green' : 'chip-quiet'}>
                    {isAway
                      ? t('board.state_away')
                      : ck
                        ? t('board.state_in')
                        : phase === 'closed'
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
      </Section>

      {groupGoals.length > 0 && (
        <Section title={t('board.together')}>
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

function ItemLine({ item }) {
  const { t } = useT()
  // A dot is not text, so it can carry the saturated hue directly.
  const tone =
    item.outcome === 'done'
      ? 'bg-green'
      : item.outcome === 'partial'
        ? 'bg-yellow'
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
