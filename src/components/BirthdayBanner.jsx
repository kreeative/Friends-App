import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { upcomingBirthdays } from '../lib/birthdays'
import { Avatar } from './ui'

/**
 * A week's notice.
 *
 * The feed already says "it is Rue's birthday today", which is the one day it
 * is too late to do anything about. Nobody orders a present, books a table or
 * writes something worth reading on the morning of. A reminder that arrives on
 * the day is a record of an event, not a prompt.
 *
 * So this sits at the top of the screen from a week out and counts down. It is
 * the only thing in the app that asks you to do something for somebody else on
 * a deadline that is not your own, which is why it outranks the nudge banner
 * underneath it: a nudge waits for whoever gets to it, a birthday does not
 * wait at all.
 *
 * Not dismissible, and deliberately so. Everything else here can be put off
 * until tomorrow with no cost; this is the one thing where tomorrow is a
 * different answer. It removes itself the day after, which is the only ending
 * it needs.
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

  const line = (person) => {
    const name = person.display_name ?? ''
    if (person.days === 0) return t('board.birthday_line', { name })
    if (person.days === 1) return t('birthday.tomorrow', { name })
    return t('birthday.in_days', { name, n: person.days })
  }

  return (
    /* The same raised surface the nudge uses. Two banners in the same slot
       should be the same object at different words, not two designs arguing
       about which is the more important kind of announcement. */
    <div className="animate-rise pt-8">
      <div className="rounded-card bg-surface p-6 shadow-raised">
        <ul className="space-y-3.5">
          {soon.map((person) => (
            <li key={person.id} className="flex items-center gap-3.5">
              <Avatar profile={person} size={36} />
              <span className="min-w-0 flex-1 text-body text-ink">{line(person)}</span>
            </li>
          ))}
        </ul>

        {/* Said once for the whole card rather than once per person, and it
            says the same thing the nudge says: the app is the reminder, it is
            not the gesture. */}
        <p className="lede mt-4">{t('birthday.note')}</p>
      </div>
    </div>
  )
}
