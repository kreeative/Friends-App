import coach from '../_bb/coach.js'
import generate from '../_bb/generate.js'
import ingest from '../_bb/ingest.js'
import preview from '../_bb/preview.js'
import remove, { purge } from '../_bb/remove.js'
import status from '../_bb/status.js'
import vary from '../_bb/vary.js'
import visual from '../_bb/visual.js'
import { elaborate, report } from '../_bb/check.js'
import { cancel, checkout, portal, resume, sync } from '../_bb/billing.js'
import { grade, makeCase } from '../_bb/cases.js'

/**
 * Every Beauty & Brain route, in ONE function.
 *
 * The Hobby plan deploys at most twelve functions and this repository had
 * eleven. A dynamic `[action].js` counts as one and answers every path under
 * /api/bb/, exactly like api/plaid/[action].js: /api/bb/ingest arrives here
 * with req.query.action = 'ingest'. The handlers live in api/_bb/, which
 * Vercel does not deploy as functions because the folder name starts with an
 * underscore. src/lib/apiSyntax.test.mjs counts them.
 *
 * One function also means one maxDuration: 300 s in vercel.json, which the
 * file reading needs and the short routes never reach.
 *
 * An unknown action answers 404 in JSON, so the app reads an API answer and
 * not Vercel's HTML page.
 */
const ROUTES = { cancel, case: makeCase, checkout, coach, elaborate, generate, grade, ingest, portal, preview, purge, remove, report, resume, status, sync, vary, visual }

export default async function handler(req, res) {
  const route = ROUTES[String(req.query?.action ?? '')]
  if (!route) return res.status(404).json({ error: 'not_found' })
  return route(req, res)
}
