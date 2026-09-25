/**
 * node src/lib/moods.test.mjs
 *
 * The assertions that matter are the ones about `primaryMood`. daily_mood.mood
 * is `not null` and has been read as a single value by the week strip and the
 * group board since migration 12, so the array has to keep feeding it a
 * sensible answer or those two screens go blank for anybody who picks more
 * than one face.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  MAX_MOODS,
  MOODS,
  MOOD_IDS,
  MOOD_MOTION,
  cleanMoods,
  moodById,
  motionOf,
  primaryMood,
  toggleMood,
} from './moods.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nmoods')

/* --- the catalogue ------------------------------------------------------ */
/* NOT A COUNT. This said 15, and it failed the day two moods were added,
   which is a test reporting a correct app as broken. The number was never the
   property worth guarding: what matters is that the cap is the whole catalogue
   however big that is, and that everything in it is well formed. Same lesson
   as the probe that asserted "six modules" and broke on a seventh lesson. */
ok('there is a catalogue at all', MOODS.length > 0)
eq('and the cap is all of it', MAX_MOODS, MOODS.length)
ok('every id is unique', new Set(MOOD_IDS).size === MOODS.length)
/* The bands are gone. Nothing carries a `group` any more, and a leftover one
   on a single entry would be a heading waiting to come back. */
ok('nothing carries a band any more', MOODS.every((m) => !('group' in m)))
ok('every one has a colour', MOODS.every((m) => /^#[0-9A-F]{6}$/i.test(m.color)))
/* Closed, and starting from a move. Not a length: the triangle is a perfectly
   good fourteen characters and an arbitrary floor failed it. */
ok(
  'every one has a closed shape',
  MOODS.every((m) => typeof m.path === 'string' && /^M/.test(m.path) && /Z$/i.test(m.path.trim())),
)
ok('every one has a face', MOODS.every((m) => m.eyes && m.mouth))
ok('the colours are distinct', new Set(MOODS.map((m) => m.color)).size === MOODS.length)
ok('and so are the shapes', new Set(MOODS.map((m) => m.path)).size === MOODS.length)

/* The three added with multi-select, and the twelve that must survive it:
   every one of these ids may already be sitting in somebody's database. */
for (const id of ['excited', 'joyful', 'grateful', 'energized', 'sensitive', 'confused',
                  'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty']) {
  ok(`the original ${id} still exists`, MOOD_IDS.includes(id))
}
for (const id of ['serene', 'neutral', 'nostalgic', 'sad', 'discouraged']) {
  ok(`${id} was added`, MOOD_IDS.includes(id))
  ok(`and ${id} can be drawn`, moodById(id) !== null)
}

/* WHERE the two newest sit, which is not cosmetic.
   cleanMoods sorts by catalogue order, so position decides which face is drawn
   first and which one primaryMood hands to the group board. Put at the end of
   the file, `sad` would sort after `guilty`, and a day tagged sad and stressed
   would show the group the stressed face. */
ok('sad and discouraged sit in the second half of the run',
   MOOD_IDS.indexOf('sad') > MOOD_IDS.length / 2 &&
   MOOD_IDS.indexOf('discouraged') > MOOD_IDS.length / 2,
   `sad ${MOOD_IDS.indexOf('sad')}, discouraged ${MOOD_IDS.indexOf('discouraged')} of ${MOOD_IDS.length}`)
eq('and a hard day picks the earlier of two hard faces',
   primaryMood(['sad', 'discouraged']), 'discouraged')

/* --- the gradient -------------------------------------------------------- */

/**
 * ONE RUN, BRIGHTEST TO HARDEST.
 *
 * This is not decoration. cleanMoods sorts by catalogue position, so the order
 * decides which badge is drawn first and which id primaryMood puts in
 * daily_mood.mood, and that column is the single face the group board and the
 * week strip draw for a whole day.
 *
 * The assertions below are about the SHAPE of the run rather than its exact
 * sequence: pinning all seventeen ids in order would fail on any future
 * insertion, which is the mistake the count assertions above already made
 * once. What has to stay true is that it starts bright, ends hard, and never
 * puts a hard face ahead of a bright one.
 */
const at = (id) => MOOD_IDS.indexOf(id)

eq('it opens on the brightest thing in the set', MOOD_IDS[0], 'joyful')
ok('and ends somewhere hard', ['guilty', 'hurt', 'sad'].includes(MOOD_IDS[MOOD_IDS.length - 1]),
   MOOD_IDS[MOOD_IDS.length - 1])

/* Pairs that must never swap. Each one is a claim somebody could get wrong by
   dropping a new mood at the end of the file, which is the easy edit. */
for (const [brighter, harder] of [
  ['joyful', 'neutral'],
  ['energized', 'bored'],
  ['grateful', 'sad'],
  ['serene', 'stressed'],
  ['neutral', 'angry'],
  ['nostalgic', 'discouraged'],
  ['sensitive', 'hurt'],
  ['bored', 'guilty'],
]) {
  ok(`${brighter} comes before ${harder}`, at(brighter) < at(harder),
     `${at(brighter)} vs ${at(harder)}`)
}

/* The consequence, stated as behaviour rather than as indices: pick one of
   each and the brighter one is what the group sees. */
eq('a bright day beside a hard one shows the bright face',
   primaryMood(['guilty', 'joyful']), 'joyful')
eq('and that holds for the two newest', primaryMood(['sad', 'serene']), 'serene')

eq('an unknown id has no mood', moodById('wibble'), null)
eq('null has no mood', moodById(null), null)

/* --- cleanMoods --------------------------------------------------------- */
eq('a good list survives', cleanMoods(['joyful', 'stressed']), ['joyful', 'stressed'])
eq('order is the catalogue, not the tap order', cleanMoods(['stressed', 'joyful']), ['joyful', 'stressed'])
/* And the catalogue runs good -> middle -> hard, so a mixed day draws the
   kinder face first and hands that one to the group board. */
eq('a mixed day leads with the better half', cleanMoods(['stressed', 'serene']), ['serene', 'stressed'])
eq('and the primary follows', primaryMood(['stressed', 'serene']), 'serene')
eq('unknown ids are dropped', cleanMoods(['joyful', 'wibble']), ['joyful'])
eq('duplicates collapse', cleanMoods(['joyful', 'joyful']), ['joyful'])
eq('null is empty', cleanMoods(null), [])
eq('an object is empty', cleanMoods({ 0: 'joyful' }), [])
eq('junk inside is dropped', cleanMoods([null, 42, {}, 'joyful']), ['joyful'])

/* A single string is what every row written before this migration holds, and
   what daily_mood.mood still holds today. It has to read as a list of one. */
eq('a bare string is read as one mood', cleanMoods('joyful'), ['joyful'])
eq('and a bare unknown string is empty', cleanMoods('wibble'), [])
eq('an empty string is empty', cleanMoods(''), [])

/* --- toggleMood --------------------------------------------------------- */
eq('tapping an unselected one adds it', toggleMood([], 'joyful'), ['joyful'])
eq('tapping it again removes it', toggleMood(['joyful'], 'joyful'), [])
eq('two at once, which is the whole request', toggleMood(['joyful'], 'excited'), ['joyful', 'excited'])
eq('removing leaves the rest', toggleMood(['joyful', 'excited', 'stressed'], 'excited'), ['joyful', 'stressed'])
eq('an unknown id changes nothing', toggleMood(['joyful'], 'wibble'), ['joyful'])
eq('toggling on null works', toggleMood(null, 'joyful'), ['joyful'])
eq('and cleans as it goes', toggleMood(['wibble', 'joyful'], 'stressed'), ['joyful', 'stressed'])
{
  let list = []
  for (const id of MOOD_IDS) list = toggleMood(list, id)
  eq('every one can be on at once', list.length, MOODS.length)
  for (const id of MOOD_IDS) list = toggleMood(list, id)
  eq('and all of them off again', list, [])
}

/* --- primaryMood, which keeps the not-null column fed -------------------- */
eq('one mood is its own primary', primaryMood(['joyful']), 'joyful')
eq('several take the first in catalogue order', primaryMood(['stressed', 'joyful']), 'joyful')
eq('which is the most positive of them', primaryMood(['guilty', 'nostalgic', 'energized']), 'energized')
eq('whichever order they were tapped in', primaryMood(['joyful', 'stressed']), 'joyful')
eq('nothing selected is null', primaryMood([]), null)
eq('null is null', primaryMood(null), null)
eq('junk is null', primaryMood(['wibble']), null)
eq('a bare string works too', primaryMood('joyful'), 'joyful')
ok(
  'the primary is always one the badge can draw',
  MOOD_IDS.every((id) => moodById(primaryMood([id])) !== null),
)

/**
 * LE GESTE DE CHAQUE HUMEUR.
 *
 *   "So when you click on them, they make the face, like they reproduce the
 *    emotion."
 *
 * Trois choses, et la troisieme est celle qui casserait en silence: une
 * classe peut etre nommee dans ce fichier et ne rien declarer dans la feuille
 * de style, auquel cas la tuile attend un `animationend` qui n'arrive jamais
 * et reste marquee "en train de jouer" pour toujours. Donc on lit la feuille.
 */
{
  const ici = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(ici, '..', 'index.css'), 'utf8')

  ok('chaque humeur a un geste', MOOD_IDS.every((id) => Boolean(motionOf(id))),
     MOOD_IDS.filter((id) => !motionOf(id)).join(', '))
  ok('et aucun geste ne designe une humeur qui n existe pas',
     Object.keys(MOOD_MOTION).every((id) => MOOD_IDS.includes(id)),
     Object.keys(MOOD_MOTION).filter((id) => !MOOD_IDS.includes(id)).join(', '))
  ok('un geste par humeur, pas une famille pour six',
     new Set(Object.values(MOOD_MOTION)).size === MOOD_IDS.length,
     `${new Set(Object.values(MOOD_MOTION)).size} gestes pour ${MOOD_IDS.length} humeurs`)
  eq('une humeur inconnue ne prend pas le geste d une autre', motionOf('wibble'), '')

  const manquantes = MOOD_IDS.filter((id) => {
    const classe = motionOf(id).replace('mood-', '')
    return !new RegExp(`@keyframes mood-${classe}\\b`).test(css)
      || !new RegExp(`\\.mood-${classe} \\{ animation: mood-${classe} `).test(css)
  })
  ok('et chaque geste est declare dans la feuille, images et classe',
     manquantes.length === 0, manquantes.join(', '))

  /* Chaque suite d'images part de `none` et y revient. Sans ca la tuile reste
     de travers a la seconde ou la classe est retiree. Mesure aussi en pixels
     peints par la sonde, mais la regle se lit ici. */
  const sansRepos = MOOD_IDS.filter((id) => {
    const nom = motionOf(id)
    const i = css.indexOf(`@keyframes ${nom} {`)
    if (i < 0) return true
    const bloc = css.slice(i, css.indexOf('\n}', i))
    return !/0%, 100% \{ transform: none; \}/.test(bloc)
  })
  ok('chaque geste part du repos et y revient', sansRepos.length === 0, sansRepos.join(', '))

  /* Et le mouvement se coupe pour qui l'a demande, SANS supprimer l'animation:
     une animation supprimee n'emet jamais `animationend`, donc la tuile ne se
     nettoierait jamais. */
  const reduit = css.slice(css.indexOf('@keyframes mood-still'))
  ok('sans mouvement, les gestes deviennent une animation immobile',
     /animation: mood-still/.test(reduit)
       && MOOD_IDS.every((id) => reduit.includes(`.${motionOf(id)}`)),
     MOOD_IDS.filter((id) => !reduit.includes(`.${motionOf(id)}`)).join(', '))
}

/**
 * ET LE DECLENCHEUR, QUI EST LA MOITIE JAVASCRIPT DE LA DEMANDE.
 *
 * Trois choses ont chacune une raison d'etre exactement comme ca:
 *
 * LE COMPTEUR EN `key`. Remettre la meme classe d'animation sur le meme
 * element ne relance rien. Sans un `key` qui change, la deuxieme tape pendant
 * que le geste tourne ne fait rien du tout, ce qui se lit comme un bouton
 * mort. Verifie dans Chromium: une deuxieme tape ramene currentTime de 83 ms
 * a 0.
 *
 * LE NETTOYAGE AU MINUTEUR. Il etait sur `animationend`, et trois animations
 * jouent maintenant sur une tape (le corps, le visage, la bouffee): attendre
 * la fin de l'une coupait les autres, et la bouffee n'existe pas du tout sous
 * prefers-reduced-motion, donc l'attendre serait attendre pour toujours. Sans
 * nettoyage du tout, la tuile garde sa classe et son `will-change`, et
 * dix-huit tuiles marquees en permanence sont dix-huit couches que le
 * compositeur garde pour rien.
 *
 * DEUX BOITES IMBRIQUEES. L'etat "choisi" est un `scale-110` en transition, le
 * geste est une animation: les deux ecrivent `transform`, et sur un seul
 * element l'animation gagne pendant qu'elle joue, donc la tuile choisie
 * retrecirait d'un dixieme a chaque tape. Imbriquees, elles se composent.
 */
{
  const ici2 = dirname(fileURLToPath(import.meta.url))
  const board = readFileSync(join(ici2, '..', 'components', 'MoodBoard.jsx'), 'utf8')

  ok('la tape rejoue le geste depuis le debut',
     /key=\{beat\.id === mood\.id \? `b\$\{beat\.n\}` : 'rest'\}/.test(board)
       && /setBeat\(\(b\) => \(\{ id: mood\.id, n: b\.n \+ 1 \}\)\)/.test(board),
     'sans key qui change, une deuxieme tape ne relance rien')
  ok('et la classe est retiree a la fin, au minuteur',
     /setTimeout\(/.test(board) && /REACTION_MS/.test(board) && /\{ id: null, n: b\.n \}/.test(board)
       && !/onAnimationEnd/.test(board),
     'sinon la tuile reste marquee, avec son will-change')
  ok('une deuxieme tape n est pas coupee par le minuteur de la premiere',
     /b\.n === beat\.n \? \{ id: null, n: b\.n \} : b/.test(board))
  ok('le geste et l etat choisi sont sur deux boites differentes',
     board.indexOf("selected ? 'scale-110'") < board.indexOf('mood-act'),
     'sur un seul element, l animation avalerait le grossissement')
  ok('le geste vient du catalogue, en classe entiere',
     /motionOf\(mood\.id\)/.test(board) && !/`mood-\$\{/.test(board),
     'une classe assemblee est une classe que personne ne retrouve')

  /* Les badges au repos ne jouent rien: ils apparaissent dans la bande de
     semaine et sur la carte du groupe, ou dix-huit gestes qui partent tout
     seuls seraient du bruit. */
  const badges = board.slice(board.indexOf('export function MoodBadges'))
  ok('les badges poses ailleurs dans l app ne bougent pas',
     !/mood-act|motionOf/.test(badges),
     'un geste qui part sans que personne ait touche est du bruit')
}

/**
 * LA BOUFFEE, ET LE MINUTEUR QUI LA COUVRE.
 *
 *   "Where are the new emotions reactions?"
 *
 * Chaque humeur envoie quelque chose en l'air, chaque trajectoire nommee
 * existe dans la feuille, rien ne depasse REACTION_MS (sinon la reaction est
 * coupee en plein vol), et la bouffee disparait entierement pour qui a demande
 * moins de mouvement.
 */
{
  const { BURSTS, FLIGHTS, REACTION_MS, TINTS, burstOf } = await import('./bursts.js')
  const ici3 = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(ici3, '..', 'index.css'), 'utf8')
  const board = readFileSync(join(ici3, '..', 'components', 'MoodBoard.jsx'), 'utf8')

  ok('chaque humeur a une bouffee', MOOD_IDS.every((id) => burstOf(id).length > 0),
     MOOD_IDS.filter((id) => burstOf(id).length === 0).join(', '))
  ok('et aucune bouffee ne designe une humeur qui n existe pas',
     Object.keys(BURSTS).every((id) => MOOD_IDS.includes(id)))
  eq('une humeur inconnue n envoie rien', burstOf('wibble').length, 0)

  const parts = Object.values(BURSTS).flat()
  ok('chaque particule vole sur une trajectoire connue',
     parts.every((p) => FLIGHTS.includes(p.fly)),
     [...new Set(parts.filter((p) => !FLIGHTS.includes(p.fly)).map((p) => p.fly))].join(', '))
  ok('et porte une couleur connue', parts.every((p) => p.tint in TINTS))
  ok('chaque trajectoire est declaree dans la feuille, images et classe',
     FLIGHTS.every((f) => css.includes(`@keyframes mp-${f} {`) && css.includes(`.mp-${f} { animation-name: mp-${f};`)),
     FLIGHTS.filter((f) => !css.includes(`@keyframes mp-${f} {`)).join(', '))
  ok('les particules partent au-dessus ou autour de la tete, jamais loin',
     parts.every((p) => p.at[0] >= 18 && p.at[0] <= 78 && p.at[1] >= 8 && p.at[1] <= 52),
     'la grille vit dans un panneau qui coupe ce qui depasse')

  /* Rien ne dure plus longtemps que la reaction: le corps, le visage, la
     bouffee et ses retards. Un geste plus long serait coupe en plein vol par
     le minuteur. */
  const durees = [...css.matchAll(/animation: (?:mood|fx)-[a-z-]+ (\d+)ms/g)].map((m) => Number(m[1]))
  const bouffee = [...css.matchAll(/\.mp(?:-[a-z]+)? \{[^}]*animation-duration: (\d+)ms/g)].map((m) => Number(m[1]))
  const retardMax = Math.max(...parts.map((p) => p.delay))
  ok(`aucun geste ne depasse REACTION_MS (${Math.max(...durees)} <= ${REACTION_MS})`,
     durees.length > 30 && Math.max(...durees) <= REACTION_MS)
  ok(`ni aucune particule, retard compris (${Math.max(...bouffee) + retardMax} <= ${REACTION_MS})`,
     bouffee.length > 0 && Math.max(...bouffee) + retardMax <= REACTION_MS + 400,
     'une particule retardee finit apres la reaction si on ne compte pas son retard')
  ok('la bouffee disparait pour qui a demande moins de mouvement',
     /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.mood-burst \{\s*\n\s*display: none;/.test(css))
  ok('la tuile la porte, remontee a chaque tape',
     /<MoodBurst key=\{`k\$\{beat\.n\}`\} mood=\{mood\.id\} \/>/.test(board)
       && /className=\{`relative block h-14 w-14/.test(board),
     'sans `relative`, la bouffee se pose en absolu par rapport a la page')
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
