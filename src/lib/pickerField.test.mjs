/**
 * node src/lib/pickerField.test.mjs
 *
 * The cross beside a date or a time field, and the three lines that make it
 * actually erase something.
 *
 * WHAT WAS MEASURED, BEFORE ANY OF THIS WAS WRITTEN.
 *
 * "Tu as mis la croix mais ca supprime rien." In headless Chromium at 390px,
 * with a real touch event rather than a mouse click:
 *
 *   avant le tap   valeur=2026-09-07  focus=body
 *   apres le tap   valeur=''          focus=input[type=date]   <- ici
 *   puis le selecteur repose une date et se ferme
 *                  valeur=2026-09-07  la croix est revenue
 *
 * The middle line is the whole thing. Every field on these forms is wrapped in
 * a <label> by Field, a label forwards a tap to the control it labels, and the
 * control here is the date input. So the cross emptied the value and the same
 * tap opened the native picker over the field it had just emptied; the blur
 * handler, which exists to adopt whatever a picker did, then adopted the date
 * the picker was still holding and put it back.
 *
 * WHAT THIS FILE CAN AND CANNOT DO.
 *
 * It cannot open a picker or forward a tap. The real check was a browser, as
 * CLAUDE.md asks, and it is in the probe. What survives here is the contract
 * that fix depends on, because the realistic regression is not subtlety: it is
 * somebody reading `e.preventDefault()` in a click handler as noise and
 * removing it, or simplifying the blur guard back to the one-liner it was.
 * Each of these three lines looks removable and none of them is.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/* The same file with its comments gone. Every claim below would otherwise
   match the comment that explains it and pass against a broken file. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\npicker field')

const ui = code('src/components/ui.jsx')

/* Le composant, et le bloc qui nous interesse. */
const at = ui.indexOf('export function PickerField')
ok('PickerField existe toujours', at >= 0)
const picker = at >= 0 ? ui.slice(at, ui.indexOf('\nexport ', at + 10)) : ''

/* --- 1. le clic ne doit pas remonter au <label> ------------------------- */

ok(
  'la croix annule l action par defaut de son clic',
  /e\.preventDefault\(\)/.test(picker),
  "sans elle le <label> transmet le tap au champ et le selecteur natif s'ouvre sur le champ qu'on vient de vider",
)
ok(
  "et n'ebruite pas le clic plus haut",
  /e\.stopPropagation\(\)/.test(picker),
)

/* --- 2. le flou qui suit ne doit rien adopter --------------------------- */

ok(
  'un drapeau marque le vidage',
  /justCleared/.test(picker),
  "le flou existe pour adopter ce qu'un selecteur a fait et ne sait pas distinguer celui que le label vient d'ouvrir",
)
ok(
  'le drapeau est pose par la croix',
  /justCleared\.current = true/.test(picker),
)
ok(
  'et depense une seule fois',
  /justCleared\.current = false/.test(picker),
  'un drapeau qui reste leve ferait ignorer la date suivante, choisie expres',
)
ok(
  'un vrai changement le baisse aussi',
  /onChange=\{\(e\) => \{\s*justCleared\.current = false/.test(picker),
  "sinon un choix delibere apres un vidage serait avale par le flou d'apres",
)

/* --- 3. le champ du DOM est remis en accord avec React ------------------ */

ok(
  'refuser une valeur remet aussi la boite en accord',
  /e\.target\.value = value/.test(picker),
  "un selecteur peut ecrire sans evenement: le DOM garderait la date sous un champ que React croit vide, et un champ controle ne repeint que si l'etat change",
)
ok(
  'le champ est relache apres le vidage',
  /input\.current\?\.blur\(\)/.test(picker),
  'rien de deja ouvert ne doit pouvoir valider dans un champ ou personne ne se trouve',
)

/* --- et ce que le correctif ne doit pas avoir casse --------------------- */

ok(
  "le flou adopte toujours ce qu'un selecteur a fait",
  /if \(e\.target\.value !== value\) onChange\(e\.target\.value\)/.test(picker),
  "c'est le cas pour lequel il a ete ecrit: le Reset de Safari vide le champ sans prevenir React",
)
ok(
  'la croix ne parait que quand il y a quelque chose a effacer',
  /\{value && \(/.test(picker),
)

/* --- Field enveloppe toujours dans un <label>, ce qui est la cause ------ */

ok(
  'Field est bien un <label>, ce qui est pourquoi tout ce qui precede existe',
  /export function Field[\s\S]{0,200}<label/.test(ui),
  "si un jour Field cesse d'etre un label, relire ce fichier avant de simplifier PickerField",
)

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
