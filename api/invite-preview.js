import { env } from './_env.js'

/**
 * L'APERCU D'UN LIEN D'INVITATION, POUR LES MESSAGERIES.
 *
 *   "The link is not intelligent [...] the link does not lead you to any
 *    page."
 *
 * Colle dans WhatsApp, iMessage, Instagram ou Telegram, un lien
 * richandfriends.xyz/join/CODE affichait l'apercu de la page d'accueil: le
 * site est une seule page, index.html, et ces robots ne lancent pas le
 * JavaScript qui dit ensuite de quel groupe il s'agit. Rien dans l'apercu ne
 * disait "une invitation", encore moins a quoi.
 *
 * vercel.json envoie ici /join/CODE et /rejoindre/CODE pour les seuls robots
 * d'apercu, reconnus a leur agent utilisateur. Les personnes, elles, recoivent
 * l'app comme avant: rien de plus lent, et rien ne casse pour elles si cette
 * fonction tombe.
 *
 * CE QUE L'APERCU DIT, ET A QUI.
 *
 * Les memes regles que la page (invite_preview, migration 77), lues sans
 * session, donc comme un inconnu: le nom pour un groupe defi, fait pour etre
 * publie; pour un groupe prive, "une invitation" et le nombre de personnes,
 * sans le nom. Sinon un lien devine au hasard lirait le nom de groupes prives.
 */

const ORIGIN = 'https://richandfriends.xyz'
const IMAGE = `${ORIGIN}/brand/wordmark-pink.png`

const COPY = {
  fr: {
    named: (name) => `Rejoins « ${name} » sur Rich & Friends`,
    unnamed: 'Une invitation à rejoindre un groupe sur Rich & Friends',
    members: (n) => (n === 1 ? '1 personne déjà dedans' : `${n} personnes déjà dedans`),
    challenge: 'un point par jour pendant 21 jours',
    each: 'Chaque matin',
    group: 'Un point par jour, au même moment, avec les mêmes personnes.',
    missing: 'Ce lien d’invitation ne marche plus',
    missingBody: 'Le groupe a peut-être un nouveau code. Demande un nouveau lien à la personne qui te l’a envoyé.',
    open: 'Ouvrir l’invitation',
  },
  en: {
    named: (name) => `Join “${name}” on Rich & Friends`,
    unnamed: 'An invitation to join a group on Rich & Friends',
    members: (n) => (n === 1 ? '1 person already in' : `${n} people already in`),
    challenge: 'one check-in a day for 21 days',
    each: 'Every morning',
    group: 'One check-in a day, at the same time, with the same people.',
    missing: 'This invitation link no longer works',
    missingBody: 'The group may have a new code. Ask whoever sent it for a new link.',
    open: 'Open the invitation',
  },
}

/** Le meme filtre que cleanCode dans src/lib/pendingJoin.js. */
export function cleanCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase()
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** La langue de l'apercu: le francais, sauf si le robot demande l'anglais d'abord. */
export function previewLocale(acceptLanguage) {
  const first = String(acceptLanguage ?? '').split(',')[0].trim().toLowerCase()
  return first.startsWith('en') ? 'en' : 'fr'
}

/**
 * Le titre et la description. Pur, pour npm test.
 *
 * preview: la ligne de invite_preview (ou null si le code n'existe pas),
 * goals: les titres de invite_goals (defis seulement).
 */
export function previewText(preview, goals, locale = 'fr') {
  const c = COPY[locale] ?? COPY.fr
  if (!preview) return { title: c.missing, description: c.missingBody }
  const name = typeof preview.name === 'string' && preview.name.trim() ? preview.name.trim() : null
  const title = name ? c.named(name) : c.unnamed
  const n = Number(preview.members) || 0
  const parts = [n > 0 ? c.members(n) : null, preview.challenge ? c.challenge : null].filter(Boolean)
  let description = parts.length ? `${parts.join(' · ')}.` : ''
  const list = (goals ?? []).map((g) => String(g ?? '').trim()).filter(Boolean)
  if (preview.challenge && list.length) description += ` ${c.each}${locale === 'fr' ? '\u202f:' : ':'} ${list.join(', ')}.`
  else if (!preview.challenge) description += ` ${c.group}`
  description = description.trim()
  if (description.length > 300) description = `${description.slice(0, 297).trimEnd()}…`
  return { title, description }
}

/** La page: des balises pour le robot, un lien pour un humain qui tomberait dessus. */
export function previewHtml({ code, title, description, locale = 'fr' }) {
  const c = COPY[locale] ?? COPY.fr
  const url = `${ORIGIN}/join/${encodeURIComponent(code)}`
  const fallback = `/start?join=${encodeURIComponent(code)}`
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Rich &amp; Friends" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${IMAGE}" />
<meta property="og:image:alt" content="Rich &amp; Friends" />
<meta property="og:locale" content="${locale === 'en' ? 'en_GB' : 'fr_FR'}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${IMAGE}" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${escapeHtml(fallback)}">${escapeHtml(c.open)}</a></p>
<script>location.replace(${JSON.stringify(fallback)})</script>
</body>
</html>`
}

/** Un appel a la base, coupe court: un apercu lent ne s'affiche pas du tout. */
async function rpc(name, body) {
  const url = env('supabaseUrl')
  const key = env('supabaseAnon')
  if (!url || !key) throw new Error('not configured')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${name} ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  const code = cleanCode(req.query?.code)
  const locale = previewLocale(req.headers?.['accept-language'])
  if (!code) {
    res.statusCode = 302
    res.setHeader('Location', '/')
    return res.end()
  }

  let preview = null
  let goals = []
  let known = true
  try {
    const rows = await rpc('invite_preview', { p_code: code })
    preview = Array.isArray(rows) ? rows[0] ?? null : null
    if (preview?.challenge) {
      const g = await rpc('invite_goals', { p_code: code }).catch(() => [])
      goals = (Array.isArray(g) ? g : []).map((r) => r?.title)
    }
  } catch {
    /* La base ne repond pas: un apercu generique d'invitation plutot que
       "ce lien ne marche plus", qui serait faux. */
    known = false
  }

  const { title, description } = known
    ? previewText(preview, goals, locale)
    : previewText({ name: null, members: 0, challenge: null }, [], locale)

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
  res.setHeader('X-Robots-Tag', 'noindex')
  return res.end(previewHtml({ code, title, description, locale }))
}
