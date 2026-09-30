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
const MAX_OUTPUT = 16000

/**
 * Le message de l'API, bon a journaliser et a montrer.
 *
 * Le premier essai en production a rendu huit fois "400 Error" et rien
 * d'autre, parce que ce fichier ne journalisait que le statut et le nom, de
 * peur que le message cite la requete. Il ne cite jamais le document: un
 * 400 d'Anthropic nomme le parametre refuse, et c'est exactement ce qu'il
 * fallait lire. Ce qui pourrait ressembler a du base64 (80 caracteres et
 * plus d'un seul tenant) est tout de meme remplace, et le reste est coupe
 * a 300 caracteres.
 */
export function apiMessage(err) {
  const raw = err?.error?.error?.message ?? err?.error?.message ?? err?.message ?? ''
  return String(raw).replace(/[A-Za-z0-9+/=]{80,}/g, '[base64]').replace(/\s+/g, ' ').slice(0, 300)
}

/**
 * Ce que le handler repond quand l'appel au modele a leve: le statut HTTP
 * pour nous, le mot-code pour l'ecran, et la phrase de l'API en detail.
 *
 * Le cas "workspace" a son propre mot-code parce qu'il a sa propre
 * solution, et qu'elle n'est pas dans le code: une cle creee hors de tout
 * espace de travail exige l'en-tete anthropic-workspace-id, donc soit on
 * pose ANTHROPIC_WORKSPACE_ID dans Vercel, soit on cree la cle dans un
 * espace. Un "la lecture a echoue" n'aurait jamais mene la.
 */
export function failureOf(err) {
  const detail = apiMessage(err)
  const status = err?.status
  if (status === 429) return { status: 429, error: 'busy', detail }
  if (status === 401 || status === 403) return { status: 503, error: 'no_key', detail }
  if (status === 400 && /workspace/i.test(detail)) return { status: 503, error: 'no_workspace', detail }
  if (status === 404) return { status: 502, error: 'model_failed', detail: `model not available: ${detail}` }
  return { status: 502, error: 'model_failed', detail }
}

/** Le client, avec l'en-tete d'espace de travail quand la cle en a besoin. */
export function makeClient({ apiKey, workspace } = {}) {
  return new Anthropic({
    apiKey,
    ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
  })
}

/* Le JSON dans une reponse qui n'est pas contrainte: la premiere accolade
   a la derniere, ce qui passe par-dessus une phrase avant et une cloture de
   bloc de code apres. */
function looseJson(text) {
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try {
    return JSON.parse(text.slice(s, e + 1))
  } catch {
    return null
  }
}

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
 * en avoir. Rend { plan, model, strict } ou { error: <mot-code>, detail }.
 *
 * DEUX ESSAIS, LE STRICT PUIS LE SOUPLE.
 *
 * Le premier demande la sortie contrainte par le schema. Si l'API refuse la
 * requete (400), le second redemande la meme chose sans le schema, avec la
 * consigne de ne rendre que le JSON, et le lit entre la premiere et la
 * derniere accolade. normalisePlan() ne croit de toute facon aucun champ,
 * donc la reponse souple vaut la stricte une fois relue. Le message du
 * premier refus est journalise et rendu dans `note`, pour qu'on sache ce
 * que l'API n'a pas voulu plutot que de le deviner depuis un conteneur
 * sans cle.
 *
 * La requete est volontairement la forme la plus courante de l'API: le
 * document, une phrase, le schema. Pas de repli cote serveur ni d'en-tete
 * beta: les huit premiers appels en production ont tous ete refuses en 400,
 * et chaque option de moins est une cause de moins.
 */
export async function analyse(pdf, { today, locale = 'fr', client, model = env('syllabusModel') || MODEL } = {}) {
  const system = systemPrompt(today, locale)
  const base = {
    model,
    max_tokens: MAX_OUTPUT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
          { type: 'text', text: 'Extract the weekly sessions and every dated deadline of this syllabus.' },
        ],
      },
    ],
  }

  let msg
  let strict = true
  let note = null
  try {
    msg = await client.messages
      .stream({ ...base, system, output_config: { effort: 'medium', format: jsonSchemaOutputFormat(PLAN_SCHEMA) } })
      .finalMessage()
  } catch (err) {
    if (err?.status !== 400) throw err
    note = apiMessage(err)
    console.error(`syllabus: strict format refused (400): ${note}`)
    strict = false
    msg = await client.messages
      .stream({
        ...base,
        system: `${system}\nAnswer with the JSON object only: no prose before or after it, no code fence.`,
        output_config: { effort: 'medium' },
      })
      .finalMessage()
  }

  if (msg.stop_reason === 'refusal') return { error: 'refused', detail: note }
  if (msg.stop_reason === 'max_tokens') return { error: 'model_failed', detail: 'max_tokens' }

  let raw = msg.parsed_output ?? null
  if (!raw) {
    const text = (msg.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
    raw = looseJson(text)
    if (!raw) return { error: 'model_failed', detail: note ?? 'no JSON in the answer' }
  }
  return { plan: normalisePlan(raw, { today }), model: msg.model ?? model, strict, note }
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
  const client = makeClient({ apiKey: env('anthropicKey'), workspace: env('anthropicWorkspace') })

  let out
  try {
    out = await analyse(body.pdf, { today, locale, client })
  } catch (err) {
    /* Le statut, le nom et le message de l'API, nettoye par apiMessage():
       jamais le PDF, jamais la cle. Le meme texte part a l'ecran en
       `detail`, parce qu'un "la lecture a echoue" sans raison a deja coute
       huit essais a l'aveugle. */
    const failure = failureOf(err)
    console.error(`syllabus: model call failed: ${err?.status ?? '-'} ${err?.name ?? 'Error'}: ${failure.detail}`)
    return res.status(failure.status).json({ error: failure.error, detail: failure.detail })
  }
  if (out.error) return res.status(out.error === 'refused' ? 422 : 502).json({ error: out.error, detail: out.detail ?? null })
  return res.status(200).json({ plan: out.plan, model: out.model, strict: out.strict, note: out.note })
}
