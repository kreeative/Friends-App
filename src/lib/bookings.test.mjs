/**
 * node src/lib/bookings.test.mjs
 *
 * Les reservations Cal.com, des deux cotes: ce que l'API retient d'un paiload,
 * et ce que le calendrier en dessine.
 *
 * Les cas interessants sont tous des cas ou la chose a l'air de marcher:
 * une heure lue en UTC au lieu du local pose un rendez-vous de 14h a 18h sans
 * rien qui semble faux, une signature comparee avec === rend le bon resultat
 * en fuyant le secret, et un nom pris au premier attendee met "Kee a reserve
 * avec Kee" sur le calendrier de Kee.
 */
import { bookingEntries, bookingHref, bookingTitle } from './bookings.js'

/**
 * Le handler fabrique son client Supabase au chargement du module, et
 * supabase-js leve sur une URL vide, donc l'import a besoin de ces deux-la.
 * Ce sont volontairement des valeurs qui n'ont l'air de rien: rien dans ce
 * fichier ne fait de requete, et une valeur qui aurait l'air vraie inviterait
 * quelqu'un a croire qu'elle l'est. Meme forme que webhookBody.test.mjs.
 */
process.env.SUPABASE_URL ||= 'http://bookings-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'not-a-key'
const { bookingFrom, signatureOk } = await import('../../api/cal-webhook.js')

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

console.log('\nbookings\n')

/* --- le titre ------------------------------------------------------------ */
eq('le type et le prenom', bookingTitle({ title: 'Discovery call', guest_name: 'Fatim' }),
   'Discovery call, Fatim')
/* Cal envoie parfois une reservation sans invite nomme. Le titre seul reste
   utile, et une virgule orpheline ne l'est pas. */
eq('sans nom, le titre seul', bookingTitle({ title: 'Discovery call' }), 'Discovery call')
eq('un nom vide ne compte pas', bookingTitle({ title: 'Call', guest_name: '  ' }), 'Call')
eq('sans titre, le nom seul', bookingTitle({ guest_name: 'Fatim' }), 'Fatim')
eq('rien du tout', bookingTitle({}), '')
eq('rien du tout, sans objet', bookingTitle(null), '')

/* --- ou va le clic ------------------------------------------------------- */
/* L'appel d'abord: a 14h moins une, la chose a ouvrir est la salle. */
eq('la salle passe avant la fiche',
   bookingHref({ join_url: 'https://meet.example/x', web_url: 'https://app.cal.com/booking/u1' }),
   'https://meet.example/x')
eq('la fiche quand il n y a pas de salle',
   bookingHref({ web_url: 'https://app.cal.com/booking/u1' }), 'https://app.cal.com/booking/u1')
eq('rien a ouvrir', bookingHref({}), null)
/* Cal met "attendeeInPerson" ou "Cal Video" dans location selon le type de
   rendez-vous. Un href qui n'est pas une URL fabrique un lien mort. */
eq('un lieu qui n est pas un lien ne devient pas un lien',
   bookingHref({ join_url: 'attendeeInPerson' }), null)
eq('ni un javascript:', bookingHref({ join_url: 'javascript:alert(1)' }), null)
eq('http passe aussi', bookingHref({ join_url: 'http://meet.example/x' }), 'http://meet.example/x')

/* --- l'heure, qui est le piege ------------------------------------------- */
{
  /* Un instant precis, exprime en UTC. Ce que la grille doit en faire depend
     du fuseau de l'appareil, donc le test lit le meme instant avec Date
     plutot que d'ecrire "14:00" en dur: un test qui code le resultat attendu
     pour un seul fuseau echoue sur la machine de quelqu'un d'autre et ne dit
     rien de juste. */
  const iso = '2026-10-02T18:00:00.000Z'
  const d = new Date(iso)
  const [e] = bookingEntries([{
    id: 'b1', title: 'Discovery call', guest_name: 'Fatim',
    starts_at: iso, ends_at: '2026-10-02T18:30:00.000Z',
    web_url: 'https://app.cal.com/booking/u1', join_url: null, cancelled_at: null,
  }])

  eq('le jour est le jour local', e.starts_on,
     `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  eq('et l heure aussi', e.start_min, d.getHours() * 60 + d.getMinutes())
  eq('la fin suit', e.end_min, e.start_min + 30)
  eq('le titre porte les deux', e.title, 'Discovery call, Fatim')
  eq('la categorie est synthetique', e.category, 'reservation')
  ok('elle porte son id de reservation', e.bookingOf === 'b1')
  ok('elle ne se repete pas', Array.isArray(e.weekdays) && e.weekdays.length === 0)
  eq('et le clic va sur la fiche', e.href, 'https://app.cal.com/booking/u1')
  /* Le bouton doit dire "Ouvrir dans Cal" et pas "Rejoindre": il n'y a pas de
     salle, et envoyer quelqu'un rejoindre un appel qui n'existe pas est pire
     qu'un bouton de plus. */
  eq('et il ne se dit pas rejoignable', e.joinable, false)
}

{
  const [e] = bookingEntries([{
    id: 'b1', title: 'Call', starts_at: '2026-10-02T18:00:00Z', ends_at: '2026-10-02T18:30:00Z',
    join_url: 'https://meet.example/x', web_url: 'https://app.cal.com/booking/u1',
  }])
  eq('avec une salle, le clic y va', e.href, 'https://meet.example/x')
  eq('et le bouton se dit rejoignable', e.joinable, true)
}

/* --- ce qui n'est pas dessine -------------------------------------------- */
{
  const rows = [
    { id: 'b1', title: 'A', starts_at: '2026-10-02T18:00:00Z', ends_at: '2026-10-02T18:30:00Z', cancelled_at: null },
    /* Annulee. La ligne reste en base pour repondre a "ou est passe mon
       rendez-vous de jeudi", mais un rendez-vous annule sur la grille est un
       rendez-vous auquel on se presente. */
    { id: 'b2', title: 'B', starts_at: '2026-10-03T18:00:00Z', ends_at: '2026-10-03T18:30:00Z', cancelled_at: '2026-10-01T00:00:00Z' },
    { id: 'b3', title: '', starts_at: '2026-10-04T18:00:00Z', ends_at: '2026-10-04T18:30:00Z', cancelled_at: null },
    { id: 'b4', title: 'D', starts_at: 'pas une date', ends_at: 'non plus', cancelled_at: null },
    { title: 'sans id', starts_at: '2026-10-05T18:00:00Z', ends_at: '2026-10-05T18:30:00Z' },
  ]
  const ids = bookingEntries(rows).map((e) => e.bookingOf)
  eq('seule la vivante et complete est dessinee', ids.join(','), 'b1')
}
eq('aucune ligne, aucune entree', bookingEntries([]).length, 0)
eq('ni pour null', bookingEntries(null).length, 0)
eq('ni pour undefined', bookingEntries().length, 0)

{
  /* Un rendez-vous qui traverse minuit. end_min < start_min donnerait un bloc
     de hauteur negative, et blockStyle le dessinerait a l'envers. */
  const [e] = bookingEntries([{
    id: 'b1', title: 'Late call',
    starts_at: new Date(2026, 9, 2, 23, 30).toISOString(),
    ends_at: new Date(2026, 9, 3, 0, 30).toISOString(),
    cancelled_at: null,
  }])
  eq('il est coupe a minuit', e.end_min, 1440)
  ok('et la fin reste apres le debut', e.end_min > e.start_min)
}

{
  /* La borne. Un `from`/`to` absent ne filtre rien, parce que la requete a
     deja borne la plage: refiltrer avec des bornes que l'appelant n'a pas
     donnees viderait la grille en silence. */
  const rows = [
    { id: 'b1', title: 'A', starts_at: '2026-10-02T18:00:00Z', ends_at: '2026-10-02T18:30:00Z' },
    { id: 'b2', title: 'B', starts_at: '2026-12-02T18:00:00Z', ends_at: '2026-12-02T18:30:00Z' },
  ]
  eq('sans bornes, tout passe', bookingEntries(rows).length, 2)
  eq('avec des bornes, la plage decide',
     bookingEntries(rows, new Date('2026-10-01'), new Date('2026-10-31')).length, 1)
}

/* --- ce que l'API retient d'un paiload Cal ------------------------------- */
{
  /* La forme que Cal envoie vraiment: l'organisatrice est DANS attendees sur
     certains types de rendez-vous. Prendre attendees[0] mettrait "Discovery
     call, Kee" sur le calendrier de Kee. */
  const payload = {
    uid: 'abc123',
    title: 'Discovery call',
    startTime: '2026-10-02T18:00:00Z',
    endTime: '2026-10-02T18:30:00Z',
    organizer: { name: 'Kee', email: 'Kee@Kreeative.CA', timeZone: 'America/Toronto' },
    attendees: [
      { name: 'Kee', email: 'kee@kreeative.ca' },
      { name: 'Fatim', email: 'fatim@example.com', timeZone: 'Europe/Paris' },
    ],
    metadata: { videoCallUrl: 'https://meet.example/x' },
    location: 'integrations:daily',
    /* Ce qui NE DOIT PAS ressortir. */
    responses: { notes: { value: 'je veux parler de mon budget' } },
  }
  const row = bookingFrom(payload, 'u1')

  eq('le nom est celui de l invitee, pas de l organisatrice', row.guest_name, 'Fatim')
  eq('le titre est le type de rendez-vous', row.title, 'Discovery call')
  eq('la fiche est deduite de l uid', row.web_url, 'https://app.cal.com/booking/abc123')
  eq('la salle vient de metadata', row.join_url, 'https://meet.example/x')
  eq('l instant est garde en ISO', row.starts_at, new Date('2026-10-02T18:00:00Z').toISOString())
  eq('sur le bon compte', row.user_id, 'u1')
  eq('et une nouvelle reservation n est pas annulee', row.cancelled_at, null)

  /* LE COEUR DE LA DECISION DE CONFIDENTIALITE: la ligne ecrite ne porte que
     ces colonnes. Le courriel, le fuseau et les reponses au formulaire sont
     dans le paiload, passent ici, et ne ressortent pas. Tester la liste
     EXACTE plutot que l'absence de trois champs: une colonne ajoutee par
     distraction serait sinon invisible. */
  eq('et rien d autre ne sort du paiload', Object.keys(row).sort().join(','),
     'cancelled_at,ends_at,guest_name,join_url,source,starts_at,title,uid,updated_at,user_id,web_url')
  ok('pas de courriel nulle part', !JSON.stringify(row).includes('example.com'))
  ok('pas de reponses de formulaire non plus', !JSON.stringify(row).toLowerCase().includes('budget'))
}

{
  /* location ne sert de lien que s'il en est un. Cal y met "attendeeInPerson",
     "integrations:daily" ou un vrai lien Zoom selon le type. */
  const base = {
    uid: 'u', title: 'T', startTime: '2026-10-02T18:00:00Z', endTime: '2026-10-02T18:30:00Z',
    organizer: { email: 'k@x.ca' }, attendees: [],
  }
  eq('un lieu qui est un lien sert de salle',
     bookingFrom({ ...base, location: 'https://zoom.us/j/1' }, 'u1').join_url, 'https://zoom.us/j/1')
  eq('un lieu qui n en est pas un ne sert de rien',
     bookingFrom({ ...base, location: 'attendeeInPerson' }, 'u1').join_url, null)
  eq('sans invite, pas de nom', bookingFrom(base, 'u1').guest_name, null)
}

/* Un paiload amputé rend null plutot qu'une ligne a moitie vraie: la contrainte
   `not null` sur title la refuserait de toute facon, et un 500 sur une
   reservation reelle fait reessayer Cal en boucle. */
eq('sans uid, rien', bookingFrom({ title: 'T', startTime: '2026-10-02T18:00:00Z', endTime: '2026-10-02T18:30:00Z' }, 'u1'), null)
eq('sans titre, rien', bookingFrom({ uid: 'u', startTime: '2026-10-02T18:00:00Z', endTime: '2026-10-02T18:30:00Z' }, 'u1'), null)
eq('sans heures, rien', bookingFrom({ uid: 'u', title: 'T' }, 'u1'), null)
eq('sans rien, rien', bookingFrom(null, 'u1'), null)

/* --- la signature -------------------------------------------------------- */
{
  const secret = 'un-secret-de-signature-assez-long'
  const body = Buffer.from(JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'a' } }))
  const { createHmac } = await import('node:crypto')
  const bonne = createHmac('sha256', secret).update(body).digest('hex')

  ok('une signature juste passe', signatureOk(body, bonne, secret))
  ok('en majuscules aussi, Cal ne promet pas la casse', signatureOk(body, bonne.toUpperCase(), secret))
  ok('avec des espaces autour aussi', signatureOk(body, `  ${bonne}\n`, secret))

  ok('une signature fausse ne passe pas', !signatureOk(body, `${bonne.slice(0, -1)}0`, secret))
  ok('ni celle d un autre secret',
     !signatureOk(body, createHmac('sha256', 'autre').update(body).digest('hex'), secret))
  /* UN OCTET DE DIFFERENCE DANS LE CORPS DOIT SUFFIRE. C'est tout l'interet de
     signer le corps brut: un paiload modifie en vol ne passe pas. */
  ok('ni la bonne signature sur un autre corps',
     !signatureOk(Buffer.from(`${body.toString()} `), bonne, secret))

  /* Les absences. timingSafeEqual leve sur deux tampons de tailles
     differentes au lieu de rendre false, donc une longueur non verifiee
     ferait un 500 la ou il faut un 401. */
  ok('pas de signature du tout', !signatureOk(body, null, secret))
  ok('une signature vide', !signatureOk(body, '', secret))
  ok('une signature trop courte ne fait pas lever', !signatureOk(body, 'abc', secret))
  ok('une signature trop longue non plus', !signatureOk(body, `${bonne}${bonne}`, secret))
  ok('pas de secret, rien ne passe', !signatureOk(body, bonne, ''))
  ok('ni avec un secret absent', !signatureOk(body, bonne, undefined))
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
