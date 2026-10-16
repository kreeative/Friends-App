/**
 * What kind of file a student added, from its name and type. Shared by the
 * server (api/_bb/files.js, which converts it) and the app (which refuses a
 * HEIC or an old .ppt before uploading it, with the fix in the message).
 * Pure.
 */
/* 22 MB: a PDF travels to the model in base64, a third bigger, and one
   request is capped at 32 MB. 22 MB is 29.3 MB once encoded. */
export const MAX_MB = 22
export const MAX_BYTES = MAX_MB * 1024 * 1024

export function formatOf(name, mime) {
  const n = String(name ?? '').toLowerCase()
  const m = String(mime ?? '').toLowerCase()
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  if (n.endsWith('.pptx') || m.includes('presentationml')) return 'pptx'
  if (n.endsWith('.docx') || m.includes('wordprocessingml')) return 'docx'
  if (n.endsWith('.vtt') || n.endsWith('.srt')) return 'captions'
  if (n.endsWith('.txt') || n.endsWith('.md') || m.startsWith('text/')) return 'text'
  if (n.endsWith('.heic') || n.endsWith('.heif') || m.includes('heic') || m.includes('heif')) return 'heic'
  if (/\.(jpe?g|png|webp|gif)$/.test(n) || /^image\/(jpeg|png|webp|gif)$/.test(m)) return 'image'
  if (n.endsWith('.ppt') || n.endsWith('.doc')) return 'legacy'
  return 'unknown'
}

/** The accept list of the file picker. */
export const ACCEPT = '.pdf,.pptx,.docx,.txt,.md,.vtt,.srt,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*'

/** A sensible kind for a new file: the student can change it. */
export function kindFor(name, mime) {
  const n = String(name ?? '').toLowerCase()
  if (/(exam|examen|final|midterm|intra|quiz|practice|pratique|corrig)/.test(n)) return 'exam'
  const f = formatOf(name, mime)
  if (f === 'captions') return 'transcript'
  if (/(transcri|lecture|cours\s?\d|enregistr)/.test(n) && f === 'text') return 'transcript'
  if (f === 'image') return 'photo'
  if (f === 'docx' || /(guide|study|resume|résumé|notes?)/.test(n)) return f === 'text' ? 'notes' : 'guide'
  if (f === 'text') return 'notes'
  return 'slides'
}

/** Why a file cannot go, or null: the message key and its fix. */
export function refuse(file) {
  const f = formatOf(file?.name, file?.type)
  if ((file?.size ?? 0) > MAX_BYTES) return 'too_big'
  if (f === 'heic') return 'heic'
  if (f === 'legacy') return 'legacy'
  if (f === 'unknown') return 'unknown'
  return null
}
