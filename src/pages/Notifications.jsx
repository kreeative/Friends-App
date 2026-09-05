import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { listNotifications, markRead, replyToNudge } from '../lib/notifications'
import { Empty, Screen, Section, TopBar } from '../components/ui'

/**
 * What arrived while you were not looking, on a page of its own.
 *
 * WHY THIS IS NO LONGER A POPOVER.
 *
 * It was a panel hanging off the bell, and the note that used to sit here
 * argued for that: the content IS the list, and a page would mean leaving what
 * you were doing to read two lines. That argument was wrong in practice for a
 * reason the note did not consider.
 *
 * The bell moved into the icon rail, which sits at the bottom-left of the
 * screen. A panel anchored there opens sideways across whatever is on the
 * page, so on a tablet it landed on top of a book card, half transparent, with
 * "NOTIFICATIONS / Nothing new." floating over somebody's reading. It was not
 * a list you could dismiss by looking away; it was a thing covering the
 * content. Reported, in those words: those kinds of overlay pop-ups.
 *
 * A page also removes four mechanisms that only existed to hold the panel up:
 * the outside-click listener, the Escape handler, the two placement class sets
 * for the bar and the rail, and the refs wiring them together. The bell is now
 * a link with a number on it.
 *
 * MARKING READ STILL HAPPENS ON TAP, NOT ON ARRIVAL.
 *
 * Opening the page does not clear anything. Somebody who glances and leaves
 * has not dealt with these, and a page that empties itself on sight loses the
 * only record they had of what was waiting.
 */
export default function Notifications() {
  const { user } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  /* The reply in flight, and the ones that landed this session. */
  const [replying, setReplying] = useState(null)
  const [replied, setReplied] = useState(() => new Set())

  /**
   * Tell whoever asked that you are fine.
   *
   * The row stays on screen with a confirmation under it rather than
   * disappearing. A thing that vanishes the instant you tap it leaves nobody
   * sure whether it went, and this is the one message where that matters.
   *
   * Only an explicit true counts as sent. The server answers { replied: true }
   * and nothing weaker is a delivery: the same rule the nudge button had to
   * learn twice.
   */
  async function answer(r) {
    setReplying(r.id)
    const res = await replyToNudge(r.id)
    if (res?.ok === true && res?.replied === true) {
      setReplied((s2) => new Set(s2).add(r.id))
    }
    setReplying(null)
  }


  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setRows(await listNotifications())
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Optimistic, then corrected.
   *
   * The list empties first because the answer is already known and waiting on
   * a round trip to acknowledge a tap is what makes an app feel slow on a
   * phone with two bars. It reloads if the write did not land, and the COUNT
   * is what says so: RLS refuses an update silently with zero rows and no
   * error, so "no error" is not proof anything changed.
   */
  const clearAll = async () => {
    const ids = rows.map((r) => r.id)
    if (!ids.length) return
    setRows([])
    const res = await markRead(ids)
    if (!res.ok || res.changed === 0) await load()
  }

  const openOne = async (r) => {
    setRows((cur) => cur.filter((x) => x.id !== r.id))
    await markRead([r.id])
    navigate(r.href ?? '/')
  }

  /**
   * One line per kind, and the kind decides.
   *
   * This used to call every row a shared goal, which was true while there was
   * only one kind. Migration 54 adds book shares, and rendering one of those
   * as "added a shared goal" would be worse than not showing it.
   */
  const line = (r) => {
    const who = r.profiles?.display_name?.trim()
    if (r.kind === 'book') {
      return who ? t('notif.book_by', { who }) : t('notif.book_anon')
    }
    /**
     * Somebody reached out because you had gone quiet.
     *
     * This was missing, and the fall-through below is what it hit: a nudge
     * rendered as "added a shared goal", which is not just wrong but wrong in
     * a way that hides the one message most worth reading. Migration 54 widened
     * the kind constraint so the edge function could write these, and nothing
     * here had been taught to draw them.
     */
    if (r.kind === 'nudge') {
      return who ? t('notif.nudge_by', { who }) : t('notif.nudge_anon')
    }
    /* The answer coming back, to whoever asked. */
    if (r.kind === 'nudge_reply') {
      return who ? t('notif.reply_by', { who }) : t('notif.reply_anon')
    }
    /* Named only when the name is a fact. A shared goal created before
       migration 50 has no author recorded, and the anonymous phrasing is the
       true one rather than a guess. */
    return who ? t('notif.goal_by', { who }) : t('notif.goal_anon')
  }

  /* The thing itself, under the line about it. A book row carries a title, a
     goal row carries the commitment; neither is guaranteed, since the join
     returns null for a subject that has since been deleted. */
  const subject = (r) => {
    if (r.kind === 'book') return r.books?.title
    /* A nudge points at no row of its own. The second line is the invitation
       rather than a subject, because "somebody is asking after you" with
       nothing under it reads as an error. */
    if (r.kind === 'nudge') return t('notif.nudge_sub')
    if (r.kind === 'nudge_reply') return t('notif.reply_sub')
    return r.goals?.commitment
  }

  return (
    <Screen>
      <TopBar
        title={t('notif.title')}
        back={() => navigate(-1)}
        backLabel={t('ui.back')}
        right={
          rows.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              data-hook="notif-clear"
              className="press whitespace-nowrap rounded-pill px-3 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]"
            >
              {t('notif.mark_all')}
            </button>
          ) : null
        }
      />

      <Section>
        {loading ? (
          <p className="text-body text-muted">{t('err.loading')}</p>
        ) : rows.length === 0 ? (
          <Empty>{t('notif.none')}</Empty>
        ) : (
          <div className="lg px-5" data-hook="notif-list">
            <div className="list">
              {rows.map((r) => (
                <div key={r.id} className="py-5" data-hook="notif-row" data-kind={r.kind}>
                <button
                  type="button"
                  onClick={() => openOne(r)}
                  className="press flex w-full items-start gap-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-safe block text-body font-semibold text-ink">
                      {line(r)}
                    </span>
                    {/* Somebody's typed text, so it is clamped. No `block`
                        here: line-clamp-2 sets display:-webkit-box and block
                        sets display:block, and whichever Tailwind emits last
                        wins. With both, the clamp silently did nothing and a
                        URL ran to three lines. */}
                    {subject(r) && (
                      <span className="text-safe mt-1 line-clamp-2 text-small text-muted">
                        {subject(r)}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="pt-0.5 text-small text-muted">
                    →
                  </span>
                </button>

                {/**
                 * SOMETHING TO DO WITH IT.
                 *
                 * "X is asking after you" arrived and the only thing this row
                 * offered was an arrow to a group board. Reading a message
                 * about somebody worrying and having no way to answer is the
                 * app collecting a gesture and dropping it: the point of the
                 * whole feature is two people making contact, and a message
                 * that can only be received is half of that.
                 *
                 * One tap, no typing. The person who is quiet is quiet for a
                 * reason, and a text box is a task.
                 */}
                {r.kind === 'nudge' && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => answer(r)}
                      disabled={replying === r.id}
                      data-hook="notif-reply"
                      className="btn-primary press w-full"
                    >
                      {replying === r.id ? t('notif.reply_sending') : t('notif.reply_cta')}
                    </button>
                    {replied.has(r.id) && (
                      <p
                        className="mt-2 text-small text-muted"
                        role="status"
                        data-hook="notif-replied"
                      >
                        {t('notif.reply_done')}
                      </p>
                    )}
                  </div>
                )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Where the setting lives, since somebody who has just read a list of
          things they missed is the person most likely to want them pushed. */}
      <Section>
        <Link
          to="/settings"
          className="press lg flex items-center gap-4 px-5 py-5 text-left"
        >
          <span className="flex-1 text-body text-ink">{t('notif.settings_link')}</span>
          <span aria-hidden="true" className="text-small text-muted">→</span>
        </Link>
      </Section>
    </Screen>
  )
}
