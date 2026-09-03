import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../lib/i18n'
import { targetFor } from '../lib/schedule'
import { proofTypeOf } from '../lib/proofKinds'
import ProofField from './ProofField'

/**
 * One goal at a time, in a modal, instead of a form embedded in every card.
 *
 * WHY THE CONTROLS LEFT THE CARDS.
 *
 * They were on the cards for one round and the cards could not carry them. A
 * goal card already holds a title, two badges, an owner, a progress row and
 * four management actions; adding a question, a counter and a Save made it a
 * form with a heading, and the two jobs read as one pile. "Modifier" and
 * "Fait" are not the same kind of thing and should not be adjacent.
 *
 * So the card goes back to being a card, and the daily question becomes its
 * own act with its own moment. That is also a better shape for the question:
 * answering six goals is one pass through a small stack, not six decisions
 * scattered down a scrolling page.
 *
 * WHY A CAROUSEL AND NOT A LIST IN A MODAL.
 *
 * A list in a modal is the old screen with a scrim on it. One card at a time
 * is the thing that makes this quick: there is exactly one question on screen,
 * the answer advances it, and the end is visible from the first card because
 * the counter says how many there are.
 *
 * NOTHING IS SAVED HERE.
 *
 * Every answer is handed up as it is made and the page owns both the map and
 * the write. That is not indirection for its own sake: submit_checkin upserts
 * the whole item list for a cycle, so the thing that saves has to know about
 * every goal, and a component that only knows the one on screen would post a
 * single-goal check-in and delete the rest. The page already reads the
 * existing check-in for the same reason.
 */
export default function CheckinCarousel({ goals = [], answers = {}, onChange, onDone, onClose, busy = false }) {
  const { t } = useT()
  const [i, setI] = useState(0)
  const [finished, setFinished] = useState(false)

  /* Escape closes it, like every other dialog in the app. */
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (goals.length === 0) return null

  const goal = goals[Math.min(i, goals.length - 1)]
  const a = answers[goal.id] ?? {}
  const target = targetFor(goal)
  const count = a.count ?? 0
  const proof = proofTypeOf(goal)
  const last = i >= goals.length - 1

  const advance = () => {
    if (!last) return setI((n) => n + 1)
    /**
     * The end, and the one moment this screen is allowed to make a noise.
     *
     * Shown before the save resolves rather than after. The write is queued
     * locally first and retried underneath, so waiting on the network to say
     * "done" would put a spinner between somebody and the end of a thirty
     * second task for no information they can act on. If it genuinely fails
     * the page says so on its own line, which is where a failure belongs.
     */
    setFinished(true)
    onDone?.()
  }

  const answer = (patch) => {
    onChange?.(goal.id, patch)
    /* A tap on Fait or Pas encore IS the answer, so it moves on. The counter
       does not: pressing + three times would skip two goals. */
    if (goal.cadence === 'once') window.setTimeout(advance, 220)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-hook="checkin-carousel">
      <button
        type="button"
        aria-label={t('cal.cancel')}
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('checkin.title')}
        className="lg lg-modal relative m-2 flex max-h-[92dvh] w-[min(32rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        {finished ? (
          /**
           * The micro-celebration, and it is deliberately small.
           *
           * A full confetti canvas already fires from the page when something
           * was actually recorded; a second animation here would be the app
           * congratulating itself twice for one act. This is a line, a mark
           * and a way out.
           */
          <div className="px-6 py-12 text-center" data-hook="checkin-done">
            <p aria-hidden="true" className="text-[3rem] leading-none">🎉</p>
            <p className="mt-4 text-h2 font-semibold text-ink">{t('checkin.carousel_done')}</p>
            <p className="text-safe mt-2 text-small text-muted">{t('checkin.carousel_done_sub')}</p>
            <button type="button" onClick={onClose} className="goal-action-done press mt-6">
              {t('wiz.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              {/* How many there are, from the first card, so the end is
                  visible rather than discovered. */}
              <p className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
                {t('checkin.carousel_step', { n: i + 1, total: goals.length })}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('cal.cancel')}
                data-hook="carousel-close"
                className="press -mr-1 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
              >
                &#215;
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6">
              <p className="text-small text-muted">{t('checkin.carousel_q')}</p>
              <h2 className="text-safe mt-1 text-h2 font-semibold text-ink" data-hook="carousel-title">
                {goal.commitment}
              </h2>

              {goal.cadence === 'recurring' ? (
                <div className="mt-8 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onChange?.(goal.id, { count: Math.max(0, count - 1), touched: true })}
                    className="press h-14 w-14 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink"
                    aria-label={t('checkin.fewer')}
                  >
                    &#8722;
                  </button>
                  <div className="flex-1 text-center">
                    <span className={`font-display text-metric ${count >= target ? 'text-green' : 'text-ink'}`}>
                      {count}
                    </span>
                    <span className="text-h2 text-muted"> / {target}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange?.(goal.id, { count: Math.min(target, count + 1), touched: true })}
                    disabled={count >= target}
                    className="press h-14 w-14 shrink-0 rounded-pill bg-ink/[0.07] text-h2 leading-none text-ink disabled:opacity-40"
                    aria-label={t('checkin.more')}
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="mt-8 flex flex-wrap gap-2">
                  {[
                    ['done', t('checkin.did_it')],
                    ['missed', t('checkin.not_yet')],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={(a.outcome ?? '') === v}
                      data-hook={`carousel-${v}`}
                      onClick={() => answer({ outcome: v, count: v === 'done' ? 1 : 0, touched: true })}
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

              {proof !== 'none' && (
                <div className="mt-6 border-t border-hairline pt-5">
                  <p className="field-label">{goal.evidence_def || t(`proof.want_${proof}`)}</p>
                  <ProofField
                    type={proof}
                    value={a}
                    goalTitle={goal.commitment}
                    onChange={(patch) => onChange?.(goal.id, { ...patch, touched: true })}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-4">
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                disabled={i === 0}
                className="press rounded-pill px-4 py-2 text-small font-semibold text-muted disabled:opacity-30"
              >
                {t('cal.prev')}
              </button>
              <button
                type="button"
                onClick={advance}
                disabled={busy}
                data-hook="carousel-next"
                className="goal-action-done press"
              >
                {last ? t('checkin.carousel_finish') : t('cal.next')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>,
    document.body,
  )
}
