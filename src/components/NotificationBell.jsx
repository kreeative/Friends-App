import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { listNotifications } from '../lib/notifications'
import { IconBell } from './NavIcons'

/**
 * The bell, and the number on it. Nothing else.
 *
 * IT USED TO OPEN A PANEL, AND THAT WAS THE PROBLEM.
 *
 * The old note here argued a popover beat a page: the content IS the list, and
 * a page means leaving what you were doing to read two lines. Reasonable, and
 * wrong once the bell moved into the icon rail at the bottom-left of the
 * screen. A panel anchored there opens sideways across the page, so on a
 * tablet it landed half-transparent on top of a book card with "NOTIFICATIONS
 * / Nothing new." floating over somebody's reading. Reported in exactly those
 * terms: those kinds of overlay pop-ups.
 *
 * So the list is a page at /notifications and this is a link to it.
 *
 * WHAT THAT DELETED.
 *
 * The outside-click listener, the Escape handler, the panel ref, the button
 * ref, the open state, and the two PLACEMENT class sets that existed only
 * because a panel hanging off a top-bar button and a panel hanging off a rail
 * row need different anchors. Every one of those was scaffolding for the
 * popover rather than for the feature.
 *
 * The `placement` prop stays, because the BUTTON still differs between the two
 * mounts: 36px in the top bar, a full-width rail row in the column.
 *
 * WHY THE COUNT REFETCHES ON NAVIGATION.
 *
 * There is no realtime subscription, on purpose: a websocket per person to
 * make a number tick without a refresh is a running cost for something nobody
 * is watching. Reloading on every route change gets it right at every moment
 * somebody could act on it, including the moment they come back from having
 * cleared the list, which is when a stale badge would be most obviously wrong.
 */
const BUTTON = {
  bar: 'press relative flex h-9 w-9 items-center justify-center rounded-pill transition-colors hover:bg-ink/[0.06]',
  /* The rail's own row shape. h-11 rather than padding, because with the label
     gone there is nothing else to give the row height and an icon in a
     shrink-to-fit box is a 20px tap target. */
  rail: 'press relative flex h-11 w-full items-center justify-center rounded-inner transition-colors hover:bg-ink/[0.06]',
}

export default function NotificationBell({ placement = 'bar' }) {
  const { user } = useAuth()
  const { t } = useT()
  const { pathname } = useLocation()

  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    if (!user) return
    setCount((await listNotifications()).length)
  }, [user])

  useEffect(() => {
    load()
  }, [load, pathname])

  if (!user) return null

  return (
    <Link
      to="/notifications"
      aria-label={count ? t('notif.open', { n: count }) : t('notif.open_none')}
      title={count ? t('notif.open', { n: count }) : t('notif.open_none')}
      data-hook="notif-bell"
      data-count={count}
      className={BUTTON[placement] ?? BUTTON.bar}
    >
      {/* Drawn in NavIcons, so the rail and this trigger cannot drift into
          being two slightly different bells. */}
      <IconBell className="h-5 w-5" />

      {/**
       * The count, and it carries a number rather than being a bare dot. A dot
       * says something happened; a number says how much, which is the
       * difference between opening the list and deciding not to bother.
       * Colour is not the only signal, per 1.4.1: the digit is the signal and
       * the tint is decoration.
       */}
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1 text-[11px] font-bold leading-none text-on-accent">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
