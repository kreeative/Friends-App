/**
 * The sticker artwork.
 *
 * Adding one is dropping a PNG into src/assets/stickers/. There is no list to
 * update and nothing to register, the glob below picks up whatever is in
 * that folder at build time, and every place that shows a sticker starts
 * showing it.
 *
 * They live under src/ rather than public/ specifically so this can work.
 * Vite only globs its own source tree; a file in public/ is copied verbatim
 * and can only be referenced by a hard-coded path, which is what the manual
 * list this replaced was for. Being in src/ also means each file gets
 * content-hashed for caching, and a typo in a name fails the build instead of
 * 404ing silently in front of somebody.
 *
 * Names are sorted so the id-to-sticker mapping below is stable: a group must
 * not change its face because a new sticker landed earlier in the directory
 * listing. Adding art appends to the end of the sorted list and only shifts
 * assignments if the new name sorts before existing ones. See the note on
 * stickerFor.
 */
const MODULES = import.meta.glob('../assets/stickers/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** [{ name, src }], sorted by name. */
export const STICKERS = Object.entries(MODULES)
  .map(([path, src]) => ({ name: path.split('/').pop().replace(/\.png$/, ''), src }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const STICKER_NAMES = STICKERS.map((s) => s.name)

const BY_NAME = Object.fromEntries(STICKERS.map((s) => [s.name, s.src]))

/**
 * The URL for one sticker by name, or undefined if there is no such file.
 * Callers that name a specific sticker should tolerate undefined. Art gets
 * renamed, and a missing picture should not take a page down.
 */
export const stickerSrc = (name) => BY_NAME[name]

/** The names that exist, from a wish list. Order preserved, gaps dropped. */
export const pickStickers = (wanted) => wanted.filter((n) => n in BY_NAME)

/**
 * A stable sticker for a given id.
 *
 * Derived rather than stored, so a group keeps the same face for its whole
 * life without needing a column for it, and everyone sees the same one.
 *
 * This is deliberately not a stored assignment: the cost is that adding art
 * can reshuffle which group shows which sticker, and the benefit is that the
 * feature needs no migration, no backfill and no admin screen. For decoration
 * that is the right side of the trade. If a group ever needs to *own* its
 * artwork, that is a column, not a change here.
 */
export function stickerFor(id) {
  if (!STICKERS.length) return undefined
  if (!id) return STICKERS[0].src
  const n = [...String(id).replace(/-/g, '')].reduce((a, c) => a + (parseInt(c, 16) || 0), 0)
  return STICKERS[n % STICKERS.length].src
}
