import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { env, missingEnv } from './_env.js'
import { MAX_PDF_BYTES, PLAN_SCHEMA, isoDate, normalisePlan } from '../src/lib/syllabus.js'

/**
 * Lire un plan de cours (PDF) et en rendre les cours, les dates et les
 * travaux, en JSON.
 *
 *   "est-ce que tu peux ajouter une option intelligente ou tu peux ajouter
 *    ton PDF de ton syllabus et ca va analyser pour te donner des events,
 *    des rappels de goals et des to-dos"
 *
 * POURQUOI COTE SERVEUR. La cle Anthropic ne peut pas etre dans le
 * navigateur, pour la meme raison que la cle Stripe et le secret Plaid: tout
 * ce qui est dans le bundle est public. Le navigateur envoie donc le PDF
 * ici, avec son jeton de session, et recoit un plan.
 *
 * QUI. Le jeton de session en Bearer. Pas de chemin anonyme: une lecture
 * coute de l'argent a chaque appel, et une fonction ouverte qui depense est
 * une fonction que quelqu'un finira par boucler.
 *
 * LE PDF NE RESTE NULLE PART. Il traverse cette fonction en memoire, part
 * chez Anthropic pour la lecture, et n'est ni ecrit, ni journalise, ni
 * renvoye. Ce qui est journalise en cas de panne est un mot-code et un
 * statut HTTP, jamais le document, jamais la cle, jamais le message du SDK
 * (qui peut citer la requete).
 *
 * LA REPONSE EST UN JSON CONTRAINT PAR UN SCHEMA, puis repassee par
 * normalisePlan() comme si elle ne l'etait pas: le schema garantit la
 * forme, pas qu'un "2026-02-30" est une date.
 */

/* Le modele par defaut: le plus capable de la famille. Une lecture de
   dix pages avec des tableaux est exactement ce pour quoi on ne descend pas
   de gamme. SYLLABUS_MODEL dans Vercel pour en changer sans redeployer. */
export const MODEL = 'claude-opus-5-5'
/* Le repli cote serveur: si le modele refuse le document pour une raison de
   politique, la requete est rejouee sur le modele de repli et la reponse le
   dit (bloc `fallback`), ce que l'ecran repete en une ligne. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const MAX_OUTPUT = 16000

function admin() {
  return createClient(env('supabaseUrl'), env('serviceRole'), { auth: { persistSession: false } })
}

/**
 * La consigne. En anglais parce que c'est la langue ou le modele lit le
 * mieux une consigne, et elle dit de garder les titres dans la langue du
 * document.
 */
export function systemPrompt(today, locale) {
  const lang = locale === 'en' ? 'English' : 'French'
  return [
    'You read a college or university course syllabus (a PDF) and return, as JSON matching the schema, everything that belongs on a student\'s calendar and to-do list.',
    `Today is ${today}. The student reads ${lang}; keep every title in the language of the document, short (under 60 characters), and do not repeat the course code in each title.`,
    '',
    'Rules:',
    '- sessions: every weekly meeting (lecture, lab, tutorial, seminar). weekdays are integers 0 to 6 with 0 = Sunday. Times are 24h HH:MM. If the syllabus gives the first and last day of classes, put them in term and leave each session\'s from/until null unless it differs.',
    '- deadlines: every dated exam, quiz, assignment, project, presentation and required reading, with its date as YYYY-MM-DD. When only a week number is printed, compute the date from the term start and the session weekday; when that is impossible, leave the item out rather than guess. Put the weight as a percent of the final grade when printed, else null. steps holds only sub-parts the syllabus itself names for that item (proposal, draft, final), at most six.',
    '- Resolve years from the term. Never output a date before the term start when a term is given.',
    '- Do not invent anything that is not in the document. Leave out office hours, policies, grading scales and reading lists without dates.',
  ].join('\n')
}

/**
 * 'not_pdf' | 'too_big' | null. Le corps est du base64; les huit premiers
 * caracteres decodent les six premiers octets, et un PDF commence par
 * %PDF. La taille est comparee en base64, qui pese quatre tiers.
 */
export function pdfBytesProblem(base64) {
  if (typeof base64 !== 'string' || base64.length < 8) return 'not_pdf'
  if (base64.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4) return 'too_big'
  let head = ''
  try {
    head = Buffer.from(base64.slice(0, 8), 'base64').toString('latin1')
  } catch {
    return 'not_pdf'
  }
  return head.startsWith('%PDF') ? null : 'not_pdf'
}

/**
 * L'appel au modele, avec le client en parametre pour que le test passe un
 * faux: il n'y a pas de cle dans le conteneur de test et il ne doit pas y
 * en avoir. Rend { plan, model, fallback } ou { error: <mot-code> }.
 */
export async function analyse(pdf, { today, locale = 'fr', client, model = env('syllabusModel') || MODEL } = {}) {
  const stream = client.beta.messages.stream({
    model,
    max_tokens: MAX_OUTPUT,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: systemPrompt(today, locale),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf }, title: 'syllabus.pdf' },
          { type: 'text', text: 'Extract the weekly sessions and every dated deadline of this syllabus.' },
        ],
      },
    ],
    output_config: { effort: 'medium', format: jsonSchemaOutputFormat(PLAN_SCHEMA) },
  })
  const msg = await stream.finalMessage()

  if (msg.stop_reason === 'refusal') return { error: 'refused' }
  if (msg.stop_reason === 'max_tokens') return { error: 'model_failed' }

  let raw = msg.parsed_output ?? null
  if (!raw) {
    const text = (msg.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
    try {
      raw = JSON.parse(text)
    } catch {
      return { error: 'model_failed' }
    }
  }
  const fallback = (msg.content ?? []).some((b) => b.type === 'fallback')
  return { plan: normalisePlan(raw, { today }), model: msg.model ?? model, fallback }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method' })
  }
  const missing = missingEnv(['supabaseUrl', 'serviceRole'])
  if (missing.length > 0) return res.status(503).json({ error: 'setup', missing })
  /* Presence seulement. La valeur d'une cle n'entre dans aucune reponse. */
  if (!env('anthropicKey')) return res.status(503).json({ error: 'no_key', missing: ['ANTHROPIC_API_KEY'] })

  const db = admin()
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = token ? await db.auth.getUser(token) : { data: null }
  if (!userData?.user) return res.status(401).json({ error: 'unauthorized' })

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    body = {}
  }
  const problem = pdfBytesProblem(body.pdf)
  if (problem) return res.status(problem === 'too_big' ? 413 : 400).json({ error: problem })

  const today = isoDate(body.today) ?? new Date().toISOString().slice(0, 10)
  const locale = body.locale === 'en' ? 'en' : 'fr'
  const client = new Anthropic({ apiKey: env('anthropicKey') })

  let out
  try {
    out = await analyse(body.pdf, { today, locale, client })
  } catch (err) {
    console.error(`syllabus: model call failed: ${err?.status ?? '-'} ${err?.name ?? 'Error'}`)
    if (err?.status === 429) return res.status(429).json({ error: 'busy' })
    if (err?.status === 401 || err?.status === 403) return res.status(503).json({ error: 'no_key' })
    return res.status(502).json({ error: 'model_failed' })
  }
  if (out.error) return res.status(out.error === 'refused' ? 422 : 502).json({ error: out.error })
  return res.status(200).json({ plan: out.plan, model: out.model, fallback: out.fallback })
}
