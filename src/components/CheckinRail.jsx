import { useT } from '../lib/i18n'
import { targetFor } from '../lib/schedule'
import { streakOf } from '../lib/streak'
import { useLongPress } from '../lib/useLongPress'

/**
 * The daily question, as a row of cards you slide through.
 *
 * ASKED FOR IN THESE WORDS: "a sliding chain of goals, like the UI in the
 * groups when people are missing. You could slide them." So it is
 * NudgeBanner's shape pointed at your own goals: horizontal scroll-snap, one
 * card mostly filling the width and a sliver of the next one showing so it is
 * visibly a row rather than a single card.
 *
 * PINK IS "NOT YET", GREY IS "DONE", AND THAT IS THE SECOND TIME ROUND.
 *
 * It shipped the other way, and the other way was wrong: the loud colour was
 * being spent on the goals that need nothing from you, while the ones still
 * waiting sat quiet. Inverted, the pink cards ARE the remaining work, and
 * finishing one visibly takes it out of the queue.
 *
 * WHICH MOVED A CONTRAST PROBLEM FROM THE EXCEPTION TO THE DEFAULT.
 *
 * White on the accent is 3.80:1, documented in index.css as a decision rather
 * than an oversight. That is fine for large text, which needs 3:1, and fails
 * normal text, which needs 4.5. It mattered little while pink was the answered
 * state and matters a lot now that it is every unanswered card.
 *
 * So the pink card carries exactly one piece of white-on-pink text, the title,
 * at 22px bold, which IS large text. Everything smaller sits in a white pill
 * with ink on it, at 16-plus to one. Nothing on this card is white-on-pink at
 * a size that would need 4.5.
 */
/**
 * APPUYER LONGUEMENT SUR UNE CARTE L'OUVRE EN ENTIER.
 *
 *   "Appuyer longuement sur le goal pour detailler et pouvoir ajouter la
 *    preuve."
 *
 * La carte du rail est un titre et un bouton, et c'est ce qu'elle doit rester:
 * elle existe pour repondre a la question du jour en une touche. Mais il n'y
 * avait aucun chemin de la carte vers le reste, et "Ajouter une preuve" sous
 * le rail ouvrait le carrousel au PREMIER objectif plutot qu'a celui qu'on
 * regardait.
 *
 * Meme geste et meme composant que les dates du calendrier: une touche
 * repond, un appui long ouvre. La note de DayCell dit pourquoi ca marche, et
 * ca vaut mot pour mot ici: ce sont deux profondeurs d'une meme intention, et
 * la touche reste intacte pour qui ne decouvre jamais l'appui long.
 *
 * L'ELEMENT EST TRANSMIS, PAS JETE. C'est le rectangle dont le panneau sort:
 * `() => onOpen?.(goal)` le perdrait, et la fiche apparaitrait de nulle part,
 * ce qui ressemble exactement a une transition qu'on aurait oublie d'appliquer.
 */
export default function CheckinRail({ goals = [], answers = {}, dayIndex = [], onAnswer, onOpen, busy = false }) {
  if (goals.length === 0) return null

  return (
    <div
      className="bleed-row flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-hook="checkin-rail"
    >
      {goals.map((goal) => (
        <RailCard
          key={goal.id}
          goal={goal}
          answer={answers[goal.id]}
          dayIndex={dayIndex}
          onAnswer={onAnswer}
          onOpen={onOpen}
          busy={busy}
        />
      ))}
    </div>
  )
}

function RailCard({ goal, answer, dayIndex = [], onAnswer, onOpen, busy = false }) {
  const { t } = useT()
  /* Le hook est ici et pas dans la boucle du parent: un hook appele dans un
     .map est un hook dont le nombre d'appels change avec les donnees. */
  const { holding, handlers, consumedClick } = useLongPress((el) => onOpen?.(goal, el), {
    enabled: Boolean(onOpen),
    /* Le geste est sur la CARTE, le clic appartient au bouton dedans. Avec la
       capture, le navigateur emet le clic sur l'ancetre commun du bas et du
       haut du pointeur, donc sur la carte, et une touche courte ne cochait
       plus la journee. Voir la note de useLongPress. */
    capture: false,
  })

  const a = answer ?? {}
  const target = targetFor(goal)
  const count = a.count ?? 0
  const counted = goal.cadence === 'recurring' && target > 1
  /* Done means recorded to target, not touched. A counter at 2 of 3 is a
     started day, not a finished one, and greying it would be the card
     contradicting the number printed on it. */
  const done = counted ? count >= target : a.outcome === 'done'

  /**
   * How many days in a row, when there is a run to report.
   *
   * Only ever non-zero for a goal with no group: streakOf walks
   * goal_days, and a group goal is answered into checkin_items instead,
   * so it has no rows there. Showing nothing is the honest outcome, not
   * a bug to paper over with a zero. A group streak would have to come
   * out of completion.js over cycles, which is a different number and a
   * different piece of work.
   */
  const streak = streakOf(goal, dayIndex, new Date())

  /* One pill spec, two grounds. On pink it has to be opaque white with
     ink on it; a translucent white would composite to something near the
     3.80 the title is already spending. */
  const pill = done
    ? 'bg-ink/[0.06] text-muted'
    : 'bg-on-accent text-ink'

  return (
    <div
      {...handlers}
      data-hook="rail-card"
      data-done={done ? '' : undefined}
      data-holding={holding ? '' : undefined}
      /* 78%, so the next card is visibly there. Capped, or it becomes
         one absurd card on a tablet. */
      /**
       * Le rail defile a l'horizontale, donc `touch-action: pan-x` plutot que
       * `manipulation`: un doigt qui part sur le cote doit encore faire
       * glisser le rail, et useLongPress annule deja l'appui des qu'il bouge
       * de plus de dix pixels. Sans ca, capturer le pointeur mangerait le
       * defilement de la seule liste de cette page qui en a un.
       *
       * `select-none` et le callout iOS coupes pour la meme raison que sur une
       * date du calendrier: un appui long sur du texte fait autrement sortir
       * la loupe et le menu du systeme par-dessus le notre.
       */
      className={`relative flex w-[78%] max-w-xs shrink-0 touch-pan-x select-none snap-start flex-col justify-between overflow-hidden rounded-card p-5 transition-transform duration-200 ease-settle [-webkit-touch-callout:none] ${
        done ? 'bg-ink/[0.05]' : 'bg-accent shadow-raised'
      } ${holding ? 'scale-[0.97]' : ''}`}
    >
      {/* Ce qui dit que l'appui a commence. Voir .hold-bar dans index.css: il
          se remplit sur exactement la duree de l'appui, donc ce qu'on voit est
          l'attente reelle et pas une pulsation generique. Sans evenements de
          pointeur, ou il volerait les pointermove que l'appui surveille pour
          savoir si le doigt derive. */}
      {holding && (
        <span
          aria-hidden="true"
          data-hook="rail-holding"
          className={`hold-bar pointer-events-none absolute inset-x-0 bottom-0 h-1 ${
            done ? 'bg-ink/40' : 'bg-on-accent'
          }`}
        />
      )}
      <div>
        {/* 22px bold: large text, so 3.80:1 clears the 3:1 it needs.
            This is the only white-on-pink type on the card. */}
        <p
          className={`text-safe line-clamp-2 text-h2 font-bold leading-tight ${
            done ? 'text-muted' : 'text-on-accent'
          }`}
        >
          {goal.commitment}
        </p>

        {/* What the day looks like so far. Both facts are pills rather
            than running text, for the contrast reason above and because
            they are scanned rather than read. */}
        {(streak > 0 || (counted && count > 0)) && (
          <div className="mt-3 flex flex-wrap gap-1.5" data-hook="rail-facts">
            {counted && count > 0 && (
              <span className={`rounded-pill px-2.5 py-1 text-label font-semibold ${pill}`}>
                {t('goal.today_count', { done: count, total: target })}
              </span>
            )}
            {streak > 0 && (
              <span className={`rounded-pill px-2.5 py-1 text-label font-semibold ${pill}`} data-hook="rail-streak">
                {t(streak === 1 ? 'goal.streak_one' : 'goal.streak_other', { n: streak })}
              </span>
            )}
          </div>
        )}
      </div>

      {counted ? (
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (consumedClick()) return
              onAnswer?.(goal, { count: Math.max(0, count - 1), touched: true })
            }}
            disabled={busy || count === 0}
            aria-label={t('checkin.fewer')}
            className={`press flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-h2 leading-none disabled:opacity-40 ${
              done ? 'bg-ink/[0.07] text-ink' : 'bg-on-accent text-ink'
            }`}
          >
            &#8722;
          </button>
          {/**
           * Both halves at full opacity, and both 22px bold.
           *
           * The denominator was text-on-accent/70, to sit back from the
           * number that changes. Measured on the painted pixels it came
           * out at 2.28:1, under the 3:1 that even large text needs,
           * because 70% white over the accent composites to a pink-grey.
           * Two siblings rather than a nested span, so an audit that
           * skips elements containing elements still sees them both.
           */}
          <span className="flex flex-1 items-baseline justify-center gap-0.5 [font-variant-numeric:tabular-nums]">
            <span className={`text-h2 font-bold leading-none ${done ? 'text-ink' : 'text-on-accent'}`}>
              {count}
            </span>
            <span className={`text-h2 font-bold leading-none ${done ? 'text-muted' : 'text-on-accent'}`}>
              {` / ${target}`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (consumedClick()) return
              onAnswer?.(goal, { count: Math.min(target, count + 1), touched: true })
            }}
            disabled={busy || count >= target}
            aria-label={t('checkin.more')}
            className={`press flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-h2 leading-none disabled:opacity-40 ${
              done ? 'bg-ink/[0.07] text-ink' : 'bg-on-accent text-ink'
            }`}
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          /* LE CLIC QUI SUIT UN APPUI LONG EST JETE, ET C'EST TOUT LE PIEGE
             DE CE GESTE. Les gestionnaires sont sur la CARTE, donc un appui
             long commence sur ce bouton-ci ouvre la fiche, puis le relachement
             declenche quand meme son clic: la fiche s'ouvrirait ET la journee
             serait cochee. Meme parade que sur une date du calendrier. */
          onClick={() => {
            if (consumedClick()) return
            onAnswer?.(goal, done
              ? { outcome: undefined, count: 0, touched: true }
              : { outcome: 'done', count: target, touched: true })
          }}
          disabled={busy}
          aria-pressed={done}
          data-hook="rail-done"
          /* The word changes with the colour. 1.4.1: colour must never be
             the only thing carrying the state, and a card that only
             differs by hue is unreadable to a good number of people. */
          className={`press mt-5 w-full rounded-pill py-2.5 text-small font-semibold transition-colors duration-200 ease-settle ${
            done ? 'bg-ink/[0.07] text-ink hover:bg-ink/[0.12]' : 'bg-on-accent text-ink'
          }`}
        >
          {done ? t('goal.done_today') : t('goal.mark_today')}
        </button>
      )}
    </div>
  )
}
