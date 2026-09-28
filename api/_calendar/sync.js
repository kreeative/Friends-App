import { createClient } from '@supabase/supabase-js'
import { env, missingEnv } from '../_env.js'
import { expandCalendar, looksLikeIcs } from '../../src/lib/ics.js'
import { feedUrlProblem } from '../../src/lib/feeds.js'

/**
 * Relire les calendriers Google et Outlook branches, et poser leurs
 * occurrences dans feed_event.
 *
 *   "add an option into the app to link google calendar or outlook"
 *
 * POURQUOI COTE SERVEUR. L'adresse secrete de Google ne repond pas aux
 * requetes venues d'une page web (pas de CORS), et c'est heureux: elle ne
 * devrait pas avoir a voyager dans un navigateur a chaque ouverture du
 * calendrier. Elle est lue ici, avec la cle service_role, et le navigateur ne
 * recoit que le compte des evenements et un mot-code s'il y a eu une panne.
 *
 * QUI. Le jeton de session en Bearer, comme pour les achats et les banques.
 * Il n'y a pas de chemin anonyme: on relit LES flux de la personne qui
 * appelle, jamais un flux nomme par son id seul.
 *
 * L'ADRESSE NE SORT JAMAIS. Ni dans une reponse, ni dans le journal, ni dans
 * un message d'erreur. feedUrlProblem() est verifie ici AVANT d'aller
 * chercher quoi que ce soit, parce qu'une fonction qui va chercher l'URL
 * qu'on lui donne irait sinon chercher http://localhost:5432/ pour qui le lui
 * demande. Les redirections sont suivies a la main, et chaque saut repasse
 * par la meme verification.
 */

const WINDOW_BACK_DAYS = 60
const WINDOW_AHEAD_DAYS = 400
const MAX_BYTES = 5 * 1024 * 1024
const FETCH_MS = 12000
/* Deux lectures du meme flux a moins d'une minute d'ecart n'apportent rien,
   et un bouton "Actualiser" martele coute une lecture chez Google a chaque
   coup. */
const MIN_GAP_MS = 60 * 1000
const CAP_PER_FEED = 3000

function admin() {
  return createClient(env('supabaseUrl'), env('serviceRole'), { auth: { persistSession: false } })
}

/**
 * Aller chercher le texte d'un flux.
 *
 * Retourne { text } ou { error: <mot-code> }. Les mots-codes sont ceux que
 * l'ecran sait traduire: bad_url, unreachable, timeout, http_401, http_403,
 * http_404, http_other, not_ics, too_big.
 */
export async function fetchIcs(url, { fetchImpl = fetch, hops = 0 } = {}) {
  if (feedUrlProblem(url)) return { error: 'bad_url' }
  if (hops > 3) return { error: 'unreachable' }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), FETCH_MS)
  let res
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: ctl.signal,
      headers: { accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'user-agent': 'RichAndFriends-Calendar/1.0' },
    })
  } catch (err) {
    clearTimeout(timer)
    return { error: err?.name === 'AbortError' ? 'timeout' : 'unreachable' }
  }
  clearTimeout(timer)

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location')
    if (!loc) return { error: 'unreachable' }
    let next
    try {
      next = new URL(loc, url).toString()
    } catch {
      return { error: 'bad_url' }
    }
    return fetchIcs(next, { fetchImpl, hops: hops + 1 })
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) return { error: `http_${res.status}` }
  if (!res.ok) return { error: 'http_other' }

  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES) return { error: 'too_big' }
  const text = await res.text()
  if (text.length > MAX_BYTES) return { error: 'too_big' }
  if (!looksLikeIcs(text)) return { error: 'not_ics' }
  return { text }
}

/**
 * Une ligne feed_event a partir d'une occurrence depliee. Le titre vide
 * devient "(sans titre)": Google en produit pour un evenement sans nom, et
 * une puce sans texte sur la grille est une puce qu'on ne peut pas nommer
 * pour dire qu'elle est de trop.
 */
export function rowOf(occ, feed) {
  return {
    feed_id: feed.id,
    user_id: feed.user_id,
    uid: String(occ.key).slice(0, 300),
    title: (occ.title || '(sans titre)').slice(0, 200),
    location: occ.location,
    url: occ.url,
    all_day: Boolean(occ.allDay),
    starts_at: occ.startsAt,
    ends_at: occ.endsAt,
    starts_on: occ.startsOn,
    ends_on: occ.endsOn,
  }
}

async function syncOne(db, feed, zone, now, { fetchImpl } = {}) {
  const got = await fetchIcs(feed.url, { fetchImpl })
  const checked = new Date(now).toISOString()
  if (got.error) {
    await db.from('calendar_feed').update({ checked_at: checked, last_error: got.error }).eq('id', feed.id)
    console.error(`feed-sync: feed ${feed.id} failed: ${got.error}`)
    return { id: feed.id, ok: false, error: got.error }
  }

  const from = now - WINDOW_BACK_DAYS * 86400000
  const to = now + WINDOW_AHEAD_DAYS * 86400000
  let occurrences
  try {
    occurrences = expandCalendar(got.text, from, to, { fallbackZone: zone, cap: CAP_PER_FEED })
  } catch (err) {
    await db.from('calendar_feed').update({ checked_at: checked, last_error: 'not_ics' }).eq('id', feed.id)
    console.error(`feed-sync: feed ${feed.id} could not be parsed: ${err?.message ?? err}`)
    return { id: feed.id, ok: false, error: 'not_ics' }
  }

  /* Remplacer, pas fusionner. Un evenement supprime chez Google doit
     disparaitre ici, et la seule facon sure de le savoir est de repartir de
     ce que le flux dit aujourd'hui. Les lignes sont petites et la fenetre
     est bornee, donc c'est bon marche. */
  const { error: delErr } = await db.from('feed_event').delete().eq('feed_id', feed.id)
  if (delErr) {
    console.error(`feed-sync: feed ${feed.id} clear failed: ${delErr.message}`)
    return { id: feed.id, ok: false, error: 'db' }
  }
  const rows = occurrences.map((o) => rowOf(o, feed))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('feed_event').insert(rows.slice(i, i + 500))
    if (error) {
      console.error(`feed-sync: feed ${feed.id} insert failed: ${error.message}`)
      await db.from('calendar_feed').update({ checked_at: checked, last_error: 'db' }).eq('id', feed.id)
      return { id: feed.id, ok: false, error: 'db' }
    }
  }
  await db.from('calendar_feed')
    .update({ checked_at: checked, last_sync_at: checked, last_error: null, event_count: rows.length })
    .eq('id', feed.id)
  return { id: feed.id, ok: true, events: rows.length }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const missing = missingEnv(['supabaseUrl', 'serviceRole'])
  if (missing.length > 0) {
    return res.status(503).json({ error: `Calendar sync is not set up yet. Missing from the Vercel environment: ${missing.join(', ')}.`, missing })
  }

  const db = admin()
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = token ? await db.auth.getUser(token) : { data: null }
  const user = userData?.user ?? null
  if (!user) return res.status(401).json({ error: 'Sign in first.' })

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    body = {}
  }
  const feedId = typeof body.feed_id === 'string' ? body.feed_id : null
  const force = body.force === true

  /* LES flux de qui appelle. Le filtre user_id est ici la regle, pas une
     repetition de RLS: ce client porte la cle service_role et RLS ne le
     regarde pas. */
  let q = db.from('calendar_feed').select('id, user_id, url, checked_at').eq('user_id', user.id)
  if (feedId) q = q.eq('id', feedId)
  const { data: feeds, error: feedsErr } = await q
  if (feedsErr) {
    console.error('feed-sync: reading calendar_feed failed', feedsErr.message)
    return res.status(500).json({ error: 'Could not read your linked calendars. If this names a missing table, run supabase/73_calendar_feeds.sql.' })
  }

  const { data: profile } = await db.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const zone = profile?.timezone || 'UTC'
  const now = Date.now()

  const report = []
  for (const feed of feeds ?? []) {
    const last = feed.checked_at ? Date.parse(feed.checked_at) : NaN
    if (!force && !Number.isNaN(last) && now - last < MIN_GAP_MS) {
      report.push({ id: feed.id, ok: true, skipped: 'recent' })
      continue
    }
    report.push(await syncOne(db, feed, zone, now))
  }
  return res.status(200).json({ feeds: report })
}
