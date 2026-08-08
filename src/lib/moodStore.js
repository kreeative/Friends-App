/**
 * Today's mood, with the database as the preferred home and this device as
 * the fallback.
 *
 * Two honest halves, and the difference between them is the whole reason this
 * file is worth having rather than pretending:
 *
 *   Recording how you are is a note to yourself. A browser can hold that
 *   perfectly well, so it does, and the feature works before any SQL has run.
 *
 *   Sharing it with your group is not something a browser can do. There is no
 *   route from your localStorage to somebody else's screen. Offering a toggle
 *   that silently reaches nobody would be worse than not offering it, so when
 *   the table is missing the toggle says why instead of lying.
 *
 * When the table does exist, it wins outright: it is the only copy other
 * people can see, and it follows you between devices.
 */
const KEY = 'rf.mood'

/** PostgREST's ways of saying the table is not there. */
export function isMissingTable(error) {
  const raw = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return (
    raw.includes('pgrst205') ||
    raw.includes('42p01') ||
    raw.includes('schema cache') ||
    (raw.includes('does not exist') && raw.includes('relation'))
  )
}

/** Local dates, not UTC. "Today" is the user's Tuesday, not Greenwich's. */
export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* One entry, overwritten daily. Keeping a history here would be storing
   somebody's moods on a shared computer for no purpose the app has. */
export function readLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return v?.day === today() ? v : null
  } catch {
    return null
  }
}

export function writeLocal(mood) {
  try {
    if (mood === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ day: today(), mood }))
  } catch {
    /* Private modes throw on write. The mood is still shown for this session;
       it simply will not survive a reload, which is not worth an error for. */
  }
}
