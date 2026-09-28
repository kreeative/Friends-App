import exportIcs from './_calendar/export.js'
import syncFeeds from './_calendar/sync.js'

/**
 * Google Agenda et Outlook, les deux sens, en UNE fonction.
 *
 *   GET  /api/calendar?t=<token>   le calendrier Rich & Friends en iCalendar,
 *                                  ce que Google et Outlook viennent lire
 *                                  (vercel.json reecrit /cal/<token>.ics ici)
 *   POST /api/calendar             relire les flux branches, pour la personne
 *                                  dont le jeton est en Bearer
 *
 * Deux fichiers sous api/_calendar/, un par sens, parce qu'ils n'ont rien en
 * commun: l'un parle a n'importe qui avec un token et rend un 404 uniforme,
 * l'autre parle a une personne connectee et rend des mots-codes. Ils sont
 * reunis ici et pas deployes chacun de leur cote a cause de la limite de
 * douze fonctions du plan Hobby, voir api/plaid/[action].js.
 *
 * La methode decide. Ni l'un ni l'autre ne lit la methode de l'autre, donc
 * un GET sans token reste un 404 et un POST sans jeton reste un 401.
 */
export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') return exportIcs(req, res)
  if (req.method === 'POST') return syncFeeds(req, res)
  res.setHeader('Allow', 'GET, HEAD, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
