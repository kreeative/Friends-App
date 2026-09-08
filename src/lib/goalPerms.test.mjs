/**
 * node src/lib/goalPerms.test.mjs
 *
 * The delete rule, checked against the same fifteen cases that were run on a
 * real Postgres 16 with the real policy.
 *
 * THE CASE THIS FILE EXISTS FOR is the creator of the group. Her roster row
 * says 'creator', the old inline check said `role === 'admin'`, and so the
 * entry was never drawn for her on any shared goal. The database would have
 * accepted every one of those deletes. A rule copied into a page drifts from
 * the policy it copies without anything failing, which is why the rule is one
 * function now and this file is its transcription.
 *
 * The second case is the author of a shared goal. That is what migration 62
 * adds: created_by has existed since migration 50 and nothing had ever read it
 * for rights.
 */
import { canDeleteGoal } from './goalPerms.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const CREATRICE = 'u-1'
const ADMIN = 'u-2'
const AUTEUR = 'u-3'
const MEMBRE = 'u-4'
const ETRANGER = 'u-5'

const GROUPE = 'g-1'

/* Who is looking, and what the group says about them. groupCreatedBy is the
   same for everybody: it is a fact about the group, not about the reader. */
const viewer = (userId, role) => ({ userId, role, groupCreatedBy: CREATRICE })

/* A commun ecrit par la creatrice. */
const A = { id: 'A', group_id: GROUPE, owner_id: null, created_by: CREATRICE }
/* B commun ecrit par un membre ordinaire. */
const B = { id: 'B', group_id: GROUPE, owner_id: null, created_by: AUTEUR }
/* C personnel, dans le groupe, appartenant au membre ordinaire. */
const C = { id: 'C', group_id: GROUPE, owner_id: MEMBRE, created_by: MEMBRE }
/* D personnel hors groupe, la page /goals. */
const D = { id: 'D', group_id: null, owner_id: MEMBRE, created_by: MEMBRE }

console.log('goalPerms')

/* ------------------------------------------------------------------ *
 * A shared goal written by the group's creator.
 * ------------------------------------------------------------------ */
ok('A: la creatrice supprime le sien', canDeleteGoal(A, viewer(CREATRICE, 'creator')))
ok('A: un admin supprime', canDeleteGoal(A, viewer(ADMIN, 'admin')))
ok('A: un membre ne supprime pas', !canDeleteGoal(A, viewer(AUTEUR, 'member')))
ok('A: un autre membre ne supprime pas', !canDeleteGoal(A, viewer(MEMBRE, 'member')))
ok('A: un etranger ne supprime pas', !canDeleteGoal(A, viewer(ETRANGER, null)))

/* ------------------------------------------------------------------ *
 * A shared goal written by an ordinary member. The line migration 62 adds.
 * ------------------------------------------------------------------ */
ok('B: son auteur supprime, simple membre', canDeleteGoal(B, viewer(AUTEUR, 'member')))
ok('B: la creatrice supprime', canDeleteGoal(B, viewer(CREATRICE, 'creator')))
ok('B: un admin supprime', canDeleteGoal(B, viewer(ADMIN, 'admin')))
ok('B: un membre qui ne l a pas ecrit ne supprime pas', !canDeleteGoal(B, viewer(MEMBRE, 'member')))
ok('B: un etranger ne supprime pas', !canDeleteGoal(B, viewer(ETRANGER, null)))

/* ------------------------------------------------------------------ *
 * A personal goal that lives inside the group.
 * ------------------------------------------------------------------ */
ok('C: son proprietaire supprime', canDeleteGoal(C, viewer(MEMBRE, 'member')))
ok('C: un admin supprime', canDeleteGoal(C, viewer(ADMIN, 'admin')))
ok('C: la creatrice supprime', canDeleteGoal(C, viewer(CREATRICE, 'creator')))
ok('C: un autre membre ne supprime pas', !canDeleteGoal(C, viewer(AUTEUR, 'member')))
ok('C: un etranger ne supprime pas', !canDeleteGoal(C, viewer(ETRANGER, null)))

/* ------------------------------------------------------------------ *
 * A goal with no group. Nothing about a group may reach it.
 * ------------------------------------------------------------------ */
ok('D: son proprietaire supprime', canDeleteGoal(D, { userId: MEMBRE, role: null, groupCreatedBy: null }))
ok(
  'D: un admin d un groupe quelconque ne supprime pas un objectif solo',
  !canDeleteGoal(D, viewer(ADMIN, 'admin')),
)
ok(
  'D: la creatrice d un groupe non plus',
  !canDeleteGoal(D, viewer(CREATRICE, 'creator')),
)

/* ------------------------------------------------------------------ *
 * The named group-creator branch, on its own.
 *
 * Proved separately on Postgres by demoting the creator's roster row to
 * 'member': is_group_admin() then says no and only is_group_creator() answers.
 * ------------------------------------------------------------------ */
ok(
  'la creatrice retrogradee dans le roster supprime encore',
  canDeleteGoal(B, { userId: CREATRICE, role: 'member', groupCreatedBy: CREATRICE }),
)

/* ------------------------------------------------------------------ *
 * Nulls. The reason the first line of the function is a guard.
 * ------------------------------------------------------------------ */
ok('personne de connecte: rien', !canDeleteGoal(A, { userId: null, role: 'creator', groupCreatedBy: CREATRICE }))
ok('pas de viewer du tout: rien', !canDeleteGoal(A, undefined))
ok('pas d objectif: rien', !canDeleteGoal(null, viewer(CREATRICE, 'creator')))
ok(
  'created_by null ne vaut pas connecte null',
  !canDeleteGoal({ id: 'E', group_id: GROUPE, owner_id: null, created_by: null }, {
    userId: null,
    role: null,
    groupCreatedBy: null,
  }),
)
ok(
  'un objectif d avant la migration 50 reste refuse a un simple membre',
  !canDeleteGoal({ id: 'F', group_id: GROUPE, owner_id: null, created_by: null }, viewer(MEMBRE, 'member')),
)
/* null pour role et pour groupCreatedBy passes explicitement: les valeurs par
   defaut d un parametre ne se declenchent que sur undefined, jamais sur null,
   et cette regle a deja coute du temps ailleurs dans ce depot. */
ok(
  'role et groupCreatedBy a null ne cassent rien',
  !canDeleteGoal(A, { userId: MEMBRE, role: null, groupCreatedBy: null }),
)

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
