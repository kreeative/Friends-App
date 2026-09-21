import { daysOfSpan, reconcile, runsOf, selectedFrom, spanOf } from './periodPick.js'
import { phaseOn } from './cycle.js'

let bad = 0
const ok = (name, cond, extra) => {
  if (!cond) bad += 1
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`)
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a))

console.log('cocher les jours de regles sur le mois')

console.log('\n ce qu une ligne occupe a l ecran')
eq('ended_on quand il est la',
   spanOf({ started_on: '2026-09-17', ended_on: '2026-09-19' }),
   { from: '2026-09-17', to: '2026-09-19' })
eq('cinq jours quand il ne l est pas',
   spanOf({ started_on: '2026-09-17', ended_on: null }),
   { from: '2026-09-17', to: '2026-09-21' })
eq('un seul jour se tient tout seul',
   spanOf({ started_on: '2026-09-17', ended_on: '2026-09-17' }),
   { from: '2026-09-17', to: '2026-09-17' })
eq('une fin avant le debut retombe sur la duree par defaut',
   spanOf({ started_on: '2026-09-17', ended_on: '2026-09-10' }),
   { from: '2026-09-17', to: '2026-09-21' })
ok('une ligne sans debut n occupe rien', spanOf({ started_on: null }) === null)

/* La meme reponse que le calendrier, sinon enregistrer ferait disparaitre des
   jours que personne n a touches. */
console.log('\n ET LE CALENDRIER DESSINE EXACTEMENT LA MEME CHOSE')
for (const [row, dedans, dehors] of [
  [{ started_on: '2026-09-17', ended_on: '2026-09-19' }, '2026-09-19', '2026-09-20'],
  [{ started_on: '2026-09-17', ended_on: null }, '2026-09-21', '2026-09-22'],
  [{ started_on: '2026-09-17', ended_on: '2026-09-17' }, '2026-09-17', '2026-09-18'],
]) {
  const span = spanOf(row)
  ok(`${span.from}..${span.to}: le dernier jour est colorie`,
     phaseOn(dedans, [row], null) === 'period' && daysOfSpan(span).includes(dedans))
  ok(`${span.from}..${span.to}: et le suivant ne l est pas`,
     phaseOn(dehors, [row], null) === null && !daysOfSpan(span).includes(dehors))
}

console.log('\n les series continues')
eq('trois jours de suite sont UNE regle',
   runsOf(['2026-09-17', '2026-09-18', '2026-09-19']),
   [{ from: '2026-09-17', to: '2026-09-19' }])
eq('l ordre de saisie ne change rien',
   runsOf(['2026-09-19', '2026-09-17', '2026-09-18']),
   [{ from: '2026-09-17', to: '2026-09-19' }])
eq('un trou fait deux regles, et le trou n est pas comble',
   runsOf(['2026-09-17', '2026-09-18', '2026-09-25']),
   [{ from: '2026-09-17', to: '2026-09-18' }, { from: '2026-09-25', to: '2026-09-25' }])
eq('a cheval sur deux mois', runsOf(['2026-09-30', '2026-10-01']),
   [{ from: '2026-09-30', to: '2026-10-01' }])
eq('a cheval sur deux annees', runsOf(['2026-12-31', '2027-01-01']),
   [{ from: '2026-12-31', to: '2027-01-01' }])
eq('le 28 fevrier d une annee non bissextile enchaine sur mars',
   runsOf(['2027-02-28', '2027-03-01']),
   [{ from: '2027-02-28', to: '2027-03-01' }])
eq('et le 29 existe en annee bissextile',
   runsOf(['2028-02-28', '2028-02-29', '2028-03-01']),
   [{ from: '2028-02-28', to: '2028-03-01' }])
eq('rien de coche, rien a faire', runsOf([]), [])
eq('une saleté n est pas une date', runsOf(['pas-une-date', '2026-09-17']),
   [{ from: '2026-09-17', to: '2026-09-17' }])

console.log('\n ce qui est deja enregistre arrive coche')
{
  const vu = selectedFrom([{ started_on: '2026-09-17', ended_on: '2026-09-19' }])
  ok('les trois jours', vu.size === 3 && vu.has('2026-09-18'))
  ok('et pas le quatrieme', !vu.has('2026-09-20'))
}

console.log('\n LE CAS QUI EFFACERAIT DES DONNEES')
{
  /**
   * Toutes les lignes existantes ont ended_on a null: rien ne l'a jamais
   * ecrit. Sans la regle du "touche", enregistrer apres avoir coche un jour de
   * septembre inventerait une duree de cinq jours sur chaque regle de l'annee
   * derniere, sur des lignes que personne n'a ouvertes.
   */
  const vieilles = [
    { id: 'a', started_on: '2025-11-03', ended_on: null },
    { id: 'b', started_on: '2025-12-01', ended_on: null },
    { id: 'c', started_on: '2026-01-02', ended_on: null },
  ]
  const coche = selectedFrom(vieilles)
  coche.add('2026-09-17')
  const r = reconcile({ rows: vieilles, selected: coche, touched: ['2026-09-17'] })
  eq('un seul jour ajoute', r.add, [{ started_on: '2026-09-17', ended_on: '2026-09-17' }])
  eq('et RIEN de retire', r.remove, [])
  ok('aucune vieille ligne ne recoit de duree inventee',
     !r.add.some((x) => x.started_on.startsWith('2025') || x.started_on === '2026-01-02'))
}

console.log('\n cocher trois jours, comme dans Flo')
{
  const r = reconcile({
    rows: [],
    selected: ['2026-09-17', '2026-09-18', '2026-09-19'],
    touched: ['2026-09-17', '2026-09-18', '2026-09-19'],
  })
  eq('une regle de trois jours, pas trois regles',
     r.add, [{ started_on: '2026-09-17', ended_on: '2026-09-19' }])
  eq('rien a retirer', r.remove, [])
}

console.log('\n corriger une regle deja enregistree')
{
  const rows = [{ id: 'x', started_on: '2026-09-17', ended_on: '2026-09-19' }]
  const coche = selectedFrom(rows)
  coche.add('2026-09-20')
  const r = reconcile({ rows, selected: coche, touched: ['2026-09-20'] })
  eq('la nouvelle plage est ecrite',
     r.add, [{ started_on: '2026-09-17', ended_on: '2026-09-20' }])
  eq('et l ancienne ligne part', r.remove, ['x'])
}
{
  /* Le 19 decoche sur une ligne qui n a pas de fin: elle etait dessinee sur
     cinq jours, elle en vaut trois maintenant, et c est bien elle qu on a
     touchee. */
  const rows = [{ id: 'y', started_on: '2026-09-17', ended_on: null }]
  const coche = selectedFrom(rows)
  coche.delete('2026-09-20')
  coche.delete('2026-09-21')
  const r = reconcile({ rows, selected: coche, touched: ['2026-09-20', '2026-09-21'] })
  eq('la duree reelle est enfin ecrite',
     r.add, [{ started_on: '2026-09-17', ended_on: '2026-09-19' }])
  eq('l ancienne ligne sans fin part', r.remove, ['y'])
}

console.log('\n combler le trou entre deux regles les fusionne')
{
  /* Le cas qui a casse la premiere version de la zone concernee: le seul jour
     tape est le 20, et ce sont les series de part et d'autre qui doivent
     bouger. */
  const rows = [
    { id: 'g', started_on: '2026-09-17', ended_on: '2026-09-19' },
    { id: 'h', started_on: '2026-09-21', ended_on: '2026-09-23' },
  ]
  const coche = selectedFrom(rows)
  coche.add('2026-09-20')
  const r = reconcile({ rows, selected: coche, touched: ['2026-09-20'] })
  eq('une seule regle du 17 au 23',
     r.add, [{ started_on: '2026-09-17', ended_on: '2026-09-23' }])
  eq('et les deux anciennes partent', r.remove.sort(), ['g', 'h'],
     'sinon trois lignes se chevaucheraient pour une seule regle')
}

console.log('\n couper une regle en deux')
{
  const rows = [{ id: 'k', started_on: '2026-09-17', ended_on: '2026-09-21' }]
  const coche = selectedFrom(rows)
  coche.delete('2026-09-19')
  const r = reconcile({ rows, selected: coche, touched: ['2026-09-19'] })
  eq('deux series de part et d autre du trou', r.add,
     [{ started_on: '2026-09-17', ended_on: '2026-09-18' },
      { started_on: '2026-09-20', ended_on: '2026-09-21' }])
  eq('l ancienne part', r.remove, ['k'])
}

console.log('\n tout decocher supprime, et rien d autre')
{
  const rows = [
    { id: 'p', started_on: '2026-09-17', ended_on: '2026-09-19' },
    { id: 'q', started_on: '2026-08-20', ended_on: '2026-08-23' },
  ]
  const coche = selectedFrom(rows)
  for (const k of ['2026-09-17', '2026-09-18', '2026-09-19']) coche.delete(k)
  const r = reconcile({
    rows, selected: coche, touched: ['2026-09-17', '2026-09-18', '2026-09-19'],
  })
  eq('la serie de septembre part', r.remove, ['p'])
  eq('rien n est ajoute', r.add, [])
  ok('et celle d aout ne bouge pas', !r.remove.includes('q'))
}

console.log('\n un aller-retour n ecrit rien')
{
  const rows = [{ id: 'z', started_on: '2026-09-17', ended_on: '2026-09-19' }]
  const coche = selectedFrom(rows)
  coche.add('2026-09-20')
  coche.delete('2026-09-20')
  const r = reconcile({ rows, selected: coche, touched: ['2026-09-20'] })
  eq('rien a ecrire', r.add, [])
  eq('rien a retirer', r.remove, [],
     'cocher puis decocher doit laisser la base exactement comme elle etait')
}

console.log('\n sans rien toucher, enregistrer ne fait rien')
{
  const rows = [
    { id: 'a', started_on: '2026-09-17', ended_on: null },
    { id: 'b', started_on: '2026-08-20', ended_on: null },
  ]
  const r = reconcile({ rows, selected: selectedFrom(rows), touched: [] })
  eq('aucun ajout', r.add, [])
  eq('aucune suppression', r.remove, [],
     'ouvrir le mois et refermer ne doit reecrire aucune duree')
}

console.log('\n une ligne sans identifiant ne peut pas etre supprimee')
{
  const rows = [{ started_on: '2026-09-17', ended_on: '2026-09-19' }]
  const r = reconcile({ rows, selected: [], touched: ['2026-09-17'] })
  eq('rien n est supprime a l aveugle', r.remove, [],
     'supprimer par date toucherait la mauvaise ligne si deux se chevauchent')
}

console.log('\n les appels vides ne cassent pas')
{
  const r = reconcile()
  eq('rien a ajouter', r.add, [])
  eq('rien a retirer', r.remove, [])
}

console.log(bad ? `\n  ${bad} faux\n` : '\n  tout juste\n')
process.exit(bad ? 1 : 0)
