/**
 * node src/lib/shelves.test.mjs
 *
 * Les quatre etageres de Lectures, et le bouton qui ouvre un cours.
 *
 * Ce qui est verifie ici est ce qui se voit tout de suite a l'ecran quand
 * c'est faux: un onglet qui n'existe pas et rend une page vide, une etude qui
 * n'apparait sur aucune des deux etageres, un compteur qui ment, un bouton
 * "commencer" qui ouvre une lecon pas encore redigee.
 */
import { DEFAULT_SHELF, SHELVES, safeShelf, shelfCount, studiesOfKind } from './shelves.js'
import { STUDIES } from '../content/studies.js'
import { COURSES } from '../content/courses.js'
import { firstLessonOf, lessonsOf, modulesOf } from './courses.js'

let pass = 0,
  fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`,
  )
}
const ok = (label, cond, why = '') => {
  cond ? pass++ : fail++
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : `  ${why}`}`)
}

// ---- l'etagere lue depuis l'URL --------------------------------------------

eq('les quatre etageres, dans l ordre demande', SHELVES, ['courses', 'articles', 'books', 'studies'])
eq('une etagere connue passe', safeShelf('books'), 'books')

/* La valeur vient de la query string, donc de n'importe ou: un vieux lien, une
   faute de frappe, une cle renommee. Elle doit retomber sur une etagere qui
   existe plutot que de rendre quatre onglets et rien dessous. */
eq('une inconnue retombe sur le defaut', safeShelf('nimportequoi'), DEFAULT_SHELF)
eq('null aussi', safeShelf(null), DEFAULT_SHELF)
eq('undefined aussi', safeShelf(undefined), DEFAULT_SHELF)
eq('et la chaine vide', safeShelf(''), DEFAULT_SHELF)
ok('le defaut est une etagere reelle', SHELVES.includes(DEFAULT_SHELF))

// ---- article et etude ne sont pas la meme chose -----------------------------

const articles = studiesOfKind('article')
const studies = studiesOfKind('study')

ok('il y a au moins un article', articles.length > 0)
ok('et au moins une etude', studies.length > 0)

/**
 * AUCUNE ENTREE NE DOIT DISPARAITRE DES DEUX ETAGERES.
 *
 * C'est l'assertion qui compte le plus ici. Le tri se fait sur un champ ajoute
 * apres coup, donc une entree ecrite plus tard sans `kind`, ou avec une faute
 * dedans, ne rendrait aucune erreur: elle serait simplement introuvable, sur
 * une page qui a l'air de marcher. Le repli sur 'study' existe pour ca et
 * cette ligne verifie qu'il tient.
 */
eq('les deux etageres couvrent tout STUDIES', articles.length + studies.length, STUDIES.length)
ok(
  'et aucune entree n est sur les deux',
  articles.every((a) => !studies.some((s) => s.slug === a.slug)),
)

/* Chaque entree porte le prefixe i18n de sa vignette. Sans lui la vignette
   afficherait la cle brute, "undefined_title", ce qui est visible mais pas
   avant d'avoir ouvert l'onglet. */
for (const s of STUDIES) {
  ok(`${s.slug} a un prefixe de vignette`, typeof s.banner === 'string' && s.banner.length > 0)
  ok(`${s.slug} a une sorte connue`, ['article', 'study'].includes(s.kind ?? 'study'))
}

// ---- les compteurs des onglets ----------------------------------------------

const catalogue = [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]
eq('les livres se comptent depuis le reseau', shelfCount('books', { books: catalogue }), 3)
eq('un catalogue vide compte zero', shelfCount('books'), 0)
eq('les articles', shelfCount('articles'), articles.length)
eq('les etudes', shelfCount('studies'), studies.length)

/* Budget 101 etait compte a part, `COURSES.length + 1`, parce qu'il vivait
   dans un autre fichier avec son propre lecteur. Il est maintenant un cours de
   COURSES comme les autres, donc il est deja dans le compte: l'ajouter une
   deuxieme fois annoncait cinq cours au-dessus de quatre cartes.

   Ancien commentaire, garde parce qu'il dit pourquoi le +1 existait:
   La formation est un cours. Elle vit dans un autre fichier parce qu'elle est
   plus ancienne, ce qui est une raison de structure interne et pas une raison
   de la compter ailleurs. */
eq('le compte des cours est celui de COURSES', shelfCount('courses'), COURSES.length)
eq('une etagere inconnue ne casse pas le compteur', shelfCount('pouet', { books: catalogue }), COURSES.length)

// ---- par ou commence un cours ------------------------------------------------

for (const c of COURSES) {
  const first = firstLessonOf(c)
  const all = lessonsOf(c)

  ok(`${c.slug}: le bouton commencer mene quelque part`, Boolean(first))

  /**
   * LA PREMIERE ECRITE, PAS LA PREMIERE TOUT COURT.
   *
   * Un cours dont le premier module est encore une esquisse ouvrirait sinon
   * sur "cette lecon n'est pas encore redigee", ce qui est la pire premiere
   * page possible pour quelqu'un qui vient d'appuyer sur "commencer".
   */
  eq(`${c.slug}: et elle est redigee`, first.state, 'written')

  /* Dans l'ordre des modules, pas dans celui du fichier. C'est exactement ce
     qui avait fait ouvrir le cours au module 3. */
  const firstWritten = all.find((l) => l.state === 'written')
  eq(`${c.slug}: c est bien la premiere en ordre de lecture`, first.id, firstWritten.id)

  const ns = modulesOf(c).map((m) => Number(m.n))
  eq(`${c.slug}: les modules sont tries`, ns, [...ns].sort((a, b) => a - b))
}

/* Les cas ou il n'y a rien a ouvrir. Le bouton doit disparaitre plutot que de
   mener a undefined. */
eq('un cours sans lecon n a pas de premiere', firstLessonOf({ modules: [] }), null)
eq('ni un cours absent', firstLessonOf(null), null)
eq(
  'un cours entierement en plan ouvre quand meme sa premiere lecon',
  firstLessonOf({ modules: [{ n: 1, lessons: [{ id: 'x.1', state: 'plan' }] }] })?.id,
  'x.1',
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
