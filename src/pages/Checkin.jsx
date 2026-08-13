import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { celebrate } from '../lib/celebrations'
import { useGroup } from '../context/GroupContext'
import { enqueue, flush } from '../lib/queue'
import { cycleEnd, cyclePhase, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { dueOn, outcomeFor, targetFor } from '../lib/schedule'
import { Field, Screen, Section, TopBar } from '../components/ui'
import ProofPicker from '../components/ProofPicker'
import CelebrateStep from '../components/CelebrateStep'
import ProofGallery from '../components/ProofGallery'

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

  /* Kept here rather than inside CelebrateStep so that Submit sends it. The
     step has no button of its own on purpose: a second Send in a form with one
     Submit is two ways to finish and a good chance of doing neither. */
  const [party, setParty] = useState({ receiverId: null, message: '' })

  /* Bumped whenever something happened that the gallery below cannot know
     about. See ProofGallery's refreshToken: without it a check-in filed on
     this very screen left the strip showing the set it loaded on mount, which
     is the whole of "my photo did not appear". */
  const [proofTick, setProofTick] = useState(0)

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
    await flush()

    /**
     * The celebration, after the check-in and never instead of it.
     *
     * Deliberately outside the offline queue. That queue replays a check-in
     * against a cycle, which is a fact about a day and is still true an hour
     * later; a compliment that turns up whenever the network happens to come
     * back is a stranger thing, and a failed one is better dropped than
     * delivered at midnight with no context. It also must never be able to
     * fail the submit: the day's record is the thing that matters here.
     */
    if (party.receiverId && party.message.trim()) {
      await celebrate({
        groupId: activeId,
        senderId: user.id,
        receiverId: party.receiverId,
        message: party.message,
      }).catch(() => {})
    }

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

  return (
    <Screen>
      <TopBar
        title={t('checkin.title')}
        sub={t('board.reveals_in', { t: untilLabel(ends) })}
      />

      {goals.length === 0 ? (
        <Section>
          <p className="card text-body text-muted">{t('checkin.no_goals')}</p>
        </Section>
      ) : (
        <Section title={t('checkin.what_happened')}>
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

                  {/* A line of text describing a photograph is not a
                      photograph, and the thing a group actually wants is to
                      see it. Offered on every goal, not only the ones with a
                      proof sentence configured. */}
                  <ProofPicker
                    url={a.photo_url ?? null}
                    onChange={(photo_url) => set(g.id, { photo_url })}
                  />
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/**
       * The proof, directly under the form that fills it.
       *
       * This was a fifth tab of its own, which put a place in the navigation
       * bar next to four things you do, and split one act across two screens:
       * you attached a photograph here and then went somewhere else to find
       * out whether it had arrived. A photo is proof OF a check-in. It belongs
       * in the same screen as the thing it is evidence for.
       *
       * A screenful rather than the whole archive, with a way through to the
       * full grid, so the check-in stays a form rather than becoming a feed.
       */}
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

      <CelebrateStep members={members} value={party} onChange={setParty} />

      <Section title={t('checkin.one_thing')}>
        <Field>
          <input
            className="field"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t('checkin.one_thing_ph')}
            maxLength={280}
          />
        </Field>
      </Section>

      <Section>
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
