import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cheer } from '../lib/burst'
import { cyclePhase } from '../lib/time'
import { useT } from '../lib/i18n'
import { dueOn, outcomeFor, targetFor } from '../lib/schedule'
import { countOn, progressFor } from '../lib/streak'
import { proofFields, proofTypeOf } from '../lib/proofKinds'
import { errorText } from '../lib/dberr'
import { Empty, Screen, Section, TopBar } from '../components/ui'
import GoalCard from '../components/GoalCard'
import CheckinCarousel from '../components/CheckinCarousel'
import CheckinRail from '../components/CheckinRail'
import ProofGallery from '../components/ProofGallery'
import CelebrateStep from '../components/CelebrateStep'

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
  const {
    goals, soloGoals, members, myRole, cycles, cadence, currentCycle, reloadGroup,
    dayIndex, setGoalDay,
  } = useGroup()
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

  /**
   * THE CHECK-IN, ON THIS PAGE, IN BOTH MODES, AND NOWHERE ELSE ON IT.
   *
   * It was a separate screen listing the same goals again with one Submit at
   * the bottom; then a control on every card; then a banner and a modal
   * carousel. It is a banner and a rail you slide, and this page is the only
   * place the daily question is asked.
   *
   * THE CARDS BELOW NO LONGER ASK IT. They had a tick, a "not due today" line,
   * a streak and seven dots, so a list of five goals put the same question
   * under every one of them, five rows below the place it had already been
   * asked once. Everything under a card's rule is gone; a goal card shows what
   * the goal IS, and whether today is done belongs to the rail.
   *
   * IT RUNS SOLO TOO, AND THE TWO MODES WRITE TO DIFFERENT TABLES.
   *
   * That difference is not a detail to paper over. A group goal is answered
   * into a cycle: submit_checkin upserts a checkins row and the whole
   * checkin_items list under it, which is why saving one answer has to post all
   * of them. A solo goal has no cycle at all, because cycles.group_id is not
   * null, so migration 32 gave it goal_days: one row per goal per day, a count
   * and a date. See src/lib/streak.js.
   *
   * So `open` splits in two. A group is open while its period is, and a shut
   * period is a thing nobody can write into. Solo has no period to be shut, so
   * it is open whenever there is anything due.
   */
  const phase = cyclePhase(currentCycle, cycles, cadence)
  const openGroup = Boolean(groupId) && Boolean(currentCycle) && phase === 'open'
  const openSolo = !groupId
  const open = openGroup || openSolo

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
    if (!openGroup) return undefined
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
  }, [openGroup, currentCycle?.id, user?.id])

  /**
   * The same seeding for solo, and it needs no request at all.
   *
   * goal_days for the last four hundred days is already in the context, which
   * is where the cards get their ticks and their streaks. Reading it again
   * over the wire would be a second copy of a number already on screen, and
   * the two would disagree for as long as the request was in flight.
   *
   * `complete` rather than a stored outcome, because goal_days has no outcome
   * column: it has a count. A once-a-day goal is done when the count reached
   * its target, which is what progressFor already works out for the card.
   */
  useEffect(() => {
    if (!openSolo) return
    const seeded = {}
    const now = new Date()
    for (const g of live) {
      const p = progressFor(g, dayIndex, now)
      if (!p.due) continue
      const done = countOn(dayIndex, g.id, p.day)
      if (done <= 0) continue
      seeded[g.id] = { count: done, outcome: p.complete ? 'done' : undefined }
    }
    setAnswers(seeded)
    answersRef.current = seeded
    setSavedAt(Object.fromEntries(Object.keys(seeded).map((k) => [k, true])))
  }, [openSolo, live, dayIndex])

  const set = (goalId, patch) => {
    /**
     * THE REF IS UPDATED SYNCHRONOUSLY, AND THAT IS THE WHOLE POINT OF IT.
     *
     * It used to be assigned inside the setAnswers updater. React does not call
     * an updater at the moment you queue it, so the ref only caught up on the
     * next render, and any caller that recorded an answer and saved in the same
     * handler read the value from BEFORE the answer.
     *
     * The carousel never showed this: a tap and its save were always separated
     * by another tap or by the advance timer, so a render had happened in
     * between. The rail saves on the same tap and lost the write completely.
     * The card turned pink, nothing went to the network, and a reload put it
     * back to grey.
     *
     * Found by reading the request log, not the screen. The screen was right.
     */
    const next = {
      ...answersRef.current,
      [goalId]: { ...(answersRef.current[goalId] ?? {}), ...patch },
    }
    answersRef.current = next
    setAnswers(next)
    setSavedAt((s) => ({ ...s, [goalId]: false }))
  }

  /**
   * Is every goal due today now recorded.
   *
   * THIS EXISTS BECAUSE THE RAIL SAVES ON EVERY TAP.
   *
   * The old rule was "confetti if anything was recorded", which was right when
   * a save happened once, at the end of the carousel. The rail writes on each
   * answer, so that rule fired a full celebration five times while somebody
   * ticked five goals, which is not a celebration, it is a nuisance with
   * colour. It fires once now, on the tap that finishes the day.
   *
   * Read from the ref rather than from state, for the reason recorded on it:
   * the caller has just written an answer and the render carrying it may not
   * have happened.
   */
  const dayComplete = useCallback(() => {
    const current = answersRef.current
    const due = live.filter((g) => dueToday.has(g.id))
    if (due.length === 0) return false
    return due.every((g) => {
      const a = current[g.id]
      if (!a) return false
      const target = targetFor(g)
      return g.cadence === 'recurring' && target > 1
        ? (a.count ?? 0) >= target
        : a.outcome === 'done' || (a.count ?? 0) > 0
    })
  }, [live, dueToday])

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
      if (saving) return

      /**
       * SOLO SAVES ONE ROW PER GOAL AND NOTHING ELSE.
       *
       * There is no cycle to enqueue against and no RPC that takes a list, so
       * this is not the group path with a different table name: it is a write
       * per answered goal through setGoalDay, which is the same call the card's
       * tick makes. That is deliberate. Two controls writing the same fact by
       * two different routes is how they come to disagree; both go through the
       * one function that owns goal_days, so there is nothing to reconcile.
       *
       * Only the goals due today, unlike the group branch below. goal_days is
       * keyed by date, so writing a goal that is not due today would file an
       * answer under a day that did not ask the question.
       */
      if (openSolo) {
        setSaving('all')
        setStuck(null)
        const current = answersRef.current
        const now = new Date()
        const written = []
        let firstError = null
        for (const g of live) {
          const a = current[g.id]
          if (!a) continue
          if (!progressFor(g, dayIndex, now).due) continue
          /* An explicit "pas encore" is a zero, which setGoalDay stores by
             deleting the row. Leaving the old count would mean answering
             "not yet" had no effect at all. */
          const count = a.outcome === 'missed' ? 0 : (a.count ?? (a.outcome === 'done' ? targetFor(g) : 0))
          const { error } = await setGoalDay(g, count, now)
          if (error) {
            firstError = firstError ?? error
            continue
          }
          written.push({ goal_id: g.id, count_done: count })
        }

        if (firstError) {
          setStuck({ rejected: true, detail: errorText(firstError) })
          setSaving(null)
          return
        }
        if (written.some((it) => it.count_done > 0) && dayComplete()) cheer()
        setSavedAt(Object.fromEntries(written.map((it) => [it.goal_id, true])))
        setSaving(null)
        return
      }

      if (!currentCycle) return
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
      if (dayComplete()) cheer()

      setSavedAt(Object.fromEntries(items.map((it) => [it.goal_id, true])))
      /* The gallery below loads once and cannot know a photo was just attached
         in the carousel. Without this the strip keeps showing the set it had
         on mount, which is the whole of "my photo did not appear". */
      setProofTick((n) => n + 1)
      await reloadGroup()
      setSaving(null)
    },
    [live, currentCycle, saving, reloadGroup, openSolo, dayIndex, setGoalDay, dayComplete],
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

  /**
   * PROOF AND PRAISE, WHICH USED TO BE A TAB OF THEIR OWN.
   *
   * The Bravo tab was the check-in. When the check-in moved onto this page,
   * what was left there was a destination whose whole content was two buttons
   * and an empty state, and both buttons led somewhere else. A tab that exists
   * to offer two links is a menu with a page around it.
   *
   * Both belong here. Proof is evidence OF a goal, so the gallery goes under
   * the goal cards rather than a tab away from them; a compliment is what
   * somebody thinks of while looking at how the week went, which is this
   * screen. One page now answers "what did I commit to, what did I do about
   * it, and who else did well".
   *
   * GROUP ONLY. Both read from a group: the gallery is the group's proof and
   * the compliment is addressed to a member. On /goals with no group there is
   * neither a feed to show nor anybody to send to.
   */
  const [proofTick, setProofTick] = useState(0)
  const [party, setParty] = useState({ receiverId: null, message: '' })
  /* Closed until asked for, which is what CelebrateStep's own note asks of
     its host: it costs nothing until somebody wants it, and wanting it is one
     tap. Open by default it would be a face row and a textarea between the
     goals and the archive on a day nobody meant to write anything. */
  const [celebrating, setCelebrating] = useState(false)

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
        /**
         * The privacy line moved into a question mark beside the heading.
         *
         * "Rien qu'a toi. Personne d'autre ne les voit." answers a question
         * somebody has once and never again, and as standing copy it cost two
         * lines at the top of the page on every visit, pushing the goals down.
         * It is still one tap away and still the first thing under the title;
         * it just is not read aloud to people who already know.
         */
        hint={groupId ? undefined : t('goals.solo_sub')}
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
       * THE DAILY QUESTION, AND THE CARDS YOU ANSWER IT ON.
       *
       * The question is type on the page rather than a card: a white rectangle
       * above a column of white rectangles read as the first goal in the list.
       *
       * Under it, a rail you slide rather than a button that opens a modal.
       * The button was one more tap before the first answer and put a layer
       * between somebody and a list they were already looking at. This section
       * exists to be fast, so it answers in place. See CheckinRail.
       *
       * It counts down, and when everything due is recorded it says so instead
       * of disappearing: a section that vanishes is indistinguishable from one
       * that never worked.
       */}
      {open && todays.length > 0 && (
        <Section>
          <div
            data-hook="checkin-banner"
            data-answered={answered}
            data-total={todays.length}
          >
            <p className="text-safe text-h2 font-semibold leading-tight text-ink">
              {answered >= todays.length ? t('checkin.banner_done') : t('checkin.banner_q')}
            </p>
            <p className="text-safe mt-1.5 text-small text-muted">
              {t('checkin.banner_sub', { n: todays.length - answered, total: todays.length })}
            </p>
          </div>
          <div className="mt-4">
            <CheckinRail
              goals={todays}
              answers={answers}
              busy={saving !== null}
              /* One tap records. saveAll posts every answer rather than the one
                 just given, which is not laziness: submit_checkin upserts the
                 whole item list for a cycle, so a save that carried only this
                 goal would delete the rest. The solo branch writes one
                 goal_days row per answered goal, and an upsert of an unchanged
                 row is a no-op. */
              onAnswer={(goal, patch) => {
                set(goal.id, patch)
                saveAll()
              }}
            />
          </div>

          {/**
           * THE ONE THING THE RAIL CANNOT DO, KEPT REACHABLE.
           *
           * A rail card is a title and one control; there is no room in it for
           * a photograph, a link and an evidence note, and cramming them in
           * would undo the speed the rail exists for. So the carousel stays as
           * the long way round, for the days there is something to attach.
           *
           * GROUP ONLY, and that is a storage fact rather than a layout one:
           * proof rides on a checkin_item, and a solo goal is a goal_days row
           * with a count and a date and nowhere to put a file. Offering it on
           * /goals would be offering to drop what somebody chose.
           */}
          {openGroup && todays.some((g) => proofTypeOf(g) !== 'none') && (
            <button
              type="button"
              onClick={() => setCarousel(true)}
              data-hook="checkin-proof-open"
              className="press mt-3 text-small font-semibold text-accent underline decoration-1 underline-offset-2"
            >
              {t('checkin.add_proof')}
            </button>
          )}
        </Section>
      )}

      {/**
       * The carousel, for proof only now.
       *
       * It used to be the check-in itself. The rail answers the daily question
       * in place, so this is the long way round: one goal at a time with the
       * evidence field, reached from the link under the rail and never opened
       * by accident. Group only, because that is the only place proof has a
       * column to live in.
       */}
      {carousel && (
        <CheckinCarousel
          goals={todays}
          answers={answers}
          onChange={set}
          onDone={saveAll}
          onClose={() => setCarousel(false)}
          busy={saving !== null}
          proof={openGroup}
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
       * The proof, directly under the goals it is proof of.
       *
       * A strip rather than the whole grid: this is the tail of a page about
       * goals, not a gallery, and "See all" opens the full screen at /proofs
       * for anybody who came to look through it. That route already existed
       * behind the same link from the tab that is gone.
       */}
      {groupId && (
        <Section
          title={t('proof.title')}
          action={
            <Link
              to={`/g/${groupId}/proofs`}
              data-hook="goals-proof-all"
              className="text-small text-ink underline-offset-4 hover:underline"
            >
              {t('proof.see_all')}
            </Link>
          }
        >
          <div data-hook="goals-proof">
            <ProofGallery groupId={groupId} limit={6} refreshToken={proofTick} />
          </div>
        </Section>
      )}

      {/**
       * And the compliment, which is the one thing on this page that is not
       * about you.
       *
       * Behind a button because it is optional and should stay that way. There
       * is no prompt, no suggested recipient and no count of how often anybody
       * has used it: a nudge to say something nice produces things nobody
       * means. CelebrateStep posts on its own, so nothing here waits on a save.
       */}
      {groupId && (
        <Section title={t('celebrate.title')}>
          {celebrating ? (
            <CelebrateStep
              groupId={groupId}
              members={members}
              value={party}
              onChange={setParty}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCelebrating(true)}
              data-hook="goals-celebrate-open"
              className="goal-action press"
            >
              {t('celebrate.open')}
            </button>
          )}
        </Section>
      )}

      {/**
       * A write that did not land. Shown in both modes, because both can fail
       * and a save that quietly did nothing is the worst of the outcomes.
       */}
      {stuck && (
        <Section>
          <div data-hook="goals-stuck">
            <p className="text-small text-negative" role="alert">
              {stuck.rejected ? t('checkin.refused') : t('checkin.queued')}
            </p>
            {stuck.detail && (
              <p className="mt-1 break-words text-label text-muted">{stuck.detail}</p>
            )}
          </div>
        </Section>
      )}

      {/**
       * And the way to sit a period out, which is GROUP ONLY.
       *
       * It belongs to the cycle rather than to any one goal, which is why it
       * is here and not on a card: "I am away" is a statement about the week,
       * and putting it on six cards would be six ways to say it once.
       *
       * There is no solo equivalent and inventing one would be wrong. away_periods
       * is keyed by cycle_id, and more to the point, telling four people you
       * are out this week is the whole act. Nobody needs to notify themselves
       * that they are having a quiet week.
       */}
      {openGroup && (
        <Section>
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
