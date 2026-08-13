import { supabase } from './supabase'

/**
 * Proof photographs: shrink, upload, read back, react.
 *
 * The same shape as avatar.js and for the same reasons, with one difference
 * that matters: an avatar is cropped square because it is rendered in a
 * circle, and a proof is not. Somebody photographing a gym floor, a page of a
 * book or a finished plate has framed it themselves, and cropping it to a
 * square to fit a grid throws away the half they meant. The long edge is
 * capped and the aspect is kept; the grid crops visually with object-cover,
 * which is reversible, and the modal shows the whole thing.
 */

const BUCKET = 'checkin-proofs'
const MAX_EDGE = 1280
const QUALITY = 0.82

export const REACTIONS = ['heart', 'fire', 'clap', 'muscle']

/** The picker, and the only four the database will accept. See migration 23. */
export const REACTION_GLYPH = {
  heart: '♥',
  fire: '▲',
  clap: '✚',
  muscle: '●',
}

/**
 * Down to a sane size, aspect kept, EXIF rotation applied.
 *
 * Returns null when the browser cannot decode the file, which is the honest
 * answer for a HEIC on an engine with no HEIC decoder. The caller sends the
 * original and the bucket's own size limit is the backstop.
 */
export async function photoBlob(file, maxEdge = MAX_EDGE) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY),
    )
  } catch {
    return null
  }
}

/**
 * Upload, and hand back the URL to store on the check-in item.
 *
 * A random filename per photo, unlike the avatar's fixed path. Two reasons:
 * these accumulate rather than replace, and the bucket is public, so a
 * guessable name is a photograph anybody can find by counting. crypto.randomUUID
 * is available everywhere this app runs; the fallback keeps it working in the
 * odd insecure context.
 */
export async function uploadProof(userId, file) {
  if (!userId || !file) return { url: null, error: new Error('nothing to upload') }

  const resized = await photoBlob(file)
  const body = resized ?? file
  const name = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${userId}/${name}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: resized ? 'image/jpeg' : file.type || 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) return { url: null, error }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data?.publicUrl ?? null, error: data?.publicUrl ? null : new Error('no public url') }
}

/** Did this fail because migration 23 has not been run? */
export function isMissingProofs(error) {
  const raw = `${error?.message ?? ''} ${error?.code ?? ''} ${error?.statusCode ?? ''}`.toLowerCase()
  return (
    raw.includes('bucket not found') ||
    raw.includes('pgrst205') ||
    raw.includes('42p01') ||
    raw.includes('schema cache') ||
    raw.includes('404')
  )
}

/**
 * Every photograph the group has, newest first.
 *
 * One read of the view, which already carries the member, the goal and the
 * reaction tallies. `missing` is the migration not having been run, which is
 * a state rather than an error: the screen says so instead of showing a
 * PostgREST code to somebody who cannot act on one.
 */
export async function loadProofs(groupId, limit) {
  const cap = limit ?? 120
  if (!groupId) return { proofs: [], missing: false }

  const { data, error } = await supabase
    .from('group_proofs')
    .select('*')
    .eq('group_id', groupId)
    .order('submitted_at', { ascending: false })
    .limit(cap)

  if (error) return { proofs: [], missing: isMissingProofs(error) }
  return { proofs: data ?? [], missing: false }
}

/**
 * Toggle one emoji from one person on one photograph.
 *
 * A delete rather than a second insert when it is already there, which is what
 * the unique constraint in migration 23 expects. Returns the new state so the
 * caller can settle its optimistic update rather than refetching the grid.
 */
export async function toggleReaction(itemId, userId, emoji, isOn) {
  if (!itemId || !userId || !REACTIONS.includes(emoji)) return { error: null }

  if (isOn) {
    const { error } = await supabase
      .from('proof_reactions')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
    return { error }
  }

  const { error } = await supabase
    .from('proof_reactions')
    .insert({ item_id: itemId, user_id: userId, emoji })
  return { error }
}

/**
 * Change a proof you already sent.
 *
 * Written straight to checkin_items rather than through submit_checkin,
 * because that function rewrites the whole check-in from a payload and this is
 * one field of one item: routing an edit through it would mean reconstructing
 * every other goal's answer from the gallery, and getting one wrong would
 * silently overwrite a count somebody entered days ago.
 *
 * No ownership check here, on purpose. checkin_items_write in 03_policies is
 * scoped to check-ins you own, so an attempt on somebody else's row matches
 * nothing and updates nothing. A second check in the client would be a second
 * place to get it wrong, and the one that matters is the one in the database.
 */
export async function updateProof(itemId, patch) {
  if (!itemId) return { error: new Error('no item') }

  const { data, error } = await supabase
    .from('checkin_items')
    .update(patch)
    .eq('id', itemId)
    .select('id, photo_url, link_url, evidence')
    .maybeSingle()

  return { row: data ?? null, error }
}

/**
 * Photographs bucketed by the month they belong to, newest month first.
 *
 * Grouped on the cycle's own day rather than on when the file was uploaded: a
 * photo taken on the 31st and filed at ten past midnight belongs to the month
 * it was taken in, which is the one the person remembers.
 */
export function byMonth(proofs, tag = 'en') {
  const out = []
  const index = new Map()

  for (const proof of proofs) {
    const when = new Date(proof.day_at ?? proof.submitted_at)
    const key = `${when.getFullYear()}-${when.getMonth()}`

    if (!index.has(key)) {
      index.set(key, out.length)
      out.push({
        key,
        label: when.toLocaleDateString(tag, { month: 'long', year: 'numeric' }),
        proofs: [],
      })
    }
    out[index.get(key)].proofs.push(proof)
  }

  return out
}
