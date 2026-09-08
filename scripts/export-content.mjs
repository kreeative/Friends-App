/**
 * node scripts/export-content.mjs
 *
 * Tout le texte des cours, dans content.json, pour qu'un outil de creation
 * puisse s'en servir sans ouvrir ce depot.
 *
 * CE QUI A ETE DEMANDE
 *
 *   "Exporte tous les textes de mes lecons / modules dans un fichier
 *    content.json pour Claude Design afin qu'il puisse creer du contenu,
 *    creas, medias sociaux etc que je vais utiliser."
 *
 * DEUX FORMES DANS LE MEME FICHIER, ET C'EST VOULU
 *
 * `courses` est l'arbre tel qu'il existe: cours, modules, lecons, avec chaque
 * phrase gardee en { fr, en }. Rien n'y est resume ni reecrit, donc une
 * citation prise ici est exactement ce que la lecon dit.
 *
 * `lessons` est le meme contenu a plat, une entree par lecon, avec un tableau
 * `text` qui contient chaque phrase de la lecon dans l'ordre de lecture, avec
 * son role (titre, objectif, point, reflexion, script...). C'est cette forme-la
 * qui sert a fabriquer un carrousel ou une legende: on parcourt `text` et on
 * choisit, sans avoir a comprendre la structure d'un module.
 *
 * Les deux sont dans un seul fichier plutot que deux, parce qu'un fichier qui
 * voyage par courriel jusqu'a un iPad est plus sur que deux qui doivent rester
 * ensemble.
 *
 * CE QUI N'EST PAS PERDU
 *
 * La copie de l'arbre est generique: elle recopie tout ce qu'elle trouve, y
 * compris un champ ajoute demain. Un exportateur qui liste les champs qu'il
 * connait oublie en silence celui qu'on vient d'ecrire, et personne ne le voit
 * avant de chercher un texte qui n'est pas dans le fichier.
 *
 * `state: "plan"` EST UNE ESQUISSE, PAS UNE LECON
 *
 * Seize lecons sur cinquante-deux ne sont pas ecrites: elles ont un titre et
 * une promesse et rien dessous. Elles sont exportees quand meme, parce que
 * savoir ce qui existe a un titre est utile, mais chaque entree porte son
 * `state` et le meta le repete. Publier une esquisse comme si c'etait une
 * lecon serait promettre un texte qui n'existe pas.
 *
 * LE LEXIQUE SUIT
 *
 * Une lecon reference ses termes par identifiant (`terms: ['valeur-nette']`).
 * Sans le lexique, ces identifiants sont des references mortes dans le
 * fichier, donc les definitions voyagent avec.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { COURSES, COUNTRIES } from '../src/content/courses.js'
import { GLOSSARY } from '../src/content/glossary.js'
import { modulesOf, say } from '../src/lib/courses.js'
import { courseTerms } from '../src/lib/glossary.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const OUT = join(root, 'content.json')

/** Une phrase bilingue, telle que le contenu l'ecrit. */
const isSay = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  ('fr' in v || 'en' in v) && Object.values(v).every((x) => typeof x === 'string')

/**
 * Recopie generique.
 *
 * Elle ne connait aucun nom de champ, donc elle ne peut en oublier aucun. Ce
 * qu'elle fait: laisse une phrase bilingue telle quelle, descend dans les
 * tableaux et les objets, et rend tout le reste (nombre, chaine, booleen) sans
 * y toucher.
 */
function copy(value) {
  if (Array.isArray(value)) return value.map(copy)
  if (isSay(value)) return { ...value }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v)]))
  }
  return value
}

/**
 * Chaque phrase d'une lecon, dans l'ordre ou on la lit, avec son role.
 *
 * L'ordre est celui de l'ecran, pas celui de l'objet: c'est ce qui fait qu'une
 * suite de `text` se lit comme la lecon plutot que comme un vidage de champs.
 * Un role est ajoute a chaque ligne parce qu'une legende ne se fabrique pas de
 * la meme facon a partir d'un objectif et a partir d'un script a dire tel quel.
 */
function flatten(lesson) {
  const out = []
  const push = (role, field, extra = {}) => {
    if (!field) return
    const fr = say(field, 'fr')
    const en = say(field, 'en')
    if (!fr && !en) return
    out.push({ role, fr, en, ...extra })
  }

  push('title', lesson.title)
  push('sub', lesson.sub)
  push('objective', lesson.objective)
  push('metaphor', lesson.metaphor)
  push('universal', lesson.universal)

  for (const p of lesson.points ?? []) {
    push('point_lead', p.lead)
    push('point_body', p.body)
  }

  for (const s of lesson.script ?? []) push('script', s)

  push('reflection', lesson.reflection)
  push('todo', lesson.todo)

  /* Les variantes par pays. Une lecon peut dire une chose au Canada et une
     autre en zone franc, et les deux sont du vrai texte a citer. */
  for (const { id } of COUNTRIES) {
    const v = lesson.byCountry?.[id]
    if (!v) continue
    push('country_grail', v.grail, { country: id })
    for (const p of v.points ?? []) {
      push('country_point_lead', p.lead, { country: id })
      push('country_point_body', p.body, { country: id })
    }
    push('country_todo', v.todo, { country: id })
  }

  /* Le quiz en dernier, comme a l'ecran. La bonne reponse est marquee: une
     question sans sa reponse ne sert a rien hors de l'application. */
  for (const q of lesson.quiz ?? []) {
    push('quiz_question', q.ask)
    ;(q.options ?? []).forEach((o, i) => push('quiz_option', o, { correct: i === q.answer }))
    push('quiz_why', q.why)
  }

  return out
}

/* --- l'arbre, tel quel ---------------------------------------------------- */

const courses = COURSES.map((course) => ({
  slug: course.slug,
  title: copy(course.title),
  tagline: copy(course.tagline),
  modules: modulesOf(course).map((m) => ({
    n: m.n,
    title: copy(m.title),
    intro: copy(m.intro),
    lessons: (m.lessons ?? []).map(copy),
  })),
}))

/* --- les memes lecons, a plat ---------------------------------------------- */

/**
 * Les termes d'une lecon, toujours rendus en identifiants reels.
 *
 * `terms: 'course'` est une sentinelle: elle veut dire "tous les mots croises
 * dans ce cours", et c'est ce que porte la lecon de recap a la fin de chaque
 * cours. Recopiee telle quelle, elle donnait la chaine "course" dans le
 * fichier, ce qui ne veut rien dire pour qui lit l'export sans avoir la
 * fonction qui la resout. Elle est donc developpee ici, et `terms_source`
 * garde la trace de ce qui etait ecrit.
 */
function termsOf(lesson, course) {
  if (lesson.terms === 'course') {
    return { terms: courseTerms(course).map((e) => e.id), terms_source: 'course' }
  }
  return { terms: lesson.terms ?? [] }
}

const lessons = []
for (const course of COURSES) {
  for (const m of modulesOf(course)) {
    for (const lesson of m.lessons ?? []) {
      lessons.push({
        course: course.slug,
        course_title: copy(course.title),
        module: m.n,
        module_title: copy(m.title),
        id: lesson.id,
        state: lesson.state ?? 'written',
        title: copy(lesson.title),
        sub: copy(lesson.sub),
        ...termsOf(lesson, course),
        text: flatten(lesson),
      })
    }
  }
}

/* --- le lexique, pour que `terms` ne soit pas une reference morte ---------- */

const glossary = Object.fromEntries(
  Object.entries(GLOSSARY).map(([id, e]) => [
    id,
    { term: copy(e.term), short: copy(e.short), ...(e.only ? { only: e.only } : {}) },
  ]),
)

const written = lessons.filter((l) => l.state === 'written').length

const payload = {
  meta: {
    app: 'Rich & Friends',
    what: 'Tout le texte des cours: cours, modules, lecons, quiz, lexique. Deux formes du meme contenu, voir `courses` et `lessons`.',
    generated_at: new Date().toISOString().slice(0, 10),
    generated_by: 'scripts/export-content.mjs',
    languages: ['fr', 'en'],
    source_language: 'fr',
    note_state:
      'state "written" = lecon ecrite, citable telle quelle. state "plan" = esquisse: un titre et une promesse, aucun texte dessous. Ne pas publier une esquisse comme si c etait une lecon.',
    note_shape:
      '`courses` est l arbre complet. `lessons` est le meme contenu a plat, une entree par lecon, avec `text`: chaque phrase dans l ordre de lecture, avec son role.',
    roles: [
      'title', 'sub', 'objective', 'metaphor', 'universal',
      'point_lead', 'point_body', 'script', 'reflection', 'todo',
      'country_grail', 'country_point_lead', 'country_point_body', 'country_todo',
      'quiz_question', 'quiz_option', 'quiz_why',
    ],
    countries: COUNTRIES.map((c) => ({ id: c.id, label: copy(c.label) })),
    counts: {
      courses: courses.length,
      modules: courses.reduce((n, c) => n + c.modules.length, 0),
      lessons: lessons.length,
      lessons_written: written,
      lessons_planned: lessons.length - written,
      sentences: lessons.reduce((n, l) => n + l.text.length, 0),
      glossary: Object.keys(glossary).length,
    },
  },
  courses,
  lessons,
  glossary,
}

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)

const kb = Math.round(JSON.stringify(payload).length / 1024)
console.log(`content.json ecrit (${kb} ko)`)
console.log(
  `  ${payload.meta.counts.courses} cours, ${payload.meta.counts.modules} modules, ` +
    `${payload.meta.counts.lessons} lecons (${written} ecrites, ${lessons.length - written} esquisses)`,
)
console.log(`  ${payload.meta.counts.sentences} phrases, ${payload.meta.counts.glossary} termes de lexique`)
