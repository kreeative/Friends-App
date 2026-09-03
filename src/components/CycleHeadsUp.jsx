import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { dayKey, daysBetween, phaseOn } from '../lib/cycle'

/**
 * A word about the week ahead, directly under the calendar on the home page.
 *
 * WHAT WAS ASKED FOR: "les notifications des regles devraient s'afficher juste
 * en bas du calendrier dans la page d'accueil, like les instructions comme
 * regles approchent pourquoi ca peut affecter ta productivite".
 *
 * So it is not a reminder that a date is coming. The date is already on the
 * calendar as a dot. It is the sentence after the date: energy usually dips in
 * the days before, so move the hard thing forward, and that is a planning fact
 * rather than a medical one.
 *
 * THIS SITS ON A SCREEN THAT GETS LOOKED AT IN PUBLIC, AND THAT IS WORTH
 * SAYING RATHER THAN LEAVING TO BE NOTICED LATER.
 *
 * Every other surface in this app keeps the words behind a tap: the calendar
 * shows a 6px dot and the sentence only appears in the drawer, because the
 * grid gets opened in a lecture theatre with somebody sitting beside you. A
 * card on the dashboard that says "tes regles approchent" is a deliberate
 * departure from that, and it was asked for in those words.
 *
 * Two things keep it honest rather than one:
 *
 *   It is gated on cycle_remind, the switch in the drawer that already governs
 *   whether this person wants to be told at all. Turning reminders off turns
 *   this off. No new consent was invented for it.
 *
 *   It is dismissible for the day, and the dismissal is per browser rather
 *   than per account, so closing it on a laptop somebody else can see does not
 *   write anything anywhere.
 *
 * IT READS AND NEVER WRITES. No row is created by this component, nothing is
 * sent, nothing is aggregated, and there is no group path out of it. Migration
 * 51 is explicit that a "who is having a rough week" signal is what those
 * tables exist to make impossible; a card that grew a "how are you feeling"
 * input would be the first step towards one. It renders a phase this app
 * already computes twice elsewhere and stops there.
 */

/* Which phases get a card, and in what tone. `fertile` is here for the same
   reason the difficult ones are: a week where things are usually easier is
   worth knowing about when you are deciding when to schedule the hard thing. */
const TONE = {
  period: { emoji: '🌸', ring: 'bg-negative/[0.07]' },
  predicted: { emoji: '🌷', ring: 'bg-accent/[0.08]' },
  pms: { emoji: '🌿', ring: 'bg-accent/[0.07]' },
  fertile: { emoji: '✨', ring: 'bg-green/[0.07]' },
}

const KEY = 'friends.cycle.headsup'

/* Dismissed FOR TODAY, not forever. A card about this week that somebody can
   silence permanently is one they will silence once and then wonder why it
   never came back; a card that returns tomorrow is a card they can close
   without thinking about it. */
const readDismissed = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export default function CycleHeadsUp({ starts = [], prediction = null, remind = true, days = 2 }) {
  const { t } = useT()
  const today = dayKey(new Date())
  const [hidden, setHidden] = useState(() => readDismissed() === today)

  if (!remind || hidden || !prediction || starts.length === 0) return null

  const phase = phaseOn(new Date(), starts, prediction)
  if (!phase || !TONE[phase]) return null

  /**
   * How far ahead to speak up, and why it is the reminder setting rather than
   * a number chosen here.
   *
   * `pms` and `fertile` are windows that predict() already sizes, so those two
   * are shown whenever the day falls inside them. `predicted` is the one that
   * needs a bound: the prediction window widens as the recorded cycles
   * disagree, and at its widest that phase covers nine days, which is a card
   * that never leaves the page. So it is shown from `days` before the expected
   * start, and `days` is the value already set in the drawer.
   */
  const away = daysBetween(new Date(), prediction.nextStart)
  if (phase === 'predicted' && away > Math.max(1, days)) return null

  const tone = TONE[phase]

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(KEY, today)
    } catch {
      /* A private window. The card simply comes back on the next render, which
         is a worse afternoon and not a broken one. */
    }
  }

  return (
    /**
     * Its own card, under the calendar's, not a block inside it.
     *
     * `lg` is the same sheet every other card on this page is made of, so it
     * reads as a thing in the column rather than as the last row of the
     * calendar. The phase tint moves inside as a wash on that sheet: on the
     * card itself it would be a coloured card in a column of white ones, which
     * is a louder claim than a note about the week ahead should make.
     */
    <div className="lg mt-4 overflow-hidden" data-hook="cycle-headsup" data-phase={phase}>
    <div className={`px-5 py-4 ${tone.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-safe min-w-0 flex-1 text-body font-semibold text-ink">
          <span aria-hidden="true" className="mr-1.5">
            {tone.emoji}
          </span>
          {t(`home.cyc_${phase}_title`)}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('wiz.close')}
          data-hook="cycle-headsup-close"
          className="press -mr-1 -mt-1 h-8 w-8 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
        >
          &#215;
        </button>
      </div>

      {/* The sentence that was actually asked for: not that a date is coming,
          but what it tends to do to a week and what to do about it. */}
      <p className="text-safe mt-1 text-small text-muted">{t(`home.cyc_${phase}_body`)}</p>

      <Link
        to="/calendar"
        data-hook="cycle-headsup-link"
        className="press mt-2 inline-block text-small font-semibold text-accent underline decoration-1 underline-offset-2"
      >
        {t('cycle.manage')}
      </Link>
    </div>
    </div>
  )
}
