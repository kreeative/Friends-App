import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { serverPushOutcome } from '../lib/notifications'
import {
  VAPID_PUBLIC_KEY,
  currentSubscription,
  disablePush,
  enablePushHere,
  pushSupport,
  showTestNotification,
  syncSubscription,
} from '../lib/pushClient'

/**
 * Notifications on this device.
 *
 * WHY THE WORDS CHANGE INSTEAD OF THE CONTROL BEING DISABLED.
 *
 * There are four reasons this can be unavailable and they need four different
 * sentences. A disabled switch with a grey label says "no" without saying why,
 * and three of the four have something the reader can actually do about them:
 *
 *   ios-needs-home-screen  add the site to the home screen. Apple's rule, not
 *                          ours, and the one that will bite hardest here
 *   denied                 the browser was told no once and will not ask again
 *   no-key                 nobody has set VITE_VAPID_PUBLIC_KEY on this build
 *   unsupported            genuinely nothing to offer
 *
 * "Your browser does not support notifications" shown to an iPhone in a Safari
 * tab is the worst of these: it is false, and it sends somebody to install
 * another browser that will behave identically, because every browser on iOS
 * is Safari underneath.
 *
 * PER DEVICE, AND IT SAYS SO.
 *
 * A push subscription belongs to one browser on one machine. Turning this on
 * on a phone does nothing for a laptop, and a toggle that reads as an account
 * setting would be lying about that. The row names the device rather than the
 * account.
 */
export default function PushToggle() {
  const { user } = useAuth()
  const { t } = useT()

  const [support, setSupport] = useState('unsupported')
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)
  /* The database's own words for why the row did not land. */
  const [problemDetail, setProblemDetail] = useState(null)
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState(null)
  /* The server round trip, which is a different question entirely. */
  const [serverTesting, setServerTesting] = useState(false)
  const [serverOut, setServerOut] = useState(null)

  useEffect(() => {
    let dead = false
    const run = async () => {
      const s = VAPID_PUBLIC_KEY ? pushSupport() : 'no-key'
      if (!dead) setSupport(s)
      if (s !== 'ready') return
      const sub = await currentSubscription().catch(() => null)
      if (!dead) setOn(Boolean(sub))
      /* And make the server agree. The row is deleted server-side when a push
         comes back 404 or 410, while this browser keeps its subscription, so
         the switch can read on for months against a server with nothing to
         send to. See syncSubscription. */
      if (sub && user?.id) {
        const healed = await syncSubscription(user.id)
        /* A heal that could not write is the same failure as a toggle that
           could not write, and it must be as visible. Silence here is what let
           a switch read on for a day against a server with no row. */
        if (!dead && healed?.ok === false && healed?.detail) {
          setProblem('save-failed')
          setProblemDetail(healed.detail)
        }
      }
    }
    run()
    return () => {
      dead = true
    }
  }, [user?.id])

  if (support !== 'ready') {
    return (
      <div className="py-5" data-hook="push-unavailable" data-reason={support}>
        <p className="text-body text-ink">{t('push.title')}</p>
        <p className="lede mt-1.5">{t(`push.why_${support.replace(/-/g, '_')}`)}</p>
      </div>
    )
  }

  const toggle = async () => {
    setBusy(true)
    setProblem(null)
    setProblemDetail(null)
    try {
      if (on) {
        const endpoint = await disablePush()
        /* The row goes even if unsubscribing failed. A row nothing can deliver
           to is worse than a browser subscribed to something nobody sends: the
           sender would post to it every hour until the service gave up. */
        if (endpoint) await supabase.from('push_subscription').delete().eq('endpoint', endpoint)
        setOn(false)
      } else {
        const result = await enablePushHere(user.id)
        if (!result.ok) {
          setProblem(result.reason)
          /* A refusal is permanent in the browser, so the row has to reflect
             that rather than leaving a switch somebody can keep tapping. */
          if (result.reason === 'denied' || result.reason === 'refused') setSupport('denied')
          return
        }
        /**
         * THE SWITCH MOVES NOW, NOT AFTER THE ROW IS WRITTEN.
         *
         * Reported: turning it on appeared to do nothing, and the switch only
         * showed as on after closing the app and opening it again.
         *
         * That is this ordering. `setOn(true)` used to sit AFTER the upsert,
         * behind an early return on error, so a failed row write left the
         * browser genuinely subscribed and the switch showing off. Reopening
         * the app then read the real subscription off the service worker and
         * showed on, which is why it looked like it needed a restart.
         *
         * The label says "on for this browser", and by this line that is
         * simply true: enablePush has already asked, subscribed, and been
         * granted. So the switch reflects it immediately. A row that fails to
         * save is a separate problem and gets said separately, rather than
         * being reported as the switch not having worked.
         */
        setOn(true)
        if (!result.saved) {
          setProblem('save-failed')
          setProblemDetail(result.detail ?? null)
        }
      }
    } catch {
      setProblem('save-failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-5" data-hook="push-toggle" data-on={on ? 'yes' : 'no'}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className="press flex w-full items-center gap-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-body text-ink">{t('push.title')}</span>
          {/* What it will actually do, in the state it is in. Not a repeat of
              the label with "on" after it. */}
          <span className="mt-1 block text-small text-muted">
            {on ? t('push.on_here') : t('push.off_here')}
          </span>
        </span>

        {/**
         * A track and a knob, not a checkbox.
         *
         * aria-pressed on the button is what carries the state, so the shape is
         * decoration and is hidden. A real checkbox styled into a switch needs
         * its own label association and gets read out as "checkbox" anyway.
         */}
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-200 ${
            on ? 'bg-accent' : 'bg-ink/[0.14]'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-pill bg-surface shadow-raised transition-all duration-200 ${
              on ? 'left-6' : 'left-1'
            }`}
          />
        </span>
      </button>

      {problem && (
        <>
          <p className="mt-3 text-small text-negative" role="alert">
            {t(`push.problem_${problem.replace(/-/g, '_')}`)}
          </p>
          {/**
           * The database's own words, verbatim and selectable.
           *
           * "Could not be saved" was the whole message, and it sent somebody
           * to Safari's settings for a problem that was a policy refusing a
           * write. The sentence above is this app's reading; this line is the
           * thing itself, so it can be read out to whoever can act on it.
           */}
          {problemDetail && (
            <p
              className="mt-1 select-all text-small text-muted"
              data-hook="push-save-detail"
            >
              {problemDetail}
            </p>
          )}
        </>
      )}

      {/**
       * ONLY ONCE IT IS ON, AND ONLY SAYING WHAT IT CHECKED.
       *
       * Turning this on has no visible result. The switch moves and then
       * nothing happens for hours, until a reminder either arrives or does
       * not, and if it does not there is no way to tell a refused permission
       * from a silenced app from a server that never sent anything.
       *
       * So there is one thing to press that produces an immediate answer. It
       * proves the half that actually breaks: permission granted, worker
       * registered, and the operating system willing to paint a notification
       * from this site. On an iPhone that is most of the failure surface.
       *
       * It cannot prove delivery, and the line under it says so rather than
       * letting a green tick imply an end-to-end test. The note stays visible
       * rather than appearing after the press, because the thing it qualifies
       * is the button, not the result.
       */}
      {on && (
        <div className="mt-4" data-hook="push-test">
          <button
            type="button"
            onClick={async () => {
              setTesting(true)
              setTested(null)
              const res = await showTestNotification({
                title: t('push.test_title'),
                body: t('push.test_body'),
              })
              setTested(res.ok ? 'sent' : (res.reason ?? 'save-failed'))
              setTesting(false)
            }}
            disabled={testing}
            className="goal-action press"
          >
            {testing ? t('push.testing') : t('push.test')}
          </button>

          {tested && (
            <p
              className={`mt-2 text-small ${tested === 'sent' ? 'text-muted' : 'text-negative'}`}
              role="status"
              data-hook="push-test-out"
            >
              {tested === 'sent'
                ? t('push.test_sent')
                : t(`push.problem_${tested.replace(/-/g, '_')}`)}
            </p>
          )}

          {/**
           * THE OTHER HALF, WHICH IS THE HALF NOBODY COULD TEST.
           *
           * The button above calls showNotification in this browser. It never
           * touches the server, so it says nothing about whether the Supabase
           * function is the right version, whether it holds signing keys, or
           * whether this device is subscribed on the server's side.
           *
           * Testing that took two people and two phones, because you cannot
           * nudge yourself: the endpoint refuses it and the card about you is
           * never shown to you. So an entire afternoon went into guessing
           * which link of the chain was broken.
           *
           * This asks the server to push to the person pressing it, and to
           * nobody else. It cannot name a recipient, so the worst it can do is
           * send you your own notification. The result names the broken link.
           */}
          <div className="mt-4" data-hook="push-server-test">
            <button
              type="button"
              onClick={async () => {
                setServerTesting(true)
                setServerOut(null)
                setServerOut(await serverPushOutcome())
                setServerTesting(false)
              }}
              disabled={serverTesting}
              className="goal-action press"
            >
              {serverTesting ? t('push.testing') : t('push.server_test')}
            </button>

            <p className="mt-2 text-small text-muted">{t('push.server_test_note')}</p>

            {serverOut && (
              <>
                <p
                  className={`mt-2 text-small ${serverOut.why === 'ok' ? 'text-muted' : 'text-negative'}`}
                  role="status"
                  data-hook="push-server-out"
                  data-why={serverOut.why}
                >
                  {t(`push.server_${serverOut.why}`)}
                </p>
                {/**
                 * The server's own words, verbatim.
                 *
                 * The sentence above is this app's reading of what happened.
                 * This is the thing itself: an HTTP status, or whatever the
                 * browser said when the request never arrived. It is here to
                 * be read out to somebody who can act on it, which is why it
                 * is selectable and not translated.
                 */}
                {serverOut.detail && (
                  <p
                    className="mt-1 select-all text-small text-muted"
                    data-hook="push-server-detail"
                  >
                    {serverOut.detail}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
