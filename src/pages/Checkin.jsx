import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cheer } from '../lib/burst'
import { cycleEnd, cyclePhase, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { dueOn, outcomeFor, targetFor } from '../lib/schedule'
import { proofFields, proofFilled, proofTypeOf } from '../lib/proofKinds'
import { Field, Screen, Section, TopBar } from '../components/ui'
import ProofField from '../components/ProofField'
import CelebrateStep from '../components/CelebrateStep'
import ProofGallery from '../components/ProofGallery'
import ActionBar, { CameraIcon, ForwardIcon, PartyIcon, TargetIcon } from '../components/ActionBar'

export default function Checkin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useT()
  const { activeId, cycles, cadence, currentCycle, nextCycle, members, myGoals, groupGoals, reloadGroup } =
    useGroup()

  /* Only what is actually due. A twice-a-week goal on a Thursday and a
     one-off due in October are not questions today has an answer to, and a
     form that asks them anyway is one people learn to scroll past. */
  const goals = useMemo(
    () => dueOn([...myGoals, ...groupGoals].filter((g) => g.status === 'active')),
    [myGoals, groupGoals],
  )

  const [answers, setAnswers] = useState({})
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * The celebration draft, and a count of what has actually gone out.
   *
   * It used to ride along with Submit. That was defensible while this was one
   * scrolling form and became wrong the moment it got a pane of its own: with
   * Submit off screen, the only button in front of somebody who had just
   * written a compliment was "Skip". It also coupled two unrelated things, a
   * compliment is not a fact about your day and should not need a check-in to
   * be sent.
   *
   * So CelebrateStep posts it itself, and this page only keeps the draft
   * between pane switches and counts what went out, for the tile's badge.
   */
  const [party, setParty] = useState({ receiverId: null, message: '' })
  const [partySent, setPartySent] = useState(0)

  /* Bumped whenever something happened that the gallery below cannot know
     about. See ProofGallery's refreshToken: without it a check-in filed on
     this very screen left the strip showing the set it loaded on mount, which
     is the whole of "my photo did not appear". */
  const [proofTick, setProofTick] = useState(0)

  /* Which of the four jobs is on screen. Goals first, because it is the only
     one that is not optional and the only one most days need. */
  const [pane, setPane] = useState('goals')

  /* Set when a submit went into the queue and did not come back out. See
     submit() for why that must not look like success. */
  const [stuck, setStuck] = useState(false)

  const phase = cyclePhase(currentCycle, cycles, cadence)
  const ends = cycleEnd(currentCycle, cycles, cadence)

  function set(goalId, patch) {
    setAnswers((a) => ({ ...a, [goalId]: { ...(a[goalId] ?? {}), ...patch } }))
  }

  async function submit() {
    if (busy || !currentCycle) return
    setBusy(true)

    /* One payload, carrying the count and whatever proof the goal asked for.
       proofFields sends only the field matching the goal's own proof_type, so
       a goal switched from link to photo does not keep posting whatever was
       left in the link box before the switch. See lib/proofKinds.js. */
    const items = goals.map((g) => {
      const a = answers[g.id] ?? {}
      const count = a.count ?? 0
      return {
        goal_id: g.id,
        outcome: a.outcome ?? outcomeFor(g, count),
        count_done: count,
        ...proofFields(a, proofTypeOf(g)),
      }
    })

    // Local first, network second, a bad connection must never lose this.
    enqueue({
      cycle_id: currentCycle.id,
      next_commitment: next.trim() || null,
      note: null,
      items,
    })

    /**
     * A queued check-in is not a sent one, and the difference is visible.
     *
     * This used to fire and forget: enqueue, flush, navigate. When the flush
     * did not go through, the entry stayed in the queue and the app still
     * moved to the board and showed nothing new, which is exactly the shape of
     * "I attached a photo and it never appeared". Nothing was lost, but a
     * failure that looks like a success is worse than one that looks like a
     * failure, because there is nothing to try again.
     *
     * So a submit that is still queued stays on this screen and says so. The
     * queue keeps retrying underneath either way, and pressing Send again is
     * safe: submit_checkin upserts on (cycle_id, user_id).
     */
    const { failed } = await flush()
    if (failed > 0) {
      setStuck(true)
      setBusy(false)
      return
    }

    /**
     * The one moment this app is allowed to make a noise.
     *
     * Fired here rather than on the board, because this is where the server
     * said yes: anywhere later and it would be celebrating a page load. It
     * runs before the navigation on purpose, and the canvas lives on the body
     * rather than in this component, so it carries over and plays across the
     * board somebody lands on. See lib/burst.js.
     *
     * Only when something was actually recorded. Sending a check-in where
     * every goal is a nought is an honest thing to do and confetti over it
     * would be the app congratulating somebody for a day they just said went
     * badly.
     */
    if (logged > 0) cheer()

    setStuck(false)
    await reloadGroup()
    setProofTick((n) => n + 1)
    setBusy(false)
    navigate(`/g/${activeId}`)
  }

  async function markAway() {
    if (!currentCycle) return
    setBusy(true)
    await supabase.from('away_periods').upsert(
      { cycle_id: currentCycle.id, user_id: user.id, reason: null },
      { onConflict: 'cycle_id,user_id' },
    )
    await reloadGroup()
    setProofTick((n) => n + 1)
    setBusy(false)
    navigate(`/g/${activeId}`)
  }

  /**
   * No cycle at all, a group whose first window has not been materialised
   * yet. This used to `return null`, which paints nothing: a blank white
   * screen under the chrome, with no way to tell a loading state from a
   * broken one. Anything is better than nothing here.
   */
  if (!currentCycle) {
    return (
      <Screen>
        <TopBar title={t('checkin.title')} sub={t('board.getting_ready')} />
        <Section>
          <p className="card text-body text-muted">{t('checkin.no_cycle_body')}</p>
        </Section>
      </Screen>
    )
  }

  /**
   * A period you cannot write into.
   *
   * This screen was here for most of the week. Thirty hours open, a hundred
   * and thirty-eight shut, and the shut version was the one nearly everyone
   * saw. It is still here because a group whose next period has not started
   * yet is a real state, but it is now the rare one rather than the default,
   * and the copy says when rather than no.
   */
  if (phase !== 'open') {
    return (
      <Screen>
        <TopBar title={t('checkin.title')} sub={t('checkin.between')} />
        <Section>
          <div className="card">
            <p className="text-body text-muted">
              {/* nextCycle, not currentCycle: with nothing open, currentCycle
                  is the period that just ended, and its opens_at is in the
                  past, which is how you get "starts again 3d ago". */}
              {nextCycle
                ? t('checkin.between_body', { t: untilLabel(nextCycle.opens_at) })
: t('checkin.no_cycle_body')}
            </p>
          </div>
        </Section>

      </Screen>
    )
  }

  /* What each tile says about itself. Computed here rather than inside the bar
     because it is all state this page owns, and a bar that fetched its own
     answers would be a second source of truth for what has been filled in. */
  const logged = goals.filter((g) => {
    const a = answers[g.id] ?? {}
    if (g.cadence === 'once') return Boolean(a.outcome)
    return (a.count ?? 0) > 0
  }).length
  /* Goals whose proof control has something in it. Counted with proofFilled
     rather than by looking for a photo_url, because proof is now three
     different things and a link is as filled in as a photograph. */
  const proved = goals.filter((g) => proofFilled(answers[g.id], proofTypeOf(g))).length
  const wantProof = goals.filter((g) => proofTypeOf(g) !== 'none').length

  const tiles = [
    {
      id: 'goals',
      icon: <TargetIcon />,
      label: t('checkin.tab_goals'),
      /* Proof is filled in on this pane now, so its count belongs on this
         tile. Only shown once something is counted: "0/3 proved" on an
         untouched form is the app opening with a complaint. */
      badge: goals.length
        ? logged > 0 && wantProof > 0
          ? `${logged}/${goals.length} · ${proved}/${wantProof}`
          : `${logged}/${goals.length}`
        : null,
      done: goals.length > 0 && logged === goals.length,
    },
    {
      id: 'proof',
      icon: <CameraIcon />,
      label: t('checkin.tab_proof'),
      /* No badge. This tile is a gallery of what the group has done, not a
         list of things waiting to be filled in, and a count here would read as
         the second. */
      badge: null,
      done: true,
    },
    {
      id: 'celebrate',
      icon: <PartyIcon />,
      label: t('checkin.tab_celebrate'),
      /* What went out, not what is typed. A tick on a half-written draft would
         say something had been sent that had not. */
      badge: partySent > 0 ? String(partySent) : null,
      done: true,
    },
    {
      id: 'next',
      icon: <ForwardIcon />,
      label: t('checkin.tab_next'),
      badge: next.trim() ? '✓' : null,
      done: true,
    },
  ]

  return (
    <Screen>
      <TopBar
        title={t('checkin.title')}
        sub={t('board.reveals_in', { t: untilLabel(ends) })}
      />

      <ActionBar items={tiles} value={pane} onChange={setPane} />

      {/**
       * One pane at a time, and Submit outside all of them.
       *
       * The button belongs to the check-in, not to whichever tile happens to be
       * open: there is one submission and it carries everything, so hiding it
       * behind the Goals tile would mean somebody who finished on the Celebrate
       * pane had to navigate back to a tab to send. Everything filled in on any
       * pane goes out together whichever one is showing.
       */}
      <div className="mt-6">
        {pane === 'goals' && (
          goals.length === 0 ? (
            <p className="lg p-5 text-body text-muted">{t('checkin.no_goals')}</p>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => {
                const a = answers[g.id] ?? {}
                const count = a.count ?? 0
                const target = targetFor(g)

                return (
                  <div key={g.id} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-h2 text-ink">{g.commitment}</h3>
                      {g.kind === 'group' && (
                        <span className="chip-quiet shrink-0">{t('checkin.shared')}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-small text-muted">
                      {g.cadence === 'recurring'
                        ? t('checkin.committed', { n: target })
                        : t('checkin.committed_once')}
                      {g.trigger_when ? ` · ${g.trigger_when}` : ''}
                    </p>

                    {g.cadence === 'recurring' ? (
                      <div className="mt-6 flex items-center gap-4">
                        <button
                          onClick={() => set(g.id, { count: Math.max(0, count - 1) })}
                          className="press h-14 w-14 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink"
                          aria-label={t('checkin.fewer')}
                        >
                          −
                        </button>
                        <div className="flex-1 text-center">
                          {/* Green once it is met, so the number itself says so
                              rather than leaving it to be worked out from two
                              digits that happen to match. */}
                          <span
                            className={`font-display text-metric ${count >= target ? 'text-green' : 'text-ink'}`}
                          >
                            {count}
                          </span>
                          <span className="text-h2 text-muted"> / {target}</span>
                        </div>
                        <button
                          onClick={() => set(g.id, { count: Math.min(target, count + 1) })}
                          disabled={count >= target}
                          className="press h-14 w-14 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink disabled:opacity-40"
                          aria-label={t('checkin.more')}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="mt-6 flex gap-2">
                        {[
                          ['done', t('checkin.did_it')],
                          ['missed', t('checkin.not_yet')],
                        ].map(([v, label]) => (
                          <button
                            key={v}
                            onClick={() => set(g.id, { outcome: v, count: v === 'done' ? 1 : 0 })}
                            className={
                              (a.outcome ?? '') === v
                                ? v === 'done'
                                  ? 'chip-green press'
                                  : 'chip-accent press'
                                : 'chip-quiet press'
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/**
                     * The proof, here, on the card it is proof of.
                     *
                     * It used to be a second list of the same goals on a
                     * different pane, which is how somebody could count three
                     * gym sessions and send a check-in with no photograph
                     * without ever seeing a control that would have taken one.
                     *
                     * evidence_def is still the prompt: it is the sentence
                     * somebody wrote to their future self about what would
                     * count, so it becomes the hint above the control rather
                     * than a text box of its own. proof_type decides which
                     * control gets drawn. See lib/proofKinds.js.
                     */}
                    {proofTypeOf(g) !== 'none' && (
                      <div className="mt-6 border-t border-hairline pt-5">
                        <p className="field-label">
                          {g.evidence_def || t(`proof.want_${proofTypeOf(g)}`)}
                        </p>
                        <ProofField
                          type={proofTypeOf(g)}
                          value={a}
                          goalTitle={g.commitment}
                          onChange={(patch) => set(g.id, patch)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/**
         * Proof: a gallery, and nothing you can put anything into.
         *
         * This pane used to be both at once. It listed every goal again with a
         * photo picker beside it, and then showed the group's gallery
         * underneath, so one screen was "attach something" and "look at what
         * everyone did" with no line between them. People read it as the
         * second, which is the one it looks like, and never found the first.
         *
         * The pickers now live on the goal cards where the answers are. What
         * is left here is a feed: everything the group has proved, in every
         * kind, with your own entries editable in place.
         */}
        {pane === 'proof' && (
          <Section
            title={t('proof.title')}
            action={
              <Link
                to={`/g/${activeId}/proofs`}
                className="text-small text-ink underline-offset-4 hover:underline"
              >
                {t('proof.see_all')}
              </Link>
            }
          >
            <ProofGallery groupId={activeId} limit={9} refreshToken={proofTick} />
          </Section>
        )}

        {pane === 'celebrate' && (
          <CelebrateStep
            groupId={activeId}
            members={members}
            value={party}
            onChange={setParty}
            onSent={() => setPartySent((n) => n + 1)}
          />
        )}

        {pane === 'next' && (
          <div className="lg p-5 sm:p-6">
            <p className="text-small text-muted">{t('checkin.one_thing')}</p>
            <Field>
              <input
                className="field mt-3"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder={t('checkin.one_thing_ph')}
                maxLength={280}
              />
            </Field>
          </div>
        )}
      </div>

      <Section>
        {stuck && <p className="mb-4 text-small text-negative">{t('checkin.queued')}</p>}
        <button onClick={submit} disabled={busy} className="btn-primary press">
          {busy ? t('checkin.sending') : t('checkin.submit')}
        </button>
        <button onClick={markAway} disabled={busy} className="btn-ghost press mt-2">
          {t('checkin.away')}
        </button>
        <p className="mt-4 text-center text-small text-muted">{t('checkin.away_note')}</p>
      </Section>
    </Screen>
  )
}
