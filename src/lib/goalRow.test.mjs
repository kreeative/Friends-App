/**
 * node src/lib/goalRow.test.mjs
 *
 * LE TEST QUI MANQUAIT.
 *
 * Il en existait un pour starts_on. Il lisait le texte source de GoalForm.jsx
 * et verifiait la presence de /starts_on: startsOn \|\| null/, c'est-a-dire de
 * la ligne exacte qui empechait toute creation d'objectif. Il est reste vert
 * pendant tout ce temps, parce qu'une assertion sur la presence d'un bout de
 * code ne dit rien de ce que ce code produit.
 *
 * Ici on regarde la ligne rendue. Une regression sur starts_on redonnerait
 * null ou '' et ces assertions tomberaient.
 */
import { goalRow, startsOnFor } from './goalRow.js'
import { isDueOn } from './schedule.js'
import { dayKey } from './time.js'

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

const TODAY = '2026-09-06'

/* Ce que le formulaire a a l'ecran quand il vient de s'ouvrir pour un nouvel
   objectif personnel: la personne a tape son engagement et rien d'autre. */
const fresh = {
  groupId: null,
  kind: 'personal',
  userId: 'u1',
  commitment: '  Courir vingt minutes  ',
  goalType: 'process',
  when: '',
  where: '',
  evidence: '',
  proofType: 'photo',
  cadence: 'recurring',
  target: 3,
  days: [0, 1, 2, 3, 4, 5, 6],
  dueOn: '',
  endsOn: '',
  startsOn: '',
  stake: '',
  remind: true,
}

// ---- starts_on, la colonne not null ----------------------------------------

/**
 * `goals.starts_on` est `date not null default current_date` (01_schema.sql).
 * Un null explicite dans un INSERT ecrase le DEFAULT au lieu de le laisser
 * s'appliquer, donc envoyer null n'est pas "laisser la base decider", c'est
 * violer la contrainte. Erreur reelle recue par une utilisatrice:
 *
 *   [23502] null value in column "starts_on" of relation "goals"
 */
const row = goalRow(fresh, TODAY)
ok(
  'un champ vide ne part jamais en null',
  row.starts_on !== null,
  'null ecrase le DEFAULT de la colonne, il ne le laisse pas s appliquer',
)
ok('ni en chaine vide', row.starts_on !== '', 'une chaine vide n est pas une date')
eq('mais au jour local', row.starts_on, TODAY)

eq('une date choisie est respectee', goalRow({ ...fresh, startsOn: '2027-01-01' }, TODAY).starts_on, '2027-01-01')
eq('startsOnFor sur du vide', startsOnFor('', TODAY), TODAY)
eq('startsOnFor sur null', startsOnFor(null, TODAY), TODAY)
eq('startsOnFor sur undefined', startsOnFor(undefined, TODAY), TODAY)

/**
 * Le jour local et pas la date du serveur. current_date est en UTC: pour
 * quelqu'un a Montreal a 21h le 6, il rend le 7, et l'objectif cree ce soir ne
 * serait pas demande ce soir. dayKey lit l'horloge de la personne.
 */
eq('sans jour fourni, celui de la personne', goalRow(fresh).starts_on, dayKey(new Date()))

/**
 * La consequence qui compte, et pas seulement la valeur: un objectif cree
 * aujourd'hui doit etre demande aujourd'hui. isDueOn compare starts_on au jour
 * en cours et refuse tout ce qui commence plus tard.
 */
ok(
  'et un objectif cree aujourd hui est du aujourd hui',
  isDueOn({ ...goalRow(fresh), status: 'active' }, new Date()),
  'un starts_on decale d un jour fait disparaitre l objectif du soir meme',
)

// ---- les colonnes qui, elles, acceptent null --------------------------------

/* due_on et ends_on sont nullable, donc la chaine vide doit bien y devenir
   null. C'est ce que faisait deja `|| null`, et c'est pour ca que la meme
   ligne recopiee sur starts_on avait l'air correcte. */
eq('due_on vide reste null', goalRow({ ...fresh, cadence: 'once', dueOn: '' }, TODAY).due_on, null)
eq('ends_on vide reste null', goalRow({ ...fresh, endsOn: '' }, TODAY).ends_on, null)
eq('due_on ne part pas sur un objectif recurrent', goalRow({ ...fresh, dueOn: '2026-12-01' }, TODAY).due_on, null)
eq(
  'ends_on ne part pas sur un objectif ponctuel',
  goalRow({ ...fresh, cadence: 'once', endsOn: '2026-12-01' }, TODAY).ends_on,
  null,
)

// ---- le reste de la ligne ----------------------------------------------------

eq('les espaces autour de l engagement sont enleves', row.commitment, 'Courir vingt minutes')
eq('un texte vide devient null', [row.trigger_when, row.trigger_where, row.evidence_def, row.stake_text], [null, null, null, null])
eq('tous les jours se stocke null', row.active_days, null)
eq('aucun jour aussi', goalRow({ ...fresh, days: [] }, TODAY).active_days, null)
eq('une selection partielle est triee', goalRow({ ...fresh, days: [3, 1] }, TODAY).active_days, [1, 3])
eq('la cible ponctuelle vaut un', goalRow({ ...fresh, cadence: 'once', target: 5 }, TODAY).target_per_cycle, 1)
eq('une cible illisible retombe sur un', goalRow({ ...fresh, target: '' }, TODAY).target_per_cycle, 1)

/* Sans groupe, l'objectif est personnel quoi que dise la bascule: la
   contrainte de la base refuse group_id null avec kind group. */
eq('sans groupe, personnel', goalRow({ ...fresh, kind: 'group' }, TODAY).kind, 'personal')
eq('et il a un proprietaire', goalRow({ ...fresh, kind: 'group' }, TODAY).owner_id, 'u1')
{
  const g = goalRow({ ...fresh, groupId: 'g1', kind: 'group' }, TODAY)
  eq('dans un groupe, un objectif de groupe n a pas de proprietaire', g.owner_id, null)
  eq('et porte le groupe', [g.group_id, g.kind], ['g1', 'group'])
}

// ---- la notification horaire par objectif -------------------------------------

/* Le booleen `remind` est la porte; l'heure est un detail derriere elle. */
eq('une heure avec la case cochee part en minutes', goalRow({ ...fresh, remind: true, remindAt: '09:30' }, TODAY).remind_at_min, 570)
eq('sans heure, null et pas une chaine vide', goalRow({ ...fresh, remind: true, remindAt: '' }, TODAY).remind_at_min, null)
eq('une heure sans la case cochee est ignoree', goalRow({ ...fresh, remind: false, remindAt: '09:30' }, TODAY).remind_at_min, null)
eq('une saisie illisible ne fait pas un NaN', goalRow({ ...fresh, remind: true, remindAt: 'midi' }, TODAY).remind_at_min, null)
eq('undefined non plus', goalRow({ ...fresh, remind: true }, TODAY).remind_at_min, null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
