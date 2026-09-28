import { dayKey, fromKey, addDays, daysBetween } from './cycle.js'
import { LAYER_COLOUR } from './agenda.js'

/**
 * Les calendriers Google et Outlook branches sur le sien.
 *
 *   "add an option into the app to link google calendar or outlook"
 *
 * Ce fichier tient les trois choses que le navigateur et l'API doivent dire
 * pareil: a quoi une adresse de flux a le droit de ressembler, de quel
 * fournisseur elle vient, et comment une ligne de feed_event devient une
 * entree que la page du calendrier sait deja dessiner. Meme forme que
 * bookings.js, pour la meme raison.
 */

/** Combien de calendriers une personne peut brancher. La base tient le meme chiffre. */
export const FEED_LIMIT = 5

/** Au bout de combien de temps la page relit un flux sans qu'on lui demande. */
export const FEED_STALE_MS = 30 * 60 * 1000

/**
 * Ce qui ne va pas dans une adresse, ou null si elle est bonne.
 *
 * PARTAGE ENTRE LE NAVIGATEUR ET L'API, ET C'EST L'API QUI COMPTE. Le
 * navigateur s'en sert pour dire tout de suite "ce n'est pas une adresse de
 * calendrier"; l'API s'en sert pour REFUSER d'aller la chercher. Une fonction
 * Vercel qui va chercher l'URL qu'on lui donne est une fonction qui, sans
 * ceci, irait chercher http://169.254.169.254/ ou http://localhost:5432/ pour
 * qui le lui demande. Donc: https seulement, un vrai nom d'hote avec un
 * point, jamais une adresse IP, jamais un nom local.
 *
 *   'scheme'   pas https
 *   'host'     une IP, localhost, un nom sans point, un domaine interne
 *   'shape'    pas une URL du tout, ou trop longue
 */
export function feedUrlProblem(raw) {
  const s = String(raw ?? '').trim()
  if (!s || s.length > 2000) return 'shape'
  let u
  try {
    u = new URL(s)
  } catch {
    return 'shape'
  }
  if (u.protocol !== 'https:') return 'scheme'
  if (u.username || u.password) return 'host'
  const host = u.hostname.toLowerCase()
  if (!host || host.startsWith('[') || /^[\d.]+$/.test(host)) return 'host'
  if (!host.includes('.')) return 'host'
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet|localdomain|arpa)$/.test(host)) return 'host'
  return null
}

/**
 * D'ou vient ce flux, d'apres son hote. 'ics' pour tout ce qui n'est ni l'un
 * ni l'autre (Apple, Proton, une ecole), qui est lu exactement pareil: le
 * fournisseur ne sert qu'a l'etiquette et au petit mode d'emploi.
 */
export function providerOf(raw) {
  let host = ''
  try {
    host = new URL(String(raw ?? '').trim()).hostname.toLowerCase()
  } catch {
    return 'ics'
  }
  if (/(^|\.)google\.com$/.test(host) || /(^|\.)googleapis\.com$/.test(host)) return 'google'
  if (/(^|\.)(outlook\.(live|office|office365)\.com|outlook\.com|office\.com|live\.com|sharepoint\.com)$/.test(host)) return 'outlook'
  return 'ics'
}

/** L'hote, pour nommer un flux sans nom. Jamais le chemin: c'est lui qui est secret. */
export function hostOf(raw) {
  try {
    return new URL(String(raw ?? '').trim()).hostname
  } catch {
    return ''
  }
}

/** Les flux qui meritent une relecture: jamais lus, ou lus il y a trop longtemps. */
export function staleFeeds(feeds, now = Date.now()) {
  return (feeds ?? []).filter((f) => {
    const t = f?.checked_at ? Date.parse(f.checked_at) : NaN
    return Number.isNaN(t) || now - t > FEED_STALE_MS
  })
}

/**
 * Demander a l'API de relire les flux. Le jeton de session part en Bearer,
 * comme pour les achats et les banques: l'API relit la ligne calendar_feed
 * elle-meme, et l'URL secrete ne remonte jamais dans la reponse.
 *
 * Retourne le rapport, ou null si rien n'a pu etre demande. Un echec ici
 * n'est pas une erreur pour la page: les evenements deja en base restent
 * affiches.
 */
export async function syncFeeds(supabase, { feedId = null, force = false, origin = '' } = {}) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return null
    const res = await fetch(`${origin}/api/calendar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...(feedId ? { feed_id: feedId } : {}), ...(force ? { force: true } : {}) }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, status: res.status, error: json?.error ?? 'failed', feeds: json?.feeds ?? [] }
    return { ok: true, ...(json ?? {}) }
  } catch {
    return null
  }
}

function minutesLocales(d) {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Les lignes de feed_event, en entrees de calendrier, pour la plage affichee.
 *
 * Deux formes de ligne, et la meme raison qu'entre booking et calendar_event:
 *   - une heure est un INSTANT (starts_at), lu dans le fuseau de l'appareil,
 *     comme les reservations;
 *   - une journee entiere est une DATE (starts_on), et une date n'a pas de
 *     fuseau: un anniversaire le 3 est le 3 partout. La lire comme un instant
 *     l'aurait fait glisser au 2 a l'ouest de Greenwich.
 * Une journee entiere qui dure plusieurs jours fait une entree par jour, parce
 * que la grille de cette application est une journee.
 *
 * `feeds` sert a nommer la source de chaque entree, ce qui est le signal qui
 * n'est pas une couleur (1.4.1): la liste du jour ecrit "Google Calendar" a
 * cote de l'heure.
 */
export function feedEntries(rows, feeds = [], from = null, to = null) {
  const byId = new Map((feeds ?? []).map((f) => [f.id, f]))
  const out = []
  for (const row of rows ?? []) {
    if (!row?.id) continue
    const feed = byId.get(row.feed_id)
    const provider = feed?.provider ?? 'ics'
    const titre = String(row.title ?? '').trim()
    const base = {
      feedOf: row.feed_id,
      source: provider,
      sourceLabel: feed?.label || null,
      href: /^https?:\/\//i.test(String(row.url ?? '')) ? String(row.url) : null,
      title: titre,
      category: 'externe',
      colour: LAYER_COLOUR.externes,
      weekdays: [],
      until_on: null,
      location: row.location || null,
      excluded_on: [],
    }

    if (row.all_day) {
      const first = fromKey(row.starts_on)
      if (!first) continue
      const endEx = fromKey(row.ends_on)
      const n = endEx ? Math.max(1, daysBetween(first, endEx)) : 1
      for (let i = 0; i < n && i < 62; i += 1) {
        const d = addDays(first, i)
        if (from && daysBetween(from, d) < 0) continue
        if (to && daysBetween(d, to) < 0) continue
        out.push({ ...base, id: `feed:${row.id}:${i}`, starts_on: dayKey(d), start_min: null, end_min: null })
      }
      continue
    }

    const debut = new Date(row.starts_at)
    const fin = new Date(row.ends_at)
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) continue
    /* Par JOUR, pas par instant: `to` est le dernier jour affiche, a minuit,
       et un cours de 9h ce jour-la est APRES minuit. Compare en instants, la
       vue du jour ne montrait rien alors que la semaine le montrait. */
    if (from && daysBetween(from, debut) < 0) continue
    if (to && daysBetween(debut, to) < 0) continue
    const memeJour = dayKey(debut) === dayKey(fin)
    const finMin = memeJour ? minutesLocales(fin) : 1440
    out.push({
      ...base,
      id: `feed:${row.id}`,
      starts_on: dayKey(debut),
      start_min: minutesLocales(debut),
      end_min: Math.max(minutesLocales(debut) + 1, finMin),
    })
  }
  return out
}
