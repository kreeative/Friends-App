import { useEffect, useRef } from 'react'

/**
 * Unsubmitted form state, kept on the device.
 *
 * iOS does not keep a backgrounded browser tab alive. Switch to the transit
 * app to check when the bus is, come back, and Safari has thrown the page away
 * and reloaded it from scratch. Everything typed and not yet submitted is
 * gone. That is not a rare edge: the budget form is the longest thing in this
 * app, it is filled in once, and it is exactly the sort of thing somebody
 * starts on a train.
 *
 * There is no server-side draft here and there should not be: a half-typed
 * plan is not a plan, and writing partial rows to budget_plan would mean every
 * reader downstream has to know which rows are real. The device is the right
 * place for something that only matters to the person typing it.
 *
 * WHY THREE TRIGGERS AND NOT ONE
 *
 * Debouncing alone loses the last 300ms, which is the keystroke people were
 * mid-way through when they switched apps. visibilitychange alone misses a
 * crash or a swipe-away. So: debounced as you type, flushed the instant the
 * page is hidden, and flushed again on pagehide, which is the one iOS fires
 * most reliably when it is actually about to discard the page. beforeunload is
 * deliberately not used; Safari on iOS treats it as advisory at best.
 */

/* localStorage throws outright in Safari private mode and when a device policy
   disables it, and this runs on every keystroke. The whole feature is a
   convenience, so every path here fails quietly and the form simply behaves
   the way it did before. */
export function readDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Stamped here rather than by the caller, because there is more than one way
 * in and the timestamp is load-bearing: hasFreshDraft uses it to decide
 * whether to put somebody back in the form. It was briefly applied only on the
 * debounced path, which left the flush-on-hide writing an undated draft, and
 * that is precisely the write that matters most: the one made as the phone
 * goes into somebody's pocket.
 *
 * It is added on the way out so it never appears in the object the caller
 * compares against the saved plan to decide whether the form is dirty.
 */
export function writeDraft(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }))
  } catch {
    /* Nothing to do. The form still works; it just will not survive a reload. */
  }
}

export function clearDraft(key) {
  writeDraft(key, null)
}

/** A day. Long enough to cover a commute and a night's sleep. */
const MAX_AGE = 24 * 60 * 60 * 1000

/**
 * Is there something here worth interrupting somebody for?
 *
 * Stale drafts are worse than no drafts. Somebody who abandoned a half-typed
 * plan three weeks ago and has thought no more about it should not be dropped
 * back into that form every time they open the budget, holding numbers they no
 * longer recognise. A day is the horizon over which "I was in the middle of
 * this" is still true.
 *
 * The draft itself is not deleted when it goes stale. It costs nothing to
 * leave, and if the form is opened deliberately it is still the most recent
 * thing that person typed.
 */
export function hasFreshDraft(key, maxAge = MAX_AGE) {
  const draft = key ? readDraft(key) : null
  return Boolean(draft) && Date.now() - (draft.at ?? 0) < maxAge
}

/**
 * Keep `value` on the device while the form is dirty, and take it off again
 * the moment it is not.
 *
 * `value` of null means "there is nothing worth keeping", which is how the
 * caller says the form has been returned to what the server already has. That
 * is a clear rather than a no-op, so undoing your own edits does not leave a
 * stale draft waiting to be offered back tomorrow.
 *
 * The latest value lives in a ref so the two listeners can be attached once
 * rather than being torn down and rebuilt on every keystroke.
 */
export function useDraft(key, value, delay = 300) {
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    if (!key) return
    const id = setTimeout(() => writeDraft(key, latest.current), delay)
    return () => clearTimeout(id)
  }, [key, delay, JSON.stringify(value)])

  useEffect(() => {
    if (!key) return

    const flush = () => writeDraft(key, latest.current)
    const onHide = () => document.visibilityState === 'hidden' && flush()

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
    }
  }, [key])
}
