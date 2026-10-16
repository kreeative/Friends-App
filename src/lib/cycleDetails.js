import { addDays, cleanStarts, daysBetween, fromKey } from './cycle.js'

/**
 * CE QUE LA CARTE DU CYCLE MONTRE QUAND ON L'OUVRE.
 *
 *   "The period stuff on the calendar: you should be able to click and expand
 *    the tab when you click it for a long time."
 *
 * Fermee, la carte dit une chose: dans combien de jours. Ouverte (appui long,
 * ou le bouton "Voir plus"), elle dit ce que predict() savait deja et ne
 * montrait nulle part sur le calendrier: les dates qui arrivent, le rythme
 * moyen et sa regularite, et les dernieres regles notees.
 *
 * Rien de nouveau n'est lu ni ecrit: tout vient des lignes de cycle_log que
 * le calendrier tient deja et de la prediction. Le cycle reste a la personne
 * (pas de chemin de groupe, pas de vue partagee, pas d'export).
 *
 * Pur, pour npm test.
 */

/** Une date sans heure, pour comparer des jours. */
const dayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Les dates a venir, dans l'ordre. Chacune: { kind, from, to }.
 *
 * `pms`, `predicted` et `fertile` sont les memes fenetres que phaseOn() et
 * l'anneau. La fenetre fertile et l'ovulation de predict() sont celles du
 * cycle EN COURS: une fois passees (on est apres le milieu du cycle), ce qui
 * arrive est celle du cycle suivant, une longueur de cycle plus tard.
 */
export function upcoming(prediction, today = new Date()) {
  if (!prediction?.nextStart) return []
  const now = dayOf(today)
  const length = Math.max(1, Math.round(Number(prediction.length) || 0))
  const ahead = (to) => daysBetween(now, to) >= 0
  const out = []

  if (prediction.pmsFrom && prediction.pmsTo && ahead(prediction.pmsTo)) {
    out.push({ kind: 'pms', from: prediction.pmsFrom, to: prediction.pmsTo })
  }
  out.push({ kind: 'predicted', from: prediction.nextStart, to: prediction.nextStart, window: prediction.window ?? 1 })

  if (prediction.fertileFrom && prediction.fertileTo) {
    const shift = ahead(prediction.fertileTo) ? 0 : length
    out.push({ kind: 'fertile', from: addDays(prediction.fertileFrom, shift), to: addDays(prediction.fertileTo, shift) })
  }
  if (prediction.ovulation) {
    const shift = ahead(prediction.ovulation) ? 0 : length
    const day = addDays(prediction.ovulation, shift)
    out.push({ kind: 'ovulation', from: day, to: day })
  }

  return out.sort((a, b) => a.from - b.from)
}

/**
 * Les dernieres regles notees, la plus recente d'abord. Chacune:
 * { from, to, days, gap } ou `to` et `days` sont null quand la fin n'a pas
 * ete notee, et `gap` le nombre de jours depuis le debut precedent (null pour
 * la plus ancienne montree s'il n'y a rien avant elle).
 */
export function recentPeriods(rows, count = 3) {
  const starts = cleanStarts(rows)
  const endOf = new Map()
  for (const r of rows ?? []) {
    const s = fromKey(r?.started_on)
    const e = fromKey(r?.ended_on)
    if (s && e && daysBetween(s, e) >= 0) endOf.set(s.getTime(), e)
  }
  const out = []
  for (let i = starts.length - 1; i >= 0 && out.length < count; i--) {
    const from = starts[i]
    const to = endOf.get(from.getTime()) ?? null
    out.push({
      from,
      to,
      days: to ? daysBetween(from, to) + 1 : null,
      gap: i > 0 ? daysBetween(starts[i - 1], from) : null,
    })
  }
  return out
}

/** Tout ce que la carte ouverte affiche. */
export function cycleDetails(rows, prediction, today = new Date()) {
  if (!prediction) return null
  return {
    upcoming: upcoming(prediction, today),
    average: {
      length: Math.round(Number(prediction.length) || 0),
      confidence: prediction.confidence ?? 'none',
      source: prediction.source ?? 'default',
    },
    day: Number(prediction.dayOfCycle) || null,
    missed: Number(prediction.missed) || 0,
    recent: recentPeriods(rows),
  }
}
