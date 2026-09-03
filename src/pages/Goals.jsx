import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cheer } from '../lib/burst'
import { cyclePhase } from '../lib/time'
import { useT } from '../lib/i18n'
import { dueOn, outcomeFor } from '../lib/schedule'
import { proofFields, proofTypeOf } from '../lib/proofKinds'
import { errorText } from '../lib/dberr'
import { Empty, Screen, Section, TopBar } from '../components/ui'
import GoalCard from '../components/GoalCard'
import GoalCheckin from '../components/GoalCheckin'

/**
 * Goals, in a group or on your own.
 *
 * One component for both, because they are the same screen with a different
 * source: /g/:groupId/goals reads the group's goals, /goals reads the ones
 * with no group attached. Splitting them into two pages would have duplicated
 * the sections, the empty states and the archive for no gain.
 *
 * The archive is new. Goals used to be loaded as active-or-paused only, so
 * finishing one made it disappear, which is exactly backwards, since a
 * finished goal is the only evidence you have that any of this works.
 */
const LIVE = new Set(['active', 'paused'])

export default function Goals() {
  const { user } = useAuth()
  const { groupId } = useParams()
  const { goals, soloGoals, members, myRole, cycles, cadence, currentCycle, reloadGroup } = useGroup()
  const { t } = useT()
  /**
   * Open by default.
   *
   * It was collapsed, and collapsed was wrong: marking a goal done removed it
   * from the live list and put it somewhere you could not see, so the reward
   * for finishing something was watching it disappear. This section is last
   * on the page, so showing it buries nothing.
   */
  const [showPast, setShowPast] = useState(true)

  const source = groupId ? goals : soloGoals
  const base = groupId ? `/g/${groupId}/goals` : '/goals'

  const live = useMemo(() => source.filter((g) => LIVE.has(g.status)), [source])
  const past = useMemo(() => source.filter((g) => !LIVE.has(g.status)), [source])

  const mine = live.filter((g) => g.kind === 'personal' && g.owner_id === user?.id)
  const shared = live.filter((g) => g.kind === 'group')
  const others = live.filter((g) => g.kind === 'personal' && g.owner_id !== user?.id)

  const ownerOf = (id) => members.find((m) => m.user_id === id)?.profile

  /**
   * Who may delete what, matching goals_delete in supabase/09 exactly:
   *
   *   owner_id = auth.uid() or (group_id is not null and is_group_admin(...))
   *
   * A goal you own is yours to remove wherever it lives. A group goal has no
   * owner, so it belongs to the group and only an admin may take it away from
   * four other people.
   *
   * Mirrored here rather than shown to everybody and left to fail, because a
   * delete that RLS refuses does not raise: Postgres deletes nothing and
   * reports success. A button that silently does nothing is worse than no
   * button. removeGoal checks the returned rows as well, so the two have to
   * both be wrong for anything to go unnoticed.
   */
  const canDelete = (g) => g.owner_id === user?.id || (Boolean(groupId) && myRole === 'admin')

  /* The daily tick belongs to goals with no group. Inside a group the check-in
     asks this question on the card itself, and answering it twice would be two
     records of one day that can disagree. */
  const tracks = !groupId

  /**
   * THE CHECK-IN, ON THIS PAGE, ON EACH CARD.
   *
   * It was a separate screen listing the same goals again with one Submit at
   * the bottom. Answering where the goal already is, is the shorter sentence,
   * and a button per card means somebody can answer the one goal they care
   * about and close the app having recorded it.
   *
   * Only inside a group and only while the period is open. A solo goal already
   * has its own daily tick above, and a shut period is a thing you cannot
   * write into.
   */
  const phase = cyclePhase(currentCycle, cycles, cadence)
  const open = Boolean(groupId) && Boolean(currentCycle) && phase === 'open'

  /* Which goals today actually has an answer for. A twice-a-week goal on a
     Thursday and a one-off due in October are not questions today can answer,
     and a card that asks anyway is one people learn to scroll past. */
  const dueToday = useMemo(
    () => new Set(dueOn(live.filter((g) => g.status === 'active')).map((g) => g.id)),
    [live],
  )

  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(null)
  const [savedAt, setSavedAt] = useState({})
  const [stuck, setStuck] = useState(null)
  const [away, setAway] = useState(false)

  /**
   * WHAT IS ALREADY RECORDED, READ BEFORE ANYTHING IS WRITTEN.
   *
   * This is the load-bearing half of per-card saving and it is easy to leave
   * out. submit_checkin upserts on (cycle_id, user_id) and carries the whole
   * item list, so saving one card posts all of them. Starting from an empty
   * map would mean the first card saved replaced a check-in filled in earlier
   * with a single-goal one, silently deleting the rest.
   *
   * So the existing items are read and become the starting answers. Failing is
   * survivable: the controls still work and a save still writes, it just
   * starts from blank, which is the old behaviour.
   */
  useEffect(() => {
    if (!open) return undefined
    let dead = false
    ;(async () => {
      const { data } = await supabase
        .from('checkins')
        .select('id, checkin_items(goal_id, outcome, count_done, evidence, link_url, photo_url)')
        .eq('cycle_id', currentCycle.id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (dead) return
      const seeded = {}
      for (const it of data?.checkin_items ?? []) {
        seeded[it.goal_id] = {
          outcome: it.outcome ?? undefined,
          count: it.count_done ?? 0,
          evidence: it.evidence ?? '',
          link_url: it.link_url ?? '',
          photo_url: it.photo_url ?? '',
        }
      }
      setAnswers(seeded)
      setSavedAt(Object.fromEntries(Object.keys(seeded).map((k) => [k, true])))
    })()
    return () => {
      dead = true
    }
  }, [open, currentCycle?.id, user?.id])

  const set = (goalId, patch) => {
    setAnswers((a) => ({ ...a, [goalId]: { ...(a[goalId] ?? {}), ...patch } }))
    setSavedAt((s) => ({ ...s, [goalId]: false }))
  }

  /**
   * One card's Save, which posts every answer.
   *
   * See the note on GoalCheckin for why it has to be all of them. `live` and
   * not `dueToday` is deliberate on the payload: a goal answered yesterday
   * inside the same period still belongs in the row, and dropping it because
   * it is not due TODAY would delete that answer.
   */
  const saveOne = useCallback(
    async (goalId) => {
      if (saving || !currentCycle) return
      setSaving(goalId)
      setStuck(null)

      const items = live
        .filter((g) => answers[g.id])
        .map((g) => {
          const a = answers[g.id]
          const count = a.count ?? 0
          return {
            goal_id: g.id,
            outcome: a.outcome ?? outcomeFor(g, count),
            count_done: count,
            ...proofFields(a, proofTypeOf(g)),
          }
        })

      // Local first, network second: a bad connection must never lose this.
      enqueue({ cycle_id: currentCycle.id, note: null, items })

      const { failed, rejected, error } = await flush()
      if (failed > 0 || rejected > 0) {
        /* The server's own words, kept. "It will send when you are back
           online" is right for a dead connection and a lie for a constraint
           violation, and the two are indistinguishable from here. */
        setStuck({ rejected: rejected > 0, detail: errorText(error) })
        setSaving(null)
        return
      }

      /* Only when something was actually recorded. Confetti over a nought is
         the app congratulating somebody for a day they just said went badly. */
      const a = answers[goalId] ?? {}
      if ((a.count ?? 0) > 0 || a.outcome === 'done') cheer()

      setSavedAt((s) => ({ ...s, [goalId]: true }))
      await reloadGroup()
      setSaving(null)
    },
    [answers, live, currentCycle, saving, reloadGroup],
  )

  const markAway = async () => {
    if (!currentCycle) return
    setAway(true)
    await supabase.from('away_periods').upsert(
      { cycle_id: currentCycle.id, user_id: user.id, reason: null },
      { onConflict: 'cycle_id,user_id' },
    )
    await reloadGroup()
    setAway(false)
  }

  /* Rendered under a card rather than passed into GoalCard, so GoalCard stays
     the thing that draws a goal and does not grow a second job. */
  const checkinFor = (g) =>
    open && dueToday.has(g.id) ? (
      <GoalCheckin
        goal={g}
        answer={answers[g.id]}
        onChange={(patch) => set(g.id, patch)}
        onSave={() => saveOne(g.id)}
        busy={saving === g.id}
        saved={Boolean(savedAt[g.id])}
      />
    ) : null

  return (
    <Screen>
      <TopBar
        title={t('nav.goals')}
        sub={groupId ? undefined : t('goals.solo_sub')}
        right={
          /**
           * A plus and nothing else. "+ Add" wrapped onto two lines inside the
           * pill on a phone, making the chip taller than the heading beside
           * it. The word was never doing work that a plus in the corner of a
           * list does not already do, but it has to keep its accessible name,
           * so the label moves to aria-label rather than disappearing.
           */
          <Link
            to={`${base}/new`}
            aria-label={t('goals.new_goal')}
            title={t('goals.new_goal')}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-accent text-[1.375rem] font-semibold leading-none text-on-accent"
          >
            +
          </Link>
        }
      />

      <Section title={t('goals.yours')}>
        {mine.length === 0 ? (
          <Empty
            action={
              <Link to={`${base}/new`} className="btn-primary press inline-flex w-auto px-8">
                {t('goals.new_goal')}
              </Link>
            }
          >
            {groupId ? t('goals.empty') : t('goals.empty_solo')}
          </Empty>
        ) : (
          <div className="card-grid">
            {mine.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                owner={ownerOf(g.owner_id)}
                showControls
                track={tracks}
                deletable={canDelete(g)}
                editHref={`${base}/${g.id}/edit`}
                footer={checkinFor(g)}
              />
            ))}
          </div>
        )}
      </Section>

      {shared.length > 0 && (
        <Section title={t('board.together')}>
          <div className="card-grid">
            {shared.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                showControls
                deletable={canDelete(g)}
                editHref={`${base}/${g.id}/edit`}
                footer={checkinFor(g)}
              />
            ))}
          </div>
        </Section>
      )}

      {others.length > 0 && (
        <Section title={t('goals.everyone_else')}>
          <div className="card-grid">
            {others.map((g) => (
              <GoalCard key={g.id} goal={g} owner={ownerOf(g.owner_id)} />
            ))}
          </div>
        </Section>
      )}

      {/**
       * A write that did not land, and the way to sit a period out.
       *
       * Both belong to the CYCLE rather than to any one goal, which is why
       * they are here and not on a card. "I am away" is a statement about the
       * week; putting it on six cards would be six ways to say it once.
       */}
      {open && (
        <Section>
          {stuck && (
            <div className="mb-4" data-hook="goals-stuck">
              <p className="text-small text-negative" role="alert">
                {stuck.rejected ? t('checkin.refused') : t('checkin.queued')}
              </p>
              {stuck.detail && (
                <p className="mt-1 break-words text-label text-muted">{stuck.detail}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={markAway}
            disabled={away}
            data-hook="goals-away"
            className="btn-ghost press"
          >
            {t('checkin.away')}
          </button>
          <p className="mt-3 text-center text-small text-muted">{t('checkin.away_note')}</p>
        </Section>
      )}

      {/**
       * Collapsed by default. The archive is worth keeping and worth being
       * able to find, but it is not what you came to this screen for, and a
       * long list of finished things above your live ones would bury them.
       */}
      {past.length > 0 && (
        <Section
          title={t('goals.past')}
          action={
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-small text-ink underline-offset-4 hover:underline"
            >
              {showPast ? t('goals.hide') : t('goals.show_n', { n: past.length })}
            </button>
          }
        >
          {showPast && (
            <div className="card-grid">
              {past.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  owner={ownerOf(g.owner_id)}
                  /* Restarting is only yours to offer on your own goals and on
                     the group's. Someone else's finished goal is a record. */
                  showControls={g.kind === 'group' || g.owner_id === user?.id}
                  deletable={canDelete(g)}
                />
              ))}
            </div>
          )}
        </Section>
      )}
    </Screen>
  )
}
