import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { upcomingBirthdays } from '../lib/birthdays'
import { Avatar } from './ui'

/**
 * A week's notice, as a rail of cards.
 *
 * WHY A WEEK AHEAD.
 *
 * The feed already says "it is Rue's birthday today", which is the one day it
 * is too late to do anything about. Nobody orders a present, books a table or
 * writes something worth reading on the morning of. A reminder that arrives on
 * the day is a record of an event, not a prompt.
 *
 * So this sits at the top of the screen from a week out and counts down. It is
 * the only thing in the app that asks you to do something for somebody else on
 * a deadline that is not your own, which is why it outranks the nudge rail
 * underneath it: a nudge waits for whoever gets to it, a birthday does not wait
 * at all.
 *
 * WHY IT IS A RAIL NOW AND NOT ONE PANEL.
 *
 * It used to be a single card with a list of names inside it, which made it a
 * different object from the nudge rail directly below doing the same job:
 * here is a person, here is something you could do about them. Two designs
 * arguing about which is the more important kind of announcement.
 *
 * Now they are the same object with different words. Same rail, same card, same
 * three lines: the gesture as the heading, when it is underneath in grey, and
 * the note about where the message actually belongs. The scroll-snap is the
 * browser's, exactly as in NudgeBanner and the welcome deck, so the physics
 * match every other scroller on the device for nothing.
 *
 * WHAT IT DELIBERATELY DOES NOT HAVE.
 *
 * No cross and no button. The nudge rail has both because a nudge is a job
 * somebody has to pick up and because one person may know a reason not to
 * write. A birthday is neither: nothing to claim, nobody to assign, and no
 * private reason to hide a date that everybody can see anyway. It removes
 * itself the day after, which is the only ending it needs.
 *
 * It never announces your own birthday. See upcomingBirthdays.
 */
export default function BirthdayBanner({ people, within = 7 }) {
  const { user } = useAuth()
  const { t } = useT()

  const soon = useMemo(
    () => upcomingBirthdays(people, { within, exclude: user?.id }),
    [people, within, user?.id],
  )

  if (soon.length === 0) return null

  const when = (person) => {
    if (person.days === 0) return t('birthday.when_today')
    if (person.days === 1) return t('birthday.when_tomorrow')
    return t('birthday.when_in', { n: person.days })
  }

  return (
    <div className="pt-8" data-hook="birthdays">
      <div
        /* Bleeds to both screen edges: the shell pads by 6, so the negative
           margin lets the rail run to the glass and the padding puts the first
           and last card back on the text column. Identical to the nudge rail,
           because two rails on one screen that stop at different places read
           as a mistake. */
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-6 pb-2
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {soon.map((person) => {
          const name = person.display_name ?? ''
          const today = person.days === 0

          return (
            <div
              key={person.id}
              data-birthday={person.id}
              /* 85% of the viewport, so a sliver of the next card is the only
                 thing that says there IS a next card. Capped so it does not
                 become one absurd card on a tablet. */
              className="animate-rise relative w-[85%] max-w-sm shrink-0 snap-start rounded-card bg-surface p-6 shadow-raised"
            >
              {/* The face, which the nudge card does not have and this one
                  earns: a birthday card is about one specific person, and in a
                  rail the avatar is what tells two cards apart before either
                  heading is read. */}
              <Avatar profile={person} size={40} />

              {/* The gesture, not the date. Same rule as the nudge rail: a
                  heading that states a fact leaves the reader to work out what
                  it wants from them, and six of those in a row is a list of
                  facts rather than a list of ideas.

                  "a {name}" and "pour {name}" both survive any first name.
                  "de {name}" would not: de elides before a vowel, so it would
                  need a rule per name. */}
              <h3 className="mt-3 text-h2 text-ink">
                {today ? t('birthday.wish', { name }) : t('birthday.plan', { name })}
              </h3>
              <p className="mt-1.5 text-label text-muted" data-hook="birthday-when">
                {when(person)}
              </p>

              {/* On the day there is only a message left, so say that. Before
                  the day there is still time to do something, so say that
                  instead: the same sentence for both would waste the notice
                  this whole component exists to give. */}
              <p className="lede mt-3">
                {today ? t('birthday.note') : t('birthday.note_early')}
              </p>
            </div>
          )
        })}
      </div>

      {/* How many there are. Only past one: a counter under a single card is
          chrome describing nothing. */}
      {soon.length > 1 && (
        <p className="mt-1 px-1 text-label text-muted" data-hook="birthday-count">
          {t('birthday.count', { n: soon.length })}
        </p>
      )}
    </div>
  )
}
