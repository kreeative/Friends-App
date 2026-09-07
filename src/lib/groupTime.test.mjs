/**
 * node src/lib/groupTime.test.mjs
 *
 * L'heure d'un groupe, lue depuis un autre fuseau.
 *
 * CE QUE CE FICHIER PROUVE, ET POURQUOI IL EST NECESSAIRE
 *
 * Rapporte avec une capture: "Sunday 00:00 · America/Toronto", et la question
 * "instead of all the group being on the Toronto timeline, can it just be
 * adjusted in real time for everyone?".
 *
 * La reponse est que la planification l'etait deja: cycles.opens_at est un
 * timestamptz, donc un instant, et il s'ouvre au meme moment partout. Ce qui
 * ne l'etait pas, c'est la phrase sous le nom du groupe, qui affichait la
 * REGLE dans le fuseau du groupe plutot que le MOMENT dans celui du lecteur.
 *
 * Ce qui est verifie ici est la partie qu'aucun oeil ne peut relire: la
 * conversion. Elle porte trois pieges connus, et les trois sont testes plutot
 * que decrits.
 *
 *   1. Le decalage entre deux fuseaux n'est pas une constante. Toronto et
 *      Paris sont a six heures la plupart de l'annee et a cinq pendant les
 *      deux semaines ou les changements d'heure ne coincident pas.
 *   2. Une heure locale peut ne pas exister (celle qu'on saute au printemps)
 *      ou exister deux fois (en automne).
 *   3. "La prochaine occurrence" doit sauter au dimanche suivant quand celui
 *      d'aujourd'hui est deja passe, ce qui arrive une fois par semaine.
 */
import {
  deviceZone,
  nextOpening,
  openingLabel,
  partsIn,
  safeZone,
  zoneOffset,
  zonedTimeToInstant,
} from './groupTime.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

console.log('\ngroup time')

/* --- les fuseaux qui n'existent pas ---------------------------------------- */

eq('un fuseau valide passe', safeZone('America/Toronto'), 'America/Toronto')
eq('un fuseau inconnu retombe sur le repli', safeZone('Mars/Olympus'), 'UTC')
eq('une chaine vide aussi', safeZone(''), 'UTC')
eq('null aussi', safeZone(null), 'UTC')
eq('et le repli est choisissable', safeZone(undefined, 'Europe/Paris'), 'Europe/Paris')
ok('le fuseau de l’appareil est un fuseau valide', safeZone(deviceZone()) === deviceZone())

/* --- le decalage, aux deux saisons ----------------------------------------- */

/* Juillet: Toronto est a UTC-4, Paris a UTC+2. */
eq('Toronto en juillet vaut -240 minutes', zoneOffset(new Date('2026-07-15T12:00:00Z'), 'America/Toronto'), -240)
eq('Paris en juillet vaut +120 minutes', zoneOffset(new Date('2026-07-15T12:00:00Z'), 'Europe/Paris'), 120)
/* Janvier: Toronto passe a UTC-5, Paris a UTC+1. */
eq('Toronto en janvier vaut -300 minutes', zoneOffset(new Date('2026-01-15T12:00:00Z'), 'America/Toronto'), -300)
eq('Paris en janvier vaut +60 minutes', zoneOffset(new Date('2026-01-15T12:00:00Z'), 'Europe/Paris'), 60)
eq('UTC ne bouge jamais', zoneOffset(new Date('2026-07-15T12:00:00Z'), 'UTC'), 0)

/* --- un mur d'horloge devient un instant ----------------------------------- */

eq('minuit a Toronto en juillet, c’est 04:00 UTC',
   zonedTimeToInstant({ year: 2026, month: 7, day: 12, hour: 0 }, 'America/Toronto').toISOString(),
   '2026-07-12T04:00:00.000Z')
eq('minuit a Toronto en janvier, c’est 05:00 UTC',
   zonedTimeToInstant({ year: 2026, month: 1, day: 11, hour: 0 }, 'America/Toronto').toISOString(),
   '2026-01-11T05:00:00.000Z')
eq('et minuit a Paris en juillet, c’est 22:00 UTC la veille',
   zonedTimeToInstant({ year: 2026, month: 7, day: 12, hour: 0 }, 'Europe/Paris').toISOString(),
   '2026-07-11T22:00:00.000Z')

/**
 * L'HEURE QUI N'EXISTE PAS.
 *
 * Le 8 mars 2026, Toronto saute de 02:00 a 03:00. Un groupe regle sur 02:00
 * n'a pas de 02:00 ce jour-la. La conversion doit rendre un instant reel,
 * celui d'apres le saut, plutot que NaN ou une heure inventee.
 */
{
  const at = zonedTimeToInstant({ year: 2026, month: 3, day: 8, hour: 2 }, 'America/Toronto')
  ok('une heure qui n’existe pas rend quand meme un instant', !Number.isNaN(at.getTime()), String(at))
  eq('et c’est celui juste apres le saut', at.toISOString(), '2026-03-08T07:00:00.000Z')
  eq('qui se lit 03:00 sur place', partsIn(at, 'America/Toronto').hour, 3)
}

/**
 * L'HEURE QUI EXISTE DEUX FOIS.
 *
 * Le 1er novembre 2026, Toronto repasse de 02:00 a 01:00. Un groupe regle sur
 * 01:00 a deux 01:00 ce jour-la. On doit en rendre un, sans erreur, et le
 * premier est le bon: c'est celui qui arrive quand la regle se realise.
 */
{
  const at = zonedTimeToInstant({ year: 2026, month: 11, day: 1, hour: 1 }, 'America/Toronto')
  ok('une heure qui existe deux fois n’explose pas', !Number.isNaN(at.getTime()), String(at))
  eq('et on prend la premiere', at.toISOString(), '2026-11-01T05:00:00.000Z')
}

/* --- la prochaine occurrence ------------------------------------------------ */

/* Dimanche 00:00 a Toronto. Le 8 septembre 2026 est un mardi. */
{
  const now = new Date('2026-09-08T13:00:00Z')
  const at = nextOpening({ dow: 0, hour: 0, tz: 'America/Toronto' }, now)
  eq('mardi, la prochaine ouverture est le dimanche suivant', at.toISOString(), '2026-09-13T04:00:00.000Z')
  eq('et c’est bien un dimanche sur place', partsIn(at, 'America/Toronto').dow, 0)
}

/**
 * LE JOUR MEME, AVANT ET APRES L'HEURE.
 *
 * C'est le cas qu'un tableau de sept jours rate une fois par semaine: si
 * l'occurrence d'aujourd'hui est passee, la reponse est dans sept jours.
 */
{
  const before = new Date('2026-09-13T03:00:00Z') // samedi 23:00 a Toronto
  eq('juste avant l’heure, c’est aujourd’hui',
     nextOpening({ dow: 0, hour: 0, tz: 'America/Toronto' }, before).toISOString(),
     '2026-09-13T04:00:00.000Z')
  const after = new Date('2026-09-13T05:00:00Z') // dimanche 01:00 a Toronto
  eq('juste apres, c’est la semaine prochaine',
     nextOpening({ dow: 0, hour: 0, tz: 'America/Toronto' }, after).toISOString(),
     '2026-09-20T04:00:00.000Z')
}

/* --- la phrase sous le nom du groupe ---------------------------------------- */

/**
 * LE CAS DE LA CAPTURE: un groupe regle sur dimanche 00:00 a Toronto, lu par
 * quelqu'un a Paris. Le meme instant s'y lit dimanche 06:00.
 */
{
  const now = new Date('2026-09-08T13:00:00Z')
  const l = openingLabel({ dow: 0, hour: 0, tz: 'America/Toronto', viewerTz: 'Europe/Paris', locale: 'fr', now })
  eq('a Paris la porte s’ouvre le dimanche a 06:00', l.when, 'dimanche 06:00')
  eq('et le groupe, lui, dit dimanche 00:00', l.groupWhen, 'dimanche 00:00')
  ok('les deux fuseaux different, donc on le dit', l.sameZone === false)
  eq('et c’est le meme instant', l.at.toISOString(), '2026-09-13T04:00:00.000Z')
}

/* Chez la personne qui a cree le groupe, rien a preciser. */
{
  const now = new Date('2026-09-08T13:00:00Z')
  const l = openingLabel({ dow: 0, hour: 0, tz: 'America/Toronto', viewerTz: 'America/Toronto', locale: 'fr', now })
  eq('a Toronto la ligne dit dimanche 00:00', l.when, 'dimanche 00:00')
  ok('et il n’y a pas de deuxieme phrase', l.sameZone === true)
}

/**
 * DEUX NOMS POUR LA MEME HEURE.
 *
 * Montreal et Toronto sont deux fuseaux distincts qui n'ont jamais differe.
 * Dire a quelqu'un de Montreal "c'est aussi minuit a Toronto" est une
 * precision qui ne precise rien, donc sameZone compare l'heure obtenue et pas
 * le nom du fuseau.
 */
{
  const now = new Date('2026-09-08T13:00:00Z')
  const l = openingLabel({ dow: 0, hour: 0, tz: 'America/Toronto', viewerTz: 'America/Montreal', locale: 'fr', now })
  ok('Montreal ne declenche pas la precision', l.sameZone === true, `${l.when} / ${l.groupWhen}`)
}

/**
 * LES DEUX SEMAINES OU LE DECALAGE N'EST PAS CELUI QU'ON CROIT.
 *
 * L'Europe change d'heure le 25 octobre 2026, l'Amerique du Nord le 1er
 * novembre. Entre les deux, Toronto et Paris sont a cinq heures et non six.
 * Une soustraction ecrite en dur se tromperait ici, deux fois par an.
 */
{
  const now = new Date('2026-10-26T13:00:00Z')
  const l = openingLabel({ dow: 0, hour: 0, tz: 'America/Toronto', viewerTz: 'Europe/Paris', locale: 'fr', now })
  eq('dans la semaine decalee, Paris lit 05:00 et non 06:00', l.when, 'dimanche 05:00')
  eq('pendant que le groupe dit toujours 00:00', l.groupWhen, 'dimanche 00:00')
}

/* --- l'anglais, et les valeurs manquantes ----------------------------------- */

{
  const now = new Date('2026-09-08T13:00:00Z')
  const l = openingLabel({ dow: 0, hour: 0, tz: 'America/Toronto', viewerTz: 'Europe/Paris', locale: 'en', now })
  eq('en anglais aussi', l.when, 'Sunday 06:00')
}

/* Une ligne de groupe ecrite avant que ces colonnes existent, ou un rendu
   entre la route et l'arrivee de la ligne: pas de phrase, pas de "undefined".
   C'est le meme defaut que l'ecran des reglages avait deja corrige. */
{
  const l = openingLabel({ dow: undefined, hour: 0, tz: 'America/Toronto', viewerTz: 'Europe/Paris' })
  eq('sans jour, pas de phrase', l.when, '')
  ok('et pas d’instant', l.at === null)
}
{
  const l = openingLabel({ dow: 0, hour: null, tz: 'America/Toronto', viewerTz: 'Europe/Paris' })
  eq('sans heure non plus', l.when, '')
}
{
  const now = new Date('2026-09-08T13:00:00Z')
  const l = openingLabel({ dow: 0, hour: 0, tz: 'Mars/Olympus', viewerTz: 'Mars/Olympus', locale: 'fr', now })
  ok('un fuseau inconnu retombe sur UTC plutot que de casser la page', l.when.startsWith('dimanche'), l.when)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
