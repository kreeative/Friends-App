/**
 * Turning push notifications on, from the browser.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO.
 *
 * It never asks for permission on load. A permission prompt that appears before
 * anybody has asked for anything is refused by most people, and a refusal is
 * close to permanent: the browser remembers it, the prompt cannot be shown
 * again, and the only way back is a settings screen most people will never
 * find. So the prompt is behind an explicit tap, and one tap is the only thing
 * that can trigger it.
 *
 * THE SAFARI RULE, WHICH IS THE ONE THAT WILL CONFUSE PEOPLE.
 *
 * On iPhone, web push works only when the site has been added to the home
 * screen. In a Safari tab, PushManager does not exist at all. That is Apple's
 * rule, there is no way around it, and a toggle that simply fails on the device
 * most of this app's users hold would be the worst version of this feature. So
 * `pushSupport()` reports that case separately, and the UI says what to do
 * instead of showing a control that cannot work.
 */

/** The VAPID public key, compiled in. Public by definition: it is sent to the
    push service on every subscribe and is in the payload of every message. */
export const VAPID_PUBLIC_KEY = import.meta.env?.VITE_VAPID_PUBLIC_KEY ?? ''

/** base64url to the Uint8Array applicationServerKey wants. */
export function urlBase64ToUint8Array(base64) {
  const padded = String(base64 ?? '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const full = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const raw = atob(full)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** An ArrayBuffer from the subscription, as the base64url the server stores. */
export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Can this browser do it, and if not, why not.
 *
 * The reasons are separated because they need different words on screen. "Your
 * browser cannot" and "add this to your home screen first" are different
 * problems, and telling an iPhone user the first when the second is true sends
 * them looking for another browser that will behave identically.
 *
 * @returns {'ready'|'ios-needs-home-screen'|'unsupported'|'denied'}
 */
export function pushSupport(win = typeof window === 'undefined' ? undefined : window) {
  if (!win) return 'unsupported'

  const nav = win.navigator ?? {}
  const hasApi = 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win

  if (hasApi) return win.Notification.permission === 'denied' ? 'denied' : 'ready'

  /* iOS Safari in a tab: no PushManager at all. Standalone means it was added
     to the home screen, where the API does appear, so a missing API AND
     standalone is a genuinely unsupported browser rather than the Apple rule. */
  const iOS =
    /iPad|iPhone|iPod/.test(nav.userAgent ?? '') ||
    /* iPadOS reports itself as a Mac; the touch points give it away. */
    ((nav.platform === 'MacIntel' || /Macintosh/.test(nav.userAgent ?? '')) &&
      (nav.maxTouchPoints ?? 0) > 1)
  const standalone = win.navigator?.standalone === true ||
    win.matchMedia?.('(display-mode: standalone)')?.matches === true

  if (iOS && !standalone) return 'ios-needs-home-screen'
  return 'unsupported'
}

/** The registered worker, registering it if this is the first time. */
export async function ensureWorker() {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/** The subscription this browser already has, or null. Never prompts. */
export async function currentSubscription() {
  if (pushSupport() !== 'ready') return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/** The three fields the server needs, from a PushSubscription. */
export function subscriptionRow(sub, userId) {
  const json = typeof sub.toJSON === 'function' ? sub.toJSON() : sub
  const keys = json.keys ?? {}
  return {
    endpoint: json.endpoint,
    user_id: userId,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }
}

/**
 * Ask, subscribe, and hand back the row to store.
 *
 * Only ever call this from a click. Browsers require a user gesture for the
 * permission prompt, and calling it without one fails in a way that looks like
 * the person refused.
 *
 * @returns {Promise<{ok: true, row: object} | {ok: false, reason: string}>}
 */
export async function enablePush(userId) {
  const support = pushSupport()
  if (support !== 'ready') return { ok: false, reason: support }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-key' }

  /* Asked here rather than on load. `default` means never asked; `denied` is
     handled above and cannot be re-prompted. */
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'refused' }

  const reg = await ensureWorker()
  if (!reg) return { ok: false, reason: 'unsupported' }
  /* The worker has to be active before pushManager will subscribe, and after a
     first registration it briefly is not. */
  await navigator.serviceWorker.ready

  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      /* Required by every browser now, and it is the honest setting: it means
         every push shows something to the person rather than silently waking
         the app to do work in the background. */
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  return { ok: true, row: subscriptionRow(sub, userId) }
}

/**
 * Turn it off on this device.
 *
 * Unsubscribing from the push service AND deleting the row have to both happen.
 * Doing only the first leaves a row the sender will keep posting to until the
 * service answers 410; doing only the second leaves the browser subscribed to
 * something nothing sends, which is harmless but means turning it back on
 * silently reuses a subscription the server has forgotten.
 *
 * @returns the endpoint that was removed, so the caller can delete that row.
 */
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  return endpoint
}

/**
 * Show one notification on this device, right now.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT, WHICH IS THE WHOLE REASON IT HAS A
 * CAREFUL NAME.
 *
 * It proves the half that actually breaks: permission was granted, the service
 * worker is registered and active, and the operating system will paint a
 * notification from this site. On an iPhone that is nearly the entire failure
 * surface, because Apple only allows any of it once the site has been added to
 * the home screen, and a person who has not done that has no way to tell that
 * from the feature being broken.
 *
 * It does NOT prove that a real reminder will arrive. That travels
 * Supabase -> push service -> this browser, signed with the private half of the
 * VAPID pair, and none of that is exercised here. A mismatched pair subscribes
 * fine and then fails with 403 at send time, which is invisible from the
 * device. So the button that calls this says "test on this device" and the line
 * under it says what is still untested. A check that implies more than it
 * checked is worse than no check.
 *
 * showNotification on the REGISTRATION, not `new Notification()`. The
 * constructor does not exist on iOS at all, so the one platform this matters
 * most for is the one where the obvious call fails.
 */
export async function showTestNotification(text) {
  if (pushSupport() !== 'ready') return { ok: false, reason: pushSupport() }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'refused' }

  const reg = await ensureWorker()
  if (!reg) return { ok: false, reason: 'unsupported' }
  await navigator.serviceWorker.ready

  try {
    await reg.showNotification(text.title, {
      body: text.body,
      /* The same two paths sw.js uses for a real push. A guessed
         path here would show the browser's blank default and make a working
         test look broken. */
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      /* Same tag every time, so pressing it twice replaces the first rather
         than stacking two identical notifications on the lock screen. */
      tag: 'rf-test',
      data: { url: '/settings' },
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'save-failed', detail: String(e?.message ?? e) }
  }
}

/**
 * Turn it on for this browser AND record the row, in one call.
 *
 * Two screens now offer this: the settings toggle and the banner on the home
 * page. They must not drift, because the failure mode when they do is silent:
 * one of them subscribes the browser without storing the row, and the person
 * has a browser waiting for pushes that the server does not know to send.
 *
 * The two outcomes are kept apart on purpose. `ok` means the BROWSER is
 * subscribed, which is what the switch on screen describes and is already true
 * by the time the row is written. `saved` means the server can now reach it.
 * Reporting a failed row write as "turning it on did not work" is what made
 * the toggle look like it needed the app restarted.
 */
/**
 * Make the server's list agree with this browser.
 *
 * THE SWITCH READ THE BROWSER AND NOTHING ELSE, AND THOSE TWO DRIFT.
 *
 * Reported: somebody has notifications on, the switch says so, and the server
 * answers that they have no device subscribed. Both were telling the truth.
 *
 * The sender deletes a push_subscription row the moment a push comes back 404
 * or 410, which is correct: an endpoint the service has forgotten will never
 * work again and posting to it forever is worse than dropping it. But the
 * BROWSER keeps its subscription object through all of that, and the toggle
 * asks the browser. So the row disappears server-side, the switch stays on,
 * and every message to that person silently goes nowhere.
 *
 * A whole VAPID pair being regenerated does this to everybody at once: every
 * subscription made against the old public key is refused, every row is
 * dropped, and every switch in the product still reads on.
 *
 * So: if this browser holds a subscription, make sure the server has the row
 * for it. Idempotent, cheap, and it heals the drift without asking anybody to
 * understand any of the above.
 *
 * Returns { ok, healed } rather than throwing. Nothing here is worth
 * interrupting somebody over: the worst case is the state it was already in.
 */
export async function syncSubscription(userId) {
  try {
    if (!userId || pushSupport() !== 'ready') return { ok: false, healed: false }
    const sub = await currentSubscription()
    if (!sub) return { ok: false, healed: false }

    const { supabase } = await import('./supabase')
    const row = subscriptionRow(sub, userId)

    /* Ask first, so the common case where nothing is wrong costs a read and no
       write, and so `healed` means something rather than being always true. */
    const { data } = await supabase
      .from('push_subscription')
      .select('endpoint')
      .eq('endpoint', row.endpoint)
      .maybeSingle()
    if (data) return { ok: true, healed: false }

    const written = await saveSubscription(row)
    return { ok: written.ok, healed: written.ok, detail: written.detail }
  } catch {
    return { ok: false, healed: false }
  }
}

/**
 * Write the row, and know whether it landed.
 *
 * THE UPSERT COULD FAIL WITHOUT FAILING.
 *
 * This was `.upsert(row, { onConflict: 'endpoint' })`, which PostgREST sends
 * as INSERT ... ON CONFLICT DO UPDATE. When a row with that endpoint already
 * exists under a DIFFERENT user_id, the update path runs, the RLS policy's
 * USING clause hides that row, the statement matches zero rows, and Postgres
 * reports no error at all. The switch went on, nothing was written, and the
 * server had nothing to send to. Exactly the failure this repo already has a
 * rule about: RLS refuses an update silently, so "no error" is not "it
 * worked".
 *
 * Delete then insert instead, and ask for the row back. Either the endpoint
 * comes back, which is proof, or there is a real error to read. An endpoint
 * registered to somebody else's account now says so with a duplicate key
 * rather than pretending to succeed.
 *
 * `detail` is the database's own words, kept so a person can read them out
 * instead of describing them.
 */
export async function saveSubscription(row) {
  const { supabase } = await import('./supabase')

  /* Scoped to this reader by RLS, so it clears only a row they own. */
  await supabase.from('push_subscription').delete().eq('endpoint', row.endpoint)

  const { data, error } = await supabase
    .from('push_subscription')
    .insert(row)
    .select('endpoint')
    .maybeSingle()

  if (error) {
    return { ok: false, detail: `${error.code ?? 'error'}: ${error.message ?? String(error)}` }
  }
  if (data?.endpoint !== row.endpoint) {
    /* No error and no row: the write was refused by a policy without saying
       so. Naming it is the whole point of this function. */
    return { ok: false, detail: 'no row written (refused by a policy)' }
  }
  return { ok: true, detail: null }
}

export async function enablePushHere(userId) {
  const { supabase } = await import('./supabase')
  const result = await enablePush(userId)
  if (!result.ok) return { ok: false, saved: false, reason: result.reason }

  const written = await saveSubscription(result.row)
  return {
    ok: true,
    saved: written.ok,
    reason: written.ok ? null : 'save-failed',
    detail: written.detail,
  }
}
