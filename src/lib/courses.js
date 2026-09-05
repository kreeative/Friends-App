/* Extension explicite: charge par node dans courses.test.mjs, qui ne resout
   pas les imports sans extension comme le fait Vite. */
import { COUNTRIES, COURSES } from '../content/courses.js'

/**
 * Naviguer dans les cours, sans qu'aucune page ait a connaitre la forme des
 * donnees.
 *
 * Pur et testable sous node. Tout ce qui est ici a une version fausse qui
 * passe la relecture et se voit tout de suite a l'ecran: une lecon suivante
 * qui saute par-dessus un module, un pays inconnu qui rend une page vide, un
 * identifiant d'URL qui ne retrouve rien.
 */

export const DEFAULT_COUNTRY = 'ca'

/** La langue dans laquelle le contenu a ete ecrit en premier. */
export const SOURCE_LOCALE = 'fr'

/**
 * Un champ de contenu, dans la langue demandee.
 *
 * UN SEUL ARBRE, DES FEUILLES BILINGUES.
 *
 * L'autre solution etait deux arbres, un par langue. Elle a l'air plus simple
 * et elle derive: on ajoute une lecon d'un cote, on oublie de l'autre, et
 * personne ne s'en apercoit avant qu'un anglophone ouvre le module. Ici la
 * structure est commune et seules les phrases sont doublees, donc une lecon ne
 * peut pas exister dans une langue et pas dans l'autre.
 *
 * LE REPLI EST LE FRANCAIS, ET IL EST VOULU.
 *
 * Une traduction manquante rend la phrase francaise plutot qu'une case vide.
 * Un blanc dans un cours se lit comme une application cassee; une phrase dans
 * la mauvaise langue se lit comme une traduction en retard, ce qui est
 * exactement ce que c'est. Le test dit lesquelles manquent.
 *
 * Tolere une chaine nue, pour que du contenu ecrit avant ce changement
 * continue de s'afficher au lieu de rendre `undefined`.
 */
export function say(field, locale = SOURCE_LOCALE) {
  if (field === null || field === undefined) return ''
  if (typeof field === 'string') return field
  return field[locale] ?? field[SOURCE_LOCALE] ?? ''
}

/** Les phrases d'une liste, dans la langue demandee. */
export function sayAll(list, locale = SOURCE_LOCALE) {
  return (list ?? []).map((item) => say(item, locale))
}

/** La cle de la region choisie. Par appareil, comme le theme. */
export const COUNTRY_KEY = 'rf.course.pays'

export function courseBySlug(slug) {
  return COURSES.find((c) => c.slug === slug) ?? null
}

/** Toutes les lecons d'un cours, a plat, dans l'ordre de lecture. */
export function lessonsOf(course) {
  if (!course) return []
  return course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, module: m })))
}

export function lessonById(course, id) {
  return lessonsOf(course).find((l) => l.id === id) ?? null
}

/**
 * La lecon d'avant et celle d'apres, a travers les modules.
 *
 * A travers, et pas dans: la derniere lecon du module 0 est suivie de la
 * premiere du module 1. Une navigation qui s'arrete au bord du module oblige a
 * remonter au sommaire entre chaque module, ce qui est exactement le moment ou
 * les gens ferment l'application.
 */
export function neighbours(course, id) {
  const all = lessonsOf(course)
  const i = all.findIndex((l) => l.id === id)
  if (i < 0) return { prev: null, next: null }
  return {
    prev: i > 0 ? all[i - 1] : null,
    next: i < all.length - 1 ? all[i + 1] : null,
  }
}

/** Est-ce que cette region existe? Sinon, celle par defaut. */
export function safeCountry(id) {
  return COUNTRIES.some((c) => c.id === id) ? id : DEFAULT_COUNTRY
}

export function countryLabel(id) {
  const c = COUNTRIES.find((x) => x.id === safeCountry(id))
  return `${c.flag} ${c.label}`
}

/**
 * La partie d'une lecon qui depend du pays, ou null.
 *
 * Deux garde-fous, et les deux ont deja produit une page blanche ailleurs dans
 * ce depot. Une lecon sans `byCountry` n'est pas une erreur, c'est le cas
 * normal: la plupart des lecons sont universelles. Et un identifiant de pays
 * inconnu, qui arrive des qu'une valeur trainee dans localStorage survit a un
 * renommage, retombe sur la region par defaut au lieu de rendre `undefined`.
 */
export function variantFor(lesson, country) {
  if (!lesson?.byCountry) return null
  return lesson.byCountry[safeCountry(country)] ?? lesson.byCountry[DEFAULT_COUNTRY] ?? null
}

/** Combien de lecons sont ecrites, et combien sont encore des esquisses. */
export function progressOf(course) {
  const all = lessonsOf(course)
  const written = all.filter((l) => l.state === 'written').length
  return { written, total: all.length }
}
