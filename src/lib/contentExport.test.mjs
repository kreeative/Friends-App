/**
 * node src/lib/contentExport.test.mjs
 *
 * content.json est genere, commite, et il derive en silence.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le fichier a ete demande pour fabriquer des visuels et des legendes hors de
 * l'application. Il est donc lu par quelqu'un qui n'ouvrira jamais ce depot et
 * qui n'a aucun moyen de savoir qu'il est vieux. Une lecon ajoutee, un titre
 * corrige, une esquisse enfin ecrite: la source change, l'export ne bouge pas,
 * et le contenu publie cite une version qui n'existe plus.
 *
 * Rien n'echoue quand ca arrive. C'est exactement la forme de defaut que ce
 * depot epingle: le fichier est toujours la, toujours valide, toujours faux.
 *
 * CE QUE CE TEST VERIFIE, ET CE QU'IL NE VERIFIE PAS
 *
 * Il compare l'export a la source: les memes lecons, les memes identifiants,
 * les memes titres, les memes etats. Il ne relit pas chaque phrase, parce que
 * la copie est generique et qu'un test qui reecrit la copie ne teste que
 * lui-meme. Ce qui derive, c'est la fraicheur, et c'est ce qui est mesure ici.
 *
 * Quand il tombe: npm run export:content, puis commiter content.json.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { COURSES } from '../content/courses.js'
import { GLOSSARY } from '../content/glossary.js'
import { lessonsOf, modulesOf, say } from './courses.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const PATH = join(root, 'content.json')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\ncontent export')

ok('content.json existe', existsSync(PATH), 'npm run export:content')
if (!existsSync(PATH)) {
  console.log(`  ${pass} passed, ${fail} failed`)
  process.exit(1)
}

const data = JSON.parse(readFileSync(PATH, 'utf8'))

/* --- les memes lecons que la source ---------------------------------------- */

const sourceIds = []
for (const course of COURSES) {
  for (const l of lessonsOf(course)) sourceIds.push(`${course.slug}/${l.id}`)
}
const exportIds = data.lessons.map((l) => `${l.course}/${l.id}`)

ok(
  `autant de lecons qu'a la source (${sourceIds.length})`,
  exportIds.length === sourceIds.length,
  `export ${exportIds.length}, source ${sourceIds.length}. npm run export:content`,
)

const manquantes = sourceIds.filter((id) => !exportIds.includes(id))
ok('aucune lecon manquante', manquantes.length === 0, manquantes.join(' '))

const enTrop = exportIds.filter((id) => !sourceIds.includes(id))
ok('aucune lecon fantome', enTrop.length === 0, enTrop.join(' '))

/* --- et le meme texte, la ou il compte -------------------------------------- */

const byId = new Map(data.lessons.map((l) => [`${l.course}/${l.id}`, l]))
const titresFaux = []
const etatsFaux = []
for (const course of COURSES) {
  for (const l of lessonsOf(course)) {
    const e = byId.get(`${course.slug}/${l.id}`)
    if (!e) continue
    if (e.title?.fr !== say(l.title, 'fr')) titresFaux.push(l.id)
    if (e.state !== (l.state ?? 'written')) etatsFaux.push(l.id)
  }
}
ok('les titres sont a jour', titresFaux.length === 0, `${titresFaux.join(' ')} — npm run export:content`)
ok('les etats sont a jour', etatsFaux.length === 0, `${etatsFaux.join(' ')} — npm run export:content`)

/* --- les comptes annonces sont les vrais ------------------------------------ */

const modules = COURSES.reduce((n, c) => n + modulesOf(c).length, 0)
ok('le compte de cours est juste', data.meta.counts.courses === COURSES.length)
ok('le compte de modules est juste', data.meta.counts.modules === modules,
   `${data.meta.counts.modules} vs ${modules}`)
ok('le compte de lecons est juste', data.meta.counts.lessons === sourceIds.length)
ok('le compte de phrases correspond au contenu',
   data.meta.counts.sentences === data.lessons.reduce((n, l) => n + l.text.length, 0))
ok('le lexique est complet', Object.keys(data.glossary).length === Object.keys(GLOSSARY).length,
   `${Object.keys(data.glossary).length} vs ${Object.keys(GLOSSARY).length}`)

/* --- ce qui rend le fichier utilisable hors de l'app ------------------------ */

ok('une esquisse est reconnaissable',
   data.lessons.some((l) => l.state === 'plan') && /plan/.test(data.meta.note_state ?? ''),
   'publier une esquisse comme une lecon promet un texte qui n existe pas')
ok('une esquisse ne porte pas de faux corps',
   data.lessons.filter((l) => l.state === 'plan').every((l) => l.text.length <= 2),
   'un titre et une promesse, rien dessous')
ok('les phrases portent leur role',
   data.lessons.every((l) => l.text.every((t) => typeof t.role === 'string' && t.role.length > 0)))
ok('les deux langues sont la',
   data.lessons.every((l) => l.text.every((t) => 'fr' in t && 'en' in t)))
ok('la bonne reponse du quiz est marquee',
   data.lessons.some((l) => l.text.some((t) => t.role === 'quiz_option' && t.correct === true)),
   'une question sans sa reponse ne sert a rien hors de l application')
ok('les termes cites existent dans le lexique',
   data.lessons.every((l) => (l.terms ?? []).every((id) => id in data.glossary)),
   'sinon terms est une reference morte dans le fichier')
ok('rien ne s est aplati en [object Object]',
   !readFileSync(PATH, 'utf8').includes('[object Object]'))

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
