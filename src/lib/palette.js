/**
 * The floating tool palette's memory: where it sits, whether it is open, and
 * which colours have been mixed lately.
 *
 * All of it is per-device rather than per-account, and that is deliberate.
 * Where a toolbar should sit is a fact about the hand holding the device and
 * the size of its screen: left-handed on an iPad in landscape is a different
 * answer from the same person on a phone, and syncing one to the other would
 * move the palette out from under somebody's thumb every time they switched.
 *
 * Pure and importless. localStorage is touched only inside the two functions
 * that say so, and both survive its absence, so the rest can be tested in node.
 */

export const STORE_KEY = 'friends.ink.palette'

/** How many mixed colours are kept. Two rows of three at the size they render. */
export const RECENT_MAX = 6

/** Kept off the very edge, so the palette never half-leaves the screen. */
export const EDGE_PAD = 8

/**
 * '#a1b' and '#AA11BB' and 'aa11bb' all mean a colour; nothing else does.
 *
 * `<input type="color">` always hands back a lowercase six-digit string, so
 * this is not really guarding that input. It guards what comes back out of
 * storage, which is a string a person can edit in devtools and which ends up
 * in an inline `background` and in the `c` field of every stroke that uses it.
 */
export function normaliseHex(raw) {
  const text = String(raw ?? '').trim().replace(/^#/, '')

  if (/^[0-9a-f]{3}$/i.test(text)) {
    /* Expanded rather than stored short, so every colour in the file is the
       same shape and nothing downstream has to know both forms. */
    return `#${text[0]}${text[0]}${text[1]}${text[1]}${text[2]}${text[2]}`.toLowerCase()
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toLowerCase()}`
  return null
}

export function isHex(raw) {
  return normaliseHex(raw) !== null
}

/**
 * Most recent first, no duplicates, capped.
 *
 * Re-picking a colour already in the list moves it to the front rather than
 * adding a second copy, which is what makes the row settle on the four or five
 * colours somebody actually uses instead of filling with near-identical greens
 * from one afternoon of fiddling with the wheel.
 */
export function addRecent(list, colour) {
  const hex = normaliseHex(colour)
  if (!hex) return Array.isArray(list) ? list : []

  const rest = (Array.isArray(list) ? list : []).filter((c) => normaliseHex(c) !== hex)
  return [hex, ...rest].slice(0, RECENT_MAX)
}

/**
 * Keep the palette on the screen.
 *
 * Stored as pixels rather than fractions, because a palette dropped two thirds
 * of the way across a wide screen should not jump when the window narrows: the
 * distance from the left is what somebody chose, and the clamp is what handles
 * the case where that distance no longer exists.
 *
 * Rotating a tablet is exactly that case, and without this the toolbar from
 * landscape sits entirely outside a portrait viewport with no way to fetch it
 * back.
 */
export function clampSpot(spot, { w, h, vw, vh, pad = EDGE_PAD } = {}) {
  const maxX = Math.max(pad, (vw ?? 0) - (w ?? 0) - pad)
  const maxY = Math.max(pad, (vh ?? 0) - (h ?? 0) - pad)

  return {
    x: Math.min(maxX, Math.max(pad, Math.round(spot?.x ?? pad))),
    y: Math.min(maxY, Math.max(pad, Math.round(spot?.y ?? pad))),
  }
}

/** The shape every reader can rely on, for a device that has never drawn. */
export function emptyPalette() {
  return { spot: null, collapsed: false, recent: [] }
}

/**
 * Read it back, tolerating anything.
 *
 * A person editing their own localStorage is not an attacker, but a half-typed
 * JSON blob there should not be a white screen. Every field is checked
 * separately so one bad value does not throw the other two away.
 */
export function readPalette(raw) {
  const empty = emptyPalette()
  if (!raw || typeof raw !== 'object') return empty

  const spot =
    raw.spot && Number.isFinite(raw.spot.x) && Number.isFinite(raw.spot.y)
      ? { x: raw.spot.x, y: raw.spot.y }
      : null

  /* Deduplicated on the way in as well as on the way out. addRecent already
     guarantees a clean list, but this reads a string somebody can edit, and a
     stored list of six identical greys would render as six identical swatches
     with nothing to choose between them. */
  const recent = Array.isArray(raw.recent)
    ? [...new Set(raw.recent.map(normaliseHex).filter(Boolean))].slice(0, RECENT_MAX)
    : []

  return { spot, collapsed: raw.collapsed === true, recent }
}

/** localStorage throws in Safari private mode. A palette is not worth a crash. */
export function loadPalette() {
  try {
    return readPalette(JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'))
  } catch {
    return emptyPalette()
  }
}

export function savePalette(next) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    /* The palette simply starts in its default place next time. */
  }
}

/**
 * Where a palette that has never been placed should go.
 *
 * Bottom centre, which is where a thumb is on a phone and where PencilKit puts
 * it on a tablet. Computed rather than stored, so the first open on a new
 * device lands correctly instead of at the top-left corner.
 */
export function defaultSpot({ w, h, vw, vh, pad = EDGE_PAD } = {}) {
  return clampSpot(
    { x: Math.round(((vw ?? 0) - (w ?? 0)) / 2), y: (vh ?? 0) - (h ?? 0) - pad * 3 },
    { w, h, vw, vh, pad },
  )
}
