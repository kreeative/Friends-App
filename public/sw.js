/**
 * The service worker, which exists for exactly one reason: push.
 *
 * NOT AN OFFLINE CACHE, ON PURPOSE.
 *
 * A service worker's other job is caching, and this one deliberately does none.
 * A stale cache serving an old bundle is the single most confusing failure a
 * web app can have: the site is fixed, the deploy went out, and one person
 * keeps seeing last week's screen with no way to explain it. This project has
 * already spent a day on "the changes are not showing"; adding a cache would
 * make that permanent rather than a deploy away.
 *
 * So there is no `fetch` handler at all. Without one, the browser goes to the
 * network exactly as it did before this file existed, and the only thing that
 * changed is that push messages now have somewhere to arrive.
 *
 * IT LIVES AT THE ROOT AND THAT IS LOAD-BEARING.
 *
 * A worker's scope cannot be broader than its own path, so /sw.js can control
 * the whole origin and /assets/sw.js could not. It sits in public/ rather than
 * being bundled for that reason, and because a hashed filename would mean a new
 * worker on every deploy.
 *
 * AND IT MUST NEVER BE SERVED FROM CACHE.
 *
 * That is the `/sw.js` entry in vercel.json, and it is the price of the
 * unhashed name above. Browsers hold on to a worker for up to 24 hours by
 * default, so without that header a fix to the push handler below reaches
 * people a day late, and this is the one file where a stale copy keeps serving
 * itself: the old worker is what decides whether to fetch the new one. The
 * bundle under /assets is the opposite case, cached forever, because its name
 * carries a content hash and a changed file is a changed URL.
 *
 * vercel.json cannot say any of this itself. It is JSON, which has no comments,
 * and Vercel validates it against a schema that rejects unknown keys, so the
 * "//" trick fails the build rather than being ignored. Hence this paragraph,
 * here, next to the thing it protects.
 */

/* Take over immediately rather than waiting for every tab to close. A worker
   that activates only after the last tab is shut is one that arrives days late
   on a phone, which is the device this whole feature is for. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/**
 * A push arrived.
 *
 * The payload is the JSON the sender encrypted. If it cannot be read, something
 * is still shown: a push that displays nothing is worse than a vague one,
 * because on some platforms the browser then shows its own generic "this site
 * has been updated" notice instead, which is confusing and unbranded.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    /* Not JSON. Treat whatever arrived as the body rather than dropping it. */
    try {
      data = { body: event.data.text() }
    } catch {
      data = {}
    }
  }

  /**
   * THE TITLE IS NEVER THE APP'S OWN NAME.
   *
   * iOS prints "from Rich & Friends" on its own line under the title, so a
   * notification titled "Rich & Friends" arrives reading "Rich & Friends /
   * from Rich & Friends / ...". Reported from a real lock screen. Every real
   * push already sends something specific, a commitment or a person's name;
   * this fallback was the one place that did not.
   *
   * So an untitled push promotes its body to the title rather than borrowing
   * the app name, and then clears the body so the same sentence is not printed
   * twice. The app name survives only for a push carrying neither, where
   * something has to be shown and there is nothing else to say.
   */
  const title = data.title || data.body || 'Rich & Friends'
  const options = {
    body: data.title ? (data.body || '') : '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    /* Where a tap goes. Read back in notificationclick below. */
    data: { url: data.url || '/' },
    /**
     * COLLAPSING, AND WHY IT IS PER KIND.
     *
     * A tag replaces any notification already on screen with the same tag. The
     * sender passes one per kind, so a second birthday reminder replaces the
     * first rather than stacking; two DIFFERENT kinds keep their own, because
     * a birthday and somebody having gone quiet are not the same news and
     * silently swallowing one would lose it.
     */
    tag: data.tag || 'rich-and-friends',
    /* False, so a replacement still buzzes. Silently swapping the text of a
       notification somebody has already dismissed reaches nobody. */
    renotify: false,
    requireInteraction: false,
  }

  /* waitUntil, or the worker can be killed mid-show and nothing appears. */
  event.waitUntil(self.registration.showNotification(title, options))
})

/**
 * Somebody tapped it.
 *
 * An open tab is focused and navigated rather than a second one opened. Four
 * copies of the same app in a phone's tab switcher is what happens without
 * this, and each one has its own session and its own scroll position.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          /* navigate() can reject when the client is cross-origin or already
             unloading. Focusing is the part that matters; landing on the right
             screen is the bonus. */
          client.navigate?.(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined
    }),
  )
})
