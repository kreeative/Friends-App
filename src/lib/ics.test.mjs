/**
 * node src/lib/ics.test.mjs
 *
 * Google Agenda et Outlook, dans les deux sens: ce que le lecteur iCalendar
 * comprend d'un flux, et ce que l'ecrivain met dans le fichier que Google et
 * Outlook viennent lire.
 *
 * Les cas qui comptent sont ceux ou la chose a l'air de marcher: une heure
 * murale lue en UTC pose un cours de 9h a 13h sans que rien semble faux, une
 * regle hebdomadaire iteree sur des instants glisse d'une heure au changement
 * d'heure, une exception RECURRENCE-ID ignoree fait revenir un rendez-vous
 * deplace, et un fichier "toutes les minutes depuis 1970" fait expirer la
 * fonction si rien ne borne la boucle.
 */
import {
  expandCalendar, expandRRule, ianaName, nthWeekday, parseDateValue, parseDuration, parseLine,
  parseRRule, toInstant, unfold, wallToUtc, looksLikeIcs,
} from './ics.js'
import { buildIcs, escapeText, eventLines, foldLine, transitionsOf, vtimezone } from './icsExport.js'
import { feedEntries, feedUrlProblem, providerOf, staleFeeds } from './feeds.js'

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

console.log('\nics\n')

/* --- les lignes ----------------------------------------------------------- */
deq('une ligne pliee est recollee', unfold('SUMMARY:Cours de bio\r\n chimie\r\nEND:VEVENT'), ['SUMMARY:Cours de biochimie', 'END:VEVENT'])
deq('un pli par tabulation aussi', unfold('A:b\n\tc'), ['A:bc'])
deq('un parametre entre guillemets peut contenir le deux-points',
    parseLine('ATTACH;FMTTYPE="a:b":https://x.y/z'), { name: 'ATTACH', params: { FMTTYPE: 'a:b' }, value: 'https://x.y/z' })
deq('TZID est lu comme parametre', parseLine('DTSTART;TZID=America/Toronto:20261002T090000'),
    { name: 'DTSTART', params: { TZID: 'America/Toronto' }, value: '20261002T090000' })
eq('le nom est mis en majuscules', parseLine('summary:x').name, 'SUMMARY')
eq('une ligne sans deux-points n est rien', parseLine('BEGIN'), null)

/* --- les dates ------------------------------------------------------------ */
{
  const d = parseDateValue('20261002')
  ok('une date sans heure est une journee entiere', d.allDay && d.wall === Date.UTC(2026, 9, 2))
  const t = parseDateValue('20261002T090000', { TZID: 'America/Toronto' })
  ok('une heure murale garde son fuseau', !t.allDay && !t.utc && t.tzid === 'America/Toronto')
  const z = parseDateValue('20261002T130000Z')
  ok('un Z est un instant UTC', z.utc && z.tzid === null && z.wall === Date.UTC(2026, 9, 2, 13))
  eq('VALUE=DATE force la journee entiere meme avec une heure', parseDateValue('20261002T090000', { VALUE: 'DATE' }).allDay, true)
  eq('n importe quoi n est pas une date', parseDateValue('demain'), null)
}
eq('PT1H30M', parseDuration('PT1H30M'), 5400000)
eq('P1D', parseDuration('P1D'), 86400000)
eq('P2W', parseDuration('P2W'), 14 * 86400000)
eq('-PT15M', parseDuration('-PT15M'), -900000)
eq('pas une duree', parseDuration('1h'), null)

/* --- les fuseaux ---------------------------------------------------------- */
/**
 * LE PIEGE CENTRAL: 9h a Toronto, c'est 13h UTC en octobre et 14h UTC en
 * decembre. Une conversion qui rend 9h UTC poserait le cours a 5h du matin
 * sur la grille, et rien n'aurait l'air faux dans le code.
 */
eq('9h Toronto en octobre, c est 13h UTC', wallToUtc(Date.UTC(2026, 9, 2, 9), 'America/Toronto'), Date.UTC(2026, 9, 2, 13))
eq('9h Toronto en decembre, c est 14h UTC', wallToUtc(Date.UTC(2026, 11, 2, 9), 'America/Toronto'), Date.UTC(2026, 11, 2, 14))
eq('un nom Windows est traduit', ianaName('Eastern Standard Time'), 'America/New_York')
eq('un nom IANA passe tel quel', ianaName('Europe/Paris'), 'Europe/Paris')
eq('un nom Outlook precede d une barre aussi', ianaName('/Europe/Paris'), 'Europe/Paris')
eq('un nom inconnu rend null', ianaName('Mars/Olympus'), null)

/* Un VTIMEZONE fait main, pour un fuseau qu'Intl ne connait pas. Les regles
   sont celles de l'Est nord-americain: c'est le plan B d'Outlook. */
const VTZ = [
  'BEGIN:VTIMEZONE', 'TZID:Ma Zone', 'BEGIN:STANDARD', 'DTSTART:16010101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'END:STANDARD',
  'BEGIN:DAYLIGHT', 'DTSTART:16010101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'END:DAYLIGHT', 'END:VTIMEZONE',
].join('\r\n')
{
  const ics = `BEGIN:VCALENDAR\r\n${VTZ}\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART;TZID=Ma Zone:20261002T090000\r\nDTEND;TZID=Ma Zone:20261002T100000\r\nSUMMARY:Ete\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:b\r\nDTSTART;TZID=Ma Zone:20261202T090000\r\nDTEND;TZID=Ma Zone:20261202T100000\r\nSUMMARY:Hiver\r\nEND:VEVENT\r\nEND:VCALENDAR`
  const occ = expandCalendar(ics, Date.UTC(2026, 8, 1), Date.UTC(2027, 0, 1))
  eq('un VTIMEZONE inconnu d Intl est lu par ses regles, ete', occ.find((o) => o.uid === 'a')?.startsAt, '2026-10-02T13:00:00.000Z')
  eq('et hiver', occ.find((o) => o.uid === 'b')?.startsAt, '2026-12-02T14:00:00.000Z')
}
{
  /* Une heure flottante: 9h la ou est qui lit. */
  const t = toInstant(parseDateValue('20261002T090000'), new Map(), 'America/Toronto')
  eq('une heure flottante est lue dans le fuseau de qui lit', t, Date.UTC(2026, 9, 2, 13))
}

/* --- les regles ----------------------------------------------------------- */
deq('FREQ=WEEKLY;BYDAY=MO,WE', parseRRule('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3'),
    { FREQ: 'WEEKLY', BYDAY: [{ n: 0, day: 1 }, { n: 0, day: 3 }], COUNT: 3 })
eq('le deuxieme dimanche de mars 2026 est le 8', nthWeekday(2026, 2, 0, 2), 8)
eq('le dernier vendredi d octobre 2026 est le 30', nthWeekday(2026, 9, 5, -1), 30)
eq('un cinquieme lundi qui n existe pas rend null', nthWeekday(2026, 1, 1, 5), null)

const W = (y, m, d, h = 0) => Date.UTC(y, m - 1, d, h)
{
  /* Un cours du lundi et du mercredi a 9h, a partir du mercredi 2 septembre. */
  const r = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE')
  const walls = expandRRule(W(2026, 9, 2, 9), r, W(2026, 9, 1), W(2026, 9, 16))
  deq('hebdomadaire, deux jours, dans la fenetre', walls.map((w) => new Date(w).toISOString().slice(0, 13)),
      ['2026-09-02T09', '2026-09-07T09', '2026-09-09T09', '2026-09-14T09'])
}
{
  const r = parseRRule('FREQ=WEEKLY;BYDAY=MO;COUNT=3')
  const walls = expandRRule(W(2026, 9, 7, 9), r, W(2026, 1, 1), W(2027, 1, 1))
  eq('COUNT compte depuis le debut', walls.length, 3)
}
{
  const r = parseRRule('FREQ=WEEKLY;BYDAY=MO;COUNT=10')
  const walls = expandRRule(W(2026, 9, 7, 9), r, W(2026, 10, 1), W(2027, 1, 1))
  /* 7, 14, 21, 28 sept sont avant la fenetre mais comptent; restent 5, 12,
     19, 26 oct, 2, 9 nov = 6. */
  eq('COUNT compte aussi les occurrences avant la fenetre', walls.length, 6)
}
{
  const r = parseRRule('FREQ=WEEKLY;BYDAY=TU;UNTIL=20260922T235959Z')
  const walls = expandRRule(W(2026, 9, 1, 9), r, W(2026, 9, 1), W(2026, 12, 1))
  eq('UNTIL arrete la serie', walls.length, 4)
}
{
  const r = parseRRule('FREQ=DAILY;INTERVAL=2')
  const walls = expandRRule(W(2026, 9, 1, 9), r, W(2026, 9, 1), W(2026, 9, 8))
  deq('quotidien tous les deux jours', walls.map((w) => new Date(w).getUTCDate()), [1, 3, 5, 7])
}
{
  const r = parseRRule('FREQ=MONTHLY;BYDAY=2TU')
  const walls = expandRRule(W(2026, 9, 8, 19), r, W(2026, 9, 1), W(2026, 12, 31))
  deq('mensuel, le deuxieme mardi', walls.map((w) => new Date(w).toISOString().slice(0, 10)),
      ['2026-09-08', '2026-10-13', '2026-11-10', '2026-12-08'])
}
{
  const r = parseRRule('FREQ=MONTHLY')
  const walls = expandRRule(W(2026, 1, 31, 9), r, W(2026, 1, 1), W(2026, 6, 1))
  deq('mensuel le 31 saute les mois courts', walls.map((w) => new Date(w).getUTCMonth() + 1), [1, 3, 5])
}
{
  const r = parseRRule('FREQ=YEARLY')
  const walls = expandRRule(W(2000, 3, 14), r, W(2026, 1, 1), W(2027, 12, 31))
  deq('annuel, un anniversaire', walls.map((w) => new Date(w).toISOString().slice(0, 10)), ['2026-03-14', '2027-03-14'])
}
{
  /* UN FICHIER MALVEILLANT. Toutes les minutes depuis 1970: sans plafond la
     fonction Vercel expire. Ici la lecture rend au plus la premiere. */
  const r = parseRRule('FREQ=MINUTELY')
  const walls = expandRRule(W(1970, 1, 1), r, W(2026, 1, 1), W(2027, 1, 1))
  eq('MINUTELY n est pas deplie', walls.length, 0)
  const t0 = Date.now()
  const daily = expandRRule(W(1970, 1, 1), parseRRule('FREQ=DAILY'), W(2026, 1, 1), W(2026, 12, 31))
  ok('quotidien depuis 1970 rend l annee demandee et pas plus', daily.length === 365, String(daily.length))
  ok('et en moins d une seconde', Date.now() - t0 < 1000)
}

/* --- un fichier entier ---------------------------------------------------- */
const GOOGLE = [
  'BEGIN:VCALENDAR', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'VERSION:2.0',
  'X-WR-CALNAME:Kee', 'X-WR-TIMEZONE:America/Toronto',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/Toronto:20260908T090000', 'DTEND;TZID=America/Toronto:20260908T103000',
  'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261211T045959Z', 'EXDATE;TZID=America/Toronto:20261013T090000',
  'UID:cours@google.com', 'SUMMARY:Biochimie', 'LOCATION:B-2245', 'URL:https://www.google.com/calendar/event?eid=abc',
  'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P0DT0H10M0S', 'END:VALARM', 'END:VEVENT',
  /* L'occurrence du 15 octobre, deplacee au 16 a 14h. */
  'BEGIN:VEVENT', 'DTSTART;TZID=America/Toronto:20261016T140000', 'DTEND;TZID=America/Toronto:20261016T153000',
  'RECURRENCE-ID;TZID=America/Toronto:20261015T090000', 'UID:cours@google.com', 'SUMMARY:Biochimie (deplace)', 'END:VEVENT',
  /* Une journee entiere de deux jours. */
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261024', 'DTEND;VALUE=DATE:20261026', 'UID:retraite@google.com',
  'SUMMARY:Retraite d\\, equipe\\; Mont-Tremblant', 'END:VEVENT',
  /* Un evenement annule, qui ne doit rien rendre. */
  'BEGIN:VEVENT', 'DTSTART:20261020T180000Z', 'DTEND:20261020T190000Z', 'UID:annule@google.com',
  'SUMMARY:Annule', 'STATUS:CANCELLED', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

{
  const occ = expandCalendar(GOOGLE, Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 31, 23, 59), { fallbackZone: 'America/Toronto' })
  const cours = occ.filter((o) => o.uid === 'cours@google.com')
  const jours = cours.map((o) => o.startsAt.slice(0, 10))
  /* Octobre 2026: mardis 6, 13, 20, 27; jeudis 1, 8, 15, 22, 29. Le 13 est
     exclu, le 15 est deplace au 16. */
  deq('les mardis et jeudis d octobre, moins l exclu, le deplace a sa nouvelle date', jours,
      ['2026-10-01', '2026-10-06', '2026-10-08', '2026-10-16', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29'])
  eq('a 13h UTC, parce que 9h a Toronto en octobre', cours[0].startsAt, '2026-10-01T13:00:00.000Z')
  eq('et fini a 14h30 UTC', cours[0].endsAt, '2026-10-01T14:30:00.000Z')
  const deplace = cours.find((o) => o.startsAt.startsWith('2026-10-16'))
  eq('l occurrence deplacee porte son propre titre', deplace?.title, 'Biochimie (deplace)')
  eq('et sa nouvelle heure', deplace?.startsAt, '2026-10-16T18:00:00.000Z')
  eq('le lieu descend', cours[0].location, 'B-2245')
  eq('et le lien', cours[0].url, 'https://www.google.com/calendar/event?eid=abc')
  eq('l alarme n a rien casse', cours[0].title, 'Biochimie')

  const retraite = occ.find((o) => o.uid === 'retraite@google.com')
  ok('une journee entiere est une date, pas un instant', retraite?.allDay && retraite.startsOn === '2026-10-24' && retraite.endsOn === '2026-10-26')
  eq('le texte est desechappe', retraite?.title, 'Retraite d, equipe; Mont-Tremblant')
  eq('un evenement annule ne rend rien', occ.some((o) => o.uid === 'annule@google.com'), false)
}
{
  /* La meme serie, vue de decembre: UNTIL la coupe apres le 10. */
  const occ = expandCalendar(GOOGLE, Date.UTC(2026, 11, 1), Date.UTC(2026, 11, 31), { fallbackZone: 'America/Toronto' })
  deq('UNTIL coupe la serie', occ.map((o) => o.startsAt.slice(0, 10)), ['2026-12-01', '2026-12-03', '2026-12-08', '2026-12-10'])
  eq('et en decembre 9h Toronto est 14h UTC', occ[0].startsAt, '2026-12-01T14:00:00.000Z')
}

/* Outlook: un nom de fuseau Windows, un RECURRENCE-ID en UTC. */
const OUTLOOK = [
  'BEGIN:VCALENDAR', 'PRODID:Microsoft Exchange Server 2010', 'VERSION:2.0',
  'BEGIN:VTIMEZONE', 'TZID:Eastern Standard Time', 'BEGIN:STANDARD', 'DTSTART:16010101T020000',
  'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11', 'END:STANDARD',
  'BEGIN:DAYLIGHT', 'DTSTART:16010101T020000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400',
  'RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=2SU;BYMONTH=3', 'END:DAYLIGHT', 'END:VTIMEZONE',
  'BEGIN:VEVENT', 'UID:040000008200E00074C5B7101A82E008', 'SUMMARY:Standup',
  'DTSTART;TZID=Eastern Standard Time:20261005T093000', 'DTEND;TZID=Eastern Standard Time:20261005T094500',
  'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR;WKST=SU', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:040000008200E00074C5B7101A82E008', 'RECURRENCE-ID:20261007T133000Z', 'SUMMARY:Standup',
  'DTSTART;TZID=Eastern Standard Time:20261007T110000', 'DTEND;TZID=Eastern Standard Time:20261007T111500',
  'STATUS:CANCELLED', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')
{
  const occ = expandCalendar(OUTLOOK, Date.UTC(2026, 9, 5), Date.UTC(2026, 9, 10), { fallbackZone: 'UTC' })
  deq('Outlook: cinq jours par semaine, moins l occurrence annulee en UTC',
      occ.map((o) => o.startsAt.slice(0, 10)), ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'])
  eq('et le nom Windows est bien l Est', occ[0].startsAt, '2026-10-05T13:30:00.000Z')
}

eq('un vrai fichier ressemble a un calendrier', looksLikeIcs(GOOGLE), true)
eq('une page HTML de connexion, non', looksLikeIcs('<!doctype html><html><body>Sign in</body></html>'), false)

/* --- l ecrivain ----------------------------------------------------------- */
eq('le texte est echappe', escapeText('a, b; c\\d\nligne'), 'a\\, b\\; c\\\\d\\nligne')
{
  const long = `SUMMARY:${'é'.repeat(60)}`
  const folded = foldLine(long)
  const lines = folded.split('\r\n')
  ok('une ligne longue est pliee', lines.length > 1)
  ok('a 75 octets au plus', lines.every((l) => Buffer.byteLength(l, 'utf8') <= 75), lines.map((l) => Buffer.byteLength(l, 'utf8')).join(','))
  ok('et se deplie sans perte', lines.map((l, i) => (i ? l.slice(1) : l)).join('') === long)
  eq('une ligne courte n est pas touchee', foldLine('UID:x'), 'UID:x')
}
{
  const tr = transitionsOf('America/Toronto', 2026, 2026)
  eq('Toronto change deux fois par an', tr.length, 2)
  eq('le 8 mars a 7h UTC (2h heure d hiver)', new Date(tr[0].at).toISOString(), '2026-03-08T07:00:00.000Z')
  eq('le 1er novembre a 6h UTC (2h heure d ete)', new Date(tr[1].at).toISOString(), '2026-11-01T06:00:00.000Z')
  const vt = vtimezone('America/Toronto', 2026).join('\n')
  ok('le VTIMEZONE a une observance d ete et une d hiver', /BEGIN:DAYLIGHT/.test(vt) && /BEGIN:STANDARD/.test(vt))
  ok('avec les bons decalages', /TZOFFSETFROM:-0500\nTZOFFSETTO:-0400/.test(vt) && /TZOFFSETFROM:-0400\nTZOFFSETTO:-0500/.test(vt))
  ok('et le DTSTART de l ete est 2h du matin, heure murale', /BEGIN:DAYLIGHT\nDTSTART:\d{4}0308T020000|BEGIN:DAYLIGHT\nDTSTART:\d{4}03\d{2}T020000/.test(vt), vt)
  const fixe = vtimezone('Asia/Tokyo', 2026).join('\n')
  ok('un fuseau sans heure d ete a une seule observance', /BEGIN:STANDARD/.test(fixe) && !/DAYLIGHT/.test(fixe) && /TZOFFSETTO:\+0900/.test(fixe))
}
{
  const now = Date.UTC(2026, 8, 28, 12)
  /* Un cours du mardi et du jeudi, qui commence un lundi: DTSTART doit etre
     le mardi. Une seance sautee le 13 octobre. */
  const lines = eventLines({
    id: 'e1', title: 'Biochimie, labo', location: 'B-2245', starts_on: '2026-09-07', start_min: 540, end_min: 630,
    weekdays: [2, 4], until_on: '2026-12-10', excluded_on: ['2026-10-13'],
  }, 'America/Toronto', now)
  const s = lines.join('\n')
  ok('DTSTART avance au premier jour qui colle a la regle', /DTSTART;TZID=America\/Toronto:20260908T090000/.test(s), s)
  ok('la fin suit', /DTEND;TZID=America\/Toronto:20260908T103000/.test(s))
  ok('la regle est hebdomadaire sur les jours coches', /RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261211T0[45]5959Z/.test(s), s)
  ok('l exception est en heure murale du meme fuseau', /EXDATE;TZID=America\/Toronto:20261013T090000/.test(s))
  ok('le titre est echappe', /SUMMARY:Biochimie\\, labo/.test(s))
  ok('le lieu descend', /LOCATION:B-2245/.test(s))

  const jour = eventLines({ id: 'e2', title: 'Remise', starts_on: '2026-10-05', start_min: null, end_min: null, weekdays: [] }, 'America/Toronto', now).join('\n')
  ok('une journee entiere est une DATE, finie le lendemain', /DTSTART;VALUE=DATE:20261005\nDTEND;VALUE=DATE:20261006/.test(jour), jour)
  ok('et sans regle', !/RRULE/.test(jour))
  eq('sans titre, rien', eventLines({ id: 'e3', title: '', starts_on: '2026-10-05' }, 'UTC', now).length, 0)
}
{
  const now = Date.UTC(2026, 8, 28, 12)
  const ics = buildIcs({
    zone: 'America/Toronto', now,
    events: [{ id: 'e1', title: 'Cours', starts_on: '2026-09-08', start_min: 540, end_min: 630, weekdays: [2], until_on: null, excluded_on: [] }],
    bookings: [
      { id: 'b1', title: 'Discovery call', guest_name: 'Fatim', starts_at: '2026-10-02T18:00:00Z', ends_at: '2026-10-02T18:30:00Z', join_url: 'https://meet.example/x', web_url: null, cancelled_at: null },
      { id: 'b2', title: 'Annule', guest_name: 'Sam', starts_at: '2026-10-03T18:00:00Z', ends_at: '2026-10-03T18:30:00Z', cancelled_at: '2026-10-01T00:00:00Z' },
    ],
    goals: [{ id: 'g1', commitment: 'Rendre le memoire', due_on: '2026-10-15' }],
  })
  ok('le fichier commence et finit comme un calendrier', ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'))
  ok('CRLF partout', !/[^\r]\n/.test(ics))
  ok('le fuseau est declare', /X-WR-TIMEZONE:America\/Toronto/.test(ics) && /BEGIN:VTIMEZONE\r\nTZID:America\/Toronto/.test(ics))
  ok('la reservation est en UTC, avec son lien', /DTSTART:20261002T180000Z/.test(ics) && /URL:https:\/\/meet\.example\/x/.test(ics) && /SUMMARY:Discovery call\\, Fatim/.test(ics))
  ok('la reservation annulee n y est pas', !/Annule/.test(ics))
  ok('l objectif est une journee', /UID:rf-goal-g1@richandfriends\.xyz\r\nDTSTAMP:[0-9TZ]+\r\nDTSTART;VALUE=DATE:20261015/.test(ics))
  eq('trois VEVENT', (ics.match(/BEGIN:VEVENT/g) ?? []).length, 3)
  /* LE FICHIER SE RELIT. Ce que l'ecrivain produit, le lecteur d'a cote doit
     le comprendre, et rendre les memes heures. */
  const back = expandCalendar(ics, Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 31), { fallbackZone: 'UTC' })
  const mardis = back.filter((o) => o.uid.startsWith('rf-ev-e1')).map((o) => o.startsAt)
  deq('et se relit: les mardis d octobre a 13h UTC', mardis,
      ['2026-10-06T13:00:00.000Z', '2026-10-13T13:00:00.000Z', '2026-10-20T13:00:00.000Z', '2026-10-27T13:00:00.000Z'])
  ok('jamais le cycle, jamais un anniversaire', !/cycle|period|birthday|anniv/i.test(ics))
}

/* --- les flux, cote navigateur -------------------------------------------- */
eq('https est exige', feedUrlProblem('http://calendar.google.com/calendar/ical/x/basic.ics'), 'scheme')
eq('une adresse IP est refusee', feedUrlProblem('https://169.254.169.254/latest/meta-data/'), 'host')
eq('localhost est refuse', feedUrlProblem('https://localhost:5432/x.ics'), 'host')
eq('un nom sans point est refuse', feedUrlProblem('https://supabase/x.ics'), 'host')
eq('un domaine interne est refuse', feedUrlProblem('https://db.internal/x.ics'), 'host')
eq('une IPv6 est refusee', feedUrlProblem('https://[::1]/x.ics'), 'host')
eq('des identifiants dans l URL sont refuses', feedUrlProblem('https://kee:pw@calendar.google.com/x.ics'), 'host')
eq('n importe quoi est refuse', feedUrlProblem('coucou'), 'shape')
eq('vide est refuse', feedUrlProblem(''), 'shape')
eq('l adresse secrete de Google passe', feedUrlProblem('https://calendar.google.com/calendar/ical/kee%40gmail.com/private-abc123/basic.ics'), null)
eq('celle d Outlook aussi', feedUrlProblem('https://outlook.live.com/owa/calendar/00000000-0000/abc/calendar.ics'), null)
eq('Google est reconnu', providerOf('https://calendar.google.com/calendar/ical/x/basic.ics'), 'google')
eq('Outlook.com est reconnu', providerOf('https://outlook.live.com/owa/calendar/x/calendar.ics'), 'outlook')
eq('Office 365 aussi', providerOf('https://outlook.office365.com/owa/calendar/x/calendar.ics'), 'outlook')
eq('le reste est un flux', providerOf('https://p12-caldav.icloud.com/published/2/abc'), 'ics')

{
  const now = Date.parse('2026-09-28T12:00:00Z')
  const flux = [
    { id: 'a', checked_at: null },
    { id: 'b', checked_at: '2026-09-28T11:50:00Z' },
    { id: 'c', checked_at: '2026-09-28T10:00:00Z' },
  ]
  deq('un flux jamais lu ou lu il y a plus d une demi-heure est a relire', staleFeeds(flux, now).map((f) => f.id), ['a', 'c'])
}

{
  /* Ce que la page dessine. Le fuseau de la machine compte ici: l'heure
     murale doit ressortir dans le fuseau de qui regarde, donc le test la
     calcule de la meme facon plutot que de supposer UTC. */
  const feeds = [{ id: 'f1', provider: 'google', label: null }, { id: 'f2', provider: 'outlook', label: 'Travail' }]
  const rows = [
    { id: 1, feed_id: 'f1', title: 'Biochimie', location: 'B-2245', url: null, all_day: false, starts_at: '2026-10-01T13:00:00Z', ends_at: '2026-10-01T14:30:00Z', starts_on: null, ends_on: null },
    { id: 2, feed_id: 'f2', title: 'Retraite', location: null, url: 'https://x.y/z', all_day: true, starts_at: '2026-10-24T00:00:00Z', ends_at: '2026-10-26T00:00:00Z', starts_on: '2026-10-24', ends_on: '2026-10-26' },
  ]
  const entries = feedEntries(rows, feeds)
  const cours = entries.find((e) => e.title === 'Biochimie')
  const d = new Date('2026-10-01T13:00:00Z')
  eq('une heure est lue dans le fuseau de l appareil', cours.start_min, d.getHours() * 60 + d.getMinutes())
  eq('et dure jusqu a la fin', cours.end_min, cours.start_min + 90)
  eq('elle est sur la couche externe', cours.category, 'externe')
  eq('avec sa source', cours.source, 'google')
  eq('et le feed pour refuser le formulaire', cours.feedOf, 'f1')
  const jours = entries.filter((e) => e.title === 'Retraite')
  deq('une journee entiere de deux jours fait deux entrees, aux bonnes DATES', jours.map((e) => e.starts_on), ['2026-10-24', '2026-10-25'])
  ok('sans heure', jours.every((e) => e.start_min === null))
  eq('avec l etiquette du flux', jours[0].sourceLabel, 'Travail')
  eq('et le lien', jours[0].href, 'https://x.y/z')
  const bornees = feedEntries(rows, feeds, new Date(2026, 9, 25), new Date(2026, 9, 31))
  deq('la plage borne les journees fabriquees', bornees.map((e) => e.starts_on), ['2026-10-25'])
  /* La vue du jour passe from = to = le jour a minuit. Un cours a 9h ce
     jour-la est apres minuit, et une comparaison d'instants le perdait. */
  const jourSeul = feedEntries(rows, feeds, new Date(2026, 9, 1), new Date(2026, 9, 1))
  eq('un cours du jour est dans la vue du jour', jourSeul.filter((e) => e.title === 'Biochimie').length, 1)
  eq('et pas dans celle de la veille', feedEntries(rows, feeds, new Date(2026, 8, 30), new Date(2026, 8, 30)).length, 0)
  eq('rien pour rien', feedEntries(null).length, 0)
}

/* --- l API, sans reseau -------------------------------------------------- */
/**
 * fetchIcs recoit son fetch en parametre, donc tout ceci tourne sans
 * reseau. Ce qui compte: la garde passe AVANT le fetch, une redirection vers
 * un hote interdit est refusee au saut suivant, et chaque panne rend un
 * mot-code et jamais le texte du serveur.
 */
process.env.SUPABASE_URL ||= 'http://feeds-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'not-a-key'
const { fetchIcs, rowOf } = await import('../../api/feed-sync.js')
{
  const calls = []
  const reponse = (status, body, headers = {}) => ({
    status, ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  })
  const fake = (table) => async (url) => {
    calls.push(url)
    const r = table[url]
    if (!r) throw Object.assign(new Error('ENOTFOUND'), { name: 'FetchError' })
    return r
  }

  let got = await fetchIcs('https://localhost/x.ics', { fetchImpl: fake({}) })
  eq('une adresse interdite n est jamais allee chercher', got.error, 'bad_url')
  eq('vraiment jamais', calls.length, 0)

  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({ 'https://a.example/x.ics': reponse(302, '', { location: 'https://10.0.0.5/x.ics' }) }) })
  eq('une redirection vers une IP privee est refusee au saut suivant', got.error, 'bad_url')
  eq('sans que la cible ait ete contactee', calls.filter((u) => u.includes('10.0.0.5')).length, 0)

  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({
    'https://a.example/x.ics': reponse(301, '', { location: '/y.ics' }),
    'https://a.example/y.ics': reponse(200, GOOGLE),
  }) })
  ok('une redirection relative vers le meme hote est suivie', got.text === GOOGLE, got.error)

  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({ 'https://a.example/x.ics': reponse(404, 'Not Found') }) })
  eq('404 rend son mot-code', got.error, 'http_404')
  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({ 'https://a.example/x.ics': reponse(401, 'Unauthorized') }) })
  eq('401 aussi', got.error, 'http_401')
  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({ 'https://a.example/x.ics': reponse(500, 'boom') }) })
  eq('les autres sont http_other, sans le texte du serveur', got.error, 'http_other')
  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({ 'https://a.example/x.ics': reponse(200, '<!doctype html><title>Sign in</title>') }) })
  eq('une page de connexion n est pas un calendrier', got.error, 'not_ics')
  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({}) })
  eq('un hote qui ne repond pas est injoignable', got.error, 'unreachable')
  got = await fetchIcs('https://a.example/x.ics', { fetchImpl: fake({ 'https://a.example/x.ics': reponse(200, GOOGLE, { 'content-length': String(6 * 1024 * 1024) }) }) })
  eq('un fichier annonce trop gros n est pas lu', got.error, 'too_big')

  const row = rowOf({ key: 'u#1', title: '', location: null, url: null, allDay: true, startsAt: '2026-10-24T00:00:00.000Z', endsAt: '2026-10-26T00:00:00.000Z', startsOn: '2026-10-24', endsOn: '2026-10-26' }, { id: 'f1', user_id: 'u1' })
  eq('une occurrence sans titre a un titre quand meme', row.title, '(sans titre)')
  eq('et porte le flux et le compte', `${row.feed_id}/${row.user_id}`, 'f1/u1')
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
