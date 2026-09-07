/* Extension explicite: charge par node dans glossary.test.mjs, qui ne resout
   pas les imports sans extension comme le fait Vite. */
import { GLOSSARY } from '../content/glossary.js'
import { lessonsOf, safeCountry } from './courses.js'

/**
 * Resoudre les mots d'une lecon.
 *
 * "Can you add in the module some part where words are explained like
 * inflation etc."
 *
 * Une lecon porte `terms: ['inflation', 'fnb']`, c'est-a-dire des
 * identifiants, pas des definitions: voir la note en tete de
 * content/glossary.js pour la raison. Ce fichier fait la jointure, et il fait
 * les deux choses qu'une jointure doit faire, refuser l'inconnu et garder
 * l'ordre.
 */

/**
 * Est-ce que cette entree concerne cette region?
 *
 * Sans `only`, oui: c'est le cas normal, l'inflation est l'inflation partout.
 * Avec, seulement les regions nommees: montrer le CELI a quelqu'un en France
 * remplit le lexique de mots qui ne le concernent pas, ce qui est le reproche
 * deja fait a un cours qui recite des plafonds etrangers.
 */
export function inRegion(entry, country) {
  if (!entry?.only) return true
  return entry.only.includes(safeCountry(country))
}

/**
 * Les entrees d'une liste d'identifiants, dans l'ordre ecrit.
 *
 * Un identifiant inconnu est IGNORE plutot que rendu en case vide. Une faute
 * de frappe dans une lecon ne doit pas casser la page, et le test dit
 * exactement lesquels sont inconnus, ce qui est le bon endroit pour
 * l'apprendre: a l'ecriture, pas devant quelqu'un qui lit.
 */
export function resolveTerms(ids, country) {
  return (ids ?? [])
    .map((id) => (GLOSSARY[id] ? { id, ...GLOSSARY[id] } : null))
    .filter((e) => e && inRegion(e, country))
}

/**
 * Tous les mots d'un cours, sans doublon, dans l'ordre des lecons.
 *
 * `terms: 'course'` sur la derniere lecon en fait le lexique du cours: les
 * mots y reviennent tous, dans l'ordre ou ils ont ete rencontres, ce qui est
 * aussi l'ordre dans lequel ils s'expliquent. Ecrire cette liste a la main
 * dans la lecon de recap aurait garanti qu'elle soit fausse au premier mot
 * ajoute ailleurs.
 */
export function courseTerms(course, country) {
  const seen = new Set()
  const out = []
  for (const lesson of lessonsOf(course)) {
    if (lesson.terms === 'course') continue
    for (const id of lesson.terms ?? []) {
      if (seen.has(id)) continue
      seen.add(id)
      const entry = GLOSSARY[id]
      if (entry && inRegion(entry, country)) out.push({ id, ...entry })
    }
  }
  return out
}

/**
 * Les mots a afficher au bas d'une lecon.
 *
 * Le seul point d'entree des ecrans: la lecon dit `terms`, et cette fonction
 * decide si c'est une liste ou le lexique entier du cours.
 */
export function termsFor(lesson, course, country) {
  if (lesson?.terms === 'course') return courseTerms(course, country)
  return resolveTerms(lesson?.terms, country)
}
