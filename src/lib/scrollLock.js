/**
 * Stop the page behind a panel from scrolling, and let it go again.
 *
 * THE BUG THIS EXISTS FOR: "la version mobile pour voir les goals dans Young
 * and Beautiful, ca scrolle pas en bas, c'est comme bloque."
 *
 * It was. Measured in headless Chromium with real touch events: open one goal
 * card, close it, open another before the first has finished its closing
 * animation, and `document.body.style.overflow` is left at 'hidden'. A thumb
 * then moves the page exactly 0 pixels, and nothing short of a reload gets it
 * back. On a list of eight goals, tapping two of them in a row is not an edge
 * case, it is the normal way to read the list.
 *
 * WHAT WENT WRONG, AND WHY IT LOOKED CORRECT
 *
 * Four panels each did this, and each looked careful:
 *
 *   const previous = document.body.style.overflow
 *   document.body.style.overflow = 'hidden'
 *   return () => { document.body.style.overflow = previous }
 *
 * Restoring what was there rather than blanking it is the right instinct, and
 * it is right for one panel. It is wrong for two, because "what was there" is
 * read at lock time and the two locks interleave:
 *
 *   A ouvre   previous = ''         body = hidden
 *   B ouvre   previous = 'hidden'   body = hidden
 *   A ferme                         body = ''        <- B est ouvert et la page defile
 *   B ferme                         body = 'hidden'  <- plus rien n est ouvert et la page est morte
 *
 * Each panel restored exactly what it had found. The page still ends locked
 * with nothing on screen to explain it. No single component is at fault, which
 * is why the fix cannot live in one of them.
 *
 * WHAT REPLACES IT
 *
 * One counter for the whole page. The first lock records the original value
 * and sets hidden; the last release puts the original back. Any number of
 * panels can overlap in any order and the page is locked exactly while at
 * least one of them wants it locked.
 *
 * The releaser is idempotent on purpose. React can run an effect's cleanup
 * more than once in development under strict mode, and a second release that
 * decremented again would unlock the page while a panel was still open, which
 * is the same bug wearing the other face.
 */

let depth = 0
/* What body.overflow was before the first lock. null means nothing is held. */
let saved = null

/**
 * Lock the page. Returns the function that releases this one hold.
 *
 * @param doc the document, injectable so a test does not need a browser
 */
export function lockScroll(doc = document) {
  const body = doc?.body
  if (!body) return () => {}

  if (depth === 0) saved = body.style.overflow
  depth += 1
  body.style.overflow = 'hidden'

  let released = false
  return () => {
    if (released) return
    released = true
    depth -= 1
    if (depth > 0) return
    /* Below zero would mean a release without a lock, which cannot happen from
       here but would silently poison the next lock's `saved`. */
    depth = 0
    body.style.overflow = saved ?? ''
    saved = null
  }
}

/** How many holds are outstanding. For tests and for a probe. */
export function scrollLockDepth() {
  return depth
}

/**
 * Drop every hold and restore the page.
 *
 * Not used by the app: a component that needs its hold released has the
 * function that does it. This is for tests, which share one module instance
 * across cases and would otherwise leak a count from one into the next.
 */
export function resetScrollLock(doc = null) {
  depth = 0
  if (doc?.body) doc.body.style.overflow = saved ?? ''
  saved = null
}
