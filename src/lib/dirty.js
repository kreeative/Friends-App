/**
 * HAS THE FORM CHANGED FROM WHAT IS SAVED?
 *
 * "Si rien n'a changé, le bouton enregistrer reste grisé, partout dans
 * l'app" (Kee). A save button that works on an untouched form says there is
 * something to save when there is not, and its one press writes the same
 * row again. So every form that edits something already saved compares
 * itself with it, and its save button waits for a real change.
 *
 * Compared as a person reads a form, not as JavaScript does: "6" typed in a
 * number field is the 6 that was saved, "  Kee " is "Kee", an empty field is
 * the null in the database, and a set of chapters ticked in another order is
 * the same set. Pure, for `npm test`.
 */

const NUMERIC = /^-?\d+(\.\d+)?$/

function norm(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    return NUMERIC.test(s) ? Number(s) : s
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString()
  if (Array.isArray(v)) {
    const items = v.map(norm)
    /* A list of plain values is a set: ticked in any order, the same choice. */
    return items.every((x) => x === null || typeof x !== 'object') ? [...items].sort((a, b) => String(a).localeCompare(String(b))) : items
  }
  if (typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) {
      const n = norm(v[k])
      if (n !== null && !(Array.isArray(n) && !n.length)) out[k] = n
    }
    return out
  }
  return v
}

/** The same, as a person reads a form. */
export function same(a, b) {
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

/** Something to save: the form is not what is saved. */
export function changed(saved, draft) {
  return !same(saved, draft)
}
