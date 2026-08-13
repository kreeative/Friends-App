/**
 * What counts as proof, per goal.
 *
 * Until now every goal offered the same thing: a photograph, on a separate
 * tab, whether or not a photograph was the sensible evidence for it. "Read
 * twenty pages" photographs badly. "Ship the landing page" is a URL. "Sat with
 * it for ten minutes" is a sentence and cannot be anything else. Asking for a
 * picture of all three is how the proof tab became a thing people ignored.
 *
 * So the goal says what proof it wants, and the check-in renders that one
 * control on the goal's own card. Three kinds, plus the honest fourth: some
 * goals do not need proving to anybody and pretending otherwise is worse than
 * asking for nothing.
 *
 * Pure and importless, so the link parsing can be tested without a browser.
 */

/** photo, link, text, or nothing. Order is the order the picker offers them. */
export const PROOF_TYPES = ['photo', 'link', 'text', 'none']

/**
 * What a goal wants if nobody said.
 *
 * A photograph, because that is what every goal in the database offered before
 * this column existed, and a migration that silently changed what thousands of
 * existing goals ask for would be a migration that rewrote people's goals.
 */
export const DEFAULT_PROOF = 'photo'

/** How long a note may be. The column is text; this is what the form allows. */
export const NOTE_MAX = 280

/** What kind of proof does this goal want? Tolerant of a row from before 28. */
export function proofTypeOf(goal) {
  const raw = goal?.proof_type
  return PROOF_TYPES.includes(raw) ? raw : DEFAULT_PROOF
}

/**
 * A link, as somebody actually types it.
 *
 * Nobody types the scheme. "github.com/me/thing" is what gets pasted out of a
 * phone's address bar, and storing it as-is produces an anchor the browser
 * resolves against our own origin, so the proof link on the gallery would open
 * rich-and-friends.app/github.com/me/thing. Adding https when there is no
 * scheme is the whole of the fix.
 *
 * Only http and https come back. A `javascript:` URL in a field that later
 * becomes an href is the oldest hole there is, and this is the one place where
 * one person's text is rendered as a link on four other people's screens.
 * mailto and tel are refused too, not because they are dangerous but because
 * they are not evidence of anything.
 */
export function normaliseLink(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null

  /* A bare scheme-looking prefix is tested before https is bolted on, or
     "javascript:alert(1)" would become "https://javascript:alert(1)" and pass
     as an ordinary URL with a strange host. */
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`

  let url
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  /* A URL with no host parses fine and points nowhere: `https:///a` is valid
     to the parser and meaningless as evidence. */
  if (!url.hostname || !url.hostname.includes('.')) return null

  return url.href
}

/** Would this be stored as a link? */
export function isValidLink(raw) {
  return normaliseLink(raw) !== null
}

/**
 * The bit of a URL worth showing.
 *
 * A gallery tile is about 110px wide and a real URL is two hundred characters
 * of tracking parameters. The host is what tells somebody whether this is a
 * Strava run or a GitHub commit, which is the entire question a tile has room
 * to answer.
 */
export function linkHost(raw) {
  const href = normaliseLink(raw)
  if (!href) return ''
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Which proof is on this item, if any.
 *
 * Read from what was actually stored rather than from what the goal asked for,
 * because the two can disagree and the stored one is the truth: a goal that
 * wanted a photograph in March and wants a link now still has March's
 * photographs hanging off it, and the gallery has to render what is there.
 *
 * A photograph wins when there are several, because it is the one with
 * something to look at.
 */
export function proofOf(item) {
  if (item?.photo_url) return { kind: 'photo', value: item.photo_url }
  if (item?.link_url) return { kind: 'link', value: item.link_url }
  const note = String(item?.evidence ?? '').trim()
  if (note) return { kind: 'text', value: note }
  return null
}

/** Is there anything on this item worth showing in the gallery? */
export function hasProof(item) {
  return proofOf(item) !== null
}

/**
 * Is the answer somebody has filled in good enough to send?
 *
 * Deliberately not a gate on submitting. A check-in with no proof is still a
 * check-in, and an app that refused to record an honest day because the
 * photograph did not upload would be an app that punishes bad reception. This
 * only says whether the control is satisfied, which is what draws the tick on
 * the card.
 */
export function proofFilled(answer, type) {
  if (type === 'photo') return Boolean(answer?.photo_url)
  if (type === 'link') return isValidLink(answer?.link_url)
  if (type === 'text') return Boolean(String(answer?.evidence ?? '').trim())
  return false
}

/**
 * The proof half of one check-in item, ready for submit_checkin.
 *
 * Only the field the goal actually asked for is sent. Without that, a goal
 * switched from link to photo would keep posting whatever was left in the link
 * box from before the switch, and the item would carry two kinds of proof for
 * one answer.
 *
 * `evidence` is the exception and is always carried: it doubles as the caption
 * on a photograph, which is what evidence_def has always prompted for.
 */
export function proofFields(answer = {}, type = DEFAULT_PROOF) {
  const note = String(answer.evidence ?? '').trim() || null

  return {
    evidence: note,
    photo_url: type === 'photo' ? answer.photo_url || null : null,
    link_url: type === 'link' ? normaliseLink(answer.link_url) : null,
  }
}
