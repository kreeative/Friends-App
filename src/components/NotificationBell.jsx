import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { IconBell } from './NavIcons'

/**
 * What arrived while you were not looking.
 *
 * WHY THIS EXISTS AT ALL.
 *
 * Migration 50 writes a row into `notification` for every member of a group
 * when somebody adds a shared goal, inside the same transaction as the goal.
 * Without something that reads them, that is a table filling up with rows
 * nobody will ever see, and the feature would be an email that happens to have
 * a database behind it.
 *
 * WHY A PANEL AND NOT A PAGE.
 *
 * The header used to have a dropdown holding a name, an email and two links,
 * and it was removed for being a table of contents for a screen one tap away.
 * This is the opposite case: the content IS the list, there is nowhere else it
 * lives, and a page would mean leaving whatever you were doing to read two
 * lines and come back.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 * No realtime subscription. A count that is correct when the app loads and
 * after any navigation is worth having; a websocket per person to make a
 * number tick without a refresh is a running cost for something nobody is
 * watching. It refetches when the panel opens, which is the moment the number
 * actually has to be right.
 */
/**
 * Where the panel hangs, which is the only thing that differs between the two
 * places this is mounted.
 *
 * `bar` is the original: a 36px button in the top bar with the panel dropping
 * from its right edge. `rail` is the icon column, where the button is a rail
 * row and the panel has to come out sideways, because below the button is the
 * bottom of the screen and to its left is 16px of gutter.
 *
 * Two placements rather than two components. Everything above this line, the
 * query, the unread count, the mark-read writes and the outside-click close,
 * is the same object in both, and duplicating it to change two class strings
 * is how the two copies start disagreeing about what "read" means.
 */
const PLACEMENT = {
  bar: {
    button: 'press relative flex h-9 w-9 items-center justify-center rounded-pill transition-colors hover:bg-ink/[0.06]',
    /**
     * Anchored to the bell's right edge, and the width has to account for the
     * fact that the bell is NOT the right edge of the screen: the avatar sits
     * beyond it. Measured at 360px, `100vw - 2rem` gave a 320px panel whose
     * left edge landed at -25px, off the side.
     *
     * 6rem is the avatar, the gap, the header's own padding and a margin on
     * the far side, so the panel stays inside on a 320px phone too.
     */
    panel: 'absolute right-0 top-11 w-[min(20rem,calc(100vw-6rem))]',
  },
  rail: {
    /* Sized and shaped by the rail, which passes its own row classes. */
    button: 'press relative flex w-full flex-col items-center gap-1 rounded-inner px-1 py-2 transition-colors hover:bg-ink/[0.06]',
    /* Out of the right-hand side, sitting on the button's own line. `bottom-0`
       rather than `top-0` because this row lives at the foot of the rail, and
       a panel dropping downward from there would open off the bottom of the
       screen. */
    panel: 'absolute bottom-0 left-full z-50 ml-3 w-[20rem] max-w-[calc(100vw-8rem)]',
  },
}

export default function NotificationBell({ placement = 'bar' }) {
  const { user } = useAuth()
  const { t } = useT()
  const place = PLACEMENT[placement] ?? PLACEMENT.bar

  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const panel = useRef(null)
  const button = useRef(null)

  const load = useCallback(async () => {
    if (!user) return
    /* Unread only, and capped. This is a glance, not an archive: somebody
       returning after a month does not want two hundred rows, and the ones
       that matter are the recent ones. RLS restricts this to the caller's own
       rows regardless of what is asked for. */
    const { data } = await supabase
      .from('notification')
      .select('id, kind, href, created_at, goals(commitment), profiles!notification_actor_id_fkey(display_name)')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setRows(data ?? [])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  /* Escape and a click outside, because a panel that can only be dismissed by
     the control that opened it is a trap on a phone, where the control is
     under your thumb and the rest of the screen is what you are trying to
     get back to. */
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onDown = (e) => {
      if (!panel.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const count = rows.length
  if (!user) return null

  /**
   * Marking read is an update, not a delete, and it is optimistic.
   *
   * The row stays so the email sender can still see it was delivered and so a
   * notification cannot be made never to have existed. The list empties first
   * because the answer is already known: nothing about the outcome changes
   * what should be on screen, and waiting on a round trip to acknowledge a tap
   * is what makes an app feel slow on a phone with two bars.
   */
  const markAll = async () => {
    const ids = rows.map((r) => r.id)
    if (!ids.length) return
    setRows([])
    const { error } = await supabase
      .from('notification')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
    /* Put them back if the write was refused. RLS refuses an update silently
       with zero rows rather than an error, so an empty list here would be
       indistinguishable from success; reloading is what tells the truth. */
    if (error) await load()
  }

  const markOne = async (id) => {
    setRows((r) => r.filter((x) => x.id !== id))
    await supabase.from('notification').update({ read_at: new Date().toISOString() }).eq('id', id)
  }

  const line = (r) => {
    const who = r.profiles?.display_name?.trim()
    /* Named only when the name is a fact. A shared goal created before
       migration 50 has no author recorded, and the anonymous phrasing is the
       true one rather than a guess. */
    return who ? t('notif.goal_by', { who }) : t('notif.goal_anon')
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={button}
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) load()
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? t('notif.open', { n: count }) : t('notif.open_none')}
        data-hook="notif-bell"
        data-count={count}
        className={place.button}
      >
        {/* Drawn in NavIcons now, so the rail and this trigger cannot drift
            into being two slightly different bells. */}
        <IconBell className="h-5 w-5" />
        {placement === 'rail' && (
          <span className="w-full truncate text-center text-[0.6875rem] font-semibold leading-tight">
            {t('nav.notifications')}
          </span>
        )}

        {/**
         * The count, and it carries a number rather than being a bare dot.
         * A dot says something happened; a number says how much, which is the
         * difference between opening the panel and deciding not to bother.
         * Colour is not the only signal, per 1.4.1: the digit is the signal
         * and the tint is decoration.
         */}
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1 text-[11px] font-bold leading-none text-on-accent">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label={t('notif.title')}
          data-hook="notif-panel"
          className={`lg lg-chrome z-50 overflow-hidden p-2 ${place.panel}`}
        >
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="truncate text-label font-semibold uppercase tracking-[0.06em] text-muted">
              {t('notif.title')}
            </span>
            {/* nowrap and shrink-0, and the label is short for the same
                reason: at 264px the long version wrapped onto three lines and
                became the biggest thing in the panel. The title truncates
                instead, since it is the part that can be guessed from the
                bell that opened this. */}
            {count > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="press shrink-0 whitespace-nowrap rounded-pill px-2 py-1 text-small font-semibold text-muted hover:bg-ink/[0.06]"
              >
                {t('notif.mark_all')}
              </button>
            )}
          </div>

          {count === 0 ? (
            <p className="px-2 py-4 text-small text-muted">{t('notif.none')}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    to={r.href ?? '/'}
                    onClick={() => {
                      markOne(r.id)
                      setOpen(false)
                    }}
                    className="press block rounded-inner px-2 py-2.5 transition-colors hover:bg-ink/[0.04]"
                  >
                    <span className="text-safe block text-small font-semibold text-ink">
                      {line(r)}
                    </span>
                    {/* The goal itself, clamped. It is somebody's typed text
                        and the same rule applies here as on the card. */}
                    {/* No `block` here, deliberately. line-clamp-2 sets
                        display:-webkit-box and `block` sets display:block, and
                        whichever Tailwind emits last wins: with both, the
                        clamp silently did nothing and a URL ran to three
                        lines. The clamp already establishes the display. */}
                    {r.goals?.commitment && (
                      <span className="text-safe mt-0.5 line-clamp-2 text-small text-muted">
                        {r.goals.commitment}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
