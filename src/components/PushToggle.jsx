import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import {
  VAPID_PUBLIC_KEY,
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
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

  useEffect(() => {
    let dead = false
    const run = async () => {
      const s = VAPID_PUBLIC_KEY ? pushSupport() : 'no-key'
      if (!dead) setSupport(s)
      if (s !== 'ready') return
      const sub = await currentSubscription().catch(() => null)
      if (!dead) setOn(Boolean(sub))
    }
    run()
    return () => {
      dead = true
    }
  }, [])

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
    try {
      if (on) {
        const endpoint = await disablePush()
        /* The row goes even if unsubscribing failed. A row nothing can deliver
           to is worse than a browser subscribed to something nobody sends: the
           sender would post to it every hour until the service gave up. */
        if (endpoint) await supabase.from('push_subscription').delete().eq('endpoint', endpoint)
        setOn(false)
      } else {
        const result = await enablePush(user.id)
        if (!result.ok) {
          setProblem(result.reason)
          /* A refusal is permanent in the browser, so the row has to reflect
             that rather than leaving a switch somebody can keep tapping. */
          if (result.reason === 'denied' || result.reason === 'refused') setSupport('denied')
          return
        }
        /* onConflict on the endpoint: subscribing again on the same browser
           returns the same endpoint, and the keys can have rotated. Without
           this it is a duplicate-key error and the switch silently fails. */
        const { error } = await supabase
          .from('push_subscription')
          .upsert(result.row, { onConflict: 'endpoint' })
        if (error) {
          setProblem('save-failed')
          return
        }
        setOn(true)
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
        <p className="mt-3 text-small text-negative" role="alert">
          {t(`push.problem_${problem.replace(/-/g, '_')}`)}
        </p>
      )}
    </div>
  )
}
