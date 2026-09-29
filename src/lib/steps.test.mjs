/**
 * node src/lib/steps.test.mjs
 *
 * Les etapes d'un objectif: le pourcentage, la prochaine, ce que le
 * formulaire ecrit, et ce que le calendrier dessine.
 *
 * Les cas qui comptent: un arrondi fait a un seul endroit (66 ou 67, pas les
 * deux), une liste vide qui vaut zero et pas NaN, un enregistrement du
 * formulaire qui ne perd pas les coches deja mises, et une etape sans titre
 * qui ne devient pas une ligne en base.
 */
/* A l'ouest de Greenwich, AVANT la premiere Date: c'est la que la carte
   disait la veille. Node lit TZ une fois, au premier usage. */
process.env.TZ = 'America/Toronto'

import {
  cleanDrafts, draftOf, hasSteps, nextStep, progressOf, sortSteps, stepDiff, stepEntries, stepsOf,
} from './steps.js'
import { shortDate } from './time.js'

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
const deq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nsteps\n')

const S = (over) => ({ id: 's', goal_id: 'g1', title: 't', due_on: null, at_min: null, position: 0, done_at: null, created_at: '2026-09-01T00:00:00Z', ...over })

/* --- l avancement --------------------------------------------------------- */
deq('vide vaut zero, pas NaN', progressOf([]), { done: 0, total: 0, pct: 0, complete: false })
deq('rien de coche', progressOf([S({ id: 'a' }), S({ id: 'b' })]), { done: 0, total: 2, pct: 0, complete: false })
deq('deux sur trois font 67, arrondi une fois', progressOf([S({ id: 'a', done_at: 'x' }), S({ id: 'b', done_at: 'x' }), S({ id: 'c' })]),
    { done: 2, total: 3, pct: 67, complete: false })
deq('un sur trois font 33', progressOf([S({ id: 'a', done_at: 'x' }), S({ id: 'b' }), S({ id: 'c' })]).pct, 33)
deq('tout coche est complet', progressOf([S({ id: 'a', done_at: 'x' })]), { done: 1, total: 1, pct: 100, complete: true })
eq('null passe pour vide', progressOf(null).total, 0)

/* --- l ordre et l appartenance ------------------------------------------- */
{
  const list = [S({ id: 'c', position: 2 }), S({ id: 'a', position: 0 }), S({ id: 'b', position: 1 }), S({ id: 'z', goal_id: 'g2' })]
  deq('les etapes d un objectif, dans l ordre', stepsOf(list, 'g1').map((s) => s.id), ['a', 'b', 'c'])
  eq('un objectif a des etapes des la premiere', hasSteps(list, 'g2'), true)
  eq('et pas sans', hasSteps(list, 'g3'), false)
  deq('a rang egal, l ordre d ecriture', sortSteps([S({ id: 'b', created_at: '2026-09-02' }), S({ id: 'a', created_at: '2026-09-01' })]).map((s) => s.id), ['a', 'b'])
}

/* --- la prochaine --------------------------------------------------------- */
{
  const list = [
    S({ id: 'a', position: 0, done_at: 'x' }),
    S({ id: 'b', position: 1 }),
    S({ id: 'c', position: 2, due_on: '2026-10-05' }),
    S({ id: 'd', position: 3, due_on: '2026-10-01' }),
  ]
  eq('la prochaine est la datee la plus proche, pas la premiere de la liste', nextStep(list)?.id, 'd')
  eq('sans date, la premiere non cochee', nextStep([S({ id: 'a', done_at: 'x' }), S({ id: 'b', position: 1 }), S({ id: 'c', position: 2 })])?.id, 'b')
  eq('tout coche, rien', nextStep([S({ id: 'a', done_at: 'x' })]), null)
  eq('vide, rien', nextStep([]), null)
}

/* --- ce que le formulaire tient ------------------------------------------ */
deq('une ligne devient un brouillon', draftOf(S({ id: 'a', title: 'Billet', due_on: '2026-10-02', at_min: 570 })),
    { id: 'a', title: 'Billet', due_on: '2026-10-02', at: '09:30' })
deq('sans heure, le champ est vide', draftOf(S({ id: 'a', title: 'Billet' })), { id: 'a', title: 'Billet', due_on: '', at: '' })
{
  const clean = cleanDrafts([
    { id: null, title: '  Billet aller  ', due_on: '2026-10-02', at: '09:30' },
    { id: null, title: '', due_on: '2026-10-03', at: '' },
    { id: 'k', title: 'Hotel', due_on: '', at: '14:00' },
    { id: null, title: 'Ferry', due_on: '2026-10-02', at: 'pas une heure' },
  ])
  eq('une ligne sans titre tombe', clean.length, 3)
  deq('le titre est nettoye, l heure en minutes, le rang dans l ordre', clean[0], { id: null, title: 'Billet aller', due_on: '2026-10-02', at_min: 570, position: 0 })
  deq('une heure sans date tombe', clean[1], { id: 'k', title: 'Hotel', due_on: null, at_min: null, position: 1 })
  deq('une heure illisible tombe aussi', clean[2].at_min, null)
  eq('les rangs se resserrent apres la ligne tombee', clean[2].position, 2)
}

/* --- ce que l enregistrement ecrit --------------------------------------- */
{
  const existing = [
    S({ id: 'a', title: 'Billet', position: 0, done_at: '2026-09-20T10:00:00Z' }),
    S({ id: 'b', title: 'Hotel', position: 1 }),
    S({ id: 'c', title: 'Ferry', position: 2 }),
  ]
  const drafts = [
    { id: 'a', title: 'Billet', due_on: '', at: '' },
    { id: 'c', title: 'Ferry 11h', due_on: '2026-10-02', at: '11:00' },
    { id: null, title: 'Diner', due_on: '', at: '' },
  ]
  const d = stepDiff(existing, drafts, 'g1')
  deq('la nouvelle est inseree, au bon rang', d.insert, [{ goal_id: 'g1', title: 'Diner', due_on: null, at_min: null, position: 2 }])
  deq('celle qui a change est mise a jour, sans toucher done_at', d.update, [{ id: 'c', title: 'Ferry 11h', due_on: '2026-10-02', at_min: 660, position: 1 }])
  deq('celle qui a disparu est retiree', d.remove, ['b'])
  ok('celle qui n a pas bouge n est ni reecrite ni retiree', !d.update.some((u) => u.id === 'a') && !d.remove.includes('a'))
  deq('tout retirer, c est trois suppressions et rien d autre', stepDiff(existing, [], 'g1'), { insert: [], update: [], remove: ['a', 'b', 'c'] })
  deq('rien d existant, tout s insere', stepDiff([], drafts.slice(2), 'g1').insert.length, 1)
}

/* --- le calendrier -------------------------------------------------------- */
{
  const goals = new Map([['g1', { status: 'active' }], ['g2', { status: 'completed' }]])
  const list = [
    S({ id: 'a', title: 'Billet', due_on: '2026-10-02', at_min: 570 }),
    S({ id: 'b', title: 'Hotel', due_on: '2026-10-03', done_at: 'x' }),
    S({ id: 'c', title: 'Sans date' }),
    S({ id: 'd', title: 'Fini', goal_id: 'g2', due_on: '2026-10-04' }),
  ]
  const e = stepEntries(list, goals)
  eq('les etapes datees d objectifs actifs, et elles seules', e.length, 2)
  deq('une etape a heure est un bloc d une demi-heure', [e[0].start_min, e[0].end_min], [570, 600])
  eq('sur la couche des objectifs, avec le goalId qui ferme le formulaire', e[0].category === 'objectif' && e[0].goalId === 'g1', true)
  eq('une etape cochee garde sa place, avec une coche devant', e[1].title, '✓ Hotel')
  eq('et sans heure elle est une journee', e[1].start_min, null)
  eq('l identifiant est prefixe pour ne pas croiser un evenement', e[0].id, 'step:a')
  eq('rien pour rien', stepEntries(null, goals).length, 0)
}

/* --- trouve en sondant la carte ------------------------------------------ */
/* La date limite de la carte, fuseau Toronto: '2026-10-20' est le 20, pas le
   19. new Date('2026-10-20') est minuit UTC, soit la veille a 20h ici. */
eq('une date sans heure reste le jour qu elle nomme, a Toronto', shortDate('2026-10-20', 'en-GB'), '20 Oct')
eq('un instant complet est lu comme un instant', shortDate('2026-10-20T15:00:00Z', 'en-GB'), '20 Oct')
eq('rien pour rien', shortDate(null, 'en-GB'), null)
eq('et pas de "Invalid Date"', shortDate('demain', 'en-GB'), null)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
