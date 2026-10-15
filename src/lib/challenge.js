/**
 * OU EN EST CHACUN DANS SES 21 MATINS.
 *
 * Le defi ne commence pas a une date commune: une video circule pendant des
 * semaines, et quelqu'un qui arrive au jour 15 d'un defi a date fixe n'aurait
 * que six matins. Chaque personne a donc SES 21 jours, comptes depuis son
 * arrivee dans le groupe (group_members.joined_at), dans le fuseau du groupe:
 * c'est le fuseau ou ses periodes s'ouvrent a minuit, donc le seul ou "jour 3"
 * veut dire la meme chose pour le compteur et pour la carte du jour.
 *
 * Un matin est:
 *   done     tous les objectifs du defi faits ce jour-la
 *   partial  au moins un, pas tous
 *   missed   un jour passe, rien de fait
 *   today    aujourd'hui, pas encore tout fait
 *   future   pas encore arrive
 *
 * Pur et sans import, pour `npm test`.
 */

/** AAAA-MM-JJ d'un instant, vu depuis un fuseau. UTC si le fuseau est faux. */
export function dayKeyIn(instant, tz = 'UTC') {
  /* new Date(null) est le 1er janvier 1970, pas une erreur: une date
     d'arrivee absente ferait commencer le defi en 1970. */
  if (instant == null || instant === '') return null
  const d = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(d.getTime())) return null
  const fmt = (zone) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  try {
    return fmt(tz || 'UTC')
  } catch {
    return fmt('UTC')
  }
}

/** Le nombre de jours de calendrier de a a b (b - a), sans heure d'ete. */
export function daysBetween(a, b) {
  const t = (k) => {
    const [y, m, d] = String(k).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((t(b) - t(a)) / 86_400_000)
}

/** Le jour AAAA-MM-JJ, n jours apres un autre. */
export function addDays(key, n) {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Le numero du jour, a partir de 1. Peut depasser la duree: le defi est fini. */
export function challengeDay({ joinedAt, now = new Date(), tz = 'UTC' } = {}) {
  const start = dayKeyIn(joinedAt, tz)
  const today = dayKeyIn(now, tz)
  if (!start || !today) return 1
  return Math.max(1, daysBetween(start, today) + 1)
}

/**
 * Les matins, un par case.
 *
 * @param cycles   les periodes du groupe (opens_at): une par jour
 * @param checkins MES points du jour seulement (cycle_id, id)
 * @param items    leurs lignes (checkin_id, goal_id, outcome)
 * @param goalIds  les objectifs du defi: ceux du groupe
 */
export function challengeTrack({
  joinedAt,
  now = new Date(),
  tz = 'UTC',
  length = 21,
  cycles = [],
  checkins = [],
  items = [],
  goalIds = [],
} = {}) {
  const start = dayKeyIn(joinedAt, tz)
  const today = dayKeyIn(now, tz)
  if (!start || !today) return []

  const want = new Set(goalIds)
  const dayOfCycle = new Map(cycles.map((c) => [c.id, dayKeyIn(c.opens_at, tz)]))
  const dayOfCheckin = new Map(
    checkins.filter((c) => dayOfCycle.has(c.cycle_id)).map((c) => [c.id, dayOfCycle.get(c.cycle_id)]),
  )

  /* Par jour, les objectifs du defi faits (ou faits en partie). Un objectif
     compte une fois, quel que soit le nombre de lignes. */
  const full = new Map()
  const some = new Map()
  for (const it of items) {
    const day = dayOfCheckin.get(it.checkin_id)
    if (!day || !want.has(it.goal_id)) continue
    if (it.outcome === 'done' || it.outcome === 'partial') {
      if (!some.has(day)) some.set(day, new Set())
      some.get(day).add(it.goal_id)
    }
    if (it.outcome === 'done') {
      if (!full.has(day)) full.set(day, new Set())
      full.get(day).add(it.goal_id)
    }
  }

  const total = want.size
  return Array.from({ length }, (_, i) => {
    const date = addDays(start, i)
    const done = full.get(date)?.size ?? 0
    const any = some.get(date)?.size ?? 0
    let state
    if (date > today) state = 'future'
    else if (total > 0 && done >= total) state = 'done'
    else if (date === today) state = 'today'
    else if (any > 0) state = 'partial'
    else state = 'missed'
    return { n: i + 1, date, state, done, total }
  })
}

/** Combien de matins complets. */
export function completeMornings(track) {
  return track.filter((d) => d.state === 'done').length
}
