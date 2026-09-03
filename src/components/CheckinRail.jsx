import { useT } from '../lib/i18n'
import { targetFor } from '../lib/schedule'

/**
 * The daily question, as a row of cards you slide through.
 *
 * ASKED FOR IN THESE WORDS: "underneath, did you do your goal today, there will
 * be like a sliding chain of goals, like the UI in the groups when people are
 * missing. You could slide them, and they will be gray. And when you click
 * done today, there will be bright pink."
 *
 * So it is NudgeBanner's shape, pointed at your own goals: a horizontal rail
 * with scroll-snap, one card mostly filling the width and a sliver of the next
 * one showing so it is visibly a row rather than a single card.
 *
 * WHY THIS REPLACED A MODAL.
 *
 * The check-in was a banner with a button that opened a carousel over the page.
 * That is one more tap before the first answer and a layer between somebody and
 * a list they were already looking at. The whole point of this section is
 * speed: "the section on the top where you can do your checking very quickly".
 * A rail answers in one tap from the page it lives on.
 *
 * COLOUR IS THE ANSWER, AND IT IS NOT THE ONLY SIGNAL.
 *
 * Grey means unanswered, accent means done, which is the difference asked for.
 * Colour alone would fail 1.4.1, so the button also changes its word and
 * carries aria-pressed: a screen reader and a monochrome screen both get the
 * state without seeing the pink.
 *
 * NOTHING IS SAVED HERE. Every answer is handed up and the page owns the
 * write, for the reason recorded on the page: a group check-in upserts the
 * whole item list, so the thing that saves has to know about every goal.
 */
export default function CheckinRail({ goals = [], answers = {}, onChange, onAnswer, busy = false }) {
  const { t } = useT()
  if (goals.length === 0) return null

  return (
    <div>
      {/* bleed-row lets the rail run to the edge of the screen while the page
          keeps its gutter, so the last card does not look clipped by a margin.
          Same class the nudge rail uses. */}
      <div
        className="bleed-row flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-hook="checkin-rail"
      >
        {goals.map((goal) => {
          const a = answers[goal.id] ?? {}
          const target = targetFor(goal)
          const count = a.count ?? 0
          const recurring = goal.cadence === 'recurring' && target > 1
          /* Done means recorded to target, not touched. A counter at 2 of 3 is
             a started day, not a finished one, and colouring it as finished
             would be the card lying about the number printed on it. */
          const done = recurring ? count >= target : a.outcome === 'done'

          return (
            <div
              key={goal.id}
              data-hook="rail-card"
              data-done={done ? '' : undefined}
              /* 78%, so the next card is visibly there. Capped, or it becomes
                 one absurd card on a tablet. */
              className={`flex w-[78%] max-w-xs shrink-0 snap-start flex-col justify-between rounded-card p-5 transition-colors duration-200 ease-settle ${
                done ? 'bg-accent shadow-raised' : 'bg-ink/[0.05]'
              }`}
            >
              <p
                className={`text-safe line-clamp-3 text-body font-semibold leading-tight ${
                  done ? 'text-on-accent' : 'text-ink'
                }`}
              >
                {goal.commitment}
              </p>

              {recurring ? (
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAnswer?.(goal, { count: Math.max(0, count - 1), touched: true })}
                    disabled={busy || count === 0}
                    aria-label={t('checkin.fewer')}
                    className={`press flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-h2 leading-none disabled:opacity-40 ${
                      done ? 'bg-on-accent/25 text-on-accent' : 'bg-ink/[0.07] text-ink'
                    }`}
                  >
                    &#8722;
                  </button>
                  <span
                    className={`flex-1 text-center text-body font-semibold [font-variant-numeric:tabular-nums] ${
                      done ? 'text-on-accent' : 'text-ink'
                    }`}
                  >
                    {t('goal.today_count', { done: count, total: target })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAnswer?.(goal, { count: Math.min(target, count + 1), touched: true })}
                    disabled={busy || count >= target}
                    aria-label={t('checkin.more')}
                    className={`press flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-h2 leading-none disabled:opacity-40 ${
                      done ? 'bg-on-accent/25 text-on-accent' : 'bg-ink/[0.07] text-ink'
                    }`}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onAnswer?.(goal, done
                      ? { outcome: undefined, count: 0, touched: true }
                      : { outcome: 'done', count: target, touched: true })
                  }
                  disabled={busy}
                  aria-pressed={done}
                  data-hook="rail-done"
                  /* The word changes with the colour. 1.4.1: colour must never
                     be the only thing carrying the state. */
                  className={`press mt-5 w-full rounded-pill py-2.5 text-small font-semibold transition-colors duration-200 ease-settle ${
                    done ? 'bg-on-accent text-accent' : 'bg-ink/[0.08] text-ink hover:bg-ink/[0.14]'
                  }`}
                >
                  {done ? t('goal.done_today') : t('goal.mark_today')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
