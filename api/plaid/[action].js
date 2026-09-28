import disconnect from '../_bank/disconnect.js'
import exchange from '../_bank/exchange.js'
import linkToken from '../_bank/link-token.js'
import status from '../_bank/status.js'
import sync from '../_bank/sync.js'

/**
 * Les cinq routes Plaid, en UNE fonction.
 *
 * POURQUOI. Le plan Hobby de Vercel accepte douze fonctions par deploiement,
 * et ce depot en avait exactement douze: sept a la racine de api/ et les cinq
 * de Plaid. Le deploiement de #301 (Google Agenda et Outlook) a ete refuse
 * pour "No more than 12 Serverless Functions", apres un build vert. Une route
 * dynamique `[action].js` compte pour une fonction et repond aux memes URL:
 * /api/plaid/sync arrive ici avec req.query.action = 'sync'.
 *
 * Les cinq handlers n'ont pas bouge d'une ligne, seulement de dossier:
 * api/_bank/, que Vercel ne deploie pas comme fonctions parce que le nom
 * commence par un tiret bas, comme _env.js et _plaid.js a cote. Le client
 * (src/lib/plaidLink.js) appelle les memes chemins qu'avant.
 *
 * Une action inconnue rend 404 en JSON, comme le ferait un fichier absent,
 * pour que plaidLink.js lise une reponse d'API et pas la page HTML de Vercel.
 */
const ROUTES = { disconnect, exchange, 'link-token': linkToken, status, sync }

export default async function handler(req, res) {
  const route = ROUTES[String(req.query?.action ?? '')]
  if (!route) return res.status(404).json({ error: 'Not found' })
  return route(req, res)
}
