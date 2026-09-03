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
/**
 * @param proof  whether to ask for evidence. False on a goal you keep on your
 *   own, and that is a storage fact rather than a taste one: proof rides on a
 *   checkin_item, checkin_items hang off a cycle, and cycles.group_id is not
 *   null. A solo goal is written to goal_days, which has a count and a date and
 *   nowhere to put a photograph. Showing the picker anyway would take a file
 *   somebody chose and drop it.
 */
export default function CheckinCarousel({ goals = [], answers = {}, onChange, onDone, onClose, busy = false, proof: wantProof = true }) {
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
            {/**
             * THE SLIDE IS SHAPED LIKE A NUDGE CARD.
             *
             * "un peu comme les notifications dans le groupe qui signalent
             * quand quelqu'un n'est pas connecte": heading, a grey line of
             * context under it, the thing itself, and one full-width action at
             * the bottom. See NudgeBanner, which is the card being pointed at.
             *
             * What that replaces is a dialog chrome: a bordered header with a
             * step count on the left and a cross on the right, and a bordered
             * footer with Precedent and Suivant in it. Three rules across a
             * card this small made it read as a wizard, and "Suivant" made the
             * action look like paging rather than answering.
             */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
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
                className="press -mr-2 -mt-2 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
              >
                &#215;
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-2 pt-3">
              <h2 className="text-safe pr-2 text-h2 font-semibold leading-tight text-ink" data-hook="carousel-title">
                {goal.commitment}
              </h2>
              {/* The question moves UNDER the goal, in grey, where the nudge
                  card puts "pas de nouvelles depuis deux semaines". The goal
                  is what somebody is looking for; "as-tu realise" above it in
                  the same size buried the one word that identifies the slide. */}
              <p className="mt-1.5 text-small text-muted">{t('checkin.carousel_q')}</p>

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

              {wantProof && proof !== 'none' && (
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

            {/**
             * VALIDATE, FULL WIDTH, AT THE BOTTOM. Like the nudge card's
             * "Je m'en occupe".
             *
             * It said "Suivant" before, sitting in a bordered footer next to
             * "Precedent", and that is a description of paging rather than of
             * answering: the button that RECORDS the answer looked like the
             * button that skips it. "Valider" says what pressing it does, and
             * the last one says the run is finished.
             *
             * Back is underneath and quiet, and it only exists once there is
             * somewhere to go back to. A disabled control on the first card of
             * two is a permanently grey button teaching people it does
             * nothing.
             */}
            <div className="px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={advance}
                disabled={busy}
                data-hook="carousel-next"
                className="btn-primary press w-full"
              >
                {last ? t('checkin.carousel_finish') : t('checkin.validate')}
              </button>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI((n) => Math.max(0, n - 1))}
                  data-hook="carousel-prev"
                  className="press mt-2 w-full py-2 text-center text-small font-semibold text-muted transition-colors hover:text-ink"
                >
                  {t('cal.prev')}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>,
    document.body,
  )
}
