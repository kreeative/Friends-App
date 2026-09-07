/**
 * node src/lib/inlineTerms.test.mjs
 *
 * Reconnaitre un terme dans une phrase, sans abimer la phrase.
 *
 * CE QUI PEUT MAL TOURNER ICI, ET QUI NE SE VOIT PAS
 *
 * Cette reconnaissance decoupe du texte avec des expressions regulieres, puis
 * le recolle a l'ecran. Une erreur de bornes ne leve rien: elle mange une
 * lettre, duplique un morceau de phrase, ou souligne le mauvais mot. Personne
 * ne relit les quatre cours a chaque changement de motif.
 *
 * Donc l'invariant d'abord: sur CHAQUE phrase des cours, le texte recolle doit
 * etre identique au texte de depart. C'est le test qui attrape tout le reste.
 */
import { GLOSSARY } from '../content/glossary.js'
import { COURSES } from '../content/courses.js'
import { lessonsOf, say } from './courses.js'
import { splitTerms, hasTerms } from './inlineTerms.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const join = (segs) => segs.map((s) => s.text).join('')
const idsOf = (segs) => segs.filter((s) => s.id).map((s) => s.id)

console.log('\ninline terms')

/* --- les motifs compilent, dans les deux langues --------------------------- */

for (const [id, entry] of Object.entries(GLOSSARY)) {
  ok(`${id}: porte un motif`, Boolean(entry.match), JSON.stringify(entry.match))
  for (const loc of ['fr', 'en']) {
    const src = entry.match?.[loc]
    ok(`${id} (${loc}): le motif existe`, typeof src === 'string' && src.length > 0, String(src))
    let compiled = true
    try {
      new RegExp(src, 'iu')
    } catch (e) {
      compiled = false
      ok(`${id} (${loc}): le motif compile`, false, e.message)
    }
    if (compiled) pass += 1
  }
}

/* --- L'INVARIANT: rien n'est perdu ni duplique ------------------------------ */

/**
 * Sur toutes les phrases des quatre cours, dans les deux langues et pour les
 * quatre regions. C'est long a ecrire en une ligne et c'est le test qui vaut
 * tous les autres: une expression qui mange une lettre est trouvee ici, sur la
 * phrase exacte ou elle la mange.
 */
{
  let checked = 0
  const broken = []
  for (const course of COURSES) {
    for (const lesson of lessonsOf(course)) {
      if (lesson.state !== 'written') continue
      for (const locale of ['fr', 'en']) {
        for (const country of ['ca', 'fr', 'us', 'af']) {
          const used = new Set()
          const fields = [
            lesson.objective, lesson.universal, lesson.metaphor,
            lesson.reflection, lesson.todo,
            ...(lesson.points ?? []).flatMap((p) => [p.lead, p.body]),
          ]
          for (const f of fields) {
            const text = say(f, locale)
            if (!text) continue
            checked += 1
            const segs = splitTerms(text, { locale, country, used })
            if (join(segs) !== text) {
              broken.push(`${course.slug}/${lesson.id} ${locale}/${country}: "${text.slice(0, 60)}"`)
            }
          }
        }
      }
    }
  }
  ok(`le texte recolle est identique au texte de depart (${checked} phrases)`,
     broken.length === 0, broken.slice(0, 3).join(' | '))
  ok(`et il y avait bien du texte a verifier`, checked > 500, String(checked))
}

/* --- ce qui doit etre reconnu ----------------------------------------------- */

const seg1 = (text, opts) => splitTerms(text, { locale: 'fr', country: 'ca', ...opts })

ok('inflation est reconnue', idsOf(seg1('Ton argent perd a cause de l’inflation.')).includes('inflation'))
ok('FNB aussi', idsOf(seg1('Un FNB contient des centaines d’actions.')).includes('fnb'))
ok('et le mot demande explicitement, taxes',
   idsOf(seg1('Ce compte change ce que tu paies en taxes.')).includes('taxes'))
ok('impots aussi, c’est la meme entree',
   idsOf(seg1('Tu paieras l’impot au retrait.')).includes('taxes'))
ok('lump sum, en francais, c’est "d’un coup"',
   idsOf(seg1('Investir une somme d’un coup ou l’etaler.')).includes('lump-sum'))
ok('et en anglais',
   idsOf(splitTerms('A lump sum beats spreading it out.', { locale: 'en' })).includes('lump-sum'))

/**
 * L'APOSTROPHE TYPOGRAPHIQUE.
 *
 * Le contenu emploie U+2019 et les motifs sont ecrits avec une apostrophe
 * droite. Sans la substitution faite dans patternOf, "coût d’opportunité" ne
 * serait jamais reconnu, et rien ne le dirait: la page s'afficherait, sans le
 * mot souligne.
 */
ok('l’apostrophe typographique est reconnue',
   idsOf(seg1('Le coût d’opportunité de cet achat.')).includes('cout-d-opportunite'),
   'U+2019 dans le contenu, apostrophe droite dans le motif')
ok('et l’apostrophe droite aussi',
   idsOf(seg1("Le coût d'opportunité de cet achat.")).includes('cout-d-opportunite'))

/* Les lettres accentuees sont des lettres: "marche" ne doit pas etre coupe. */
{
  const segs = seg1('Un marché baissier dure des mois.')
  ok('un terme accentue est pris en entier',
     segs.some((s) => s.id === 'marche-baissier' && s.text === 'marché baissier'),
     JSON.stringify(segs.map((s) => s.text)))
}

/* --- ce qui ne doit PAS etre reconnu ---------------------------------------- */

/**
 * Les pieges connus. Chacun est un mot francais courant qui ressemble a un
 * terme financier, et chacun ferait souligner une phrase ordinaire.
 */
ok('"action" au singulier n’est pas une action en bourse',
   !idsOf(seg1('Passe a l’action dès demain.')).includes('action'),
   'le motif demande le pluriel, parce que "action" seul est un mot courant')
ok('un mot plus long n’est pas attrape par un plus court',
   !idsOf(seg1('Ses inflations verbales.')).includes('inflation'),
   'la borne de droite refuse une lettre qui suit')
ok('et un mot qui commence pareil non plus',
   !idsOf(seg1('Le soldat rentre chez lui.')).includes('solde'))

/* --- chevauchement: le plus long gagne -------------------------------------- */

/**
 * "transfert de solde" contient "solde". Reconnaitre le court laisserait le
 * long a moitie souligne, ce qui se lit comme un bogue plutot que comme un
 * lien.
 */
{
  const segs = seg1('Un transfert de solde vers une autre carte.')
  const ids = idsOf(segs)
  ok('le terme long gagne sur le court qu’il contient',
     ids.includes('transfert-de-solde'), ids.join(', '))
  ok('et le court n’apparait pas en plus', !ids.includes('solde'), ids.join(', '))
  ok('le texte reste intact', join(segs) === 'Un transfert de solde vers une autre carte.')
}

/* --- une seule fois par lecon ----------------------------------------------- */

{
  const used = new Set()
  const a = seg1('L’inflation ronge l’argent qui dort.', { used })
  const b = seg1('Et l’inflation continue l’annee suivante.', { used })
  ok('le premier paragraphe explique le mot', idsOf(a).includes('inflation'))
  ok('le second ne le re-souligne pas', !idsOf(b).includes('inflation'),
     'huit "inflation" soulignes feraient une page de liens')
  ok('mais son texte est rendu en entier',
     join(b) === 'Et l’inflation continue l’annee suivante.')
}

/* --- la region --------------------------------------------------------------- */

ok('le CELI est reconnu au Canada',
   idsOf(splitTerms('Ouvre un CELI en premier.', { locale: 'fr', country: 'ca' })).includes('celi'))
ok('et pas en France',
   !idsOf(splitTerms('Ouvre un CELI en premier.', { locale: 'fr', country: 'fr' })).includes('celi'),
   'un mot qui ne concerne pas le lecteur est du bruit, meme souligne')
ok('le PEA est reconnu en France',
   idsOf(splitTerms('Ouvre un PEA en premier.', { locale: 'fr', country: 'fr' })).includes('pea'))

/* --- les bords ---------------------------------------------------------------- */

ok('une chaine vide rend un segment vide', join(splitTerms('')) === '')
ok('undefined ne casse pas', join(splitTerms(undefined)) === '')
ok('un texte sans aucun terme est rendu tel quel',
   join(seg1('Le chat dort sur le tapis.')) === 'Le chat dort sur le tapis.')
ok('et hasTerms le dit', hasTerms('Le chat dort sur le tapis.', { locale: 'fr' }) === false)
ok('hasTerms dit oui quand il y en a un', hasTerms('Parlons d’inflation.', { locale: 'fr' }) === true)
ok('hasTerms ne consomme pas le mot pour la suite',
   hasTerms('Parlons d’inflation.', { locale: 'fr' }) &&
     hasTerms('Parlons d’inflation.', { locale: 'fr' }),
   'il travaille sur une copie du Set, sinon deux appels donnent deux reponses')

/* --- ce que ca donne sur les vrais cours -------------------------------------- */

/**
 * Une mesure de couverture plutot qu'une promesse: si un jour un motif casse,
 * ce chiffre s'effondre et le test le dit, meme si toutes les assertions
 * ci-dessus continuent de passer sur leurs phrases inventees.
 */
{
  let marked = 0
  for (const course of COURSES) {
    for (const lesson of lessonsOf(course)) {
      if (lesson.state !== 'written') continue
      const used = new Set()
      const fields = [
        lesson.objective, lesson.universal, lesson.metaphor, lesson.reflection, lesson.todo,
        ...(lesson.points ?? []).flatMap((p) => [p.lead, p.body]),
      ]
      for (const f of fields) marked += idsOf(splitTerms(say(f, 'fr'), { locale: 'fr', used })).length
    }
  }
  ok(`les cours expliquent des mots dans leur texte (${marked})`, marked >= 50, String(marked))
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
