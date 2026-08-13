import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cycleEnd, cyclePhase, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { dueOn, outcomeFor, targetFor } from '../lib/schedule'
import { Field, Screen, Section, TopBar } from '../components/ui'
import ProofPicker from '../components/ProofPicker'
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

    const items = goals.map((g) => {
      const a = answers[g.id] ?? {}
      const count = a.count ?? 0
      return {
        goal_id: g.id,
        outcome: a.outcome ?? outcomeFor(g, count),
        count_done: count,
        evidence: a.evidence || null,
        photo_url: a.photo_url || null,
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
  const photos = goals.filter((g) => answers[g.id]?.photo_url).length


  const tiles = [
    {
      id: 'goals',
      icon: <TargetIcon />,
      label: t('checkin.tab_goals'),
      badge: goals.length ? `${logged}/${goals.length}` : null,
      done: goals.length > 0 && logged === goals.length,
    },
    {
      id: 'proof',
      icon: <CameraIcon />,
      label: t('checkin.tab_proof'),
      badge: photos > 0 ? String(photos) : null,
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

                    {g.evidence_def && (
                      <input
                        className="field mt-6"
                        placeholder={g.evidence_def}
                        value={a.evidence ?? ''}
                        onChange={(e) => set(g.id, { evidence: e.target.value })}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/**
         * Proof: attaching, and then everything the group has.
         *
         * The picker used to sit at the bottom of every goal card, which is
         * where it belongs logically and is exactly what made the Goals pane
         * twice as tall as it needed to be. Here the same control is a row per
         * goal, no counters, no chips, just the title and the photograph, and
         * the gallery underneath answers the question the old separate tab
         * existed for.
         */}
        {pane === 'proof' && (
          <div className="space-y-6">
            {goals.length > 0 && (
              <div className="lg divide-y divide-hairline px-5">
                {goals.map((g) => {
                  const a = answers[g.id] ?? {}
                  return (
                    <div key={g.id} className="py-4">
                      <p className="text-small font-semibold text-ink">{g.commitment}</p>
                      <ProofPicker
                        url={a.photo_url ?? null}
                        onChange={(photo_url) => set(g.id, { photo_url })}
                      />
                    </div>
                  )
                })}
              </div>
            )}

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
          </div>
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
