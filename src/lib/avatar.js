import { supabase } from './supabase'

/**
 * Profile photos: shrink it here, then put it somewhere.
 *
 * The resizing is the important half. A phone camera hands over eight to
 * twelve megapixels and three to six megabytes for a picture this app renders
 * at forty pixels across. Uploading that costs the person their data, costs
 * the project its storage quota, and costs every viewer the download, all to
 * throw away 99.9% of the pixels in the browser afterwards.
 *
 * So it is cropped to a square and drawn down to 512 before it leaves the
 * device, which lands around 40kB. 512 rather than 128 because the picture
 * outlives this layout: a retina 96px avatar is already 192 real pixels, and
 * re-uploading everybody's photo because a screen got bigger is not a thing
 * that can be done.
 */

const SIZE = 512
const QUALITY = 0.85
const BUCKET = 'avatars'

/** Anything a phone or a laptop is likely to hand over. */
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

/**
 * Centre-cropped square JPEG, as a Blob.
 *
 * `imageOrientation: 'from-image'` is what stops a photo taken in portrait
 * from arriving on its side: the sensor writes it landscape and puts the
 * rotation in EXIF, and a canvas ignores EXIF unless asked.
 *
 * Returns null rather than throwing when the browser cannot decode the file,
 * which is the honest answer for a HEIC on a browser with no HEIC decoder.
 * The caller sends the original in that case; the size limit on the bucket is
 * the backstop.
 */
export async function squareJpeg(file, size = SIZE) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const side = Math.min(bitmap.width, bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    )
    bitmap.close?.()

    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY),
    )
  } catch {
    return null
  }
}

/**
 * Upload, and hand back the URL to store on the profile.
 *
 * One fixed path per person rather than a new filename each time. A unique
 * name would leave every previous photo behind forever with nothing pointing
 * at it, and there is no job anywhere that would ever clean them up. Upsert
 * means the old one is the thing being replaced.
 *
 * The trade is caching: a fixed public URL is cached hard by the browser and
 * by the CDN, so a new photo at the same address keeps showing the old one.
 * Hence the version stamp on the query string. It is part of the stored URL,
 * so every viewer gets the new picture the moment the profile row reaches
 * them, and nothing has to be purged.
 *
 * Errors come back rather than being thrown. The likeliest one by far is that
 * supabase/21_profile_avatars.sql has not been run, and the caller can say so
 * in words instead of showing a storage exception to somebody who just wanted
 * a picture of their dog on their profile.
 */
export async function uploadAvatar(userId, file) {
  if (!userId || !file) return { url: null, error: new Error('nothing to upload') }

  const resized = await squareJpeg(file)
  const body = resized ?? file
  const path = `${userId}/avatar.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: resized ? 'image/jpeg' : file.type || 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) return { url: null, error }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) return { url: null, error: new Error('no public url') }

  return { url: `${data.publicUrl}?v=${Date.now()}`, error: null }
}

/**
 * Take the picture down.
 *
 * The object is removed as well as the column cleared, because a file nothing
 * references is a file nobody can delete later. A failure here is swallowed on
 * purpose: the profile is about to stop pointing at it either way, and an
 * orphaned object is not something to interrupt somebody with.
 */
export async function removeAvatar(userId) {
  if (!userId) return
  try {
    await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`])
  } catch {
    /* The column is what decides whether a picture is shown. */
  }
}

/** Did this fail because the bucket is not there yet? */
export function isMissingBucket(error) {
  const raw = `${error?.message ?? ''} ${error?.error ?? ''} ${error?.statusCode ?? ''}`.toLowerCase()
  return raw.includes('bucket not found') || raw.includes('not_found') || raw.includes('404')
}
