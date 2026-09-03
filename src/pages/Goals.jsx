import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import CheckinCarousel from '../components/CheckinCarousel'

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
  /**
   * The same answers, in a ref, and saveAll reads THIS rather than the state.
   *
   * WHY, BECAUSE THIS COST THE LAST ANSWER EVERY TIME.
   *
   * The carousel advances on a timer after a tap so the chip has a moment to
   * show as pressed. That timer's closure captures the `onDone` it was given
   * at click time, which closed over the answers as they were BEFORE the tap.
   * On the last card that is the one that saves, so the goal somebody had just
   * answered was the one goal missing from the payload.
   *
   * Nothing about it looked wrong: the celebration played, the modal closed,
   * and the RPC went out with every other answer in it. It was found by
   * reading the request body rather than the screen.
   *
   * A ref is not the only fix, but it is the one that cannot come back: any
   * caller, from any closure, at any age, reads what is current.
   */
  const answersRef = useRef({})
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
      answersRef.current = seeded
      setSavedAt(Object.fromEntries(Object.keys(seeded).map((k) => [k, true])))
    })()
    return () => {
      dead = true
    }
  }, [open, currentCycle?.id, user?.id])

  const set = (goalId, patch) => {
    setAnswers((a) => {
      const next = { ...a, [goalId]: { ...(a[goalId] ?? {}), ...patch } }
      answersRef.current = next
      return next
    })
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
  const saveAll = useCallback(
    async () => {
      if (saving || !currentCycle) return
      setSaving('all')
      setStuck(null)

      /* The ref, not the state. See the note beside answersRef. */
      const current = answersRef.current
      const items = live
        .filter((g) => current[g.id])
        .map((g) => {
          const a = current[g.id]
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
      if (items.some((it) => it.count_done > 0 || it.outcome === 'done')) cheer()

      setSavedAt(Object.fromEntries(items.map((it) => [it.goal_id, true])))
      await reloadGroup()
      setSaving(null)
    },
    [live, currentCycle, saving, reloadGroup],
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

  /**
   * THE CONTROLS LEFT THE CARDS, AND THAT IS THE POINT OF THIS ROUND.
   *
   * They were rendered into each card's footer, and the card could not carry
   * them: a title, two badges, an owner, a progress row, four management
   * actions, and then a question, a counter and a Save. "Modifier" and "Fait"
   * are not the same kind of thing and were sitting next to each other.
   *
   * So the card is a card again and the daily question is its own act: a
   * banner when there is something to answer, and a carousel that asks one
   * goal at a time. See components/CheckinCarousel.jsx.
   */
  const [carousel, setCarousel] = useState(false)

  /* The goals the banner is about, in a stable order so the carousel does not
     reshuffle under somebody halfway through it. */
  const todays = useMemo(
    () => (open ? live.filter((g) => dueToday.has(g.id)) : []),
    [open, live, dueToday],
  )

  /* Answered means recorded, not touched: a card somebody opened and left
     alone is still a question. */
  const answered = todays.filter((g) => savedAt[g.id]).length

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

      {/**
       * The daily question, as one thing to press rather than a control on
       * every card.
       *
       * Only when there is something to answer, and it counts down: a banner
       * that is on the page every day whether or not it applies is a banner
       * people stop reading. When everything due has been recorded it says so
       * once and offers to go back in, rather than disappearing, because
       * disappearing is indistinguishable from never having worked.
       */}
      {open && todays.length > 0 && (
        <Section>
          <div
            className="lg overflow-hidden px-5 py-4"
            data-hook="checkin-banner"
            data-answered={answered}
            data-total={todays.length}
          >
            <p className="text-safe text-body font-semibold text-ink">
              {answered >= todays.length ? t('checkin.banner_done') : t('checkin.banner_q')}
            </p>
            <p className="text-safe mt-1 text-small text-muted">
              {t('checkin.banner_sub', { n: todays.length - answered, total: todays.length })}
            </p>
            <button
              type="button"
              onClick={() => setCarousel(true)}
              data-hook="checkin-banner-open"
              className={`press mt-3 ${answered >= todays.length ? 'goal-action' : 'goal-action-done'}`}
            >
              {answered >= todays.length ? t('checkin.banner_again') : t('checkin.banner_cta')}
            </button>
          </div>
        </Section>
      )}

      {carousel && (
        <CheckinCarousel
          goals={todays}
          answers={answers}
          onChange={set}
          onDone={saveAll}
          onClose={() => setCarousel(false)}
          busy={saving !== null}
        />
      )}

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
