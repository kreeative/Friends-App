import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { Hint } from './ui'
import {
  VAPID_PUBLIC_KEY,
  currentSubscription,
  enablePushHere,
  pushSupport,
} from '../lib/pushClient'

const KEY = 'rf.push_banner_dismissed'

/**
 * "Turn notifications on", on the home page, for everybody who has not.
 *
 * WHY THIS EXISTS RATHER THAN JUST SWITCHING THEM ON.
 *
 * Asked for: can it not simply be enabled for everyone, with people turning it
 * off if they mind? No, and not as a policy choice. A browser will only
 * subscribe after a genuine user gesture, with the permission request raised
 * in the same tick as a real tap on a real element. There is no server-side
 * call, no setting, and no trick that grants it, and that is the correct
 * design: otherwise any page you opened could put itself on your lock screen.
 *
 * So the closest honest thing is to put the tap somewhere everyone passes,
 * which is here, and make one press do the whole job. The old route was
 * Settings, scroll, Notifications, toggle, and it depended on someone deciding
 * to go looking.
 *
 * THE BUTTON TURNS THEM ON FROM HERE.
 *
 * Not a link to Settings. The whole complaint was the trip, and a banner that
 * only points at the place where the real control lives has added a step
 * rather than removed one. This calls the same enablePushHere that the toggle
 * does, so the two cannot drift.
 *
 * IT DISAPPEARS ON ITS OWN IN FOUR CASES, QUIETLY IN ALL OF THEM.
 *
 *   already subscribed   nothing to advertise
 *   no VAPID key         the deployment cannot do this yet, so offering it
 *                        would be a button that fails
 *   permission denied    the browser will not ask again, so the button cannot
 *                        work and saying so on the home page every day is
 *                        nagging about something nobody can fix from here
 *   dismissed            they said no to being asked
 *
 * The one state it deliberately DOES show in is an iPhone in a Safari tab,
 * where push is unavailable but the reason is fixable in ten seconds. There
 * the button is replaced by the explanation, because a button that cannot work
 * is worse than a sentence that tells you what to do.
 */
export default function PushBanner() {
  const { user } = useAuth()
  const { t } = useT()

  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!user) return
      try {
        if (localStorage.getItem(KEY) === '1') return
      } catch {
        /* Storage disabled. Show it: dismissing will not stick, which is a
           smaller cost than the banner never appearing at all. */
      }

      /* No key on this build means the whole feature is unconfigured. That is
         a deployment problem and nothing a reader can act on, so it gets
         silence here rather than a broken invitation. */
      if (!VAPID_PUBLIC_KEY) return

      const support = pushSupport()
      if (support === 'unsupported' || support === 'denied') return

      if (support === 'ready') {
        const sub = await currentSubscription().catch(() => null)
        if (dead || sub) return
      }
      if (!dead) setState(support)
    })()
    return () => {
      dead = true
    }
  }, [user])

  if (!state) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* see above */
    }
    /* Played out rather than yanked, so the feed does not jump under a thumb
       that has just tapped something. */
    setLeaving(true)
    setTimeout(() => setState(null), 220)
  }

  const turnOn = async () => {
    setBusy(true)
    const res = await enablePushHere(user.id)
    setBusy(false)
    /* Granted, so this banner has done its job and goes. It does not matter
       here whether the ROW saved: the settings screen owns that problem and
       says so properly, and re-showing this banner tomorrow would ask somebody
       to grant a permission they have already granted. */
    if (res.ok) {
      try {
        localStorage.setItem(KEY, '1')
      } catch { /* see above */ }
      setLeaving(true)
      setTimeout(() => setState(null), 220)
      return
    }
    /* Refused. The browser will not ask again, so stop offering. */
    if (res.reason === 'denied' || res.reason === 'refused') dismiss()
  }

  return (
    <div
      data-hook="push-banner"
      data-state={state}
      className={`relative mt-6 overflow-hidden rounded-card border border-accent/25 bg-[rgb(var(--c-field)/0.16)] p-5 transition-all duration-200 ease-settle ${
        leaving ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      <button
        onClick={dismiss}
        aria-label={t('banner.dismiss')}
        data-hook="push-banner-close"
        className="press absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-body leading-none text-ink/60"
      >
        &times;
      </button>

      <div className="pr-8">
        {/* The title carries the "?" rather than the card having a second row
            for it. The panel anchors to this card, which is content width, so
            it cannot run off the screen the way the one beside the Goals
            heading did. */}
        <div className="flex items-center text-body font-semibold text-ink">
          {t('banner.push_title')}
          <Hint text={t('banner.push_how')} />
        </div>
        <p className="mt-1 text-small leading-snug text-muted">
          {state === 'ready' ? t('banner.push_sub') : t('banner.push_ios')}
        </p>
      </div>

      {state === 'ready' && (
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          data-hook="push-banner-on"
          className="btn-primary press mt-4 inline-flex disabled:opacity-60"
        >
          {busy ? t('banner.push_working') : t('banner.push_cta')}
        </button>
      )}
    </div>
  )
}
