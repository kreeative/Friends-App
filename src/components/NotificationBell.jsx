import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'

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
export default function NotificationBell() {
  const { user } = useAuth()
  const { t } = useT()

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
        className="press relative flex h-9 w-9 items-center justify-center rounded-pill transition-colors hover:bg-ink/[0.06]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M6 9a6 6 0 1112 0c0 3.6.9 5.4 1.8 6.3.4.4.1 1.2-.5 1.2H4.7c-.6 0-.9-.8-.5-1.2C5.1 14.4 6 12.6 6 9z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>

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
          /**
           * Anchored to the bell's right edge, and the width has to account
           * for the fact that the bell is NOT the right edge of the screen:
           * the avatar sits beyond it. Measured at 360px, `100vw - 2rem` gave
           * a 320px panel whose left edge landed at -25px, off the side.
           *
           * 6rem is the avatar, the gap, the header's own padding and a margin
           * on the far side, so the panel stays inside on a 320px phone too.
           */
          className="lg lg-chrome absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-6rem))] overflow-hidden p-2"
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
