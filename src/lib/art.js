import { chooseSticker, pickFrom } from './stickerPick'

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

/**
 * The names that exist, from a wish list. Order preserved, gaps dropped.
 *
 * `atLeast` tops the list up from whatever art is present, because dropping
 * gaps is right for one missing name and wrong for all of them: replacing the
 * whole folder used to empty every curated list at once and leave four
 * surfaces bare, with no error and nothing in the console to notice. The rule
 * itself is in stickerPick.js, where node can test it; this file cannot be
 * imported outside a bundler because of the glob above.
 */
export const pickStickers = (wanted, atLeast = 0) => pickFrom(wanted, STICKER_NAMES, atLeast)

/**
 * A group's sticker: the one it chose, else the one its id works out to.
 *
 * The derived answer used to be the only one, and the comment here said where
 * that ran out: "if a group ever needs to *own* its artwork, that is a column,
 * not a change here". Migration 66 is that column, and `chosen` is it arriving.
 *
 * The derivation stays as the default rather than being replaced. A group that
 * has never picked anything still needs a face, the same face every time, with
 * nobody having had to choose it and no backfill writing a random one into
 * every row.
 *
 * The rule lives in stickerPick.js, where node can test it. This file cannot
 * be imported outside a bundler because of the glob above, so anything that
 * stays here is only ever checked by reading it.
 *
 * @param id      the group id
 * @param chosen  groups.sticker, a file name without .png, or null
 */
export function stickerFor(id, chosen = null) {
  const name = chooseSticker(chosen, id, STICKER_NAMES)
  return name ? BY_NAME[name] : undefined
}
