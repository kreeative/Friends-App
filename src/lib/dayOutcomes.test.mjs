/**
 * node src/lib/dayOutcomes.test.mjs
 *
 * The Today card read one of the two tables an answer can live in.
 *
 * Reported with a screenshot: five goals on the dashboard, one saying "Did it"
 * and four saying "Not recorded", and "Ranger ma chambre" among the four after
 * having been ticked. The one that worked was in a group, the four that did
 * not were solo. Group answers go to checkin_items, solo ticks go to
 * goal_days, and the card only ever read the first.
 *
 * So the case that matters here is a goal with NO checkin item and a goal_days
 * row: it has to come back done.
 */
import { outcomesForDay } from './dayOutcomes.js'
import { indexDays } from './streak.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const DAY = '2026-09-07'

/* Une fois par jour, la forme la plus courante. */
const ranger = { id: 'g-ranger', commitment: 'Ranger ma chambre', cadence: 'recurring', target_per_cycle: 1 }
/* Trois fois par jour: c'est ce qui distingue "fait" de "en partie". */
const eau = { id: 'g-eau', commitment: 'Boire mes complements', cadence: 'recurring', target_per_cycle: 3 }
/* Dans un groupe, donc repondu par le check-in. */
const poster = { id: 'g-poster', commitment: 'Poster 1 fois par jour', cadence: 'recurring', target_per_cycle: 1 }
/* Jamais coche. */
const livre = { id: 'g-livre', commitment: 'Acheter mon livre', cadence: 'once' }

const GOALS = [ranger, eau, poster, livre]

console.log('dayOutcomes')

/* ------------------------------------------------------------------ *
 * Le cas rapporte.
 * ------------------------------------------------------------------ */
{
  const items = [{ goal_id: 'g-poster', outcome: 'done', count_done: 1, evidence: 'capture' }]
  const index = indexDays([
    { goal_id: 'g-ranger', user_id: 'u1', on_date: DAY, count_done: 1 },
    { goal_id: 'g-eau', user_id: 'u1', on_date: DAY, count_done: 2 },
  ])
  const out = outcomesForDay(GOALS, items, index, DAY)

  ok('la chambre rangee ressort faite', out.get('g-ranger')?.outcome === 'done', String(out.get('g-ranger')?.outcome))
  ok('deux sur trois ressort en partie', out.get('g-eau')?.outcome === 'partial', String(out.get('g-eau')?.outcome))
  ok('le but de groupe garde sa reponse', out.get('g-poster')?.outcome === 'done')
  ok('le but de groupe garde sa preuve', out.get('g-poster')?.evidence === 'capture')
  ok('celui qui n a rien reste absent', !out.has('g-livre'))
  ok('un tick solo est marque comme tel', out.get('g-ranger')?.source === 'goal_day')
  ok('un item de check-in ne l est pas', out.get('g-poster')?.source === undefined)
  ok('le compte est rendu', out.get('g-eau')?.count_done === 2)
}

/* ------------------------------------------------------------------ *
 * Avant le correctif: sans l index, on retrouve exactement l ecran de la
 * capture, quatre "non enregistre" et un "fait".
 * ------------------------------------------------------------------ */
{
  const items = [{ goal_id: 'g-poster', outcome: 'done', count_done: 1 }]
  const avant = outcomesForDay(GOALS, items, null, DAY)
  ok('sans goal_days, seul le but de groupe est repondu', avant.size === 1 && avant.has('g-poster'))
}

/* ------------------------------------------------------------------ *
 * Le mauvais jour n est pas une reponse.
 * ------------------------------------------------------------------ */
{
  const index = indexDays([{ goal_id: 'g-ranger', on_date: '2026-09-06', count_done: 1 }])
  ok('le tick d hier ne compte pas aujourd hui', !outcomesForDay(GOALS, [], index, DAY).has('g-ranger'))
  ok('et compte hier', outcomesForDay(GOALS, [], index, '2026-09-06').get('g-ranger')?.outcome === 'done')
}

/* ------------------------------------------------------------------ *
 * Les horodatages. goal_days.on_date peut revenir en date nue ou en
 * timestamp selon le client; indexDays coupe a dix caracteres.
 * ------------------------------------------------------------------ */
{
  const index = indexDays([{ goal_id: 'g-ranger', on_date: `${DAY}T00:00:00+00:00`, count_done: 1 }])
  ok('un horodatage vaut sa date', outcomesForDay(GOALS, [], index, DAY).get('g-ranger')?.outcome === 'done')
}

/* ------------------------------------------------------------------ *
 * Le check-in gagne quand il y a les deux. Ne devrait pas arriver, le
 * chemin depend du but et non de l ecran, mais une reponse soumise avec sa
 * preuve vaut mieux qu un compteur.
 * ------------------------------------------------------------------ */
{
  const items = [{ goal_id: 'g-ranger', outcome: 'partial', count_done: 1, evidence: 'photo' }]
  const index = indexDays([{ goal_id: 'g-ranger', on_date: DAY, count_done: 9 }])
  const out = outcomesForDay(GOALS, items, index, DAY)
  ok('le check-in l emporte', out.get('g-ranger')?.outcome === 'partial')
  ok('et garde sa preuve', out.get('g-ranger')?.evidence === 'photo')
}

/* ------------------------------------------------------------------ *
 * Zero n est pas une reponse. setGoalDay SUPPRIME la ligne plutot que
 * d ecrire zero, mais une ligne a zero venue d ailleurs ne doit pas se lire
 * comme un echec enregistre: elle doit se lire comme rien.
 * ------------------------------------------------------------------ */
{
  const index = indexDays([{ goal_id: 'g-ranger', on_date: DAY, count_done: 0 }])
  ok('zero se lit comme rien', !outcomesForDay(GOALS, [], index, DAY).has('g-ranger'))
}

/* ------------------------------------------------------------------ *
 * Les entrees vides. Rien ne doit lever.
 * ------------------------------------------------------------------ */
{
  ok('aucun argument', outcomesForDay().size === 0)
  ok('index absent', outcomesForDay(GOALS, [], null, null).size === 0)
  ok('jour absent', outcomesForDay(GOALS, [], indexDays([{ goal_id: 'g-ranger', on_date: DAY, count_done: 1 }]), null).size === 0)
  ok('items nuls', outcomesForDay(GOALS, null, null, DAY).size === 0)
  ok(
    'un item sans goal_id est ignore',
    outcomesForDay(GOALS, [{ outcome: 'done' }], null, DAY).size === 0,
  )
}

/* ------------------------------------------------------------------ *
 * Un but qui n est pas dans la liste du jour n est pas ajoute par sa ligne.
 * La liste decide de ce qui s affiche; ce fichier ne decide que du verdict.
 * ------------------------------------------------------------------ */
{
  const index = indexDays([{ goal_id: 'g-inconnu', on_date: DAY, count_done: 4 }])
  ok('un tick sans but affiche n ajoute rien', outcomesForDay(GOALS, [], index, DAY).size === 0)
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
