/**
 * L'anneau du cycle: ou l'on en est, en un dessin.
 *
 *   "The menstruation tab... it looks cheap, it doesn't feel like I care
 *    about women's health."
 *
 * Le tiroir disait tout en champs de formulaire: une liste de <input
 * type="date">, un nombre dans une boite, une case a cocher. Juste, et froid.
 * Ce que les applications de sante font, et qu'on reconnait au premier
 * regard, c'est UN cercle: le cycle entier, les regles en couleur, la fenetre
 * fertile, les jours d'avant, et un point qui dit "tu es la".
 *
 * Ce fichier calcule l'anneau; CycleRing.jsx le dessine. Separes pour que la
 * geometrie se teste sans navigateur, comme cycle.js.
 *
 * CE QUE L'ANNEAU AFFIRME, ET PAS PLUS.
 *
 * Il ne dessine rien que predict() ne dise deja: les regles enregistrees
 * (un fait, trait plein), la fenetre fertile, les jours d'avant et les
 * regles attendues (des estimations, trait pointille). Meme regle que les
 * pastilles du calendrier: le fait est plein, l'estimation est un anneau. La
 * largeur de la fenetre d'incertitude (prediction.window) elargit le segment
 * attendu, donc un cycle irregulier montre une plage, pas une date.
 *
 * Quand des regles semblent manquer (prediction.missed > 0), la prediction a
 * ete avancee d'un ou plusieurs cycles, et ses fenetres n'appartiennent plus
 * a l'anneau en cours: on ne dessine alors que les regles enregistrees et le
 * point du jour. Un anneau qui inventerait une fenetre fertile dans un cycle
 * dont on ne sait rien serait exactement l'affirmation que cycle.js evite.
 */
import { cleanStarts, daysBetween, fromKey } from './cycle.js'

/** L'ordre de dessin: les estimations dessous, les faits dessus. */
export const SEGMENT_ORDER = ['fertile', 'pms', 'predicted', 'period']

export const ESTIMATES = new Set(['fertile', 'pms', 'predicted'])

/**
 * @param starts     les lignes de cycle_log (started_on, ended_on) ou des dates
 * @param prediction ce que predict() rend, avec length/window/missed dedans
 * @returns null sans dates ni prediction, sinon
 *   { length, day, marker, late, segments: [{ kind, from, to, estimate }] }
 *   from/to sont des numeros de jour, 1 = le dernier debut enregistre.
 */
export function ringModel(starts, prediction, { today = new Date(), periodDays = 5 } = {}) {
  const clean = cleanStarts(starts)
  const last = clean[clean.length - 1]
  if (!last || !prediction) return null

  const length = Math.max(1, Math.round(Number(prediction.length) || 0))
  if (!length) return null
  const day = daysBetween(last, today) + 1
  const marker = Math.min(Math.max(day, 1), length)
  const idx = (d) => daysBetween(last, d) + 1
  const segments = []

  /* Les regles en cours ou les dernieres: ended_on quand il est la, sinon la
     duree par defaut, la meme que phaseOn(). */
  const lastRow = (starts ?? []).find((r) => !(r instanceof Date) && fromKey(r?.started_on)?.getTime() === last.getTime())
  const end = lastRow ? fromKey(lastRow.ended_on) : null
  const periodLen = end && daysBetween(last, end) >= 0 ? daysBetween(last, end) + 1 : periodDays
  segments.push({ kind: 'period', from: 1, to: Math.min(periodLen, length), estimate: false })

  if (!prediction.missed) {
    const clamp = (kind, a, b) => {
      const from = Math.max(1, idx(a))
      const to = Math.min(length, idx(b))
      if (from <= to) segments.push({ kind, from, to, estimate: true })
    }
    if (prediction.fertileFrom && prediction.fertileTo) clamp('fertile', prediction.fertileFrom, prediction.fertileTo)
    if (prediction.pmsFrom && prediction.pmsTo) clamp('pms', prediction.pmsFrom, prediction.pmsTo)
    if (prediction.nextStart) {
      const w = Math.max(1, Number(prediction.window) || 1)
      const from = Math.max(1, idx(prediction.nextStart) - w)
      if (from <= length) segments.push({ kind: 'predicted', from, to: length, estimate: true })
    }
  }

  segments.sort((a, b) => SEGMENT_ORDER.indexOf(a.kind) - SEGMENT_ORDER.indexOf(b.kind))
  return { length, day, marker, late: day > length, segments }
}

/** Un point sur le cercle, l'angle compte depuis le haut, dans le sens horaire. */
export function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

/** L'angle du milieu d'un jour, pour y poser le point du jour. */
export const dayAngle = (day, length) => ((day - 0.5) / length) * 360

/**
 * L'arc d'un segment, du debut du jour `from` a la fin du jour `to`.
 * Un arc ne peut pas faire 360 degres d'un seul trait (il s'annule): un
 * segment qui couvre tout l'anneau est raccourci d'un cheveu.
 */
export function arcPath(cx, cy, r, from, to, length) {
  const a0 = ((from - 1) / length) * 360
  let a1 = (to / length) * 360
  if (a1 - a0 >= 360) a1 = a0 + 359.99
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  const f = (n) => Number(n.toFixed(2))
  return `M${f(p0.x)} ${f(p0.y)}A${r} ${r} 0 ${large} 1 ${f(p1.x)} ${f(p1.y)}`
}
