/**
 * node src/lib/glossary.test.mjs
 *
 * Les mots des cours, et la jointure entre une lecon et leur definition.
 *
 * CE QUI EST VERIFIE ICI EST CE QU'AUCUNE RELECTURE NE VOIT
 *
 * Une lecon porte des IDENTIFIANTS. Une faute de frappe dans un identifiant ne
 * casse rien, ne leve rien, et rend simplement un mot de moins au bas d'une
 * page que personne ne relit avec la liste a cote. C'est le genre de defaut
 * qui vit des mois. Le test le rend impossible.
 *
 * Et deux regles de redaction sont verifiees plutot que promises: une
 * definition tient en deux phrases, et le lexique ne contient pas deux fois le
 * meme mot sous deux identifiants.
 */
import { GLOSSARY } from '../content/glossary.js'
import { COURSES } from '../content/courses.js'
import { lessonsOf } from './courses.js'
import { courseTerms, inRegion, resolveTerms, termsFor } from './glossary.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, got, want) =>
  ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

console.log('\nglossary')

const ids = Object.keys(GLOSSARY)
ok(`le lexique a des entrees (${ids.length})`, ids.length >= 30, String(ids.length))

/* --- chaque entree est complete, dans les deux langues --------------------- */

for (const id of ids) {
  const e = GLOSSARY[id]
  ok(`${id}: un terme en francais et en anglais`,
     typeof e.term?.fr === 'string' && e.term.fr.trim().length > 0 &&
     typeof e.term?.en === 'string' && e.term.en.trim().length > 0,
     JSON.stringify(e.term))
  ok(`${id}: une definition dans les deux langues`,
     typeof e.short?.fr === 'string' && e.short.fr.trim().length > 0 &&
     typeof e.short?.en === 'string' && e.short.en.trim().length > 0,
     JSON.stringify(e.short))
  /**
   * DEUX PHRASES AU PLUS.
   *
   * Un lexique se lit en diagonale au moment ou le mot bloque. Un paragraphe
   * par entree ne se lit pas, il se saute, et le mot reste inconnu. La limite
   * est mesuree plutot que recommandee, sinon la troisieme phrase arrive a la
   * prochaine relecture.
   */
  for (const loc of ['fr', 'en']) {
    const sentences = e.short[loc].split(/[.!?]\s/).filter((x) => x.trim().length > 0).length
    ok(`${id} (${loc}): ${sentences} phrase(s), pas plus de deux`, sentences <= 2, e.short[loc])
    ok(`${id} (${loc}): moins de 220 caracteres`, e.short[loc].length <= 220, String(e.short[loc].length))
  }
  if (e.only) {
    ok(`${id}: les regions de "only" existent`,
       Array.isArray(e.only) && e.only.every((c) => ['ca', 'fr', 'us', 'af'].includes(c)),
       JSON.stringify(e.only))
  }
}

/**
 * LE FRANCAIS GARDE SES ACCENTS.
 *
 * La premiere version de ce lexique a ete ecrite sans accents, par habitude
 * prise sur les migrations SQL, ou l'ASCII est une regle parce que le texte
 * voyage par un presse-papier. Ici il ne voyage nulle part: il s'affiche a
 * quelqu'un qui lit en francais, et "La hausse generale des prix" s'est vu sur
 * la premiere capture d'ecran.
 *
 * Le test cherche les formes fautives plutot que l'absence d'accent, parce que
 * beaucoup de phrases correctes n'en portent aucun: "Un morceau d'une
 * entreprise" n'a rien a corriger. Chaque mot de cette liste est un mot qui a
 * ete trouve sans accent dans une version de ce fichier.
 */
{
  /* Uniquement des formes qui ne sont PAS des mots francais sans leur accent.
     La premiere version listait "rapporte" et "marche", qui sont deux verbes
     parfaitement corrects ("ce qu'il rapporte", "ca marche"): elle signalait
     trois phrases justes. Un test qui crie sur du texte correct finit par etre
     ignore, ce qui est pire que pas de test. */
  const WRONG = /\b(periodique|annee|annees|meme|cout|coute|interet|interets|credit|epargne|depense|depenses|reduit|eleve|elevee|debut|apres|tres|deja|etre|premiere|derniere|regle|penalite|verification|americain|francais|europeennes|impot|impots|zero|role|facon|categorie|arrete|releve|delai|grace|decennie|arithmetique|methode|imprevu|probleme|possedes|echec|repere|intermediaire|different|differents|separee|achete|achetes|generale|opportunite|benefices|volatilite|preleve|prelevee|penalites)\b/
  const bad = []
  for (const id of ids) {
    for (const field of ['term', 'short']) {
      const m = GLOSSARY[id][field].fr.match(WRONG)
      if (m) bad.push(`${id}.${field}: "${m[0]}"`)
    }
  }
  ok('le francais du lexique garde ses accents', bad.length === 0, bad.join(', '))
}

/* Pas deux identifiants pour le meme mot: ce serait deux definitions a tenir
   d'accord, ce que le fichier promet justement d'eviter. */
{
  const seen = new Map()
  const dupes = []
  for (const id of ids) {
    const key = GLOSSARY[id].term.fr.toLowerCase()
    if (seen.has(key)) dupes.push(`${id} et ${seen.get(key)}`)
    seen.set(key, id)
  }
  ok('aucun terme francais en double', dupes.length === 0, dupes.join(', '))
}

/* --- ce que les lecons demandent existe ------------------------------------ */

/**
 * LA VRAIE RAISON DE CE FICHIER.
 *
 * resolveTerms ignore un identifiant inconnu plutot que de rendre une case
 * vide, ce qui est le bon comportement a l'ecran et le mauvais silence a
 * l'ecriture. Ici on le rompt: un identifiant qu'aucune entree ne porte est
 * une erreur, nommee, avec la lecon qui la demande.
 */
{
  const unknown = []
  const used = new Set()
  let lessonsWithTerms = 0
  for (const course of COURSES) {
    for (const lesson of lessonsOf(course)) {
      if (!lesson.terms) continue
      lessonsWithTerms += 1
      if (lesson.terms === 'course') continue
      ok(`${course.slug}/${lesson.id}: terms est une liste ou 'course'`,
         Array.isArray(lesson.terms), JSON.stringify(lesson.terms))
      for (const id of lesson.terms ?? []) {
        used.add(id)
        if (!GLOSSARY[id]) unknown.push(`${course.slug}/${lesson.id} -> ${id}`)
      }
    }
  }
  ok('aucune lecon ne demande un mot qui n’existe pas', unknown.length === 0, unknown.join(', '))
  ok(`des lecons portent des mots (${lessonsWithTerms})`, lessonsWithTerms >= 20, String(lessonsWithTerms))

  /* L'inverse: une entree que personne n'emploie est du texte ecrit pour rien,
     et surtout un mot que le lecteur ne verra jamais. */
  const orphans = ids.filter((id) => !used.has(id))
  ok('aucune entree n’est orpheline', orphans.length === 0, orphans.join(', '))
}

/* Les mots ne sont poses que sur des lecons redigees: en mettre sur une
   esquisse promet une page qui dit "pas encore redigee". */
{
  const onPlans = []
  for (const course of COURSES) {
    for (const lesson of lessonsOf(course)) {
      if (lesson.terms && lesson.state !== 'written') onPlans.push(`${course.slug}/${lesson.id}`)
    }
  }
  ok('aucun mot sur une lecon non redigee', onPlans.length === 0, onPlans.join(', '))
}

/* --- la resolution --------------------------------------------------------- */

eq('une liste vide rend une liste vide', resolveTerms([], 'ca').length, 0)
eq('undefined aussi', resolveTerms(undefined, 'ca').length, 0)
eq('un identifiant inconnu est ignore, pas rendu vide',
   resolveTerms(['inflation', 'nawak'], 'ca').length, 1)
eq('l’ordre ecrit est garde',
   resolveTerms(['fnb', 'inflation'], 'ca').map((e) => e.id).join(','), 'fnb,inflation')
ok('et l’entree porte son identifiant', resolveTerms(['inflation'], 'ca')[0].id === 'inflation')

/* --- la region -------------------------------------------------------------- */

ok('une entree sans "only" vaut partout', inRegion(GLOSSARY.inflation, 'fr'))
ok('le CELI vaut au Canada', inRegion(GLOSSARY.celi, 'ca'))
ok('et pas en France', !inRegion(GLOSSARY.celi, 'fr'))
ok('le PEA vaut en France', inRegion(GLOSSARY.pea, 'fr'))
ok('et pas au Canada', !inRegion(GLOSSARY.pea, 'ca'))
ok('une region inconnue retombe sur la region par defaut, pas sur du vide',
   inRegion(GLOSSARY.celi, 'mars'))

/**
 * LA LECON DES ENVELOPPES, VUE DE QUATRE PAYS.
 *
 * C'est le cas qui justifie `only`: elle nomme huit comptes, dont quatre au
 * plus concernent le lecteur. Chaque region doit en voir les siens et les deux
 * mots universels, jamais ceux des autres.
 */
{
  const inv = COURSES.find((c) => c.slug === 'investir-101')
  const lesson = lessonsOf(inv).find((l) => l.id === 'i1.4')
  ok('la lecon des enveloppes porte des mots', Array.isArray(lesson?.terms))
  const ca = termsFor(lesson, inv, 'ca').map((e) => e.id)
  const fr = termsFor(lesson, inv, 'fr').map((e) => e.id)
  const us = termsFor(lesson, inv, 'us').map((e) => e.id)
  const af = termsFor(lesson, inv, 'af').map((e) => e.id)
  ok('le Canada voit le CELI et le REER', ca.includes('celi') && ca.includes('reer'), ca.join(','))
  ok('et pas le PEA', !ca.includes('pea'), ca.join(','))
  ok('la France voit le PEA et l’assurance-vie',
     fr.includes('pea') && fr.includes('assurance-vie'), fr.join(','))
  ok('les Etats-Unis voient le 401(k) et le Roth IRA',
     us.includes('401k') && us.includes('roth-ira'), us.join(','))
  ok('les quatre regions voient les mots universels',
     [ca, fr, us, af].every((l) => l.includes('plafond-de-cotisation')),
     JSON.stringify({ ca, fr, us, af }))
  ok('et l’Afrique ne recite aucun compte etranger',
     !af.some((id) => ['celi', 'reer', 'pea', 'assurance-vie', '401k', 'roth-ira'].includes(id)),
     af.join(','))
}

/* --- le lexique du cours ---------------------------------------------------- */

/**
 * `terms: 'course'` sur la derniere lecon rend tous les mots du cours.
 *
 * Sans doublon, dans l'ordre des lecons, et sans se compter lui-meme: la
 * derniere lecon ne doit pas apparaitre comme une source de mots, sinon la
 * fonction s'appelle sur elle-meme en cherchant sa propre liste.
 */
for (const slug of ['investir-101', 'carte-de-credit', 'budget-101']) {
  const course = COURSES.find((c) => c.slug === slug)
  const recap = lessonsOf(course).find((l) => l.terms === 'course')
  ok(`${slug}: une lecon est le lexique du cours`, Boolean(recap), 'terms: "course"')
  const all = termsFor(recap, course, 'ca')
  const idsOut = all.map((e) => e.id)
  ok(`${slug}: le lexique rend des mots (${idsOut.length})`, idsOut.length >= 5, idsOut.join(','))
  ok(`${slug}: sans doublon`, new Set(idsOut).size === idsOut.length, idsOut.join(','))

  /* Chaque mot cite par une lecon du cours doit s'y retrouver, sinon le recap
     ment sur ce qu'il recapitule. */
  const wanted = new Set()
  for (const l of lessonsOf(course)) {
    if (l.terms === 'course') continue
    for (const id of l.terms ?? []) {
      if (GLOSSARY[id] && inRegion(GLOSSARY[id], 'ca')) wanted.add(id)
    }
  }
  ok(`${slug}: il contient tout ce que le cours a nomme`,
     [...wanted].every((id) => idsOut.includes(id)),
     [...wanted].filter((id) => !idsOut.includes(id)).join(','))
  /* Et l'ordre est celui de la lecture, pas celui du fichier du lexique. */
  ok(`${slug}: dans l’ordre des lecons`, idsOut[0] === [...wanted][0], `${idsOut[0]} vs ${[...wanted][0]}`)
}

/* Le lexique d'un cours suit la region comme les lecons. */
{
  const inv = COURSES.find((c) => c.slug === 'investir-101')
  const ca = courseTerms(inv, 'ca').map((e) => e.id)
  const fr = courseTerms(inv, 'fr').map((e) => e.id)
  ok('le lexique du cours filtre aussi par region',
     ca.includes('celi') && !ca.includes('pea') && fr.includes('pea') && !fr.includes('celi'),
     JSON.stringify({ ca: ca.length, fr: fr.length }))
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
