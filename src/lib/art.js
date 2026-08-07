/**
 * The die-cut sticker artwork, and how a thing gets assigned one.
 *
 * This is the app's illustration set — real drawings, rather than anything
 * generated here. Everything that wants a picture rather than a logo pulls
 * from this list.
 */
export const STICKER_ART = [
  'unicorn',
  'pizza',
  'cat',
  'cactus',
  'skull',
  'koi',
  'fox',
  'deer',
  'lips',
  'thumb',
]

export const stickerSrc = (name) => `/stickers/${name}.png`

/**
 * A stable sticker for a given id.
 *
 * Derived from the id rather than stored, so a group keeps the same face for
 * its whole life without needing a column for it — and two people looking at
 * the same group see the same one. Sums the hex digits; any stable hash would
 * do, this one needs no import and cannot throw on a malformed id.
 */
export function stickerFor(id, list = STICKER_ART) {
  if (!id) return list[0]
  const n = [...String(id).replace(/-/g, '')].reduce(
    (a, c) => a + (parseInt(c, 16) || 0),
    0,
  )
  return list[n % list.length]
}
