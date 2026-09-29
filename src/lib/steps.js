/* Extension explicite: charge par node dans steps.test.mjs. */
import { fromHm } from './reminders.js'
import { LAYER_COLOUR } from './agenda.js'

/**
 * Les etapes d'un objectif: une liste a cocher a l'interieur d'un objectif.
 *
 *   "Dans la section goals construit une option todo du genre un goal a
 *    l'interieur duquel il y a des checklists qui auront un peu la meme
 *    fonctionnalite que les goals normaux avec des options pour le temps
 *    aussi et tout et quand tu vas checker le goal sur une vue tu vois comme
 *    un pourcentage de progression"
 *
 * Une etape est une ligne de goal_step: un titre, une date facultative, une
 * heure facultative, un rang, et le moment ou elle a ete cochee. L'objectif
 * qui en porte est une liste, et son avancement est le nombre d'etapes
 * cochees sur le nombre d'etapes.
 *
 * Tout ce qui se calcule sur ces lignes vit ici, en pur, pour que la carte,
 * la fiche, le formulaire et le calendrier disent le meme chiffre. Le
 * pourcentage en particulier: un arrondi fait a trois endroits finit par
 * rendre 66 sur la carte et 67 sur la fiche.
 */

/** Les etapes d'un objectif, dans l'ordre ou elles ont ete ecrites. */
export function stepsOf(steps, goalId) {
  return sortSteps((steps ?? []).filter((s) => s?.goal_id === goalId))
}

/** Par rang, puis par date d'ecriture: deux etapes de meme rang restent stables. */
export function sortSteps(list) {
  return [...(list ?? [])].sort(
    (a, b) =>
      (a.position ?? 0) - (b.position ?? 0)
      || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
      || String(a.id ?? '').localeCompare(String(b.id ?? '')),
  )
}

/** Est-ce que cet objectif est une liste? Une seule etape suffit. */
export function hasSteps(steps, goalId) {
  return (steps ?? []).some((s) => s?.goal_id === goalId)
}

/**
 * L'avancement: cochees, total, et le pourcentage ENTIER.
 *
 * Arrondi a l'entier le plus proche, une fois pour toutes. Zero etape rend
 * zero pour cent et pas NaN: une liste qu'on vient de creer n'est pas "pas un
 * nombre", elle est a zero.
 */
export function progressOf(steps) {
  const list = steps ?? []
  const total = list.length
  const done = list.filter((s) => Boolean(s?.done_at)).length
  const pct = total === 0 ? 0 : Math.round((100 * done) / total)
  return { done, total, pct, complete: total > 0 && done === total }
}

/**
 * La prochaine etape a faire: la premiere non cochee qui a une date, la plus
 * proche d'abord, sinon la premiere non cochee dans l'ordre de la liste.
 * Null quand tout est coche ou que la liste est vide.
 */
export function nextStep(steps) {
  const todo = sortSteps(steps).filter((s) => !s?.done_at)
  if (todo.length === 0) return null
  const dated = todo.filter((s) => s.due_on).sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)))
  return dated[0] ?? todo[0]
}

/**
 * Ce que le formulaire tient en main pour une etape: le texte tape, une date
 * en 'YYYY-MM-DD' ou vide, une heure en 'HH:MM' ou vide, et l'id quand elle
 * existe deja en base.
 */
export function draftOf(step) {
  return {
    id: step?.id ?? null,
    title: step?.title ?? '',
    due_on: step?.due_on ?? '',
    at: step?.at_min != null ? toHm(step.at_min) : '',
  }
}

function toHm(min) {
  const m = Math.max(0, Math.min(1439, Number(min) || 0))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Les brouillons, prets pour la base: titre nettoye, vides ecartes, rang
 * dans l'ordre de la liste, heure en minutes ou null.
 *
 * Une etape sans titre n'est pas une etape, c'est une ligne qu'on a ouverte
 * et pas remplie; elle tombe sans bruit. Une heure sans date n'a pas de sens
 * ("a 9h" de quel jour?) et tombe aussi.
 */
export function cleanDrafts(drafts) {
  const out = []
  for (const d of drafts ?? []) {
    const title = String(d?.title ?? '').trim()
    if (!title) continue
    const due_on = d?.due_on || null
    const at = due_on && d?.at ? fromHm(d.at, null) : null
    out.push({
      id: d?.id ?? null,
      title: title.slice(0, 200),
      due_on,
      at_min: at,
      position: out.length,
    })
  }
  return out
}

/**
 * Ce qu'il faut ecrire pour passer des lignes existantes aux brouillons:
 * inserer les nouvelles, mettre a jour celles qui ont change, supprimer
 * celles qui ne sont plus la. Trois listes, pour trois requetes au plus,
 * plutot qu'un delete-all-insert-all qui perdrait `done_at` sur chaque
 * enregistrement du formulaire.
 */
export function stepDiff(existing, drafts, goalId) {
  const clean = cleanDrafts(drafts)
  const before = new Map((existing ?? []).map((s) => [s.id, s]))
  const insert = []
  const update = []
  const keep = new Set()
  for (const d of clean) {
    if (d.id && before.has(d.id)) {
      keep.add(d.id)
      const was = before.get(d.id)
      if (was.title !== d.title || (was.due_on ?? null) !== d.due_on || (was.at_min ?? null) !== d.at_min || (was.position ?? 0) !== d.position) {
        update.push({ id: d.id, title: d.title, due_on: d.due_on, at_min: d.at_min, position: d.position })
      }
    } else {
      insert.push({ goal_id: goalId, title: d.title, due_on: d.due_on, at_min: d.at_min, position: d.position })
    }
  }
  const remove = [...before.keys()].filter((id) => !keep.has(id))
  return { insert, update, remove }
}

/**
 * Les etapes datees, en entrees de calendrier, sur la couche des objectifs.
 *
 * Meme forme que les echeances d'objectifs que la page fabrique deja: une
 * entree d'une journee sur la date, ou un bloc d'une demi-heure quand
 * l'etape a une heure. `goalId` est ce que openEditor regarde pour ne pas
 * ouvrir le formulaire d'evenement dessus. Une etape cochee garde sa place
 * sur la grille, avec une coche devant: la date a eu lieu.
 *
 * Seules les etapes d'objectifs ACTIFS sont dessinees, comme les echeances.
 */
export function stepEntries(steps, goalsById) {
  const out = []
  for (const s of steps ?? []) {
    if (!s?.id || !s.due_on) continue
    const goal = goalsById?.get?.(s.goal_id) ?? goalsById?.[s.goal_id]
    if (!goal || goal.status !== 'active') continue
    const timed = s.at_min != null && s.at_min >= 0 && s.at_min < 1440
    out.push({
      id: `step:${s.id}`,
      goalId: s.goal_id,
      stepId: s.id,
      title: `${s.done_at ? '✓ ' : ''}${s.title}`,
      category: 'objectif',
      colour: LAYER_COLOUR.objectifs,
      starts_on: s.due_on,
      start_min: timed ? s.at_min : null,
      end_min: timed ? Math.min(1440, s.at_min + 30) : null,
      weekdays: [],
      until_on: null,
      location: null,
      excluded_on: [],
    })
  }
  return out
}
