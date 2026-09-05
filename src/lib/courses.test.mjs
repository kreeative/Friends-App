/**
 * node src/lib/courses.test.mjs
 *
 * Deux choses sont verifiees ici et elles ne se ressemblent pas. La navigation,
 * qui est du code, et la forme du contenu, qui est de la prose et qui casse
 * silencieusement: une lecon a qui il manque un champ ne leve rien, elle
 * affiche du vide.
 */
import { COUNTRIES, COUNTRY_ANSWERS, COURSES } from '../content/courses.js'
import {
  DEFAULT_COUNTRY,
  countryLabel,
  courseBySlug,
  lessonById,
  lessonsOf,
  neighbours,
  progressOf,
  safeCountry,
  variantFor,
} from './courses.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\ncourses')

/* --- les regions --------------------------------------------------------- */
eq('quatre regions', COUNTRIES.length, 4)
eq('des identifiants uniques', new Set(COUNTRIES.map((c) => c.id)).size, 4)
ok('chacune a un drapeau et un nom', COUNTRIES.every((c) => c.flag && c.label))
ok('chacune a sa phrase de bienvenue', COUNTRIES.every((c) => COUNTRY_ANSWERS[c.id]))
ok('la region par defaut existe', COUNTRIES.some((c) => c.id === DEFAULT_COUNTRY))

eq('une region inconnue retombe sur le defaut', safeCountry('xx'), DEFAULT_COUNTRY)
eq('null aussi', safeCountry(null), DEFAULT_COUNTRY)
eq('rien aussi', safeCountry(), DEFAULT_COUNTRY)
eq('une region connue est gardee', safeCountry('af'), 'af')
ok('le libelle porte le drapeau', countryLabel('af').includes('🌍'), countryLabel('af'))
ok('et une region inconnue ne rend pas undefined',
   !countryLabel('xx').includes('undefined'), countryLabel('xx'))

/* --- les cours ----------------------------------------------------------- */
ok('au moins deux cours', COURSES.length >= 2)
eq('des slugs uniques', new Set(COURSES.map((c) => c.slug)).size, COURSES.length)
ok('un cours inconnu rend null', courseBySlug('rien-du-tout') === null)

for (const course of COURSES) {
  const all = lessonsOf(course)
  ok(`${course.slug}: des identifiants de lecon uniques`,
     new Set(all.map((l) => l.id)).size === all.length)
  ok(`${course.slug}: chaque lecon a un titre`, all.every((l) => l.title && l.title.length > 2))
  ok(`${course.slug}: chaque lecon declare son etat`,
     all.every((l) => l.state === 'written' || l.state === 'plan'),
     all.filter((l) => !['written', 'plan'].includes(l.state)).map((l) => l.id).join(', '))

  /**
   * LA VERIFICATION QUI COMPTE VRAIMENT.
   *
   * Une lecon marquee 'written' doit porter de quoi remplir une page. Sans
   * ceci, oublier `points` sur une lecon donne un ecran avec un titre, un
   * sous-titre et rien dessous, ce qui ne leve aucune erreur et ne se voit
   * qu'en ouvrant la bonne lecon sur le bon appareil.
   */
  for (const l of all.filter((x) => x.state === 'written')) {
    const hasBody = Array.isArray(l.points) ? l.points.length >= 2 : Boolean(l.byCountry)
    ok(`${course.slug} ${l.id}: une lecon ecrite a un corps`, hasBody)
    if (Array.isArray(l.points)) {
      ok(`${course.slug} ${l.id}: chaque point a une accroche et un texte`,
         l.points.every((p) => p.lead && p.body))
    }
  }

  /* Une lecon en plan a le droit d'etre courte, mais pas muette: elle porte
     au moins la phrase qui dit de quoi elle parlera. */
  for (const l of all.filter((x) => x.state === 'plan')) {
    ok(`${course.slug} ${l.id}: une lecon en plan annonce quand meme son sujet`,
       Boolean(l.sub))
  }
}

/* --- la navigation ------------------------------------------------------- */
{
  const course = courseBySlug('riche-lentement')
  ok('le cours se retrouve par son slug', Boolean(course))
  const all = lessonsOf(course)

  eq('la premiere lecon n’a pas de precedente', neighbours(course, all[0].id).prev, null)
  eq('la derniere n’a pas de suivante', neighbours(course, all[all.length - 1].id).next, null)

  /* A TRAVERS les modules, pas dans. La derniere lecon du module 0 est suivie
     de la premiere du module 1; une navigation qui s'arrete au bord oblige a
     repasser par le sommaire entre chaque module. */
  const last0 = course.modules[0].lessons[course.modules[0].lessons.length - 1]
  const first1 = course.modules[1].lessons[0]
  eq('la navigation franchit les modules', neighbours(course, last0.id).next?.id, first1.id)
  eq('et dans l’autre sens', neighbours(course, first1.id).prev?.id, last0.id)

  eq('une lecon inconnue n’a ni l’une ni l’autre',
     JSON.stringify(neighbours(course, 'nope')), JSON.stringify({ prev: null, next: null }))
  ok('une lecon se retrouve par son identifiant', lessonById(course, '0.1')?.title.length > 3)
  eq('un identifiant inconnu rend null', lessonById(course, 'nope'), null)
}

/* --- les variantes par pays ---------------------------------------------- */
{
  const course = courseBySlug('investir-101')
  const lesson = lessonById(course, 'i.pays')
  ok('la lecon a geometrie variable existe', Boolean(lesson?.byCountry))
  ok('elle couvre les quatre regions',
     COUNTRIES.every((c) => Boolean(lesson.byCountry[c.id])),
     Object.keys(lesson.byCountry).join(', '))
  ok('chaque version a son Saint-Graal et son premier pas',
     COUNTRIES.every((c) => lesson.byCountry[c.id].grail && lesson.byCountry[c.id].todo))
  ok('elle a un tronc commun avant les variantes', Boolean(lesson.universal))

  eq('la variante suit la region', variantFor(lesson, 'fr').grail.includes('PEA'), true)
  eq('et l’Afrique a la sienne', variantFor(lesson, 'af').grail.includes('SGI'), true)

  /* Un identifiant traine dans localStorage qui survit a un renommage ne doit
     pas rendre une page vide. */
  ok('une region inconnue retombe sur le defaut plutot que sur rien',
     variantFor(lesson, 'zz') === variantFor(lesson, DEFAULT_COUNTRY))

  /* Une lecon ordinaire n'a pas de variantes, et ce n'est pas une erreur. */
  eq('une lecon universelle n’a pas de variante', variantFor(lessonById(course, 'i3.1'), 'ca'), null)
  eq('ni une lecon absente', variantFor(null, 'ca'), null)
}

/* --- l’avancement -------------------------------------------------------- */
{
  const p = progressOf(courseBySlug('riche-lentement'))
  ok('des lecons sont ecrites', p.written > 0)
  ok('et le total est plus grand', p.total >= p.written)
  eq('un cours absent compte zero', progressOf(null).total, 0)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
